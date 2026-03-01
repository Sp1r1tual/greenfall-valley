import type { ModeType, TileType, CropType } from "./scene.types";

export interface IGridPos {
  x: number;
  y: number;
}

export type TaskType =
  | { kind: "plant"; x: number; y: number; cropType: CropType }
  | { kind: "harvest"; x: number; y: number };

type MovableTileType = Exclude<TileType, "grass">;

export interface IMovingTile {
  type: MovableTileType;
  fromX: number;
  fromY: number;
}

export interface IInventorySnapshot {
  coins: number;
  bedInv: number;
  treeInv: number;
  barnInv: number;
  treeStock: number;
  barnStock: number;
}

export interface IGameEngineCallbacks {
  onInventoryChange: (snap: IInventorySnapshot) => void;
  onMessage: (text: string, type: "normal" | "error" | "success") => void;
  onModeChange: (mode: ModeType) => void;
  onHoldingChange: (holding: boolean) => void;
  onZoomChange: (zoom: number) => void;
  onBedClick: (gridX: number, gridY: number) => void;
  onCropReady: (gridX: number, gridY: number) => void;
}

export interface IInputCallbacks {
  onHoverChange: (x: number, y: number) => void;
  onHoverLeave: () => void;
  onTileClick: (x: number, y: number) => void;
  onEscape: () => void;
  onZoomChange: (percent: number) => void;
}
