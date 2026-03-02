import * as PIXI from "pixi.js";

import { PLAYGROUND } from "../configs/game.config";
import { isoToScreen } from "./grid.helpers";
import {
  TREE_TEXTURE_ALIAS,
  BARN_TEXTURE_ALIAS,
} from "@/common/types/aliases/texture.aliases";

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
