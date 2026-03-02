import { useEffect, useRef, useState, useCallback } from "react";

import { useCropDrag } from "./hooks/useCropDrag";

import type { ModeType, IInventorySnapshot } from "./common/types";

import { Currency } from "./components/currency/Currency";
import { Messages } from "./components/messages/Messages";
import { Shop } from "./components/shop/Shop";
import { ZoomBar } from "./components/zoomBar/ZoomBar";
import { ActionBar } from "./components/actionBar/ActionBar";
import { DragCursor } from "./components/controls/DragCursor";
import { CropPopup } from "./components/popups/CropPopup";

import { GameEngine } from "./game/GameEngine";
import {
  DEFAULT_INV,
  MESSAGE_TIMEOUT_MS,
} from "./game/common/configs/game.config";

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

  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastClickPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const showMessage = useCallback(
    (text: string, type: "normal" | "error" | "success") => {
      setInfo(text);
      setInfoType(type);

      if (messageTimerRef.current !== null) {
        clearTimeout(messageTimerRef.current);
      }

      messageTimerRef.current = setTimeout(() => {
        setInfo("Клікай по полю, щоб розмістити об'єкти");
        setInfoType("normal");
        messageTimerRef.current = null;
      }, MESSAGE_TIMEOUT_MS);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (messageTimerRef.current !== null) {
        clearTimeout(messageTimerRef.current);
      }
    };
  }, []);

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

  const { dragCrop, dragPos, handleStartDrag } = useCropDrag(
    engineRef,
    showMessage,
    setCropPopup,
  );

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
