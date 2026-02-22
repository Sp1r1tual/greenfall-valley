import { useEffect, useRef, useState, useCallback } from "react";

import type { ModeType, IInventorySnapshot, CropType } from "./common/types";

import { GameEngine } from "./game/GameEngine";
import { DEFAULT_INV } from "./common/configs/game.config";

import styles from "./App.module.css";

const CROPS: {
  type: CropType;
  emoji: string;
  label: string;
  time: string;
  reward: number;
}[] = [
  { type: "wheat", emoji: "🌾", label: "Пшениця", time: "15 сек", reward: 30 },
  { type: "corn", emoji: "🌽", label: "Кукурудза", time: "30 сек", reward: 70 },
];

interface IDragCursorProps {
  x: number;
  y: number;
  crop: CropType;
}

const DragCursor = ({ x, y, crop }: IDragCursorProps) => {
  const c = CROPS.find((c) => c.type === crop);
  if (!c) return null;

  return (
    <div className={styles.dragCursor} style={{ left: x - 24, top: y - 24 }}>
      {c.emoji}
    </div>
  );
};

interface ICropPopupProps {
  screenX: number;
  screenY: number;
  onStartDrag: (crop: CropType, startX: number, startY: number) => void;
  onClose: () => void;
}

const POPUP_W = 224;

const CropPopup = ({
  screenX,
  screenY,
  onStartDrag,
  onClose,
}: ICropPopupProps) => {
  const left = Math.max(8, screenX - POPUP_W - 16);
  const top = Math.max(8, screenY - 110);

  return (
    <>
      <div className={styles.popupOverlay} onMouseDown={onClose} />
      <div
        className={styles.popup}
        style={{ left, top }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={styles.popupArrow} />
        <div className={styles.popupHint}>Затисни і тягни по грядках</div>
        <div className={styles.popupList}>
          {CROPS.map((crop) => (
            <button
              key={crop.type}
              className={styles.cropBtn}
              onMouseDown={(e) => {
                e.stopPropagation();
                onStartDrag(crop.type, e.clientX, e.clientY);
              }}
            >
              <span className={styles.cropEmoji}>{crop.emoji}</span>
              <div>
                <div className={styles.cropName}>{crop.label}</div>
                <div className={styles.cropMeta}>
                  ⏱ {crop.time} · +{crop.reward} 🪙
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export const App = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [inv, setInv] = useState<IInventorySnapshot>(DEFAULT_INV);
  const [currentMode, setCurrentMode] = useState<ModeType>("walk");
  const [holding, setHolding] = useState(false);
  const [shopOpen, setShopOpen] = useState(true);
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
  const buyBed = () => engineRef.current?.buyBed();
  const buyTree = () => engineRef.current?.buyTree();
  const buyBarn = () => engineRef.current?.buyBarn();

  const infoClass =
    infoType === "error"
      ? styles.infoError
      : infoType === "success"
        ? styles.infoSuccess
        : "";

  const BUTTONS: {
    id: ModeType;
    label: string;
    cls: string;
    empty?: boolean;
  }[] = [
    { id: "walk", label: "🚶 Ходити", cls: styles.btnWalk },
    { id: "grass", label: "🌱 Трава", cls: styles.btnGrass },
    {
      id: "bed",
      label: `🟫 Грядка (${inv.bedInv})`,
      cls: styles.btnBed,
      empty: inv.bedInv === 0,
    },
    {
      id: "tree",
      label: `🌳 Дерево (${inv.treeInv})`,
      cls: styles.btnTree,
      empty: inv.treeInv === 0,
    },
    {
      id: "barn",
      label: `🏠 Сарай (${inv.barnInv})`,
      cls: styles.btnBarn,
      empty: inv.barnInv === 0,
    },
    {
      id: "move",
      label: holding ? "✋ Скинути (ESC)" : "✋ Перемістити",
      cls: styles.btnMove,
    },
    { id: "clear", label: "🗑️ Очистити", cls: styles.btnClear },
  ];

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
        <div className={styles.stats}>
          <span className={styles.coinIcon} />
          Монети: <span>{inv.coins}</span>
        </div>

        <div className={`${styles.infoBar} ${infoClass}`}>{info}</div>

        <div className={styles.shopWrapper}>
          <button
            className={styles.shopToggle}
            onClick={() => setShopOpen((v) => !v)}
          >
            {shopOpen ? "🏪 Магазин ▲" : "🏪 Магазин ▼"}
          </button>
          {shopOpen && (
            <div className={styles.shop}>
              <div className={styles.shopTitle}>Оберіть товар</div>
              <div className={styles.shopItems}>
                <div className={styles.shopItem}>
                  <div className={styles.shopItemIcon}>🟫</div>
                  <div className={styles.shopItemName}>Грядка</div>
                  <div className={styles.shopItemPrice}>БЕЗКОШТОВНО</div>
                  <div className={styles.shopItemStock}>∞ в наявності</div>
                  <button className={styles.shopItemBtn} onClick={buyBed}>
                    Взяти
                  </button>
                </div>
                <div className={styles.shopItem}>
                  <div className={styles.shopItemIcon}>🌳</div>
                  <div className={styles.shopItemName}>Дерево</div>
                  <div className={styles.shopItemPrice}>
                    <span className={styles.coinIcon} />
                    50
                  </div>
                  <div className={styles.shopItemStock}>
                    {inv.treeStock} в наявності
                  </div>
                  <button
                    className={styles.shopItemBtn}
                    onClick={buyTree}
                    disabled={inv.coins < 50 || inv.treeStock === 0}
                  >
                    Купити
                  </button>
                </div>
                <div className={styles.shopItem}>
                  <div className={styles.shopItemIcon}>🏠</div>
                  <div className={styles.shopItemName}>Сарай</div>
                  <div className={styles.shopItemSize}>2x2 клітинки</div>
                  <div className={styles.shopItemPrice}>
                    <span className={styles.coinIcon} />
                    200
                  </div>
                  <div className={styles.shopItemStock}>
                    {inv.barnStock} в наявності
                  </div>
                  <button
                    className={styles.shopItemBtn}
                    onClick={buyBarn}
                    disabled={inv.coins < 200 || inv.barnStock === 0}
                  >
                    Купити
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.zoomIndicator}>🔍 {zoomDisplay}%</div>

        <div className={styles.toolbar}>
          {BUTTONS.map(({ id, label, cls, empty }) => (
            <button
              key={id}
              className={`${styles.btn} ${cls} ${currentMode === id ? styles.btnActive : ""} ${empty ? styles.btnEmpty : ""}`}
              onClick={() => handleSetMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
