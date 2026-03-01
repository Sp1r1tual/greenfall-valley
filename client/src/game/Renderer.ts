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
  drawBed,
  drawTree,
  drawBarnGraphics,
  drawHoverHighlight,
  drawPickedHighlight,
  drawDropHighlight,
  drawWheat,
  drawCorn,
  getTex,
} from "./common/helpers/drawing.helpers";
import { GRASS_TEXTURE_ALIAS } from "@/common/types/aliases/texture.aliases";

const GHOST_ALPHA = 0.3;

export class SceneRenderer {
  private readonly world: PIXI.Container;

  private grassSprites: PIXI.Sprite[][] = [];
  private grassInitialized = false;

  private objectGfxPool: PIXI.Graphics[] = [];

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
        sprite.visible = tile.type === "grass";

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
    sprite.visible = tile.type === "grass";
  }

  private refreshAllGrassSprites(grid: GridType): void {
    for (let y = 0; y < PLAYGROUND.GRID_H; y++) {
      for (let x = 0; x < PLAYGROUND.GRID_W; x++) {
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

    this.syncPool(objects.length);

    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      const gfx = this.objectGfxPool[i];

      gfx.clear();
      gfx.visible = true;
      gfx.zIndex = 2 + obj.sortKey;

      if (obj.kind === "bed") {
        const { x: sx, y: sy } = isoToScreen(obj.x, obj.y);
        drawBed(gfx, sx, sy, obj.alpha);

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
        const { x: sx, y: sy } = isoToScreen(obj.ox, obj.oy);
        drawBarnGraphics(gfx, sx, sy, obj.alpha);
      } else {
        const { x: sx, y: sy } = isoToScreen(obj.x, obj.y);
        drawTree(gfx, sx, sy, obj.alpha);
      }
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

    const { x: hx, y: hy } = hover;

    if (mode === "move") {
      this.drawMovePreview(lp, grid, hover, heldItem);
      return;
    }

    if (!inBounds(hx, hy)) return;
    const { x: sx, y: sy } = isoToScreen(hx, hy);
    drawHoverHighlight(lp, sx, sy);

    const tile = grid[hy][hx];
    if (mode === "bed" && inv.bedInv > 0 && tile.type === "grass")
      drawBed(lp, sx, sy, 0.5);
    else if (mode === "tree" && inv.treeInv > 0 && tile.type === "grass")
      drawTree(lp, sx, sy, 0.5);
    else if (mode === "barn" && inv.barnInv > 0 && canPlaceBarn(grid, hx, hy))
      drawBarnGraphics(lp, sx, sy, 0.5);
  }

  drawCropDragPreview(
    grid: GridType,
    iso: { x: number; y: number } | null,
    cropType: CropType | null,
  ): void {
    const lp = this.layerPreview;
    lp.clear();
    lp.alpha = 1;

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
  }

  destroy(): void {
    for (const row of this.grassSprites) {
      for (const sprite of row) {
        sprite?.destroy();
      }
    }
    this.grassSprites = [];
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
      if (heldItem.type === "bed") drawBed(lp, sx, sy, 0.5);
      if (heldItem.type === "tree") drawTree(lp, sx, sy, 0.5);
      if (heldItem.type === "barn" && canPlace)
        drawBarnGraphics(lp, sx, sy, 0.5);
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
