import * as PIXI from "pixi.js";

import type { GridType } from "../common/types";
import { GRASS_TEXTURE_ALIAS } from "@/common/types/aliases/texture.aliases";

import { PLAYGROUND } from "./common/configs/game.config";
import { isoToScreen } from "./common/helpers/grid.helpers";
import { getTex } from "./common/helpers/drawing.helpers";

export class GrassLayer {
  private grassSprites: PIXI.Sprite[][] = [];
  private grassInitialized = false;

  private readonly world: PIXI.Container;

  constructor(world: PIXI.Container) {
    this.world = world;
  }

  initGrassSprites(grid: GridType): void {
    if (this.grassInitialized) {
      this.refreshAllGrassSprites(grid);
      return;
    }

    const fallbackTex = getTex(GRASS_TEXTURE_ALIAS) ?? PIXI.Texture.WHITE;

    for (let y = 0; y < PLAYGROUND.GRID_H; y++) {
      this.grassSprites[y] = [];
      for (let x = 0; x < PLAYGROUND.GRID_W; x++) {
        const { x: sx, y: sy } = isoToScreen(x, y);
        const tile = grid[y][x];
        const tex =
          (tile.type === "grass" ? tile.grassTexture : null) ?? fallbackTex;

        const sprite = new PIXI.Sprite(tex);
        sprite.anchor.set(0.5, 0);
        sprite.x = sx;
        sprite.y = sy;
        sprite.zIndex = 0;
        sprite.visible =
          tile.type === "grass" || tile.type === "tree" || tile.type === "barn";

        this.world.addChild(sprite);
        this.grassSprites[y][x] = sprite;
      }
    }

    this.grassInitialized = true;
  }

  updateGrassSprites(grid: GridType, cx: number, cy: number): void {
    if (!this.grassInitialized) return;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        this.updateGrassSprite(grid, cx + dx, cy + dy);
      }
    }
  }

  private updateGrassSprite(grid: GridType, x: number, y: number): void {
    if (x < 0 || x >= PLAYGROUND.GRID_W || y < 0 || y >= PLAYGROUND.GRID_H)
      return;
    const sprite = this.grassSprites[y]?.[x];
    if (!sprite) return;

    const tile = grid[y][x];
    const fallbackTex = getTex(GRASS_TEXTURE_ALIAS) ?? PIXI.Texture.WHITE;
    const tex =
      (tile.type === "grass" ? tile.grassTexture : null) ?? fallbackTex;

    sprite.texture = tex;
    sprite.visible = tile.type !== "bed";
  }

  private refreshAllGrassSprites(grid: GridType): void {
    for (let y = 0; y < PLAYGROUND.GRID_H; y++) {
      for (let x = 0; x < PLAYGROUND.GRID_W; x++) {
        const sprite = this.grassSprites[y]?.[x];
        if (sprite) {
          const { x: sx, y: sy } = isoToScreen(x, y);
          sprite.x = sx;
          sprite.y = sy;
        }
        this.updateGrassSprite(grid, x, y);
      }
    }
  }

  destroy(): void {
    for (const row of this.grassSprites) {
      for (const sprite of row) sprite?.destroy();
    }
    this.grassSprites = [];
  }
}
