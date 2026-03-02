import type { CropType } from "../../common/types";

import {
  CROP_GROW_MS,
  CROP_REWARD,
  CROP_LABELS,
} from "../../game/common/configs/game.config";

import styles from "./CropPopup.module.css";

const CROPS: {
  type: CropType;
  emoji: string;
}[] = [
  { type: "wheat", emoji: "🌾" },
  { type: "corn", emoji: "🌽" },
];

const POPUP_W = 224;

interface ICropPopupProps {
  screenX: number;
  screenY: number;
  onStartDrag: (crop: CropType, startX: number, startY: number) => void;
  onClose: () => void;
}

export const CropPopup = ({
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
                <div className={styles.cropName}>{CROP_LABELS[crop.type]}</div>
                <div className={styles.cropMeta}>
                  ⏱ {Math.round(CROP_GROW_MS[crop.type] / 1000)} сек · +
                  {CROP_REWARD[crop.type]} 🪙
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
