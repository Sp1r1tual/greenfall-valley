import * as PIXI from "pixi.js";

import type { GridType, IMovingTile, ObjEntryType } from "../common/types";
import {
  TREE_TEXTURE_ALIAS,
  BED_TEXTURE_ALIAS,
} from "@/common/types/aliases/texture.aliases";

import { PLAYGROUND } from "./common/configs/game.config";
import { isoToScreen } from "./common/helpers/grid.helpers";
import { drawBarn, getTex } from "./common/helpers/drawing.helpers";
import { drawWheat, drawCorn } from "./common/helpers/crop-drawing.helpers";

const GHOST_ALPHA = 0.3;
const TREE_W = 64;
const TREE_H = 96;

export class ObjectLayer {
  private objectGfxPool: PIXI.Graphics[] = [];
  private treeSprites: Map<string, PIXI.Sprite> = new Map();
  private bedSprites: Map<string, PIXI.Sprite> = new Map();
  private barnSprites: Map<string, PIXI.Sprite> = new Map();

  private readonly world: PIXI.Container;

  constructor(world: PIXI.Container) {
    this.world = world;
  }

  drawStatic(grid: GridType, heldItem?: IMovingTile | null): void {
    const objects: ObjEntryType[] = [];
    const drawnBarns = new Set<string>();

    for (let y = 0; y < PLAYGROUND.GRID_H; y++) {
      for (let x = 0; x < PLAYGROUND.GRID_W; x++) {
        const t = grid[y][x];

        if (t.type === "bed") {
          objects.push({ kind: "bed", x, y, sortKey: x + y, alpha: 1 });
        } else if (t.type === "barn" && t.barnOrigin) {
          const key = `${t.barnOrigin.x},${t.barnOrigin.y}`;
          if (!drawnBarns.has(key)) {
            drawnBarns.add(key);
            objects.push({
              kind: "barn",
              ox: t.barnOrigin.x,
              oy: t.barnOrigin.y,
              sortKey: t.barnOrigin.x + 1 + (t.barnOrigin.y + 1),
              alpha: 1,
            });
          }
        } else if (t.type === "tree") {
          objects.push({ kind: "tree", x, y, sortKey: x + y, alpha: 1 });
        }
      }
    }

    if (heldItem) {
      const { fromX, fromY, type } = heldItem;
      if (type === "tree") {
        objects.push({
          kind: "tree",
          x: fromX,
          y: fromY,
          sortKey: fromX + fromY,
          alpha: GHOST_ALPHA,
        });
      } else if (type === "barn") {
        objects.push({
          kind: "barn",
          ox: fromX,
          oy: fromY,
          sortKey: fromX + 1 + (fromY + 1),
          alpha: GHOST_ALPHA,
        });
      } else if (type === "bed") {
        objects.push({
          kind: "bed",
          x: fromX,
          y: fromY,
          sortKey: fromX + fromY,
          alpha: GHOST_ALPHA,
        });
      }
    }

    const nextActiveTreeKeys = new Set<string>();
    const nextActiveBedKeys = new Set<string>();
    const nextActiveBarnKeys = new Set<string>();

    this.syncPool(objects.length);

    const treeTex = getTex(TREE_TEXTURE_ALIAS);
    const bedTex = getTex(BED_TEXTURE_ALIAS);

    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      const gfx = this.objectGfxPool[i];

      gfx.clear();
      gfx.visible = false;
      gfx.zIndex = 2 + obj.sortKey;

      if (obj.kind === "tree" && treeTex) {
        const key = `${obj.x},${obj.y}`;
        nextActiveTreeKeys.add(key);

        let sprite = this.treeSprites.get(key);
        if (!sprite) {
          sprite = new PIXI.Sprite(treeTex);
          sprite.anchor.set(0.5, 1);
          this.world.addChild(sprite);
          this.treeSprites.set(key, sprite);
        }

        const { x: sx, y: sy } = isoToScreen(obj.x, obj.y);
        sprite.x = sx;
        sprite.y = sy + PLAYGROUND.TILE_HEIGHT - 8;
        sprite.width = TREE_W;
        sprite.height = TREE_H;
        sprite.alpha = obj.alpha;
        sprite.zIndex = 2 + obj.sortKey + 0.5;
        sprite.visible = true;
      } else if (obj.kind === "bed") {
        const key = `${obj.x},${obj.y}`;
        nextActiveBedKeys.add(key);

        const { x: sx, y: sy } = isoToScreen(obj.x, obj.y);

        if (bedTex) {
          let bedSprite = this.bedSprites.get(key);
          if (!bedSprite) {
            bedSprite = new PIXI.Sprite(bedTex);
            bedSprite.anchor.set(0.5, 0);
            this.world.addChild(bedSprite);
            this.bedSprites.set(key, bedSprite);
          }

          bedSprite.x = sx;
          bedSprite.y = sy;
          bedSprite.width = PLAYGROUND.TILE_WIDTH;
          bedSprite.height = PLAYGROUND.TILE_HEIGHT;
          bedSprite.alpha = obj.alpha;
          bedSprite.zIndex = 2 + obj.sortKey;
          bedSprite.visible = true;

          if (obj.alpha >= 1) {
            gfx.visible = true;
            gfx.zIndex = 3 + obj.sortKey;
          }
        }

        if (obj.alpha >= 1) {
          const tile = grid[obj.y][obj.x];
          if (tile.crop) {
            const { type, stage, pending, pendingHarvest } = tile.crop;
            const cropAlpha = pending || pendingHarvest ? 0.4 : 1;

            if (type === "wheat") drawWheat(gfx, sx, sy, stage, cropAlpha);
            else drawCorn(gfx, sx, sy, stage, cropAlpha);

            if (pending) {
              gfx.circle(sx, sy - 2, 6);
              gfx.fill({ color: 0x000000, alpha: 0.35 });
              gfx.circle(sx, sy - 2, 6);
              gfx.stroke({ color: 0xffffff, alpha: 0.7, width: 1 });
              gfx.moveTo(sx, sy - 2);
              gfx.lineTo(sx, sy - 6);
              gfx.stroke({ color: 0xffffff, alpha: 0.9, width: 1 });
              gfx.moveTo(sx, sy - 2);
              gfx.lineTo(sx + 3, sy - 2);
              gfx.stroke({ color: 0xffffff, alpha: 0.9, width: 1 });
            } else if (stage === "ready") {
              gfx.circle(sx, sy - 4, 5);
              gfx.fill({ color: 0xffd700, alpha: 0.9 });
              gfx.circle(sx, sy - 4, 5);
              gfx.stroke({ color: 0xff8800, width: 1.5 });
            }
          }
        }
      } else if (obj.kind === "barn") {
        const key = `${obj.ox},${obj.oy}`;
        nextActiveBarnKeys.add(key);
        drawBarn(this.world, this.barnSprites, key, obj.ox, obj.oy, obj.alpha);
      }
    }

    for (const [key, sprite] of this.treeSprites) {
      if (!nextActiveTreeKeys.has(key)) sprite.visible = false;
    }
    for (const [key, sprite] of this.bedSprites) {
      if (!nextActiveBedKeys.has(key)) sprite.visible = false;
    }
    for (const [key, sprite] of this.barnSprites) {
      if (!nextActiveBarnKeys.has(key)) sprite.visible = false;
    }
  }

  private syncPool(count: number): void {
    while (this.objectGfxPool.length < count) {
      const gfx = new PIXI.Graphics();
      this.world.addChild(gfx);
      this.objectGfxPool.push(gfx);
    }
    for (let i = count; i < this.objectGfxPool.length; i++) {
      this.objectGfxPool[i].visible = false;
      this.objectGfxPool[i].clear();
    }
  }

  destroy(): void {
    for (const sprite of this.treeSprites.values()) sprite.destroy();
    this.treeSprites.clear();

    for (const sprite of this.bedSprites.values()) sprite.destroy();
    this.bedSprites.clear();

    for (const sprite of this.barnSprites.values()) sprite.destroy();
    this.barnSprites.clear();

    for (const gfx of this.objectGfxPool) gfx.destroy();
    this.objectGfxPool = [];
  }
}
