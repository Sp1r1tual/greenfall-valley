import { useEffect, useRef, useState, useCallback } from "react";

import type { ModeType, IInventorySnapshot, CropType } from "./common/types";

import { Currency } from "./components/currency/Currency";
import { Messages } from "./components/messages/Messages";
import { Shop } from "./components/shop/Shop";
import { ZoomBar } from "./components/zoomBar/ZoomBar";
import { ActionBar } from "./components/actionBar/Actionbar";
import { DragCursor } from "./components/controls/DragCursor";
import { CropPopup } from "./components/popups/CropPopup";

import { GameEngine } from "./game/GameEngine";
import { DEFAULT_INV } from "./game/common/configs/game.config";

import styles from "./App.module.css";

export const App = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [inv, setInv] = useState<IInventorySnapshot>(DEFAULT_INV);
  const [currentMode, setCurrentMode] = useState<ModeType>("walk");
  const [holding, setHolding] = useState(false);
  const [info, setInfo] = useState(
    "Купи предмети в магазині та розміщуй їх на полі",
  );
  const [infoType, setInfoType] = useState<"normal" | "error" | "success">(
    "normal",
  );
  const [zoomDisplay, setZoomDisplay] = useState(100);

  const [cropPopup, setCropPopup] = useState<{
    gridX: number;
    gridY: number;
    screenX: number;
    screenY: number;
  } | null>(null);

  const [dragCrop, setDragCrop] = useState<CropType | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const seededTiles = useRef<Set<string>>(new Set());
  const seededCount = useRef(0);
  const lastClickPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const showMessage = useCallback(
    (text: string, type: "normal" | "error" | "success") => {
      setInfo(text);
      setInfoType(type);
      setTimeout(() => {
        setInfo("Клікай по полю, щоб розмістити об'єкти");
        setInfoType("normal");
      }, 2500);
    },
    [],
  );

  const handleCropReady = useCallback(() => {
    setInfo("🌾 Врожай готовий! Клікни на грядку щоб зібрати 💰");
    setInfoType("success");
  }, []);

  const handleBedClick = useCallback((gridX: number, gridY: number) => {
    setCropPopup({
      gridX,
      gridY,
      screenX: lastClickPos.current.x,
      screenY: lastClickPos.current.y,
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new GameEngine({
      onInventoryChange: setInv,
      onMessage: showMessage,
      onModeChange: setCurrentMode,
      onHoldingChange: setHolding,
      onZoomChange: setZoomDisplay,
      onBedClick: handleBedClick,
      onCropReady: handleCropReady,
    });

    engine.init(containerRef.current).then(() => {
      engineRef.current = engine;
    });

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [showMessage, handleCropReady, handleBedClick]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onDown = (e: MouseEvent) => {
      lastClickPos.current = { x: e.clientX, y: e.clientY };
    };
    el.addEventListener("mousedown", onDown);
    return () => el.removeEventListener("mousedown", onDown);
  }, []);

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
        const label = dragCrop === "wheat" ? "Пшениця" : "Кукурудза";
        setInfo(`🌱 Сіємо: ${label} — ${seededCount.current} грядок`);
        setInfoType("success");
      }
    };

    const onUp = () => {
      engineRef.current?.clearDragHover();

      if (seededCount.current > 0) {
        const label = dragCrop === "wheat" ? "Пшениця" : "Кукурудза";
        showMessage(
          `✅ Посіяно ${seededCount.current} грядок: ${label}`,
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
  }, [dragCrop, showMessage]);

  const handleStartDrag = (crop: CropType, startX: number, startY: number) => {
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
  };

  const handleSetMode = (mode: ModeType) => engineRef.current?.setMode(mode);

  return (
    <>
      <div className={styles.canvasWrapper} ref={containerRef} />

      {dragCrop && <DragCursor x={dragPos.x} y={dragPos.y} crop={dragCrop} />}

      {cropPopup && !dragCrop && (
        <CropPopup
          screenX={cropPopup.screenX}
          screenY={cropPopup.screenY}
          onStartDrag={handleStartDrag}
          onClose={() => setCropPopup(null)}
        />
      )}

      <div className={styles.ui}>
        <Currency coins={inv.coins} />
        <Messages text={info} type={infoType} />
        <Shop
          inv={inv}
          onBuyBed={() => engineRef.current?.buyBed()}
          onBuyTree={() => engineRef.current?.buyTree()}
          onBuyBarn={() => engineRef.current?.buyBarn()}
        />
        <ZoomBar zoom={zoomDisplay} />
        <ActionBar
          currentMode={currentMode}
          holding={holding}
          inv={inv}
          onSetMode={handleSetMode}
        />
      </div>
    </>
  );
};
