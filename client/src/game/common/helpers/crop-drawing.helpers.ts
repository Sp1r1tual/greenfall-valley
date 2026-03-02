import * as PIXI from "pixi.js";
import type { CropStageType } from "@/common/types";
import { PLAYGROUND } from "../configs/game.config";

export const drawWheat = (
  g: PIXI.Graphics,
  sx: number,
  sy: number,
  stage: CropStageType,
  alpha = 1,
) => {
  const baseY = sy + PLAYGROUND.TILE_HEIGHT / 2;
  const stemCount = stage === "seedling" ? 3 : stage === "growing" ? 5 : 7;
  const stemH = stage === "seedling" ? 12 : stage === "growing" ? 22 : 34;
  const headSize = stage === "ready" ? 6 : 0;
  const spread = PLAYGROUND.TILE_WIDTH / 2 - 6;

  for (let i = 0; i < stemCount; i++) {
    const bx = sx - spread + (i / (stemCount - 1)) * spread * 2;
    g.moveTo(bx, baseY);
    g.lineTo(bx, baseY - stemH);
    g.stroke({
      color: stage === "ready" ? 0xd4a017 : 0x6abf69,
      width: 2,
      alpha,
      cap: "round",
    });
    if (stage === "ready") {
      g.ellipse(bx, baseY - stemH - headSize / 2, 3, headSize);
      g.fill({ color: 0xf0c040, alpha });
    } else if (stage === "growing") {
      g.circle(bx, baseY - stemH, 2);
      g.fill({ color: 0x5aaf59, alpha });
    }
  }
};

export const drawCorn = (
  g: PIXI.Graphics,
  sx: number,
  sy: number,
  stage: CropStageType,
  alpha = 1,
) => {
  const baseY = sy + PLAYGROUND.TILE_HEIGHT / 2;
  const stemH = stage === "seedling" ? 14 : stage === "growing" ? 28 : 44;
  const stemCount = stage === "seedling" ? 2 : 3;
  const spread = PLAYGROUND.TILE_WIDTH / 3;

  for (let i = 0; i < stemCount; i++) {
    const bx =
      sx - spread + (stemCount > 1 ? i / (stemCount - 1) : 0.5) * spread * 2;
    g.moveTo(bx, baseY);
    g.lineTo(bx, baseY - stemH);
    g.stroke({ color: 0x4caf50, width: 2.5, alpha, cap: "round" });

    if (stage !== "seedling") {
      g.moveTo(bx, baseY - stemH * 0.4);
      g.lineTo(bx + 12, baseY - stemH * 0.55);
      g.stroke({ color: 0x66bb6a, width: 1.5, alpha });
      g.moveTo(bx, baseY - stemH * 0.6);
      g.lineTo(bx - 12, baseY - stemH * 0.75);
      g.stroke({ color: 0x66bb6a, width: 1.5, alpha });
    }

    if (stage === "ready") {
      const cobX = bx + 6,
        cobY = baseY - stemH * 0.65;
      g.ellipse(cobX, cobY, 5, 11);
      g.fill({ color: 0xf9c31a, alpha });
      g.ellipse(cobX, cobY, 5, 11);
      g.stroke({ color: 0xe0a800, width: 1, alpha });
      g.moveTo(cobX - 5, cobY - 8);
      g.lineTo(cobX + 2, cobY - 14);
      g.stroke({ color: 0x558b2f, width: 1.5, alpha });
    }
  }
};
