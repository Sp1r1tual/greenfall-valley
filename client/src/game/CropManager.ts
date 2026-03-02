import type { GridType, CropType } from "../common/types";

import type { TaskQueue } from "./TaskQueue";

import { CROP_GROW_MS, PLAYGROUND } from "./common/configs/game.config";

export class CropManager {
  static tickCrops(
    grid: GridType,
    onCropReady: (x: number, y: number) => void,
  ): boolean {
    const now = Date.now();
    let needsRedraw = false;

    for (let y = 0; y < PLAYGROUND.GRID_H; y++) {
      for (let x = 0; x < PLAYGROUND.GRID_W; x++) {
        const tile = grid[y][x];
        if (tile.type !== "bed" || !tile.crop) continue;
        if (tile.crop.pending || tile.crop.plantedAt === 0) continue;

        const { crop } = tile;
        const ratio = (now - crop.plantedAt) / crop.growthMs;
        const newStage =
          ratio >= 1 ? "ready" : ratio >= 0.4 ? "growing" : "seedling";

        if (newStage !== crop.stage) {
          crop.stage = newStage;
          needsRedraw = true;
          if (newStage === "ready") onCropReady(x, y);
        }
      }
    }

    return needsRedraw;
  }

  static plantCrop(
    grid: GridType,
    x: number,
    y: number,
    cropType: CropType,
    tasks: TaskQueue,
  ): boolean {
    const tile = grid[y]?.[x];
    if (!tile || tile.type !== "bed" || tile.crop) return false;

    tile.crop = {
      type: cropType,
      plantedAt: 0,
      growthMs: CROP_GROW_MS[cropType],
      stage: "seedling",
      pending: true,
    };
    tasks.push({ kind: "plant", x, y, cropType });
    return true;
  }
}
