import type { GridType, TileType } from "@/common/types/index";

import { PLAYGROUND } from "../configs/game.config";
import { getSceneOrigin } from "../utils/getSceneOrigin.util";

const tileHash = (x: number, y: number): number => {
  const n = x + y * 57;
  return Math.abs((Math.sin(n) * 43758.5453) % 1);
};

const flowerNoise = (x: number, y: number): number => {
  const wave1 = Math.sin(x * 0.4 + y * 0.7) * 0.5 + 0.5;
  const wave2 = Math.sin(x * 0.8 - y * 0.3 + 1.5) * 0.5 + 0.5;
  const detail = tileHash(x, y) * 0.3;
  return (wave1 + wave2) / 2 + detail;
};

export const createGrid = (): GridType => {
  const raw = Array.from({ length: PLAYGROUND.GRID_H }, (_, y) =>
    Array.from({ length: PLAYGROUND.GRID_W }, (_, x) =>
      flowerNoise(x, y) > 1.1 ? 1 : 0,
    ),
  );

  return Array.from({ length: PLAYGROUND.GRID_H }, (_, y) =>
    Array.from({ length: PLAYGROUND.GRID_W }, (_, x) => {
      let variant = raw[y][x] as 0 | 1;

      if (variant === 1) {
        const hasFlowerNeighbor =
          raw[y - 1]?.[x] === 1 ||
          raw[y + 1]?.[x] === 1 ||
          raw[y]?.[x - 1] === 1 ||
          raw[y]?.[x + 1] === 1;

        if (!hasFlowerNeighbor) variant = 0;
      }

      return {
        type: "grass" as TileType,
        grassVariant: variant,
        grassTexture: undefined,
      };
    }),
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
