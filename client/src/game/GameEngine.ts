import * as PIXI from "pixi.js";

import type {
  ModeType,
  GridType,
  IMovingTile,
  IGameEngineCallbacks,
  IInventorySnapshot,
  CropType,
  TaskType,
} from "../common/types";

import { SceneRenderer } from "./SceneRenderer";
import { InputController } from "./InputController";
import { Character } from "./Character";
import {
  PLAYGROUND,
  CHARACTER,
  CROP_GROW_MS,
  CROP_REWARD,
} from "../common/configs/game.config";
import {
  createGrid,
  canPlaceBarn,
  screenToIso,
  inBounds,
} from "../common/helpers/grid.helpers";

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

  private coins = 1000;
  private bedInv = 0;
  private treeInv = 0;
  private barnInv = 0;
  private treeStock = 5;
  private barnStock = 3;

  private initialized = true;
  private readonly cb: IGameEngineCallbacks;

  private cropTickInterval: ReturnType<typeof setInterval> | null = null;

  private taskQueue: TaskType[] = [];
  private executingTask = false;

  constructor(cb: IGameEngineCallbacks) {
    this.cb = cb;
  }

  private get C(): IGameContext {
    if (!this.ctx) throw new Error("GameEngine not initialized");
    return this.ctx;
  }

  async init(container: HTMLDivElement): Promise<void> {
    const app = new PIXI.Application();
    await app.init({
      background: 0x4a9e2e,
      antialias: true,
      resizeTo: window,
    });

    if (!this.initialized) {
      app.destroy(true, { children: true });
      return;
    }

    container.appendChild(app.canvas as HTMLCanvasElement);

    const world = new PIXI.Container();
    world.sortableChildren = true;
    app.stage.addChild(world);
    app.stage.eventMode = "static";
    app.stage.hitArea = { contains: () => true } as PIXI.IHitArea;

    const renderer = new SceneRenderer(world);

    const startX = Math.floor(PLAYGROUND.GRID_W / 2);
    const startY = Math.floor(PLAYGROUND.GRID_H / 2);
    const character = new Character(startX, startY);
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

    app.ticker.add((ticker) => {
      this.C.character.update(ticker.deltaMS / 1000, this.grid);
    });

    this.cropTickInterval = setInterval(() => this.tickCrops(), 1000);

    this.redrawStatic();
    this.emitInventory();
  }

  destroy(): void {
    this.ctx?.input.detach();
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

    const canvas = this.ctx.app.canvas as HTMLCanvasElement;
    const { world } = this.ctx;

    const rect = canvas.getBoundingClientRect();
    const localX = (clientX - rect.left - world.x) / world.scale.x;
    const localY = (clientY - rect.top - world.y) / world.scale.y;
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

    this.taskQueue.push({ kind: "plant", x: iso.x, y: iso.y, cropType });
    this.redrawStatic();
    this.processQueue();
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

    const isPlacement = ["bed", "tree", "barn", "grass", "clear"].includes(
      mode,
    );
    const hasStock =
      (mode === "bed" && this.bedInv > 0) ||
      (mode === "tree" && this.treeInv > 0) ||
      (mode === "barn" && this.barnInv > 0);

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
    this.bedInv++;
    this.emitInventory();
    this.showMsg("✅ Отримано грядку!", "success");
    this.forceMode("bed");
  }

  buyTree(): void {
    if (this.coins < 50 || this.treeStock === 0) return;
    this.coins -= 50;
    this.treeInv++;
    this.treeStock--;
    this.emitInventory();
    this.showMsg("✅ Куплено дерево!", "success");
    this.forceMode("tree");
  }

  buyBarn(): void {
    if (this.coins < 200 || this.barnStock === 0) return;
    this.coins -= 200;
    this.barnInv++;
    this.barnStock--;
    this.emitInventory();
    this.showMsg("✅ Куплено сарай!", "success");
    this.forceMode("barn");
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
    this.taskQueue.push({ kind: "plant", x: gridX, y: gridY, cropType });
    this.redrawStatic();
    this.processQueue();
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
    return {
      coins: this.coins,
      bedInv: this.bedInv,
      treeInv: this.treeInv,
      barnInv: this.barnInv,
      treeStock: this.treeStock,
      barnStock: this.barnStock,
    };
  }

  private processQueue(): void {
    if (this.executingTask || this.taskQueue.length === 0) return;

    const task = this.taskQueue.shift()!;
    this.executingTask = true;

    if (task.kind === "plant") {
      this.runPlantTask(task);
    } else {
      this.runHarvestTask(task);
    }
  }

  private runPlantTask(task: Extract<TaskType, { kind: "plant" }>): void {
    const tile = this.grid[task.y]?.[task.x];

    if (!tile || tile.type !== "bed" || !tile.crop?.pending) {
      this.executingTask = false;
      this.processQueue();
      return;
    }

    const label = task.cropType === "wheat" ? "пшеницю" : "кукурудзу";
    this.showMsg(`🚜 Іду садити ${label}…`, "normal");

    this.C.character.goWorkAt(
      this.grid,
      task.x,
      task.y,
      CHARACTER.PLANT_DURATION,
      () => {
        const t = this.grid[task.y]?.[task.x];
        if (t?.crop?.pending) {
          t.crop.pending = false;
          t.crop.plantedAt = Date.now();
        }
        this.redrawStatic();

        const lbl = task.cropType === "wheat" ? "Пшениця" : "Кукурудза";
        this.showMsg(`🌱 Посіяно: ${lbl}`, "success");
        this.executingTask = false;
        this.processQueue();
      },
    );
  }

  private runHarvestTask(task: Extract<TaskType, { kind: "harvest" }>): void {
    const tile = this.grid[task.y]?.[task.x];

    if (!tile?.crop || tile.crop.stage !== "ready") {
      this.executingTask = false;
      this.processQueue();
      return;
    }

    const label = tile.crop.type === "wheat" ? "пшеницю" : "кукурудзу";
    this.showMsg(`🚜 Іду збирати ${label}…`, "normal");

    this.C.character.goWorkAt(
      this.grid,
      task.x,
      task.y,
      CHARACTER.HARVEST_DURATION,
      () => {
        const t = this.grid[task.y]?.[task.x];

        if (t?.crop?.stage === "ready") {
          const reward = CROP_REWARD[t.crop.type];
          const lbl = t.crop.type === "wheat" ? "Пшениця" : "Кукурудза";

          this.coins += reward;
          delete t.crop;
          this.emitInventory();
          this.redrawStatic();
          this.showMsg(`🌾 Зібрано: ${lbl} +${reward} монет!`, "success");
        }
        this.executingTask = false;
        this.processQueue();
      },
    );
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

    if (this.mode === "move") {
      this.handleMoveMode(ix, iy, tile);
      return;
    }
    if (this.mode === "clear" || this.mode === "grass") {
      this.handleClearMode(ix, iy, tile);
      return;
    }

    if (this.mode === "bed") {
      if (this.bedInv > 0 && tile.type === "grass") {
        this.bedInv--;
        this.grid[iy][ix].type = "bed";
        this.emitInventory();
        this.redrawStatic();
        if (this.bedInv === 0) this.forceMode("walk");
      } else if (this.bedInv === 0) {
        this.showMsg("❌ Немає грядок! Візьми в магазині", "error");
      }
      return;
    }

    if (this.mode === "tree") {
      if (this.treeInv > 0 && tile.type === "grass") {
        this.treeInv--;
        this.grid[iy][ix].type = "tree";
        this.emitInventory();
        this.redrawStatic();
        if (this.treeInv === 0) this.forceMode("walk");
      } else if (this.treeInv === 0) {
        this.showMsg("❌ Немає дерев! Купи в магазині за 50 монет", "error");
      }
      return;
    }

    if (this.mode === "barn") {
      if (this.barnInv > 0) {
        if (canPlaceBarn(this.grid, ix, iy)) {
          this.barnInv--;
          for (let dy = 0; dy < 2; dy++)
            for (let dx = 0; dx < 2; dx++) {
              this.grid[iy + dy][ix + dx].type = "barn";
              this.grid[iy + dy][ix + dx].barnOrigin = { x: ix, y: iy };
            }
          this.emitInventory();
          this.redrawStatic();
          if (this.barnInv === 0) this.forceMode("walk");
        } else {
          this.showMsg("❌ Потрібно 2x2 вільних клітинок для сараю!", "error");
        }
      } else {
        this.showMsg("❌ Немає сараїв! Купи в магазині за 200 монет", "error");
      }
      return;
    }

    if (this.mode === "walk") {
      if (tile.type === "bed") {
        if (tile.crop?.stage === "ready" && !tile.crop.pending) {
          tile.crop.pendingHarvest = true;
          this.taskQueue.push({ kind: "harvest", x: ix, y: iy });
          this.processQueue();
          this.redrawStatic();
          this.showMsg("🌾 Відправляю збирати врожай…", "normal");
        } else if (!tile.crop) {
          this.cb.onBedClick(ix, iy);
        } else if (tile.crop.pending) {
          const queuePos = this.taskQueue.filter(
            (t) => t.kind === "plant",
          ).length;
          this.showMsg(
            `⏳ В черзі на посів (ще ${queuePos + (this.executingTask ? 1 : 0)} задач)…`,
            "normal",
          );
        } else {
          const remaining = Math.ceil(
            (tile.crop.growthMs - (Date.now() - tile.crop.plantedAt)) / 1000,
          );
          const lbl = tile.crop.type === "wheat" ? "Пшениця" : "Кукурудза";
          this.showMsg(`⏳ ${lbl} росте… ще ~${remaining}с`, "normal");
        }
        return;
      }
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
      } else {
        this.grid[iy][ix].type = "grass";
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
        this.showMsg("❌ Сюди не можна поставити!", "error");
        return;
      }

      if (held.type === "barn") {
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++) {
            this.grid[iy + dy][ix + dx].type = "barn";
            this.grid[iy + dy][ix + dx].barnOrigin = { x: ix, y: iy };
          }
      } else {
        this.grid[iy][ix].type = held.type;
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
      this.bedInv++;
      this.grid[iy][ix].type = "grass";
      delete this.grid[iy][ix].crop;
      this.taskQueue = this.taskQueue.filter(
        (t) => !(t.x === ix && t.y === iy),
      );
    } else if (tile.type === "tree") {
      this.treeInv++;
      this.grid[iy][ix].type = "grass";
    } else if (tile.type === "barn" && tile.barnOrigin) {
      const { x: ox, y: oy } = tile.barnOrigin;
      this.barnInv++;
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) {
          this.grid[oy + dy][ox + dx].type = "grass";
          delete this.grid[oy + dy][ox + dx].barnOrigin;
        }
    } else {
      return;
    }
    this.emitInventory();
    this.redrawStatic();
  }

  private redrawStatic(): void {
    this.C.renderer.drawStatic(this.grid, this.heldItem);
    this.redrawPreview();
  }

  private redrawPreview(): void {
    this.C.renderer.drawPreview(
      this.grid,
      this.hover,
      this.mode,
      this.heldItem,
      {
        bedInv: this.bedInv,
        treeInv: this.treeInv,
        barnInv: this.barnInv,
      },
    );
  }

  private emitInventory(): void {
    this.cb.onInventoryChange(this.getInventorySnapshot());
  }

  private showMsg(text: string, type: "error" | "success" | "normal"): void {
    this.cb.onMessage(text, type);
  }
}
