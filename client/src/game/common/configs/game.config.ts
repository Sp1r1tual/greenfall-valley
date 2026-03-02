import type { CropType } from "@/common/types/index";

export const PLAYGROUND = {
  TILE_WIDTH: 64,
  TILE_HEIGHT: 32,
  GRID_W: 12,
  GRID_H: 12,
};

export const ZOOM = {
  MIN_ZOOM: 1,
  MAX_ZOOM: 5,
  DEFAULT_ZOOM: 2.5,
  ZOOM_DISPLAY_SCALE: 2.5,
};

export const TREE_PRICE = 50;
export const BARN_PRICE = 200;

export const BG_COLOR = 0x4a9e2e;
export const MESSAGE_TIMEOUT_MS = 2500;

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

export const CROP_LABELS: Record<CropType, string> = {
  wheat: "Пшениця",
  corn: "Кукурудза",
};

export const CROP_LABELS_ACCUSATIVE: Record<CropType, string> = {
  wheat: "пшеницю",
  corn: "кукурудзу",
};
