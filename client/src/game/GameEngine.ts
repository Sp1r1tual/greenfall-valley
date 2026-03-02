import * as PIXI from "pixi.js";

import type {
  ModeType,
  GridType,
  IMovingTile,
  IGameEngineCallbacks,
  IInventorySnapshot,
  CropType,
} from "../common/types";

import { SceneRenderer } from "./Renderer";
import { InputController } from "./InputController";
import { Character } from "./Character";
import { TaskQueue } from "./TaskQueue";
import { ShopService } from "./ShopService";
import { loadGameTextures } from "./common/utils/texture-loader.util";

import {
  PLAYGROUND,
  CROP_GROW_MS,
  CROP_REWARD,
} from "./common/configs/game.config";
import {
  createGrid,
  canPlaceBarn,
  screenToIso,
  inBounds,
} from "./common/helpers/grid.helpers";
import {
  computeAllGrassTiles,
  recomputeGrassAround,
} from "./common/helpers/drawing.helpers";

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
  private heldItem: IMovingTile | null = null;
  private mode: ModeType = "walk";
  private hover = { x: -1, y: -1 };

  private initialized = true;
  private readonly cb: IGameEngineCallbacks;

  private cropTickInterval: ReturnType<typeof setInterval> | null = null;

  private shop!: ShopService;
  private tasks!: TaskQueue;

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
    await app.init({ background: 0x4a9e2e, antialias: true, resizeTo: window });

    if (!this.initialized) {
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

    const input = new InputController(
      app.stage,
      world,
      app.canvas as HTMLCanvasElement,
      {
        onHoverChange: (x, y) => {
          if (x !== this.hover.x || y !== this.hover.y) {
            this.hover = { x, y };
            this.redrawPreview();
          }
        },
        onHoverLeave: () => {
          this.hover = { x: -1, y: -1 };
          this.C.renderer.clearPreview();
        },
        onTileClick: (x, y) => this.handleTileClick(x, y),
        onEscape: () => {
          if (this.heldItem) this.cancelMove();
        },
        onZoomChange: this.cb.onZoomChange,
      },
    );
    input.attach();

    this.ctx = { app, world, renderer, input, character };

    this.shop = new ShopService(
      (text, type) => this.cb.onMessage(text, type),
      (mode) => this.forceMode(mode),
    );

    this.tasks = new TaskQueue({
      grid: this.grid,
      goWorkAt: (grid, x, y, duration, onDone) =>
        character.goWorkAt(grid, x, y, duration, onDone),
      onMessage: (text, type) => this.cb.onMessage(text, type),
      onRedraw: () => this.redrawStatic(),
      onInventory: () => this.emitInventory(),
      onCropReward: (type) => {
        this.shop.addCoins(CROP_REWARD[type]);
      },
    });

    computeAllGrassTiles(this.grid);
    renderer.initGrassSprites(this.grid);

    app.ticker.add((ticker) => {
      character.update(ticker.deltaMS / 1000, this.grid);
    });

    window.addEventListener("resize", this.onResize);

    this.cropTickInterval = setInterval(() => this.tickCrops(), 1000);

    this.redrawStatic();
    this.emitInventory();
  }

  destroy(): void {
    window.removeEventListener("resize", this.onResize);
    this.ctx?.input.detach();
    this.ctx?.renderer.destroy();
    this.initialized = false;
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
    const tile = this.grid[iso.y][iso.x];
    if (tile.type !== "bed" || tile.crop) return false;

    tile.crop = {
      type: cropType,
      plantedAt: 0,
      growthMs: CROP_GROW_MS[cropType],
      stage: "seedling",
      pending: true,
    };
    this.tasks.push({ kind: "plant", x: iso.x, y: iso.y, cropType });
    this.redrawStatic();
    this.tasks.process();
    return true;
  }

  setDragHover(clientX: number, clientY: number, cropType: CropType): void {
    const iso = this.getIsoAtScreenPos(clientX, clientY);
    this.C.renderer.drawCropDragPreview(this.grid, iso, cropType);
  }

  clearDragHover(): void {
    this.C.renderer.clearPreview();
  }

  setMode(mode: ModeType): void {
    if (this.heldItem && mode !== "move") this.cancelMove();

    const { bedInv, treeInv, barnInv } = this.shop.getState();
    const isPlacement = ["bed", "tree", "barn", "grass", "clear"].includes(
      mode,
    );
    const hasStock =
      (mode === "bed" && bedInv > 0) ||
      (mode === "tree" && treeInv > 0) ||
      (mode === "barn" && barnInv > 0);

    const next = isPlacement && this.mode === mode && !hasStock ? "walk" : mode;
    this.mode = next as ModeType;
    this.cb.onModeChange(next as ModeType);
    this.redrawPreview();
  }

  private forceMode(mode: ModeType): void {
    this.mode = mode;
    this.cb.onModeChange(mode);
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

  plantCrop(gridX: number, gridY: number, cropType: CropType): void {
    const tile = this.grid[gridY]?.[gridX];
    if (!tile || tile.type !== "bed" || tile.crop) return;
    tile.crop = {
      type: cropType,
      plantedAt: 0,
      growthMs: CROP_GROW_MS[cropType],
      stage: "seedling",
      pending: true,
    };
    this.tasks.push({ kind: "plant", x: gridX, y: gridY, cropType });
    this.redrawStatic();
    this.tasks.process();
  }

  cancelMove(): void {
    const held = this.heldItem;
    if (!held) return;

    if (held.type === "barn") {
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) {
          this.grid[held.fromY + dy][held.fromX + dx].type = "barn";
          this.grid[held.fromY + dy][held.fromX + dx].barnOrigin = {
            x: held.fromX,
            y: held.fromY,
          };
        }
    } else {
      this.grid[held.fromY][held.fromX].type = held.type;
    }

    this.heldItem = null;
    this.cb.onHoldingChange(false);
    this.redrawStatic();
  }

  getInventorySnapshot(): IInventorySnapshot {
    return this.shop.getState();
  }

  private tickCrops(): void {
    const now = Date.now();
    let needsRedraw = false;

    for (let y = 0; y < PLAYGROUND.GRID_H; y++) {
      for (let x = 0; x < PLAYGROUND.GRID_W; x++) {
        const tile = this.grid[y][x];
        if (tile.type !== "bed" || !tile.crop) continue;
        if (tile.crop.pending || tile.crop.plantedAt === 0) continue;

        const { crop } = tile;
        const ratio = (now - crop.plantedAt) / crop.growthMs;
        const newStage =
          ratio >= 1 ? "ready" : ratio >= 0.4 ? "growing" : "seedling";

        if (newStage !== crop.stage) {
          crop.stage = newStage;
          needsRedraw = true;
          if (newStage === "ready") this.cb.onCropReady(x, y);
        }
      }
    }

    if (needsRedraw) this.redrawStatic();
  }

  private handleTileClick(ix: number, iy: number): void {
    const tile = this.grid[iy][ix];
    const { bedInv, treeInv, barnInv } = this.shop.getState();

    if (this.mode === "move") {
      this.handleMoveMode(ix, iy, tile);
      return;
    }
    if (this.mode === "clear" || this.mode === "grass") {
      this.handleClearMode(ix, iy, tile);
      return;
    }

    if (this.mode === "bed") {
      if (bedInv > 0 && tile.type === "grass") {
        this.shop.consumeBed();
        this.grid[iy][ix].type = "bed";
        this.notifyTileChanged(ix, iy);
        this.emitInventory();
        this.redrawStatic();
        if (this.shop.getState().bedInv === 0) this.forceMode("walk");
      } else if (bedInv === 0) {
        this.cb.onMessage("❌ Немає грядок! Візьми в магазині", "error");
      }
      return;
    }

    if (this.mode === "tree") {
      if (treeInv > 0 && tile.type === "grass") {
        this.shop.consumeTree();
        this.grid[iy][ix].type = "tree";
        this.notifyTileChanged(ix, iy);
        this.emitInventory();
        this.redrawStatic();
        if (this.shop.getState().treeInv === 0) this.forceMode("walk");
      } else if (treeInv === 0) {
        this.cb.onMessage(
          "❌ Немає дерев! Купи в магазині за 50 монет",
          "error",
        );
      }
      return;
    }

    if (this.mode === "barn") {
      if (barnInv > 0) {
        if (canPlaceBarn(this.grid, ix, iy)) {
          this.shop.consumeBarn();
          for (let dy = 0; dy < 2; dy++)
            for (let dx = 0; dx < 2; dx++) {
              this.grid[iy + dy][ix + dx].type = "barn";
              this.grid[iy + dy][ix + dx].barnOrigin = { x: ix, y: iy };
            }

          for (let dy = 0; dy < 2; dy++)
            for (let dx = 0; dx < 2; dx++)
              this.notifyTileChanged(ix + dx, iy + dy);
          this.emitInventory();
          this.redrawStatic();
          if (this.shop.getState().barnInv === 0) this.forceMode("walk");
        } else {
          this.cb.onMessage(
            "❌ Потрібно 2x2 вільних клітинок для сараю!",
            "error",
          );
        }
      } else {
        this.cb.onMessage(
          "❌ Немає сараїв! Купи в магазині за 200 монет",
          "error",
        );
      }
      return;
    }

    if (this.mode === "walk") {
      if (tile.type === "bed") {
        if (tile.crop?.stage === "ready" && !tile.crop.pending) {
          tile.crop.pendingHarvest = true;
          this.tasks.push({ kind: "harvest", x: ix, y: iy });
          this.tasks.process();
          this.redrawStatic();
          this.cb.onMessage("🌾 Відправляю збирати врожай…", "normal");
        } else if (!tile.crop) {
          this.cb.onBedClick(ix, iy);
        } else if (tile.crop.pending) {
          const queuePos = this.tasks.pendingPlantCount;
          this.cb.onMessage(
            `⏳ В черзі на посів (ще ${queuePos + (this.tasks.isExecuting ? 1 : 0)} задач)…`,
            "normal",
          );
        } else {
          const remaining = Math.ceil(
            (tile.crop.growthMs - (Date.now() - tile.crop.plantedAt)) / 1000,
          );
          const lbl = tile.crop.type === "wheat" ? "Пшениця" : "Кукурудза";
          this.cb.onMessage(`⏳ ${lbl} росте… ще ~${remaining}с`, "normal");
        }
        return;
      }

      if (tile.type === "barn" || tile.type === "tree") return;

      this.C.character.moveTo(this.grid, ix, iy);
    }
  }

  private handleMoveMode(
    ix: number,
    iy: number,
    tile: GridType[number][number],
  ): void {
    if (!this.heldItem) {
      if (tile.type === "grass") return;

      const originX = tile.barnOrigin?.x ?? ix;
      const originY = tile.barnOrigin?.y ?? iy;
      const itemType = tile.type as "bed" | "tree" | "barn";

      if (itemType === "barn") {
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++) {
            this.grid[originY + dy][originX + dx].type = "grass";
            delete this.grid[originY + dy][originX + dx].barnOrigin;
          }
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++)
            this.notifyTileChanged(originX + dx, originY + dy);
      } else {
        this.grid[iy][ix].type = "grass";
        this.notifyTileChanged(ix, iy);
      }

      this.heldItem = { type: itemType, fromX: originX, fromY: originY };
      this.cb.onHoldingChange(true);
      this.redrawStatic();
    } else {
      const held = this.heldItem;
      const canPlace =
        held.type === "barn"
          ? canPlaceBarn(this.grid, ix, iy, { x: held.fromX, y: held.fromY })
          : tile.type === "grass";

      if (!canPlace) {
        this.cb.onMessage("❌ Сюди не можна поставити!", "error");
        return;
      }

      if (held.type === "barn") {
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++) {
            this.grid[iy + dy][ix + dx].type = "barn";
            this.grid[iy + dy][ix + dx].barnOrigin = { x: ix, y: iy };
          }
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++)
            this.notifyTileChanged(ix + dx, iy + dy);
      } else {
        this.grid[iy][ix].type = held.type;
        this.notifyTileChanged(ix, iy);
      }

      this.heldItem = null;
      this.cb.onHoldingChange(false);
      this.redrawStatic();
    }
  }

  private handleClearMode(
    ix: number,
    iy: number,
    tile: GridType[number][number],
  ): void {
    if (tile.type === "bed") {
      this.shop.returnBed();
      this.grid[iy][ix].type = "grass";
      delete this.grid[iy][ix].crop;
      this.tasks.clear(ix, iy);
      this.notifyTileChanged(ix, iy);
    } else if (tile.type === "tree") {
      this.shop.returnTree();
      this.grid[iy][ix].type = "grass";
      this.notifyTileChanged(ix, iy);
    } else if (tile.type === "barn" && tile.barnOrigin) {
      const { x: ox, y: oy } = tile.barnOrigin;
      this.shop.returnBarn();
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) {
          this.grid[oy + dy][ox + dx].type = "grass";
          delete this.grid[oy + dy][ox + dx].barnOrigin;
        }
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) this.notifyTileChanged(ox + dx, oy + dy);
    } else {
      return;
    }
    this.emitInventory();
    this.redrawStatic();
  }

  private notifyTileChanged(x: number, y: number): void {
    recomputeGrassAround(this.grid, x, y);
    this.C.renderer.updateGrassSprites(this.grid, x, y);
  }

  private redrawStatic(): void {
    this.C.renderer.drawStatic(this.grid, this.heldItem);
    this.redrawPreview();
  }

  private redrawPreview(): void {
    const { bedInv, treeInv, barnInv } = this.shop.getState();
    this.C.renderer.drawPreview(
      this.grid,
      this.hover,
      this.mode,
      this.heldItem,
      { bedInv, treeInv, barnInv },
    );
  }

  private emitInventory(): void {
    this.cb.onInventoryChange(this.getInventorySnapshot());
  }
}
