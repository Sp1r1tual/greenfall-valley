import type {
  TaskType,
  CropType,
  GridType,
  OnMessageFnType,
} from "../common/types";

import {
  CHARACTER,
  CROP_LABELS,
  CROP_LABELS_ACCUSATIVE,
} from "./common/configs/game.config";

type OnRedrawType = () => void;
type OnInventoryType = () => void;

interface ITaskQueueDeps {
  grid: GridType;
  goWorkAt: (
    grid: GridType,
    x: number,
    y: number,
    duration: number,
    onDone: () => void,
  ) => void;
  onMessage: OnMessageFnType;
  onRedraw: OnRedrawType;
  onInventory: OnInventoryType;
  onCropReward: (type: CropType) => void;
}

export class TaskQueue {
  private queue: TaskType[] = [];
  private executing = false;
  private deps: ITaskQueueDeps;

  constructor(deps: ITaskQueueDeps) {
    this.deps = deps;
  }

  push(task: TaskType): void {
    this.queue.push(task);
  }

  process(): void {
    if (this.executing || this.queue.length === 0) return;

    const task = this.queue.shift()!;
    this.executing = true;

    if (task.kind === "plant") {
      this.runPlant(task);
    } else {
      this.runHarvest(task);
    }
  }

  get pendingPlantCount(): number {
    return this.queue.filter((t) => t.kind === "plant").length;
  }

  get isExecuting(): boolean {
    return this.executing;
  }

  clear(x: number, y: number): void {
    this.queue = this.queue.filter((t) => !(t.x === x && t.y === y));
  }

  private runPlant(task: Extract<TaskType, { kind: "plant" }>): void {
    const { grid, goWorkAt, onMessage, onRedraw } = this.deps;
    const tile = grid[task.y]?.[task.x];

    if (!tile || tile.type !== "bed" || !tile.crop?.pending) {
      this.executing = false;
      this.process();
      return;
    }

    onMessage(
      `🚜 Іду садити ${CROP_LABELS_ACCUSATIVE[task.cropType]}…`,
      "normal",
    );

    goWorkAt(grid, task.x, task.y, CHARACTER.PLANT_DURATION, () => {
      const t = grid[task.y]?.[task.x];
      if (t?.crop?.pending) {
        t.crop.pending = false;
        t.crop.plantedAt = Date.now();
      }
      onRedraw();
      onMessage(`🌱 Посіяно: ${CROP_LABELS[task.cropType]}`, "success");
      this.executing = false;
      this.process();
    });
  }

  private runHarvest(task: Extract<TaskType, { kind: "harvest" }>): void {
    const { grid, goWorkAt, onMessage, onRedraw, onInventory, onCropReward } =
      this.deps;
    const tile = grid[task.y]?.[task.x];

    if (!tile?.crop || tile.crop.stage !== "ready") {
      this.executing = false;
      this.process();
      return;
    }

    onMessage(
      `🚜 Іду збирати ${CROP_LABELS_ACCUSATIVE[tile.crop.type]}…`,
      "normal",
    );

    goWorkAt(grid, task.x, task.y, CHARACTER.HARVEST_DURATION, () => {
      const t = grid[task.y]?.[task.x];
      if (t?.crop?.stage === "ready") {
        onCropReward(t.crop.type);
        onMessage(`🌾 Зібрано: ${CROP_LABELS[t.crop.type]}!`, "success");
        delete t.crop;
        onInventory();
        onRedraw();
      }
      this.executing = false;
      this.process();
    });
  }
}
