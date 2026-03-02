import * as PIXI from "pixi.js";

import type { IInputCallbacks } from "../common/types";

import { ZOOM } from "./common/configs/game.config";
import { inBounds, screenToIso } from "./common/helpers/grid.helpers";

export class InputController {
  private zoom = ZOOM.DEFAULT_ZOOM;
  private removeListeners: (() => void) | null = null;

  private readonly stage: PIXI.Container;
  private readonly world: PIXI.Container;
  private readonly canvas: HTMLCanvasElement;
  private readonly cb: IInputCallbacks;

  constructor(
    stage: PIXI.Container,
    world: PIXI.Container,
    canvas: HTMLCanvasElement,
    cb: IInputCallbacks,
  ) {
    this.stage = stage;
    this.world = world;
    this.canvas = canvas;
    this.cb = cb;
  }

  attach(): void {
    this.world.scale.set(ZOOM.DEFAULT_ZOOM);
    this.cb.onZoomChange(
      Math.round((ZOOM.DEFAULT_ZOOM / ZOOM.ZOOM_DISPLAY_SCALE) * 100),
    );

    let isPanning = false;
    let didPan = false;
    const PAN_THRESHOLD = 4;
    const panStart = { x: 0, y: 0 };
    const worldStart = { x: 0, y: 0 };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;

      isPanning = true;
      didPan = false;
      panStart.x = e.clientX;
      panStart.y = e.clientY;
      worldStart.x = this.world.x;
      worldStart.y = this.world.y;
      this.canvas.style.cursor = "grabbing";
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isPanning) return;

      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;

      if (!didPan && Math.hypot(dx, dy) > PAN_THRESHOLD) didPan = true;
      if (didPan) {
        this.world.x = worldStart.x + dx;
        this.world.y = worldStart.y + dy;
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;

      isPanning = false;
      this.canvas.style.cursor = "grab";
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const old = this.zoom;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const next = Math.min(
        ZOOM.MAX_ZOOM,
        Math.max(ZOOM.MIN_ZOOM, old * factor),
      );

      if (next === old) return;

      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const wx = (mx - this.world.x) / old;
      const wy = (my - this.world.y) / old;

      this.zoom = next;
      this.world.scale.set(next);
      this.world.x = mx - wx * next;
      this.world.y = my - wy * next;
      this.cb.onZoomChange(Math.round((next / ZOOM.ZOOM_DISPLAY_SCALE) * 100));
    };

    this.stage.on("pointermove", (e: PIXI.FederatedPointerEvent) => {
      const local = e.getLocalPosition(this.world);
      const iso = screenToIso(local.x, local.y);

      if (inBounds(iso.x, iso.y)) {
        this.cb.onHoverChange(iso.x, iso.y);
      } else {
        this.cb.onHoverLeave();
      }
    });

    this.stage.on("pointerleave", () => {
      this.cb.onHoverLeave();
    });

    this.stage.on("pointerup", (e: PIXI.FederatedPointerEvent) => {
      if (didPan) return;

      const local = e.getLocalPosition(this.world);
      const iso = screenToIso(local.x, local.y);

      if (!inBounds(iso.x, iso.y)) return;
      this.cb.onTileClick(iso.x, iso.y);
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") this.cb.onEscape();
    };

    this.canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    this.canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);

    this.removeListeners = () => {
      this.canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      this.canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
    };
  }

  detach(): void {
    this.removeListeners?.();
    this.removeListeners = null;
  }
}
