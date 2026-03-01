import * as PIXI from "pixi.js";

export type PlaceableTileType = "bed" | "tree" | "barn";
export type TileType = "grass" | PlaceableTileType;
export type GrassVariantType = 0 | 1;
export type ModeType = "walk" | "clear" | "move" | "grass" | PlaceableTileType;
export type CropType = "wheat" | "corn";
export type CropStageType = "seedling" | "growing" | "ready";

export interface ICropData {
  type: CropType;
  plantedAt: number;
  growthMs: number;
  stage: CropStageType;
  pending?: boolean;
  pendingHarvest?: boolean;
}

export interface ITileData {
  type: TileType;
  barnOrigin?: { x: number; y: number };
  crop?: ICropData;
  grassVariant: GrassVariantType;
  grassTexture: PIXI.Texture | undefined;
}

export type GridType = ITileData[][];

type ObjEntryBaseType = { sortKey: number; alpha: number };

export type ObjEntryType =
  | (ObjEntryBaseType & { kind: "barn"; ox: number; oy: number })
  | (ObjEntryBaseType & { kind: "tree"; x: number; y: number })
  | (ObjEntryBaseType & { kind: "bed"; x: number; y: number });
