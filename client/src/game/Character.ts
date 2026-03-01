import * as PIXI from "pixi.js";

import type { GridType, IGridPos } from "../common/types";

import { findPath, isWalkable } from "./PathFinder";
import { PLAYGROUND, CHARACTER } from "./common/configs/game.config";
import { isoToScreen, inBounds } from "./common/helpers/grid.helpers";

import {
  CHAR_SOUTH,
  CHAR_SOUTH_EAST,
  CHAR_EAST,
  CHAR_NORTH_EAST,
  CHAR_NORTH,
  CHAR_NORTH_WEST,
  CHAR_WEST,
  CHAR_SOUTH_WEST,
  CHAR_WALK_SOUTH,
  CHAR_WALK_SOUTH_EAST,
  CHAR_WALK_EAST,
  CHAR_WALK_NORTH_EAST,
  CHAR_WALK_NORTH,
  CHAR_WALK_NORTH_WEST,
  CHAR_WALK_WEST,
  CHAR_WALK_SOUTH_WEST,
  CHAR_PICKUP_SOUTH,
} from "./common/utils/texture-loader.util";

const WALK_FRAME_COUNT = 6;
const PICKUP_FRAME_COUNT = 5;
const SPRITE_SCALE = 1;
const SPRITE_FEET_OFFSET_Y = 12;

type FacingDirType =
  | "down"
  | "up"
  | "right"
  | "left"
  | "down-right"
  | "down-left"
  | "up-right"
  | "up-left";

const stillAliasFor: Record<FacingDirType, string> = {
  down: CHAR_SOUTH,
  up: CHAR_NORTH,
  right: CHAR_EAST,
  left: CHAR_WEST,
  "down-right": CHAR_SOUTH_EAST,
  "down-left": CHAR_SOUTH_WEST,
  "up-right": CHAR_NORTH_EAST,
  "up-left": CHAR_NORTH_WEST,
};

const walkPrefixFor: Record<FacingDirType, string> = {
  down: CHAR_WALK_SOUTH,
  up: CHAR_WALK_NORTH,
  right: CHAR_WALK_EAST,
  left: CHAR_WALK_WEST,
  "down-right": CHAR_WALK_SOUTH_EAST,
  "down-left": CHAR_WALK_SOUTH_WEST,
  "up-right": CHAR_WALK_NORTH_EAST,
  "up-left": CHAR_WALK_NORTH_WEST,
};

function facingFromDelta(dx: number, dy: number): FacingDirType {
  if (dx > 0 && dy > 0) return "down";
  if (dx < 0 && dy < 0) return "up";
  if (dx > 0 && dy < 0) return "right";
  if (dx < 0 && dy > 0) return "left";
  if (dx > 0) return "down-right";
  if (dx < 0) return "up-left";
  if (dy > 0) return "down-left";
  if (dy < 0) return "up-right";
  return "down";
}

function getTexSafe(alias: string): PIXI.Texture | null {
  try {
    const t = PIXI.Assets.get<PIXI.Texture>(alias) ?? PIXI.Cache.get(alias);
    return t ?? null;
  } catch {
    return null;
  }
}

export class Character {
  private gx: number;
  private gy: number;
  private px: number;
  private py: number;

  private path: IGridPos[] = [];
  private pathIndex = 0;

  private walkCycle = 0;
  private facing: FacingDirType = "down";
  private isMoving = false;
  private isPhasing = false;

  private isWorking = false;
  private workTimer = 0;
  private workTotal = 0;
  private workCycle = 0;
  private onWorkDone: (() => void) | null = null;

  private pendingWork: { duration: number; onDone: () => void } | null = null;

  readonly container: PIXI.Container;
  private sprite: PIXI.Sprite;
  private shadowGfx: PIXI.Graphics;
  private progressGfx: PIXI.Graphics;

  constructor(startX: number, startY: number) {
    this.gx = startX;
    this.gy = startY;

    const screen = isoToScreen(startX, startY);
    this.px = screen.x;
    this.py = screen.y;

    this.container = new PIXI.Container();

    this.shadowGfx = new PIXI.Graphics();
    this.container.addChild(this.shadowGfx);

    this.sprite = new PIXI.Sprite();
    this.sprite.anchor.set(0.5, 1);
    this.sprite.y = SPRITE_FEET_OFFSET_Y;
    this.sprite.scale.set(SPRITE_SCALE);
    this.sprite.roundPixels = true;
    this.container.addChild(this.sprite);

    this.progressGfx = new PIXI.Graphics();
    this.container.addChild(this.progressGfx);

    this.applyIdleFrame();
    this.updateContainerPosition();
    this.updateZSort();
  }

  get tileX() {
    return Math.round(this.gx);
  }
  get tileY() {
    return Math.round(this.gy);
  }
  get busy() {
    return this.isMoving || this.isWorking || this.pendingWork !== null;
  }

  get workProgress(): number {
    if (!this.isWorking || this.workTotal === 0) return 0;
    return 1 - this.workTimer / this.workTotal;
  }

  get working(): boolean {
    return this.isWorking;
  }

  moveTo(grid: GridType, tx: number, ty: number): void {
    if (!inBounds(tx, ty)) return;

    const path = findPath(
      grid,
      { x: this.tileX, y: this.tileY },
      { x: tx, y: ty },
      true,
    );

    if (!path || path.length <= 1) return;

    this.path = path;
    this.pathIndex = 1;
    this.isMoving = true;
    this.isPhasing = false;
  }

  goWorkAt(
    grid: GridType,
    tx: number,
    ty: number,
    duration: number,
    onDone: () => void,
  ): void {
    this.pendingWork = null;

    const path = findPath(
      grid,
      { x: this.tileX, y: this.tileY },
      { x: tx, y: ty },
      true,
    );

    if (!path || path.length <= 1) {
      this.beginWork(duration, onDone);
      return;
    }

    this.path = path;
    this.pathIndex = 1;
    this.isMoving = true;
    this.isPhasing = false;
    this.pendingWork = { duration, onDone };
  }

  cancelWork(): void {
    this.isMoving = false;
    this.isWorking = false;
    this.pendingWork = null;
    this.onWorkDone = null;
    this.path = [];
    this.pathIndex = 0;
    this.workCycle = 0;
    this.progressGfx.clear();
    this.applyIdleFrame();
  }

  update(dt: number, grid: GridType): void {
    if (this.isWorking) {
      this.workTimer -= dt;
      this.workCycle = (this.workCycle + dt * PICKUP_FRAME_COUNT * 0.4) % 1;

      if (this.workTimer <= 0) {
        this.isWorking = false;
        this.workCycle = 0;
        this.progressGfx.clear();

        const cb = this.onWorkDone;
        this.onWorkDone = null;
        cb?.();

        this.applyIdleFrame();
      } else {
        this.applyWorkFrame();
        this.drawProgress();
      }
      return;
    }

    if (this.isMoving && this.pathIndex < this.path.length) {
      const target = this.path[this.pathIndex];

      this.isPhasing = !isWalkable(grid, target.x, target.y);

      const targetScreen = isoToScreen(target.x, target.y);
      const dx = targetScreen.x - this.px;
      const dy = targetScreen.y - this.py;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const prev = this.pathIndex > 0 ? this.path[this.pathIndex - 1] : null;
      if (prev) {
        this.facing = facingFromDelta(target.x - prev.x, target.y - prev.y);
      }

      const step = CHARACTER.MOVE_SPEED * dt;

      if (dist <= step || dist < CHARACTER.ARRIVE_THRESHOLD) {
        this.px = targetScreen.x;
        this.py = targetScreen.y;
        this.gx = target.x;
        this.gy = target.y;
        this.pathIndex++;

        if (this.pathIndex >= this.path.length) {
          this.isMoving = false;
          this.walkCycle = 0;

          if (this.pendingWork) {
            const { duration, onDone } = this.pendingWork;
            this.pendingWork = null;
            this.beginWork(duration, onDone);
            return;
          }
        }
      } else {
        this.px += (dx / dist) * step;
        this.py += (dy / dist) * step;
        this.gx += ((target.x - this.gx) * step) / dist;
        this.gy += ((target.y - this.gy) * step) / dist;
      }

      this.walkCycle = (this.walkCycle + dt * WALK_FRAME_COUNT * 0.4) % 1;

      this.applyWalkFrame();
      this.updateContainerPosition();
      this.updateZSort();
      return;
    }

    this.isMoving = false;
    this.isPhasing = false;
    this.walkCycle = 0;
    this.applyIdleFrame();
  }

  private applyIdleFrame(): void {
    this.setFrame(stillAliasFor[this.facing] ?? CHAR_SOUTH);
    this.sprite.alpha = this.isPhasing ? 0.45 : 1;
    this.drawShadow();
    this.updateContainerPosition();
    this.updateZSort();
  }

  private applyWalkFrame(): void {
    const prefix = walkPrefixFor[this.facing] ?? CHAR_WALK_SOUTH;
    const fi = Math.floor(this.walkCycle * WALK_FRAME_COUNT) % WALK_FRAME_COUNT;
    this.setFrame(`${prefix}${fi}`);
    this.sprite.alpha = this.isPhasing ? 0.45 : 1;
    this.drawShadow();
  }

  private applyWorkFrame(): void {
    const fi =
      Math.floor(this.workCycle * PICKUP_FRAME_COUNT) % PICKUP_FRAME_COUNT;
    this.setFrame(`${CHAR_PICKUP_SOUTH}${fi}`);
    this.sprite.alpha = 1;
    this.drawShadow();
  }

  private setFrame(alias: string): void {
    const tex = getTexSafe(alias) ?? getTexSafe(CHAR_SOUTH);
    if (!tex) return;
    tex.source.scaleMode = "nearest";
    this.sprite.texture = tex;
  }

  private drawShadow(): void {
    const g = this.shadowGfx;
    g.clear();

    g.ellipse(0, 2, 11, 4);
    g.fill({ color: 0x000000, alpha: this.isPhasing ? 0.08 : 0.22 });
  }

  private drawProgress(): void {
    const pg = this.progressGfx;
    pg.clear();

    const progress = this.workProgress;
    const W = 34,
      H = 5;

    const barY = -(56 * SPRITE_SCALE) - 4;
    const x = -W / 2;

    pg.rect(x - 1, barY - 1, W + 2, H + 2);
    pg.fill({ color: 0x000000, alpha: 0.5 });

    if (progress > 0) {
      const color = progress > 0.65 ? 0x6bc943 : 0xf0c040;
      pg.rect(x, barY, W * progress, H);
      pg.fill({ color });
    }

    pg.rect(x - 1, barY - 1, W + 2, H + 2);
    pg.stroke({ color: 0x000000, alpha: 0.4, width: 1 });
  }

  private updateContainerPosition(): void {
    this.container.x = this.px;

    this.container.y = this.py + PLAYGROUND.TILE_HEIGHT / 2;
  }

  private updateZSort(): void {
    this.container.zIndex = 2 + this.gx + this.gy + 0.5;
  }

  private beginWork(duration: number, onDone: () => void): void {
    this.isWorking = true;
    this.workTimer = duration;
    this.workTotal = duration;
    this.workCycle = 0;
    this.onWorkDone = onDone;
  }
}
