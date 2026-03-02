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
  BED_TEXTURE_ALIAS,
  BARN_TEXTURE_ALIAS,
} from "@/common/types/aliases/texture.aliases";

import { PLAYGROUND } from "../configs/game.config";
import { isoToScreen } from "./grid.helpers";

export const BARN_W = 128;
export const BARN_H = 160;

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
  const tex = getTex(BED_TEXTURE_ALIAS);

  if (tex) {
    const tw = PLAYGROUND.TILE_WIDTH;
    const th = PLAYGROUND.TILE_HEIGHT;
    g.texture(tex, 0xffffff, sx - tw / 2, sy, tw, th);
    if (alpha < 1) {
      g.fill({ color: 0xffffff, alpha: 1 - alpha });
    }
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

export const drawBarn = (
  world: PIXI.Container,
  barnSprites: Map<string, PIXI.Sprite>,
  key: string,
  ox: number,
  oy: number,
  alpha: number,
): void => {
  const barnTex = getTex(BARN_TEXTURE_ALIAS);
  if (!barnTex) return;

  let barnSprite = barnSprites.get(key);
  if (!barnSprite) {
    barnSprite = new PIXI.Sprite(barnTex);
    barnSprite.anchor.set(0.5, 1);
    world.addChild(barnSprite);
    barnSprites.set(key, barnSprite);
  }

  const { x: sx, y: sy } = isoToScreen(ox + 1, oy + 1);
  barnSprite.x = sx;
  barnSprite.y = sy + PLAYGROUND.TILE_HEIGHT + 16;
  barnSprite.width = BARN_W;
  barnSprite.height = BARN_H;
  barnSprite.alpha = alpha;
  barnSprite.zIndex = 2 + (ox + 1) + (oy + 1);
  barnSprite.visible = true;
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
