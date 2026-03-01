import * as PIXI from "pixi.js";

import type { GridType, CropStageType, GrassVariantType } from "@/common/types";
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
  TREE_TEXTURE_ALIAS,
} from "@/common/types/aliases/texture.aliases";

import { PLAYGROUND } from "../configs/game.config";

export const tilePoly = (sx: number, sy: number): number[] => [
  sx,
  sy,
  sx + PLAYGROUND.TILE_WIDTH / 2,
  sy + PLAYGROUND.TILE_HEIGHT / 2,
  sx,
  sy + PLAYGROUND.TILE_HEIGHT,
  sx - PLAYGROUND.TILE_WIDTH / 2,
  sy + PLAYGROUND.TILE_HEIGHT / 2,
];

const textureCache: Partial<Record<string, PIXI.Texture>> = {};

export const getTex = (alias: string): PIXI.Texture | null => {
  if (!textureCache[alias]) {
    const tex = PIXI.Assets.get<PIXI.Texture>(alias);
    if (!tex) return null;
    tex.source.scaleMode = "nearest";
    textureCache[alias] = tex;
  }
  return textureCache[alias] ?? null;
};

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

export function drawGrass(
  g: PIXI.Graphics,
  grid: GridType,
  sx: number,
  sy: number,
  tileX: number,
  tileY: number,
): void {
  const tile = grid[tileY]?.[tileX];
  const texture = tile?.grassTexture ?? null;
  g.poly(tilePoly(sx, sy));
  if (texture) g.fill({ texture });
  else g.fill({ color: 0x6bc943 });
}

export const drawHoverHighlight = (
  g: PIXI.Graphics,
  sx: number,
  sy: number,
) => {
  g.poly(tilePoly(sx, sy));
  g.fill({ color: 0xffffff, alpha: 0.25 });
  g.poly(tilePoly(sx, sy));
  g.stroke({ color: 0xffffff, alpha: 0.6, width: 1.5 });
};

export const drawPickedHighlight = (
  g: PIXI.Graphics,
  sx: number,
  sy: number,
) => {
  g.poly(tilePoly(sx, sy));
  g.fill({ color: 0xffdd00, alpha: 0.35 });
  g.poly(tilePoly(sx, sy));
  g.stroke({ color: 0xffaa00, alpha: 0.9, width: 2 });
};

export const drawDropHighlight = (
  g: PIXI.Graphics,
  sx: number,
  sy: number,
  canPlace: boolean,
) => {
  const color = canPlace ? 0x00ff88 : 0xff4444;
  g.poly(tilePoly(sx, sy));
  g.fill({ color, alpha: 0.3 });
  g.poly(tilePoly(sx, sy));
  g.stroke({ color, alpha: 0.8, width: 2 });
};

export const drawBed = (
  g: PIXI.Graphics,
  sx: number,
  sy: number,
  alpha = 1,
) => {
  g.poly(tilePoly(sx, sy));
  g.fill({ color: 0xa07855, alpha });
  g.poly([
    sx,
    sy + PLAYGROUND.TILE_HEIGHT / 2,
    sx + PLAYGROUND.TILE_WIDTH / 2,
    sy + PLAYGROUND.TILE_HEIGHT / 2,
    sx,
    sy + PLAYGROUND.TILE_HEIGHT,
    sx - PLAYGROUND.TILE_WIDTH / 2,
    sy + PLAYGROUND.TILE_HEIGHT / 2,
  ]);
  g.fill({ color: 0x6b4e35, alpha: 0.5 * alpha });
  g.poly(tilePoly(sx, sy));
  g.stroke({ color: 0x4a3625, width: 1.5, alpha });
  for (let i = 0; i < 3; i++) {
    const off = (i + 1) * (PLAYGROUND.TILE_HEIGHT / 4);
    g.moveTo(sx - PLAYGROUND.TILE_WIDTH / 4, sy + off);
    g.lineTo(sx + PLAYGROUND.TILE_WIDTH / 4, sy + off);
    g.stroke({ color: 0x000000, alpha: 0.3 * alpha, width: 1 });
  }
};

export const drawTree = (
  g: PIXI.Graphics,
  sx: number,
  sy: number,
  alpha = 1,
) => {
  const tex = getTex(TREE_TEXTURE_ALIAS);

  const spriteW = 64;
  const spriteH = 96;
  const baseY = sy + PLAYGROUND.TILE_HEIGHT - 8;

  if (tex) {
    g.texture(
      tex,
      0xffffff,
      sx - spriteW / 2,
      baseY - spriteH,
      spriteW,
      spriteH,
    );
  }
  if (alpha < 1) {
    g.fill({ color: 0xffffff, alpha: 1 - alpha });
  }
};

export const drawBarnGraphics = (
  g: PIXI.Graphics,
  sx: number,
  sy: number,
  alpha = 1,
) => {
  const hw = PLAYGROUND.TILE_WIDTH / 2,
    hh = PLAYGROUND.TILE_HEIGHT / 2;
  const wallH = 50,
    roofH = 40;
  const top = { x: sx, y: sy };
  const right = { x: sx + hw * 2, y: sy + hh * 2 };
  const bottom = { x: sx, y: sy + hh * 4 };
  const left = { x: sx - hw * 2, y: sy + hh * 2 };

  g.poly([top.x, top.y, right.x, right.y, bottom.x, bottom.y, left.x, left.y]);
  g.fill({ color: 0x8b7355, alpha });
  g.poly([top.x, top.y, right.x, right.y, bottom.x, bottom.y, left.x, left.y]);
  g.stroke({ color: 0x5d4a37, width: 2, alpha });

  g.poly([
    left.x,
    left.y,
    bottom.x,
    bottom.y,
    bottom.x,
    bottom.y - wallH,
    left.x,
    left.y - wallH,
  ]);
  g.fill({ color: 0xa0826d, alpha });
  g.poly([
    left.x,
    left.y,
    bottom.x,
    bottom.y,
    bottom.x,
    bottom.y - wallH,
    left.x,
    left.y - wallH,
  ]);
  g.stroke({ color: 0x5d4a37, width: 2, alpha });
  for (let i = 1; i < 4; i++) {
    const off = (wallH / 4) * i;
    g.moveTo(left.x, left.y - off);
    g.lineTo(bottom.x, bottom.y - off);
    g.stroke({ color: 0x8b6f47, width: 2, alpha });
  }

  g.poly([
    right.x,
    right.y,
    bottom.x,
    bottom.y,
    bottom.x,
    bottom.y - wallH,
    right.x,
    right.y - wallH,
  ]);
  g.fill({ color: 0x8b6f47, alpha });
  g.poly([
    right.x,
    right.y,
    bottom.x,
    bottom.y,
    bottom.x,
    bottom.y - wallH,
    right.x,
    right.y - wallH,
  ]);
  g.stroke({ color: 0x5d4a37, width: 2, alpha });
  for (let i = 0; i < 5; i++) {
    const r = i / 4;
    const bx = right.x + (bottom.x - right.x) * r,
      by = right.y + (bottom.y - right.y) * r;
    g.moveTo(bx, by - wallH);
    g.lineTo(bx, by);
    g.stroke({ color: 0x6b5435, width: 1.5, alpha });
  }

  const rcx = (top.x + right.x + bottom.x + left.x) / 4,
    rcy = (top.y + right.y + bottom.y + left.y) / 4;
  const peak = { x: rcx, y: rcy - wallH - roofH };

  g.poly([peak.x, peak.y, top.x, top.y - wallH, left.x, left.y - wallH]);
  g.fill({ color: 0x6b4513, alpha });
  g.poly([peak.x, peak.y, top.x, top.y - wallH, left.x, left.y - wallH]);
  g.stroke({ color: 0x4a2f0a, width: 1.5, alpha });
  g.poly([peak.x, peak.y, top.x, top.y - wallH, right.x, right.y - wallH]);
  g.fill({ color: 0x8b4513, alpha });
  g.poly([peak.x, peak.y, top.x, top.y - wallH, right.x, right.y - wallH]);
  g.stroke({ color: 0x654321, width: 1.5, alpha });
  g.poly([
    peak.x,
    peak.y,
    right.x,
    right.y - wallH,
    bottom.x,
    bottom.y - wallH,
  ]);
  g.fill({ color: 0xb0722d, alpha });
  g.poly([
    peak.x,
    peak.y,
    right.x,
    right.y - wallH,
    bottom.x,
    bottom.y - wallH,
  ]);
  g.stroke({ color: 0x8b5a2b, width: 1.5, alpha });
  g.poly([peak.x, peak.y, left.x, left.y - wallH, bottom.x, bottom.y - wallH]);
  g.fill({ color: 0xa0522d, alpha });
  g.poly([peak.x, peak.y, left.x, left.y - wallH, bottom.x, bottom.y - wallH]);
  g.stroke({ color: 0x804020, width: 1.5, alpha });

  if (alpha >= 1) {
    const dr = 0.65,
      dw = 20,
      dh = 32;
    const anchorX = right.x + (bottom.x - right.x) * dr,
      anchorY = right.y + (bottom.y - right.y) * dr;
    const wallDx = (bottom.x - right.x) / wallH,
      wallDy = (bottom.y - right.y) / wallH;
    const x0 = anchorX - (dw / 2) * wallDx,
      y0 = anchorY - (dw / 2) * wallDy - dh;
    const x1 = anchorX + (dw / 2) * wallDx,
      y1 = anchorY + (dw / 2) * wallDy - dh;
    const doorPoly = [x0, y0, x1, y1, x1, y1 + dh, x0, y0 + dh];
    g.poly(doorPoly);
    g.fill({ color: 0x3e2723 });
    g.poly(doorPoly);
    g.stroke({ color: 0x1b0000, width: 2 });
    const mx = (x0 + x1) / 2,
      my = (y0 + y1) / 2;
    g.moveTo(mx, my);
    g.lineTo(mx, my + dh);
    g.stroke({ color: 0x5d4037, width: 2 });
    g.moveTo(x0, y0 + dh / 2);
    g.lineTo(x1, y1 + dh / 2);
    g.stroke({ color: 0x5d4037, width: 2 });
    g.circle(x1 - wallDx * 3, y1 + dh / 2 - wallDy * 3, 3);
    g.fill({ color: 0xffd700 });
  }
};

export const drawWheat = (
  g: PIXI.Graphics,
  sx: number,
  sy: number,
  stage: CropStageType,
  alpha = 1,
) => {
  const baseY = sy + PLAYGROUND.TILE_HEIGHT / 2;
  const stemCount = stage === "seedling" ? 3 : stage === "growing" ? 5 : 7;
  const stemH = stage === "seedling" ? 12 : stage === "growing" ? 22 : 34;
  const headSize = stage === "ready" ? 6 : 0;
  const spread = PLAYGROUND.TILE_WIDTH / 2 - 6;
  for (let i = 0; i < stemCount; i++) {
    const bx = sx - spread + (i / (stemCount - 1)) * spread * 2;
    g.moveTo(bx, baseY);
    g.lineTo(bx, baseY - stemH);
    g.stroke({
      color: stage === "ready" ? 0xd4a017 : 0x6abf69,
      width: 2,
      alpha,
      cap: "round",
    });
    if (stage === "ready") {
      g.ellipse(bx, baseY - stemH - headSize / 2, 3, headSize);
      g.fill({ color: 0xf0c040, alpha });
    } else if (stage === "growing") {
      g.circle(bx, baseY - stemH, 2);
      g.fill({ color: 0x5aaf59, alpha });
    }
  }
};

export const drawCorn = (
  g: PIXI.Graphics,
  sx: number,
  sy: number,
  stage: CropStageType,
  alpha = 1,
) => {
  const baseY = sy + PLAYGROUND.TILE_HEIGHT / 2;
  const stemH = stage === "seedling" ? 14 : stage === "growing" ? 28 : 44;
  const stemCount = stage === "seedling" ? 2 : 3;
  const spread = PLAYGROUND.TILE_WIDTH / 3;
  for (let i = 0; i < stemCount; i++) {
    const bx =
      sx - spread + (stemCount > 1 ? i / (stemCount - 1) : 0.5) * spread * 2;
    g.moveTo(bx, baseY);
    g.lineTo(bx, baseY - stemH);
    g.stroke({ color: 0x4caf50, width: 2.5, alpha, cap: "round" });
    if (stage !== "seedling") {
      g.moveTo(bx, baseY - stemH * 0.4);
      g.lineTo(bx + 12, baseY - stemH * 0.55);
      g.stroke({ color: 0x66bb6a, width: 1.5, alpha });
      g.moveTo(bx, baseY - stemH * 0.6);
      g.lineTo(bx - 12, baseY - stemH * 0.75);
      g.stroke({ color: 0x66bb6a, width: 1.5, alpha });
    }
    if (stage === "ready") {
      const cobX = bx + 6,
        cobY = baseY - stemH * 0.65;
      g.ellipse(cobX, cobY, 5, 11);
      g.fill({ color: 0xf9c31a, alpha });
      g.ellipse(cobX, cobY, 5, 11);
      g.stroke({ color: 0xe0a800, width: 1, alpha });
      g.moveTo(cobX - 5, cobY - 8);
      g.lineTo(cobX + 2, cobY - 14);
      g.stroke({ color: 0x558b2f, width: 1.5, alpha });
    }
  }
};
