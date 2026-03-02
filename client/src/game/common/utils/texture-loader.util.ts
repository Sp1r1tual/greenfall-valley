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
  BED_TEXTURE_ALIAS,
  TREE_TEXTURE_ALIAS,
  BARN_TEXTURE_ALIAS,
  CHAR_SOUTH_ALIAS,
  CHAR_SOUTH_EAST_ALIAS,
  CHAR_EAST_ALIAS,
  CHAR_NORTH_EAST_ALIAS,
  CHAR_NORTH_ALIAS,
  CHAR_NORTH_WEST_ALIAS,
  CHAR_WEST_ALIAS,
  CHAR_SOUTH_WEST_ALIAS,
  CHAR_WALK_SOUTH_ALIAS,
  CHAR_WALK_SOUTH_EAST_ALIAS,
  CHAR_WALK_EAST_ALIAS,
  CHAR_WALK_NORTH_EAST_ALIAS,
  CHAR_WALK_NORTH_ALIAS,
  CHAR_WALK_NORTH_WEST_ALIAS,
  CHAR_WALK_WEST_ALIAS,
  CHAR_WALK_SOUTH_WEST_ALIAS,
  CHAR_PICKUP_SOUTH_ALIAS,
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
    [CHAR_SOUTH_ALIAS, "rotations/south.png"],
    [CHAR_SOUTH_EAST_ALIAS, "rotations/south-east.png"],
    [CHAR_EAST_ALIAS, "rotations/east.png"],
    [CHAR_NORTH_EAST_ALIAS, "rotations/north-east.png"],
    [CHAR_NORTH_ALIAS, "rotations/north.png"],
    [CHAR_NORTH_WEST_ALIAS, "rotations/north-west.png"],
    [CHAR_WEST_ALIAS, "rotations/west.png"],
    [CHAR_SOUTH_WEST_ALIAS, "rotations/south-west.png"],
  ];

  await loadAndCache(BED_TEXTURE_ALIAS, "/game/assets/beds/bed_tile.png");

  await loadAndCache(TREE_TEXTURE_ALIAS, "/game/assets/trees/tree_1.png");

  await loadAndCache(BARN_TEXTURE_ALIAS, "/game/assets/buildings/barn.png");

  await Promise.all(
    stills.map(([alias, file]) => loadAndCache(alias, base + file)),
  );

  const walkDirs: [string, string][] = [
    [CHAR_WALK_SOUTH_ALIAS, "south"],
    [CHAR_WALK_SOUTH_EAST_ALIAS, "south-east"],
    [CHAR_WALK_EAST_ALIAS, "east"],
    [CHAR_WALK_NORTH_EAST_ALIAS, "north-east"],
    [CHAR_WALK_NORTH_ALIAS, "north"],
    [CHAR_WALK_NORTH_WEST_ALIAS, "north-west"],
    [CHAR_WALK_WEST_ALIAS, "west"],
    [CHAR_WALK_SOUTH_WEST_ALIAS, "south-west"],
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
        `${CHAR_PICKUP_SOUTH_ALIAS}${i}`,
        `${base}animations/picking-up/south/frame_${String(i).padStart(3, "0")}.png`,
      ),
    ),
  );
};
