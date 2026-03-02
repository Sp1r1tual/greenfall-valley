import * as PIXI from "pixi.js";

import type { GridType, IGridPos } from "../common/types";
import type { FacingDirType } from "./CharacterAnimator";

import { findPath, isWalkable } from "./PathFinder";
import { CharacterAnimator } from "./CharacterAnimator";

import { CHARACTER } from "./common/configs/game.config";
import { isoToScreen, inBounds } from "./common/helpers/grid.helpers";

const WALK_FRAME_COUNT = 6;
const PICKUP_FRAME_COUNT = 5;

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

  private animator: CharacterAnimator;

  constructor(startX: number, startY: number) {
    this.gx = startX;
    this.gy = startY;

    const screen = isoToScreen(startX, startY);
    this.px = screen.x;
    this.py = screen.y;

    this.animator = new CharacterAnimator();

    this.applyIdleState();
  }

  get container(): PIXI.Container {
    return this.animator.container;
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

    this.animator.clearProgress();
    this.applyIdleState();
  }

  update(dt: number, grid: GridType): void {
    if (this.isWorking) {
      this.workTimer -= dt;
      this.workCycle = (this.workCycle + dt * PICKUP_FRAME_COUNT * 0.4) % 1;

      if (this.workTimer <= 0) {
        this.isWorking = false;
        this.workCycle = 0;

        this.animator.clearProgress();

        const cb = this.onWorkDone;
        this.onWorkDone = null;
        cb?.();

        this.applyIdleState();
      } else {
        this.animator.applyWorkFrame(this.workCycle);
        this.animator.drawProgress(this.workProgress);
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

      this.animator.applyWalkFrame(this.facing, this.walkCycle, this.isPhasing);
      this.animator.updateContainerPosition(this.px, this.py);
      this.animator.updateZSort(this.gx, this.gy);
      return;
    }

    this.isMoving = false;
    this.isPhasing = false;
    this.walkCycle = 0;
    this.applyIdleState();
  }

  private beginWork(duration: number, onDone: () => void): void {
    this.isWorking = true;
    this.workTimer = duration;
    this.workTotal = duration;
    this.workCycle = 0;
    this.onWorkDone = onDone;
  }

  private applyIdleState(): void {
    this.animator.applyIdleFrame(this.facing, this.isPhasing);
    this.animator.updateContainerPosition(this.px, this.py);
    this.animator.updateZSort(this.gx, this.gy);
  }
}
