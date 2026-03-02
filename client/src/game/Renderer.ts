import * as PIXI from "pixi.js";

import type {
  GridType,
  ModeType,
  IMovingTile,
  CropType,
  ObjEntryType,
} from "../common/types";

import { PLAYGROUND } from "./common/configs/game.config";
import {
  isoToScreen,
  inBounds,
  canPlaceBarn,
} from "./common/helpers/grid.helpers";
import {
  drawTree,
  drawHoverHighlight,
  drawPickedHighlight,
  drawDropHighlight,
  drawWheat,
  drawCorn,
  drawBarn,
  getTex,
  BARN_W,
  BARN_H,
} from "./common/helpers/drawing.helpers";
import {
  GRASS_TEXTURE_ALIAS,
  TREE_TEXTURE_ALIAS,
  BED_TEXTURE_ALIAS,
  BARN_TEXTURE_ALIAS,
} from "@/common/types/aliases/texture.aliases";

const GHOST_ALPHA = 0.3;
const TREE_W = 64;
const TREE_H = 96;

export class SceneRenderer {
  private readonly world: PIXI.Container;

  private grassSprites: PIXI.Sprite[][] = [];
  private grassInitialized = false;

  private objectGfxPool: PIXI.Graphics[] = [];

  private treeSprites: Map<string, PIXI.Sprite> = new Map();
  private bedSprites: Map<string, PIXI.Sprite> = new Map();
  private barnSprites: Map<string, PIXI.Sprite> = new Map();

  private bedPreviewSprite: PIXI.Sprite | null = null;
  private barnPreviewSprite: PIXI.Sprite | null = null;

  readonly layerPreview: PIXI.Graphics;

  constructor(world: PIXI.Container) {
    this.world = world;

    this.layerPreview = new PIXI.Graphics();
    this.layerPreview.zIndex = 9999;
    world.addChild(this.layerPreview);
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
        sprite.visible = tile.type === "grass" || tile.type === "tree";

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
        sprite.zIndex = 2 + obj.sortKey;
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
            const { type, stage, pending } = tile.crop;
            const cropAlpha = pending || tile.crop.pendingHarvest ? 0.4 : 1;

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
        drawBarn(
          this.world,
          this.barnSprites,
          key,
          obj.ox,
          obj.oy,
          obj.alpha,
          obj.sortKey,
        );
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

  drawPreview(
    grid: GridType,
    hover: { x: number; y: number },
    mode: ModeType,
    heldItem: IMovingTile | null,
    inv: { bedInv: number; treeInv: number; barnInv: number },
  ): void {
    const lp = this.layerPreview;
    lp.clear();
    lp.alpha = 1;

    if (this.bedPreviewSprite) this.bedPreviewSprite.visible = false;
    if (this.barnPreviewSprite) this.barnPreviewSprite.visible = false;

    const { x: hx, y: hy } = hover;

    if (mode === "move") {
      this.drawMovePreview(lp, grid, hover, heldItem);
      return;
    }

    if (!inBounds(hx, hy)) return;
    const { x: sx, y: sy } = isoToScreen(hx, hy);
    drawHoverHighlight(lp, sx, sy);

    const tile = grid[hy][hx];

    if (mode === "bed" && inv.bedInv > 0 && tile.type === "grass") {
      this.showBedPreview(sx, sy);
    } else if (mode === "tree" && inv.treeInv > 0 && tile.type === "grass") {
      drawTree(lp, sx, sy, 0.5);
    } else if (
      mode === "barn" &&
      inv.barnInv > 0 &&
      canPlaceBarn(grid, hx, hy)
    ) {
      this.showBarnPreview(hx, hy);
    }
  }

  drawCropDragPreview(
    grid: GridType,
    iso: { x: number; y: number } | null,
    cropType: CropType | null,
  ): void {
    const lp = this.layerPreview;
    lp.clear();
    lp.alpha = 1;

    if (this.bedPreviewSprite) this.bedPreviewSprite.visible = false;
    if (this.barnPreviewSprite) this.barnPreviewSprite.visible = false;

    if (!iso || !cropType) return;
    if (!inBounds(iso.x, iso.y)) return;

    const tile = grid[iso.y][iso.x];
    const { x: sx, y: sy } = isoToScreen(iso.x, iso.y);
    const tw = PLAYGROUND.TILE_WIDTH / 2;
    const th = PLAYGROUND.TILE_HEIGHT;
    const diamond = [
      sx,
      sy,
      sx + tw,
      sy + th / 2,
      sx,
      sy + th,
      sx - tw,
      sy + th / 2,
    ];
    const canPlant = tile.type === "bed" && !tile.crop;

    lp.poly(diamond);
    lp.fill({
      color: canPlant ? 0x00ff88 : 0xff4444,
      alpha: canPlant ? 0.35 : 0.25,
    });
    lp.poly(diamond);
    lp.stroke({
      color: canPlant ? 0x00ff88 : 0xff4444,
      alpha: canPlant ? 0.9 : 0.7,
      width: canPlant ? 2 : 1.5,
    });

    if (canPlant) {
      if (cropType === "wheat") drawWheat(lp, sx, sy, "seedling", 0.7);
      else drawCorn(lp, sx, sy, "seedling", 0.7);
    }
  }

  clearPreview(): void {
    this.layerPreview.clear();
    this.layerPreview.alpha = 1;
    if (this.bedPreviewSprite) this.bedPreviewSprite.visible = false;
    if (this.barnPreviewSprite) this.barnPreviewSprite.visible = false;
  }

  destroy(): void {
    for (const row of this.grassSprites) {
      for (const sprite of row) sprite?.destroy();
    }
    this.grassSprites = [];

    for (const sprite of this.treeSprites.values()) sprite.destroy();
    this.treeSprites.clear();

    for (const sprite of this.bedSprites.values()) sprite.destroy();
    this.bedSprites.clear();

    for (const sprite of this.barnSprites.values()) sprite.destroy();
    this.barnSprites.clear();

    this.bedPreviewSprite?.destroy();
    this.bedPreviewSprite = null;

    this.barnPreviewSprite?.destroy();
    this.barnPreviewSprite = null;
  }

  private showBedPreview(sx: number, sy: number): void {
    const bedTex = getTex(BED_TEXTURE_ALIAS);
    if (!bedTex) return;

    if (!this.bedPreviewSprite) {
      this.bedPreviewSprite = new PIXI.Sprite(bedTex);
      this.bedPreviewSprite.anchor.set(0.5, 0);
      this.bedPreviewSprite.zIndex = 9998;
      this.world.addChild(this.bedPreviewSprite);
    }

    this.bedPreviewSprite.x = sx;
    this.bedPreviewSprite.y = sy;
    this.bedPreviewSprite.width = PLAYGROUND.TILE_WIDTH;
    this.bedPreviewSprite.height = PLAYGROUND.TILE_HEIGHT;
    this.bedPreviewSprite.alpha = 0.5;
    this.bedPreviewSprite.visible = true;
  }

  private showBarnPreview(hx: number, hy: number): void {
    const barnTex = getTex(BARN_TEXTURE_ALIAS);
    if (!barnTex) return;

    if (!this.barnPreviewSprite) {
      this.barnPreviewSprite = new PIXI.Sprite(barnTex);
      this.barnPreviewSprite.anchor.set(0.5, 1);
      this.barnPreviewSprite.zIndex = 9998;
      this.world.addChild(this.barnPreviewSprite);
    }

    const { x: sx, y: sy } = isoToScreen(hx + 1, hy + 1);
    this.barnPreviewSprite.x = sx;
    this.barnPreviewSprite.y = sy + PLAYGROUND.TILE_HEIGHT + 16;
    this.barnPreviewSprite.width = BARN_W;
    this.barnPreviewSprite.height = BARN_H;
    this.barnPreviewSprite.alpha = 0.5;
    this.barnPreviewSprite.visible = true;
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

  private drawMovePreview(
    lp: PIXI.Graphics,
    grid: GridType,
    hover: { x: number; y: number },
    heldItem: IMovingTile | null,
  ): void {
    const { x: hx, y: hy } = hover;

    if (heldItem) {
      if (!inBounds(hx, hy)) return;
      const { x: sx, y: sy } = isoToScreen(hx, hy);
      let canPlace = false;

      if (heldItem.type === "barn") {
        canPlace = canPlaceBarn(grid, hx, hy, {
          x: heldItem.fromX,
          y: heldItem.fromY,
        });
      } else {
        const tile = grid[hy][hx];
        canPlace =
          tile.type === "grass" ||
          (hx === heldItem.fromX && hy === heldItem.fromY);
      }

      drawDropHighlight(lp, sx, sy, canPlace);

      if (heldItem.type === "bed") this.showBedPreview(sx, sy);
      if (heldItem.type === "tree") drawTree(lp, sx, sy, 0.5);
      if (heldItem.type === "barn" && canPlace) this.showBarnPreview(hx, hy);
    } else {
      if (!inBounds(hx, hy)) return;
      const tile = grid[hy][hx];
      const { x: sx, y: sy } = isoToScreen(hx, hy);

      if (tile.type !== "grass") {
        const originX = tile.barnOrigin?.x ?? hx;
        const originY = tile.barnOrigin?.y ?? hy;

        if (tile.type === "barn") {
          for (let dy = 0; dy < 2; dy++)
            for (let dx = 0; dx < 2; dx++) {
              const { x: ts, y: tsy } = isoToScreen(originX + dx, originY + dy);
              drawPickedHighlight(lp, ts, tsy);
            }
        } else {
          drawPickedHighlight(lp, sx, sy);
        }
      } else {
        drawHoverHighlight(lp, sx, sy);
      }
    }
  }
}
