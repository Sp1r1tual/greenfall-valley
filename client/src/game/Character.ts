import * as PIXI from "pixi.js";

import type {
  GridType,
  IGridPos,
  CharacterDirectionType,
} from "../common/types";

import { findPath, isWalkable } from "./PathFinder";
import { PLAYGROUND, CHARACTER } from "../common/configs/game.config";
import { isoToScreen, inBounds } from "../common/helpers/grid.helpers";

export class Character {
  private gx: number;
  private gy: number;
  private px: number;
  private py: number;

  private path: IGridPos[] = [];
  private pathIndex = 0;

  private walkCycle = 0;
  private facing: CharacterDirectionType = "down";
  private isMoving = false;
  private isPhasing = false;

  private isWorking = false;
  private workTimer = 0;
  private workTotal = 0;
  private workCycle = 0;
  private onWorkDone: (() => void) | null = null;

  private pendingWork: { duration: number; onDone: () => void } | null = null;

  readonly container: PIXI.Container;
  private gfx: PIXI.Graphics;
  private progressGfx: PIXI.Graphics;

  constructor(startX: number, startY: number) {
    this.gx = startX;
    this.gy = startY;

    const screen = isoToScreen(startX, startY);

    this.px = screen.x;
    this.py = screen.y;

    this.container = new PIXI.Container();
    this.gfx = new PIXI.Graphics();
    this.progressGfx = new PIXI.Graphics();
    this.container.addChild(this.gfx);
    this.container.addChild(this.progressGfx);

    this.draw();
    this.container.x = this.px;
    this.container.y = this.py + PLAYGROUND.TILE_HEIGHT;
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
    this.draw();
  }

  get workProgress(): number {
    if (!this.isWorking || this.workTotal === 0) return 0;
    return 1 - this.workTimer / this.workTotal;
  }

  get working(): boolean {
    return this.isWorking;
  }

  update(dt: number, grid: GridType): void {
    if (this.isWorking) {
      this.workTimer -= dt;
      this.workCycle = (this.workCycle + dt * 7) % 1;

      if (this.workTimer <= 0) {
        this.isWorking = false;
        this.workCycle = 0;
        this.progressGfx.clear();

        const cb = this.onWorkDone;

        this.onWorkDone = null;

        cb?.();

        this.draw();
      } else {
        this.drawWorking();
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
      if (prev) this.updateFacing(target.x - prev.x, target.y - prev.y);

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

      this.walkCycle = (this.walkCycle + dt * 4) % 1;
      this.draw();
      this.updateContainerPosition();
      this.updateZSort();
      return;
    }

    this.isMoving = false;
    this.isPhasing = false;
    this.walkCycle = 0;
    this.draw();
  }

  private beginWork(duration: number, onDone: () => void): void {
    this.isWorking = true;
    this.workTimer = duration;
    this.workTotal = duration;
    this.workCycle = 0;
    this.onWorkDone = onDone;
  }

  private draw(): void {
    const g = this.gfx;
    g.clear();
    this.progressGfx.clear();

    const walking = this.isMoving;
    const phase = this.isPhasing;
    const alpha = phase ? 0.45 : 1;
    const swing = walking ? Math.sin(this.walkCycle * Math.PI * 2) * 0.4 : 0;

    g.ellipse(0, 2, 9, 4);
    g.fill({ color: 0x000000, alpha: 0.18 * alpha });

    const legLen = 16;
    const legSpread = 3;
    const hipY = -15;

    g.moveTo(-legSpread, hipY);
    g.lineTo(
      -legSpread + Math.sin(swing) * legLen,
      hipY + Math.cos(swing) * legLen,
    );
    g.stroke({ color: 0x2c3e50, width: 2.5, alpha, cap: "round" });
    g.moveTo(legSpread, hipY);
    g.lineTo(
      legSpread + Math.sin(-swing) * legLen,
      hipY + Math.cos(-swing) * legLen,
    );
    g.stroke({ color: 0x2c3e50, width: 2.5, alpha, cap: "round" });

    const bodyTop = -35;

    g.moveTo(0, hipY);
    g.lineTo(0, bodyTop);
    g.stroke({ color: 0x2c3e50, width: 3, alpha, cap: "round" });

    const armLen = 11;
    const shoulderY = bodyTop + 5;
    const armSpread = 4;

    g.moveTo(-armSpread, shoulderY);
    g.lineTo(
      -armSpread + Math.sin(-swing * 0.8) * armLen,
      shoulderY + Math.cos(-swing * 0.8) * armLen,
    );
    g.stroke({ color: 0x2c3e50, width: 2.5, alpha, cap: "round" });
    g.moveTo(armSpread, shoulderY);
    g.lineTo(
      armSpread + Math.sin(swing * 0.8) * armLen,
      shoulderY + Math.cos(swing * 0.8) * armLen,
    );
    g.stroke({ color: 0x2c3e50, width: 2.5, alpha, cap: "round" });

    const headR = 7;
    const headY = bodyTop - headR - 1;

    g.circle(0, headY, headR);
    g.fill({ color: 0xf5cba7, alpha });
    g.circle(0, headY, headR);
    g.stroke({ color: 0x2c3e50, width: 1.5, alpha });

    const eo = this.eyeOffsetForFacing();
    g.circle(eo.lx, headY + eo.y, 1.2);
    g.fill({ color: 0x2c3e50, alpha });
    g.circle(eo.rx, headY + eo.y, 1.2);
    g.fill({ color: 0x2c3e50, alpha });

    if (phase) {
      g.circle(0, headY, headR + 1);
      g.stroke({ color: 0x9b59b6, width: 1, alpha: 0.5 });
    }

    this.updateContainerPosition();
    this.updateZSort();
  }

  private drawWorking(): void {
    const g = this.gfx;
    g.clear();

    const bob = Math.sin(this.workCycle * Math.PI * 2);
    const bobY = bob * 3;
    const armSwing = bob * 10;
    const hipY = -15;

    g.ellipse(0, 2 + bobY * 0.3, 9, 4);
    g.fill({ color: 0x000000, alpha: 0.18 });

    g.moveTo(-3, hipY);
    g.lineTo(-5, hipY + 16 + bobY * 0.5);
    g.stroke({ color: 0x2c3e50, width: 2.5, cap: "round" });
    g.moveTo(3, hipY);
    g.lineTo(6, hipY + 16 + bobY * 0.5);
    g.stroke({ color: 0x2c3e50, width: 2.5, cap: "round" });

    const bodyTop = -35 + bobY * 0.4;
    g.moveTo(0, hipY);
    g.lineTo(4, bodyTop);
    g.stroke({ color: 0x2c3e50, width: 3, cap: "round" });

    const shoulderY = bodyTop + 5;
    g.moveTo(4, shoulderY);
    g.lineTo(12, shoulderY + 13 + armSwing);
    g.stroke({ color: 0x2c3e50, width: 2.5, cap: "round" });

    g.moveTo(4, shoulderY);
    g.lineTo(-3, shoulderY + 11 - armSwing * 0.6);
    g.stroke({ color: 0x2c3e50, width: 2.5, cap: "round" });

    const headR = 7;
    const headY = bodyTop - headR - 1;

    g.circle(5, headY, headR);
    g.fill({ color: 0xf5cba7 });
    g.circle(5, headY, headR);
    g.stroke({ color: 0x2c3e50, width: 1.5 });

    g.circle(7, headY + 2, 1.2);
    g.fill({ color: 0x2c3e50 });
    g.circle(9, headY + 2, 1.2);
    g.fill({ color: 0x2c3e50 });

    this.updateContainerPosition();
    this.updateZSort();
  }

  private drawProgress(): void {
    const pg = this.progressGfx;
    pg.clear();

    const progress = this.workProgress;
    const W = 34,
      H = 5;
    const x = -W / 2,
      y = -56;

    pg.rect(x - 1, y - 1, W + 2, H + 2);
    pg.fill({ color: 0x000000, alpha: 0.5 });

    if (progress > 0) {
      const color = progress > 0.65 ? 0x6bc943 : 0xf0c040;

      pg.rect(x, y, W * progress, H);
      pg.fill({ color });
    }

    pg.rect(x - 1, y - 1, W + 2, H + 2);
    pg.stroke({ color: 0x000000, alpha: 0.4, width: 1 });
  }

  private eyeOffsetForFacing(): { lx: number; rx: number; y: number } {
    switch (this.facing) {
      case "right":
        return { lx: 1, rx: 4, y: 0 };
      case "left":
        return { lx: -4, rx: -1, y: 0 };
      case "up":
        return { lx: -2.5, rx: 2.5, y: -2 };
      default:
        return { lx: -2.5, rx: 2.5, y: 1 };
    }
  }

  private updateFacing(dx: number, dy: number): void {
    if (dx > 0 && dy === 0) this.facing = "right";
    else if (dx < 0 && dy === 0) this.facing = "left";
    else if (dy > 0 && dx === 0) this.facing = "down";
    else if (dy < 0 && dx === 0) this.facing = "up";
    else if (dx > 0) this.facing = "right";
    else if (dx < 0) this.facing = "left";
  }

  private updateContainerPosition(): void {
    this.container.x = this.px;
    this.container.y = this.py + PLAYGROUND.TILE_HEIGHT / 2;
  }

  private updateZSort(): void {
    this.container.zIndex = 2 + this.gx + this.gy + 0.5;
  }
}
