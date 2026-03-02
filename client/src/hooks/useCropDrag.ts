import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type RefObject,
} from "react";

import type { CropType } from "../common/types";
import type { GameEngine } from "../game/GameEngine";

import { CROP_LABELS } from "../game/common/configs/game.config";

interface IUseCropDragResult {
  dragCrop: CropType | null;
  dragPos: { x: number; y: number };
  handleStartDrag: (crop: CropType, startX: number, startY: number) => void;
}

export function useCropDrag(
  engineRef: RefObject<GameEngine | null>,
  showMessage: (text: string, type: "normal" | "error" | "success") => void,
  setCropPopup: (popup: null) => void,
): IUseCropDragResult {
  const [dragCrop, setDragCrop] = useState<CropType | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const seededTiles = useRef<Set<string>>(new Set());
  const seededCount = useRef(0);

  useEffect(() => {
    if (!dragCrop) return;

    const onMove = (e: MouseEvent) => {
      setDragPos({ x: e.clientX, y: e.clientY });

      const engine = engineRef.current;
      if (!engine) return;

      engine.setDragHover(e.clientX, e.clientY, dragCrop);

      const iso = engine.getIsoAtScreenPos(e.clientX, e.clientY);
      if (!iso) return;

      const key = `${iso.x},${iso.y}`;
      if (seededTiles.current.has(key)) return;

      const planted = engine.tryPlantAt(e.clientX, e.clientY, dragCrop);
      if (planted) {
        seededTiles.current.add(key);
        seededCount.current += 1;
        showMessage(
          `🌱 Сіємо: ${CROP_LABELS[dragCrop]} — ${seededCount.current} грядок`,
          "success",
        );
      }
    };

    const onUp = () => {
      engineRef.current?.clearDragHover();

      if (seededCount.current > 0) {
        showMessage(
          `✅ Посіяно ${seededCount.current} грядок: ${CROP_LABELS[dragCrop]}`,
          "success",
        );
      }

      setDragCrop(null);
      seededTiles.current.clear();
      seededCount.current = 0;
    };

    document.body.style.cursor = "grabbing";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [dragCrop, showMessage, engineRef]);

  const handleStartDrag = useCallback(
    (crop: CropType, startX: number, startY: number) => {
      setCropPopup(null);
      seededTiles.current.clear();
      seededCount.current = 0;
      setDragPos({ x: startX, y: startY });
      setDragCrop(crop);

      const engine = engineRef.current;
      if (engine) {
        const iso = engine.getIsoAtScreenPos(startX, startY);
        if (iso) {
          const key = `${iso.x},${iso.y}`;
          const planted = engine.tryPlantAt(startX, startY, crop);
          if (planted) {
            seededTiles.current.add(key);
            seededCount.current = 1;
          }
        }
      }
    },
    [engineRef, setCropPopup],
  );

  return { dragCrop, dragPos, handleStartDrag };
}
