import type { CropType } from "../../common/types";

import styles from "./CropPopup.module.css";

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
