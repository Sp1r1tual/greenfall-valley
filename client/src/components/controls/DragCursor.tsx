import type { CropType } from "../../common/types";

import styles from "./DragCursor.module.css";

const CROPS = [
  { type: "wheat" as CropType, emoji: "🌾" },
  { type: "corn" as CropType, emoji: "🌽" },
];

interface IDragCursorProps {
  x: number;
  y: number;
  crop: CropType;
}

export const DragCursor = ({ x, y, crop }: IDragCursorProps) => {
  const c = CROPS.find((c) => c.type === crop);
  if (!c) return null;

  return (
    <div className={styles.dragCursor} style={{ left: x - 24, top: y - 24 }}>
      {c.emoji}
    </div>
  );
};
