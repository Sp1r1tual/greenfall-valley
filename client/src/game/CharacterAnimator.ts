import * as PIXI from "pixi.js";

import { PLAYGROUND } from "./common/configs/game.config";
import { getTex } from "./common/helpers/drawing.helpers";
import {
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

export type FacingDirType =
  | "down"
  | "up"
  | "right"
  | "left"
  | "down-right"
  | "down-left"
  | "up-right"
  | "up-left";

const WALK_FRAME_COUNT = 6;
const PICKUP_FRAME_COUNT = 5;
const SPRITE_SCALE = 1;
const SPRITE_FEET_OFFSET_Y = 12;

const stillAliasFor: Record<FacingDirType, string> = {
  down: CHAR_SOUTH_ALIAS,
  up: CHAR_NORTH_ALIAS,
  right: CHAR_EAST_ALIAS,
  left: CHAR_WEST_ALIAS,
  "down-right": CHAR_SOUTH_EAST_ALIAS,
  "down-left": CHAR_SOUTH_WEST_ALIAS,
  "up-right": CHAR_NORTH_EAST_ALIAS,
  "up-left": CHAR_NORTH_WEST_ALIAS,
};

const walkPrefixFor: Record<FacingDirType, string> = {
  down: CHAR_WALK_SOUTH_ALIAS,
  up: CHAR_WALK_NORTH_ALIAS,
  right: CHAR_WALK_EAST_ALIAS,
  left: CHAR_WALK_WEST_ALIAS,
  "down-right": CHAR_WALK_SOUTH_EAST_ALIAS,
  "down-left": CHAR_WALK_SOUTH_WEST_ALIAS,
  "up-right": CHAR_WALK_NORTH_EAST_ALIAS,
  "up-left": CHAR_WALK_NORTH_WEST_ALIAS,
};

export class CharacterAnimator {
  public readonly container: PIXI.Container;
  private readonly sprite: PIXI.Sprite;
  private readonly shadowGfx: PIXI.Graphics;
  private readonly progressGfx: PIXI.Graphics;

  constructor() {
    this.container = new PIXI.Container();

    this.shadowGfx = new PIXI.Graphics();
    this.container.addChild(this.shadowGfx);

    this.sprite = new PIXI.Sprite();
    this.sprite.anchor.set(0.5, 1);
    this.sprite.y = SPRITE_FEET_OFFSET_Y;
    this.sprite.scale.set(SPRITE_SCALE);
    this.sprite.roundPixels = true;
    this.container.addChild(this.sprite);

    this.progressGfx = new PIXI.Graphics();
    this.container.addChild(this.progressGfx);
  }

  applyIdleFrame(facing: FacingDirType, isPhasing: boolean): void {
    this.setFrame(stillAliasFor[facing] ?? CHAR_SOUTH_ALIAS);
    this.sprite.alpha = isPhasing ? 0.45 : 1;
    this.drawShadow(isPhasing);
  }

  applyWalkFrame(
    facing: FacingDirType,
    cycle: number,
    isPhasing: boolean,
  ): void {
    const prefix = walkPrefixFor[facing] ?? CHAR_WALK_SOUTH_ALIAS;
    const fi = Math.floor(cycle * WALK_FRAME_COUNT) % WALK_FRAME_COUNT;
    this.setFrame(`${prefix}${fi}`);
    this.sprite.alpha = isPhasing ? 0.45 : 1;
    this.drawShadow(isPhasing);
  }

  applyWorkFrame(cycle: number): void {
    const fi = Math.floor(cycle * PICKUP_FRAME_COUNT) % PICKUP_FRAME_COUNT;
    this.setFrame(`${CHAR_PICKUP_SOUTH_ALIAS}${fi}`);
    this.sprite.alpha = 1;
    this.drawShadow(false);
  }

  clearProgress(): void {
    this.progressGfx.clear();
  }

  drawProgress(progress: number): void {
    const pg = this.progressGfx;
    pg.clear();

    const W = 34,
      H = 5;

    const barY = -(56 * SPRITE_SCALE) - 4;
    const x = -W / 2;

    pg.rect(x - 1, barY - 1, W + 2, H + 2);
    pg.fill({ color: 0x000000, alpha: 0.5 });

    if (progress > 0) {
      const color = progress > 0.65 ? 0x6bc943 : 0xf0c040;
      pg.rect(x, barY, W * progress, H);
      pg.fill({ color });
    }

    pg.rect(x - 1, barY - 1, W + 2, H + 2);
    pg.stroke({ color: 0x000000, alpha: 0.4, width: 1 });
  }

  updateContainerPosition(px: number, py: number): void {
    this.container.x = px;
    this.container.y = py + PLAYGROUND.TILE_HEIGHT / 2;
  }

  updateZSort(gx: number, gy: number): void {
    this.container.zIndex = 2 + gx + gy + 0.5;
  }

  private setFrame(alias: string): void {
    const tex = getTex(alias) ?? getTex(CHAR_SOUTH_ALIAS);
    if (!tex) return;
    tex.source.scaleMode = "nearest";
    this.sprite.texture = tex;
  }

  private drawShadow(isPhasing: boolean): void {
    const g = this.shadowGfx;
    g.clear();

    g.ellipse(0, 2, 11, 4);
    g.fill({ color: 0x000000, alpha: isPhasing ? 0.08 : 0.22 });
  }
}
