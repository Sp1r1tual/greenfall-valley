import type { GridType, TileType } from "@/common/types/index";

import { PLAYGROUND } from "../configs/game.config";
import { MAP_CONFIG } from "../configs/map.config";
import { getSceneOrigin } from "../utils/getSceneOrigin.util";

export const createGrid = (): GridType => {
  const grid: GridType = Array.from({ length: PLAYGROUND.GRID_H }, () =>
    Array.from({ length: PLAYGROUND.GRID_W }, () => ({
      type: "grass" as TileType,
      grassVariant: 0 as 0 | 1,
      grassTexture: undefined,
      barnOrigin: undefined,
    })),
  );

  const placedBarns = new Set<string>();

  for (const [key, cfg] of Object.entries(MAP_CONFIG)) {
    const [x, y] = key.split(",").map(Number);
    if (
      isNaN(x) ||
      isNaN(y) ||
      x < 0 ||
      x >= PLAYGROUND.GRID_W ||
      y < 0 ||
      y >= PLAYGROUND.GRID_H
    )
      continue;

    if (cfg.type === "grass") {
      grid[y][x].type = "grass";
      grid[y][x].grassVariant = cfg.flower ?? 0;
    } else if (cfg.type === "tree") {
      grid[y][x].type = "tree";
      grid[y][x].grassVariant = 0;
    } else if (cfg.type === "bed") {
      grid[y][x].type = "bed";
    } else if (cfg.type === "barn") {
      if (!placedBarns.has(key)) {
        placedBarns.add(key);
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const tx = x + dx;
            const ty = y + dy;
            if (tx < PLAYGROUND.GRID_W && ty < PLAYGROUND.GRID_H) {
              grid[ty][tx].type = "barn";
              grid[ty][tx].barnOrigin = { x, y };
            }
          }
        }
      }
    }
  }

  return grid;
};

export function forEachBarnTile(
  x: number,
  y: number,
  fn: (tx: number, ty: number) => void,
): void {
  for (let dy = 0; dy < 2; dy++)
    for (let dx = 0; dx < 2; dx++) fn(x + dx, y + dy);
}

export function placeBarn(grid: GridType, x: number, y: number): void {
  forEachBarnTile(x, y, (tx, ty) => {
    grid[ty][tx].type = "barn";
    grid[ty][tx].barnOrigin = { x, y };
  });
}

export function removeBarn(grid: GridType, x: number, y: number): void {
  forEachBarnTile(x, y, (tx, ty) => {
    grid[ty][tx].type = "grass";
    delete grid[ty][tx].barnOrigin;
  });
}

export const isoToScreen = (gx: number, gy: number) => {
  const { x: ox, y: oy } = getSceneOrigin();
  return {
    x: (gx - gy) * (PLAYGROUND.TILE_WIDTH / 2) + ox,
    y: (gx + gy) * (PLAYGROUND.TILE_HEIGHT / 2) + oy,
  };
};

export const screenToIso = (sx: number, sy: number) => {
  const { x: ox, y: oy } = getSceneOrigin();
  const x = sx - ox;
  const y = sy - oy;
  return {
    x: Math.floor(
      (x / (PLAYGROUND.TILE_WIDTH / 2) + y / (PLAYGROUND.TILE_HEIGHT / 2)) / 2,
    ),
    y: Math.floor(
      (y / (PLAYGROUND.TILE_HEIGHT / 2) - x / (PLAYGROUND.TILE_WIDTH / 2)) / 2,
    ),
  };
};

export const inBounds = (x: number, y: number) =>
  x >= 0 && x < PLAYGROUND.GRID_W && y >= 0 && y < PLAYGROUND.GRID_H;

export const canPlaceBarn = (
  grid: GridType,
  x: number,
  y: number,
  ignoreOrigin?: { x: number; y: number },
) => {
  if (x + 1 >= PLAYGROUND.GRID_W || y + 1 >= PLAYGROUND.GRID_H) return false;

  for (let dy = 0; dy < 2; dy++)
    for (let dx = 0; dx < 2; dx++) {
      const tile = grid[y + dy][x + dx];
      if (
        ignoreOrigin &&
        tile.type === "barn" &&
        tile.barnOrigin?.x === ignoreOrigin.x &&
        tile.barnOrigin?.y === ignoreOrigin.y
      )
        continue;
      if (tile.type !== "grass") return false;
    }

  return true;
};
