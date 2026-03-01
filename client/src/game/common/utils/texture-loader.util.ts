import * as PIXI from "pixi.js";

import {
  GRASS_TEXTURE_ALIAS,
  GRASS_TEXTURE_ALIAS_2,
  GRASS_BLEND_TOP_LEFT,
  GRASS_BLEND_TOP_RIGHT,
  GRASS_BLEND_LEFT,
  GRASS_BLEND_RIGHT,
  GRASS_BLEND_BOTTOM_LEFT,
  GRASS_BLEND_BOTTOM_RIGHT,
  GRASS_BLEND_BOTTOM,
  GRASS_BLEND_TOP,
} from "@/common/types/aliases/texture.aliases";

const TEXTURE_FRAME_MAP: Record<string, string> = {
  [GRASS_TEXTURE_ALIAS]: "grass_tile_1.png",
  [GRASS_TEXTURE_ALIAS_2]: "grass_tile_2.png",
  [GRASS_BLEND_TOP]: "grass_tile_flowers_top.png",
  [GRASS_BLEND_TOP_LEFT]: "grass_tile_flowers_top_left.png",
  [GRASS_BLEND_TOP_RIGHT]: "grass_tile_flowers_top_right.png",
  [GRASS_BLEND_LEFT]: "grass_tile_flowers_left.png",
  [GRASS_BLEND_RIGHT]: "grass_tile_flowers_right.png",
  [GRASS_BLEND_BOTTOM]: "grass_tile_flowers_bottom.png",
  [GRASS_BLEND_BOTTOM_LEFT]: "grass_tile_flowers_bottom_left.png",
  [GRASS_BLEND_BOTTOM_RIGHT]: "grass_tile_flowers_bottom_right.png",
};

export const CHAR_SOUTH = "char_south";
export const CHAR_SOUTH_EAST = "char_south_east";
export const CHAR_EAST = "char_east";
export const CHAR_NORTH_EAST = "char_north_east";
export const CHAR_NORTH = "char_north";
export const CHAR_NORTH_WEST = "char_north_west";
export const CHAR_WEST = "char_west";
export const CHAR_SOUTH_WEST = "char_south_west";
export const CHAR_WALK_SOUTH = "char_walk_south_";
export const CHAR_WALK_SOUTH_EAST = "char_walk_south_east_";
export const CHAR_WALK_EAST = "char_walk_east_";
export const CHAR_WALK_NORTH_EAST = "char_walk_north_east_";
export const CHAR_WALK_NORTH = "char_walk_north_";
export const CHAR_WALK_NORTH_WEST = "char_walk_north_west_";
export const CHAR_WALK_WEST = "char_walk_west_";
export const CHAR_WALK_SOUTH_WEST = "char_walk_south_west_";
export const CHAR_PICKUP_SOUTH = "char_pickup_south_";

export const CHAR_TREE = "tree_1";

export const walkPrefixForDirection = (dx: number, dy: number): string => {
  if (dx > 0 && dy === 0) return CHAR_WALK_EAST;
  if (dx < 0 && dy === 0) return CHAR_WALK_WEST;
  if (dx === 0 && dy > 0) return CHAR_WALK_SOUTH;
  if (dx === 0 && dy < 0) return CHAR_WALK_NORTH;
  if (dx > 0 && dy > 0) return CHAR_WALK_SOUTH_EAST;
  if (dx > 0 && dy < 0) return CHAR_WALK_NORTH_EAST;
  if (dx < 0 && dy > 0) return CHAR_WALK_SOUTH_WEST;
  if (dx < 0 && dy < 0) return CHAR_WALK_NORTH_WEST;
  return CHAR_WALK_SOUTH;
};

export const stillAliasForDirection = (dx: number, dy: number): string => {
  if (dx > 0 && dy === 0) return CHAR_EAST;
  if (dx < 0 && dy === 0) return CHAR_WEST;
  if (dx === 0 && dy > 0) return CHAR_SOUTH;
  if (dx === 0 && dy < 0) return CHAR_NORTH;
  if (dx > 0 && dy > 0) return CHAR_SOUTH_EAST;
  if (dx > 0 && dy < 0) return CHAR_NORTH_EAST;
  if (dx < 0 && dy > 0) return CHAR_SOUTH_WEST;
  if (dx < 0 && dy < 0) return CHAR_NORTH_WEST;
  return CHAR_SOUTH;
};

const setNearest = (tex: PIXI.Texture) => {
  tex.source.scaleMode = "nearest";
};

export const loadGameTextures = async () => {
  await PIXI.Assets.load("/game/assets/tiles/grass_atlas.json");

  for (const [alias, frame] of Object.entries(TEXTURE_FRAME_MAP)) {
    const tex = PIXI.Assets.get<PIXI.Texture>(frame);
    if (tex) PIXI.Cache.set(alias, tex);
  }

  const base = "/game/assets/character/";

  const loadAndCache = async (alias: string, path: string) => {
    const tex = await PIXI.Assets.load<PIXI.Texture>(path);
    setNearest(tex);
    PIXI.Cache.set(alias, tex);
  };

  const stills: [string, string][] = [
    [CHAR_SOUTH, "rotations/south.png"],
    [CHAR_SOUTH_EAST, "rotations/south-east.png"],
    [CHAR_EAST, "rotations/east.png"],
    [CHAR_NORTH_EAST, "rotations/north-east.png"],
    [CHAR_NORTH, "rotations/north.png"],
    [CHAR_NORTH_WEST, "rotations/north-west.png"],
    [CHAR_WEST, "rotations/west.png"],
    [CHAR_SOUTH_WEST, "rotations/south-west.png"],
  ];

  await loadAndCache(CHAR_TREE, "/game/assets/trees/tree_1.png");

  await Promise.all(
    stills.map(([alias, file]) => loadAndCache(alias, base + file)),
  );

  const walkDirs: [string, string][] = [
    [CHAR_WALK_SOUTH, "south"],
    [CHAR_WALK_SOUTH_EAST, "south-east"],
    [CHAR_WALK_EAST, "east"],
    [CHAR_WALK_NORTH_EAST, "north-east"],
    [CHAR_WALK_NORTH, "north"],
    [CHAR_WALK_NORTH_WEST, "north-west"],
    [CHAR_WALK_WEST, "west"],
    [CHAR_WALK_SOUTH_WEST, "south-west"],
  ];

  await Promise.all(
    walkDirs.flatMap(([prefix, dir]) =>
      Array.from({ length: 6 }, (_, i) =>
        loadAndCache(
          `${prefix}${i}`,
          `${base}animations/walk/${dir}/frame_${String(i).padStart(3, "0")}.png`,
        ),
      ),
    ),
  );

  await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      loadAndCache(
        `${CHAR_PICKUP_SOUTH}${i}`,
        `${base}animations/picking-up/south/frame_${String(i).padStart(3, "0")}.png`,
      ),
    ),
  );
};
