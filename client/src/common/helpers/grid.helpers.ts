import type { GridType, TileType } from "../types";

import { PLAYGROUND } from "../configs/game.config";
import { getSceneOrigin } from "../utils/getSceneOrigin.util";

export const createGrid = (): GridType => {
  return Array.from({ length: PLAYGROUND.GRID_H }, () =>
    Array.from({ length: PLAYGROUND.GRID_W }, () => ({
      type: "grass" as TileType,
    })),
  );
};

export const cloneGrid = (g: GridType): GridType => {
  return g.map((row) => row.map((t) => ({ ...t })));
};

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

export const inBounds = (x: number, y: number) => {
  return x >= 0 && x < PLAYGROUND.GRID_W && y >= 0 && y < PLAYGROUND.GRID_H;
};

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
