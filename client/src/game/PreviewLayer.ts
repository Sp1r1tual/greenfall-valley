import * as PIXI from "pixi.js";

import type {
  GridType,
  ModeType,
  IMovingTile,
  CropType,
} from "../common/types";
import {
  BED_TEXTURE_ALIAS,
  BARN_TEXTURE_ALIAS,
} from "@/common/types/aliases/texture.aliases";

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
  getTex,
  BARN_W,
  BARN_H,
} from "./common/helpers/drawing.helpers";
import { drawWheat, drawCorn } from "./common/helpers/crop-drawing.helpers";

export class PreviewLayer {
  private bedPreviewSprite: PIXI.Sprite | null = null;
  private barnPreviewSprite: PIXI.Sprite | null = null;
  public readonly layerPreview: PIXI.Graphics;

  private readonly world: PIXI.Container;

  constructor(world: PIXI.Container) {
    this.world = world;
    this.layerPreview = new PIXI.Graphics();
    this.layerPreview.zIndex = 9999;
    world.addChild(this.layerPreview);
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

    const tile = grid[hy][hx];

    if (mode === "bed" && inv.bedInv > 0) {
      const canPlace = tile.type === "grass";
      drawDropHighlight(lp, sx, sy, canPlace);
      if (canPlace) this.showBedPreview(sx, sy);
    } else if (mode === "tree" && inv.treeInv > 0) {
      const canPlace = tile.type === "grass";
      drawDropHighlight(lp, sx, sy, canPlace);
      if (canPlace) drawTree(lp, sx, sy, 0.5);
    } else if (mode === "barn" && inv.barnInv > 0) {
      this.drawBarnPlacementHighlight(lp, grid, hx, hy);
      if (canPlaceBarn(grid, hx, hy)) this.showBarnPreview(hx, hy);
    } else {
      drawHoverHighlight(lp, sx, sy);
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

  private drawMovePreview(
    lp: PIXI.Graphics,
    grid: GridType,
    hover: { x: number; y: number },
    heldItem: IMovingTile | null,
  ): void {
    const { x: hx, y: hy } = hover;

    if (heldItem) {
      if (!inBounds(hx, hy)) return;

      if (heldItem.type === "barn") {
        const canPlace = canPlaceBarn(grid, hx, hy, {
          x: heldItem.fromX,
          y: heldItem.fromY,
        });
        this.drawBarnPlacementHighlight(lp, grid, hx, hy, {
          x: heldItem.fromX,
          y: heldItem.fromY,
        });
        if (canPlace) this.showBarnPreview(hx, hy);
      } else {
        const { x: sx, y: sy } = isoToScreen(hx, hy);
        const tile = grid[hy][hx];
        const canPlace =
          tile.type === "grass" ||
          (hx === heldItem.fromX && hy === heldItem.fromY);

        drawDropHighlight(lp, sx, sy, canPlace);

        if (heldItem.type === "bed" && canPlace) this.showBedPreview(sx, sy);
        if (heldItem.type === "tree" && canPlace) drawTree(lp, sx, sy, 0.5);
      }
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

  private drawBarnPlacementHighlight(
    lp: PIXI.Graphics,
    grid: GridType,
    hx: number,
    hy: number,
    ignoreOrigin?: { x: number; y: number },
  ): void {
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const tx = hx + dx;
        const ty = hy + dy;
        if (!inBounds(tx, ty)) continue;

        const { x: sx, y: sy } = isoToScreen(tx, ty);
        const tile = grid[ty][tx];

        let canPlace: boolean;
        if (
          ignoreOrigin &&
          tile.type === "barn" &&
          tile.barnOrigin?.x === ignoreOrigin.x &&
          tile.barnOrigin?.y === ignoreOrigin.y
        ) {
          canPlace = true;
        } else {
          canPlace = tile.type === "grass";
        }

        drawDropHighlight(lp, sx, sy, canPlace);
      }
    }
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

  destroy(): void {
    this.layerPreview.destroy();
    this.bedPreviewSprite?.destroy();
    this.bedPreviewSprite = null;
    this.barnPreviewSprite?.destroy();
    this.barnPreviewSprite = null;
  }
}
