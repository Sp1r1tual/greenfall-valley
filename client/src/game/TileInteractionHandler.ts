import type {
  GridType,
  ModeType,
  IMovingTile,
  IGameEngineCallbacks,
} from "../common/types";

import type { ShopService } from "./ShopService";
import type { TaskQueue } from "./TaskQueue";
import type { Character } from "./Character";

import {
  canPlaceBarn,
  placeBarn,
  removeBarn,
  forEachBarnTile,
} from "./common/helpers/grid.helpers";
import { CROP_LABELS } from "./common/configs/game.config";

export interface IInteractionDeps {
  grid: GridType;
  shop: ShopService;
  tasks: TaskQueue;
  character: Character;
  cb: IGameEngineCallbacks;
  notifyTileChanged: (x: number, y: number) => void;
  redrawStatic: () => void;
  emitInventory: () => void;
  forceMode: (mode: ModeType) => void;
}

export class TileInteractionHandler {
  public mode: ModeType = "walk";
  public hover = { x: -1, y: -1 };
  public heldItem: IMovingTile | null = null;

  private deps: IInteractionDeps;

  constructor(deps: IInteractionDeps) {
    this.deps = deps;
  }

  public get Mode(): ModeType {
    return this.mode;
  }

  public get Hover(): { x: number; y: number } {
    return this.hover;
  }

  public get HeldItem(): IMovingTile | null {
    return this.heldItem;
  }

  public handleHoverChange(x: number, y: number): boolean {
    if (this.hover.x !== x || this.hover.y !== y) {
      this.hover = { x, y };
      return true;
    }
    return false;
  }

  public handleHoverLeave(): void {
    this.hover = { x: -1, y: -1 };
  }

  public setMode(mode: ModeType): void {
    if (this.heldItem && mode !== "move") this.cancelMove();

    const { bedInv, treeInv, barnInv } = this.deps.shop.getState();
    const isPlacement = ["bed", "tree", "barn", "grass", "clear"].includes(
      mode,
    );
    const hasStock =
      (mode === "bed" && bedInv > 0) ||
      (mode === "tree" && treeInv > 0) ||
      (mode === "barn" && barnInv > 0);

    const next = isPlacement && this.mode === mode && !hasStock ? "walk" : mode;
    this.mode = next as ModeType;
    this.deps.cb.onModeChange(this.mode);
  }

  public forceMode(mode: ModeType): void {
    this.mode = mode;
    this.deps.cb.onModeChange(mode);
  }

  public cancelMove(): void {
    const held = this.heldItem;
    if (!held) return;

    if (held.type === "barn") {
      placeBarn(this.deps.grid, held.fromX, held.fromY);
    } else {
      this.deps.grid[held.fromY][held.fromX].type = held.type;
    }

    this.heldItem = null;
    this.deps.cb.onHoldingChange(false);
    this.deps.redrawStatic();
  }

  public handleTileClick(ix: number, iy: number): void {
    const tile = this.deps.grid[iy][ix];
    const { bedInv, treeInv, barnInv } = this.deps.shop.getState();

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
        this.deps.shop.consumeBed();
        this.deps.grid[iy][ix].type = "bed";
        this.deps.notifyTileChanged(ix, iy);
        this.deps.emitInventory();
        this.deps.redrawStatic();
        if (this.deps.shop.getState().bedInv === 0) this.forceMode("walk");
      } else if (bedInv === 0) {
        this.deps.cb.onMessage("❌ Немає грядок! Візьми в магазині", "error");
      }
      return;
    }

    if (this.mode === "tree") {
      if (treeInv > 0 && tile.type === "grass") {
        this.deps.shop.consumeTree();
        this.deps.grid[iy][ix].type = "tree";
        this.deps.notifyTileChanged(ix, iy);
        this.deps.emitInventory();
        this.deps.redrawStatic();
        if (this.deps.shop.getState().treeInv === 0) this.forceMode("walk");
      } else if (treeInv === 0) {
        this.deps.cb.onMessage(
          "❌ Немає дерев! Купи в магазині за 50 монет",
          "error",
        );
      }
      return;
    }

    if (this.mode === "barn") {
      if (barnInv > 0) {
        if (canPlaceBarn(this.deps.grid, ix, iy)) {
          this.deps.shop.consumeBarn();
          placeBarn(this.deps.grid, ix, iy);

          forEachBarnTile(ix, iy, (tx, ty) =>
            this.deps.notifyTileChanged(tx, ty),
          );
          this.deps.emitInventory();
          this.deps.redrawStatic();
          if (this.deps.shop.getState().barnInv === 0) this.forceMode("walk");
        } else {
          this.deps.cb.onMessage(
            "❌ Потрібно 2x2 вільних клітинок для сараю!",
            "error",
          );
        }
      } else {
        this.deps.cb.onMessage(
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
          this.deps.tasks.push({ kind: "harvest", x: ix, y: iy });
          this.deps.tasks.process();
          this.deps.redrawStatic();
          this.deps.cb.onMessage("🌾 Відправляю збирати врожай…", "normal");
        } else if (!tile.crop) {
          this.deps.cb.onBedClick(ix, iy);
        } else if (tile.crop.pending) {
          const queuePos = this.deps.tasks.pendingPlantCount;
          this.deps.cb.onMessage(
            `⏳ В черзі на посів (ще ${
              queuePos + (this.deps.tasks.isExecuting ? 1 : 0)
            } задач)…`,
            "normal",
          );
        } else {
          const remaining = Math.ceil(
            (tile.crop.growthMs - (Date.now() - tile.crop.plantedAt)) / 1000,
          );
          this.deps.cb.onMessage(
            `⏳ ${CROP_LABELS[tile.crop.type]} росте… ще ~${remaining}с`,
            "normal",
          );
        }
        return;
      }

      if (tile.type === "barn" || tile.type === "tree") return;

      this.deps.character.moveTo(this.deps.grid, ix, iy);
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
        removeBarn(this.deps.grid, originX, originY);
        forEachBarnTile(originX, originY, (tx, ty) =>
          this.deps.notifyTileChanged(tx, ty),
        );
      } else {
        this.deps.grid[iy][ix].type = "grass";
        this.deps.notifyTileChanged(ix, iy);
      }

      this.heldItem = { type: itemType, fromX: originX, fromY: originY };
      this.deps.cb.onHoldingChange(true);
      this.deps.redrawStatic();
    } else {
      const held = this.heldItem;
      const canPlace =
        held.type === "barn"
          ? canPlaceBarn(this.deps.grid, ix, iy, {
              x: held.fromX,
              y: held.fromY,
            })
          : tile.type === "grass";

      if (!canPlace) {
        this.deps.cb.onMessage("❌ Сюди не можна поставити!", "error");
        return;
      }

      if (held.type === "barn") {
        placeBarn(this.deps.grid, ix, iy);
        forEachBarnTile(ix, iy, (tx, ty) =>
          this.deps.notifyTileChanged(tx, ty),
        );
      } else {
        this.deps.grid[iy][ix].type = held.type;
        this.deps.notifyTileChanged(ix, iy);
      }

      this.heldItem = null;
      this.deps.cb.onHoldingChange(false);
      this.deps.redrawStatic();
    }
  }

  private handleClearMode(
    ix: number,
    iy: number,
    tile: GridType[number][number],
  ): void {
    if (tile.type === "bed") {
      this.deps.shop.returnBed();
      this.deps.grid[iy][ix].type = "grass";
      delete this.deps.grid[iy][ix].crop;
      this.deps.tasks.clear(ix, iy);
      this.deps.notifyTileChanged(ix, iy);
    } else if (tile.type === "tree") {
      this.deps.shop.returnTree();
      this.deps.grid[iy][ix].type = "grass";
      this.deps.notifyTileChanged(ix, iy);
    } else if (tile.type === "barn" && tile.barnOrigin) {
      const { x: ox, y: oy } = tile.barnOrigin;
      this.deps.shop.returnBarn();
      removeBarn(this.deps.grid, ox, oy);
      forEachBarnTile(ox, oy, (tx, ty) => this.deps.notifyTileChanged(tx, ty));
    } else {
      return;
    }
    this.deps.emitInventory();
    this.deps.redrawStatic();
  }
}
