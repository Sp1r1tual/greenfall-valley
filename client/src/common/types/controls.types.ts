import type { TileType } from "./scene.types";

type MovableTileType = Exclude<TileType, "grass">;

export interface IMovingTile {
  type: MovableTileType;
  fromX: number;
  fromY: number;
}
