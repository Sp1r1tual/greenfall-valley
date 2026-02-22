import type { CropType } from "./scene.types";

export type CharacterDirectionType = "right" | "left" | "down" | "up";

export type TaskType =
  | { kind: "plant"; x: number; y: number; cropType: CropType }
  | { kind: "harvest"; x: number; y: number };
