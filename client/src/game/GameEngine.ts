import * as PIXI from "pixi.js";

import type {
  ModeType,
  GridType,
  IGameEngineCallbacks,
  IInventorySnapshot,
  CropType,
} from "../common/types";

import { SceneRenderer } from "./Renderer";
import { CropManager } from "./CropManager";
import { TileInteractionHandler } from "./TileInteractionHandler";
import { InputController } from "./InputController";
import { Character } from "./Character";
import { TaskQueue } from "./TaskQueue";
import { ShopService } from "./ShopService";

import { loadGameTextures } from "./common/utils/texture-loader.util";
import {
  BG_COLOR,
  PLAYGROUND,
  CROP_REWARD,
} from "./common/configs/game.config";
import {
  createGrid,
  screenToIso,
  inBounds,
} from "./common/helpers/grid.helpers";
import {
  computeAllGrassTiles,
  recomputeGrassAround,
} from "./common/helpers/grass.helpers";

interface IGameContext {
  app: PIXI.Application;
  world: PIXI.Container;
  renderer: SceneRenderer;
  input: InputController;
  character: Character;
}

export class GameEngine {
  private ctx: IGameContext | null = null;

  private grid: GridType = createGrid();
  private destroyed = false;
  private readonly cb: IGameEngineCallbacks;

  private cropTickInterval: ReturnType<typeof setInterval> | null = null;

  private shop!: ShopService;
  private tasks!: TaskQueue;
  private interaction!: TileInteractionHandler;

  private onResize = () => {
    if (!this.ctx) return;
    computeAllGrassTiles(this.grid);
    this.C.renderer.initGrassSprites(this.grid);
    this.redrawStatic();
  };

  constructor(cb: IGameEngineCallbacks) {
    this.cb = cb;
  }

  private get C(): IGameContext {
    if (!this.ctx) throw new Error("GameEngine not initialized");
    return this.ctx;
  }

  async init(container: HTMLDivElement): Promise<void> {
    const app = new PIXI.Application();
    await app.init({ background: BG_COLOR, antialias: true, resizeTo: window });

    if (this.destroyed) {
      app.destroy(true, { children: true });
      return;
    }

    container.appendChild(app.canvas as HTMLCanvasElement);

    await loadGameTextures();

    const world = new PIXI.Container();
    world.sortableChildren = true;
    app.stage.addChild(world);
    app.stage.eventMode = "static";
    app.stage.hitArea = { contains: () => true } as PIXI.IHitArea;

    const renderer = new SceneRenderer(world);
    const character = new Character(
      Math.floor(PLAYGROUND.GRID_W / 2),
      Math.floor(PLAYGROUND.GRID_H / 2),
    );
    world.addChild(character.container);

    this.shop = new ShopService(
      (text, type) => this.cb.onMessage(text, type),
      (mode) => this.interaction?.forceMode(mode),
    );

    this.tasks = new TaskQueue({
      grid: this.grid,
      goWorkAt: (grid, x, y, duration, onDone) =>
        character.goWorkAt(grid, x, y, duration, onDone),
      onMessage: (text, type) => this.cb.onMessage(text, type),
      onRedraw: () => this.redrawStatic(),
      onInventory: () => this.emitInventory(),
      onCropReward: (type) => this.shop.addCoins(CROP_REWARD[type]),
    });

    this.interaction = new TileInteractionHandler({
      grid: this.grid,
      shop: this.shop,
      tasks: this.tasks,
      character: character,
      cb: this.cb,
      notifyTileChanged: (x, y) => this.notifyTileChanged(x, y),
      redrawStatic: () => this.redrawStatic(),
      emitInventory: () => this.emitInventory(),
      forceMode: (mode) => this.interaction?.forceMode(mode),
    });

    const input = new InputController(
      app.stage,
      world,
      app.canvas as HTMLCanvasElement,
      {
        onHoverChange: (x, y) => {
          if (this.interaction.handleHoverChange(x, y)) {
            this.redrawPreview();
          }
        },
        onHoverLeave: () => {
          this.interaction.handleHoverLeave();
          this.C.renderer.clearPreview();
        },
        onTileClick: (x, y) => this.interaction.handleTileClick(x, y),
        onEscape: () => {
          if (this.interaction.HeldItem) this.interaction.cancelMove();
        },
        onZoomChange: this.cb.onZoomChange,
      },
    );
    input.attach();

    this.ctx = { app, world, renderer, input, character };

    computeAllGrassTiles(this.grid);
    renderer.initGrassSprites(this.grid);

    app.ticker.add((ticker) => {
      character.update(ticker.deltaMS / 1000, this.grid);
    });

    window.addEventListener("resize", this.onResize);

    this.cropTickInterval = setInterval(() => {
      if (CropManager.tickCrops(this.grid, this.cb.onCropReady)) {
        this.redrawStatic();
      }
    }, 1000);

    this.redrawStatic();
    this.emitInventory();
  }

  destroy(): void {
    window.removeEventListener("resize", this.onResize);
    this.ctx?.input.detach();
    this.ctx?.renderer.destroy();
    this.destroyed = true;
    if (this.cropTickInterval !== null) {
      clearInterval(this.cropTickInterval);
      this.cropTickInterval = null;
    }
    this.ctx?.app.destroy(true, { children: true });
    this.ctx = null;
  }

  getIsoAtScreenPos(
    clientX: number,
    clientY: number,
  ): { x: number; y: number } | null {
    if (!this.ctx) return null;
    const { world, app } = this.ctx;
    const canvas = app.canvas as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();

    const scaleX = app.renderer.width / rect.width;
    const scaleY = app.renderer.height / rect.height;

    const localX = ((clientX - rect.left) * scaleX - world.x) / world.scale.x;
    const localY = ((clientY - rect.top) * scaleY - world.y) / world.scale.y;

    const iso = screenToIso(localX, localY);
    if (!inBounds(iso.x, iso.y)) return null;
    return iso;
  }

  tryPlantAt(clientX: number, clientY: number, cropType: CropType): boolean {
    const iso = this.getIsoAtScreenPos(clientX, clientY);
    if (!iso) return false;
    if (CropManager.plantCrop(this.grid, iso.x, iso.y, cropType, this.tasks)) {
      this.redrawStatic();
      this.tasks.process();
      return true;
    }
    return false;
  }

  setDragHover(clientX: number, clientY: number, cropType: CropType): void {
    const iso = this.getIsoAtScreenPos(clientX, clientY);
    this.C.renderer.drawCropDragPreview(this.grid, iso, cropType);
  }

  clearDragHover(): void {
    this.C.renderer.clearPreview();
  }

  setMode(mode: ModeType): void {
    this.interaction.setMode(mode);
    this.redrawPreview();
  }

  buyBed(): void {
    this.shop.buyBed();
    this.emitInventory();
  }

  buyTree(): void {
    this.shop.buyTree();
    this.emitInventory();
  }

  buyBarn(): void {
    this.shop.buyBarn();
    this.emitInventory();
  }

  getInventorySnapshot(): IInventorySnapshot {
    return this.shop.getState();
  }

  private notifyTileChanged(x: number, y: number): void {
    recomputeGrassAround(this.grid, x, y);
    this.C.renderer.updateGrassSprites(this.grid, x, y);
  }

  private redrawStatic(): void {
    this.C.renderer.drawStatic(this.grid, this.interaction?.HeldItem || null);
    this.redrawPreview();
  }

  private redrawPreview(): void {
    if (!this.interaction) return;
    const { bedInv, treeInv, barnInv } = this.shop.getState();
    this.C.renderer.drawPreview(
      this.grid,
      this.interaction.Hover,
      this.interaction.Mode,
      this.interaction.HeldItem,
      { bedInv, treeInv, barnInv },
    );
  }

  private emitInventory(): void {
    this.cb.onInventoryChange(this.getInventorySnapshot());
  }
}
