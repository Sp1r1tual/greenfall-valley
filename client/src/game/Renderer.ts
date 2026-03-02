import * as PIXI from "pixi.js";

import type {
  GridType,
  ModeType,
  IMovingTile,
  CropType,
} from "../common/types";

import { GrassLayer } from "./GrassLayer";
import { ObjectLayer } from "./ObjectLayer";
import { PreviewLayer } from "./PreviewLayer";

export class SceneRenderer {
  private readonly grassLayer: GrassLayer;
  private readonly objectLayer: ObjectLayer;
  private readonly previewLayer: PreviewLayer;

  constructor(world: PIXI.Container) {
    this.grassLayer = new GrassLayer(world);
    this.objectLayer = new ObjectLayer(world);
    this.previewLayer = new PreviewLayer(world);
  }

  initGrassSprites(grid: GridType): void {
    this.grassLayer.initGrassSprites(grid);
  }

  updateGrassSprites(grid: GridType, cx: number, cy: number): void {
    this.grassLayer.updateGrassSprites(grid, cx, cy);
  }

  drawStatic(grid: GridType, heldItem?: IMovingTile | null): void {
    this.objectLayer.drawStatic(grid, heldItem);
  }

  drawPreview(
    grid: GridType,
    hover: { x: number; y: number },
    mode: ModeType,
    heldItem: IMovingTile | null,
    inv: { bedInv: number; treeInv: number; barnInv: number },
  ): void {
    this.previewLayer.drawPreview(grid, hover, mode, heldItem, inv);
  }

  drawCropDragPreview(
    grid: GridType,
    iso: { x: number; y: number } | null,
    cropType: CropType | null,
  ): void {
    this.previewLayer.drawCropDragPreview(grid, iso, cropType);
  }

  clearPreview(): void {
    this.previewLayer.clearPreview();
  }

  destroy(): void {
    this.grassLayer.destroy();
    this.objectLayer.destroy();
    this.previewLayer.destroy();
  }
}
