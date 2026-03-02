import type { GridType, GrassVariantType } from "@/common/types";
import { PLAYGROUND } from "../configs/game.config";
import { getTex } from "./drawing.helpers";
import {
  GRASS_TEXTURE_ALIAS,
  GRASS_TEXTURE_ALIAS_2,
  GRASS_BLEND_TOP_LEFT,
  GRASS_BLEND_TOP_RIGHT,
  GRASS_BLEND_LEFT,
  GRASS_BLEND_RIGHT,
  GRASS_BLEND_BOTTOM_LEFT,
  GRASS_BLEND_BOTTOM_RIGHT,
  GRASS_BLEND_TOP,
  GRASS_BLEND_BOTTOM,
} from "@/common/types/aliases/texture.aliases";

const GRASS_AUTOTILE_MAP: Record<number, string> = {
  0: GRASS_TEXTURE_ALIAS,
  1: GRASS_BLEND_TOP_LEFT,
  2: GRASS_BLEND_TOP_RIGHT,
  4: GRASS_BLEND_BOTTOM_RIGHT,
  8: GRASS_BLEND_BOTTOM_LEFT,
  3: GRASS_BLEND_TOP,
  6: GRASS_BLEND_RIGHT,
  12: GRASS_BLEND_BOTTOM,
  9: GRASS_BLEND_LEFT,
  5: GRASS_BLEND_TOP_LEFT,
  10: GRASS_BLEND_TOP_RIGHT,
  7: GRASS_BLEND_RIGHT,
  11: GRASS_BLEND_BOTTOM,
  13: GRASS_BLEND_LEFT,
  14: GRASS_BLEND_TOP,
  15: GRASS_TEXTURE_ALIAS_2,
};

function getVariant(grid: GridType, x: number, y: number): GrassVariantType {
  if (y < 0 || y >= PLAYGROUND.GRID_H || x < 0 || x >= PLAYGROUND.GRID_W)
    return 0;
  const tile = grid[y][x];
  if (!tile || tile.type !== "grass") return 0;
  return (tile.grassVariant ?? 0) as GrassVariantType;
}

export function computeGrassTile(grid: GridType, x: number, y: number): void {
  const tile = grid[y]?.[x];
  if (!tile || tile.type !== "grass") return;

  let mask = 0;
  if (getVariant(grid, x, y - 1) === 1) mask |= 8;
  if (getVariant(grid, x + 1, y) === 1) mask |= 1;
  if (getVariant(grid, x, y + 1) === 1) mask |= 2;
  if (getVariant(grid, x - 1, y) === 1) mask |= 4;

  const alias =
    tile.grassVariant === 1
      ? GRASS_TEXTURE_ALIAS_2
      : (GRASS_AUTOTILE_MAP[mask] ?? GRASS_TEXTURE_ALIAS);

  tile.grassTexture = getTex(alias) ?? undefined;
}

export function recomputeGrassAround(
  grid: GridType,
  cx: number,
  cy: number,
): void {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      computeGrassTile(grid, cx + dx, cy + dy);
    }
  }
}

export function computeAllGrassTiles(grid: GridType): void {
  for (let y = 0; y < PLAYGROUND.GRID_H; y++) {
    for (let x = 0; x < PLAYGROUND.GRID_W; x++) {
      computeGrassTile(grid, x, y);
    }
  }
}
