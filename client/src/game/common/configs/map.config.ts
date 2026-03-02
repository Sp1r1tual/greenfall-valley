import type { TileType } from "@/common/types/index";

type FlowerVariantType = 0 | 1;

interface ITileConfig {
  type: TileType;
  flower?: FlowerVariantType;
}

export const MAP_CONFIG: Record<string, ITileConfig> = {
  "0,0": { type: "grass", flower: 1 },
  "1,0": { type: "grass", flower: 1 },
  "0,1": { type: "grass", flower: 1 },
  "11,0": { type: "grass", flower: 1 },
  "10,0": { type: "grass", flower: 1 },
  "11,1": { type: "grass", flower: 1 },
  "0,11": { type: "grass", flower: 1 },
  "1,11": { type: "grass", flower: 1 },
  "0,10": { type: "grass", flower: 1 },
  "11,11": { type: "grass", flower: 1 },
  "10,11": { type: "grass", flower: 1 },
  "11,10": { type: "grass", flower: 1 },
  "5,0": { type: "grass", flower: 1 },
  "6,0": { type: "grass", flower: 1 },
  "0,5": { type: "grass", flower: 1 },
  "0,6": { type: "grass", flower: 1 },
  "11,5": { type: "grass", flower: 1 },
  "11,6": { type: "grass", flower: 1 },

  "1,2": { type: "tree" },
  "2,1": { type: "tree" },
  "9,1": { type: "tree" },
  "10,2": { type: "tree" },
  "1,9": { type: "tree" },
  "2,10": { type: "tree" },
  "9,10": { type: "tree" },
  "10,9": { type: "tree" },

  "4,4": { type: "barn" },
};
