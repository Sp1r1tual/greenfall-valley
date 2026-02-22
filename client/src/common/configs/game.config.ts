import type { CropType } from "../types";

export const PLAYGROUND = {
  TILE_WIDTH: 64,
  TILE_HEIGHT: 32,
  GRID_W: 12,
  GRID_H: 12,
};

export const ZOOM = {
  MIN_ZOOM: 0.35,
  MAX_ZOOM: 2,
};

export const DEFAULT_INV = {
  coins: 1000,
  bedInv: 0,
  treeInv: 0,
  barnInv: 0,
  treeStock: 5,
  barnStock: 3,
};

export const CHARACTER = {
  MOVE_SPEED: 120,
  ARRIVE_THRESHOLD: 0.5,
  PLANT_DURATION: 1.5,
  HARVEST_DURATION: 1.2,
};

export const CROP_GROW_MS: Record<CropType, number> = {
  wheat: 15_000,
  corn: 30_000,
};

export const CROP_REWARD: Record<CropType, number> = {
  wheat: 30,
  corn: 70,
};
