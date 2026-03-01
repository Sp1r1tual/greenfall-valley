import type { ModeType } from "../../common/types";

import styles from "./ActionBar.module.css";

const BUTTONS: {
  id: ModeType;
  label: (
    inv: { bedInv: number; treeInv: number; barnInv: number },
    holding: boolean,
  ) => string;
  cls: string;
  isEmpty?: (inv: {
    bedInv: number;
    treeInv: number;
    barnInv: number;
  }) => boolean;
}[] = [
  {
    id: "walk",
    label: () => "🚶 Ходити",
    cls: styles.btnWalk,
  },
  {
    id: "grass",
    label: () => "🌱 Трава",
    cls: styles.btnGrass,
  },
  {
    id: "bed",
    label: (inv) => `🟫 Грядка (${inv.bedInv})`,
    cls: styles.btnBed,
    isEmpty: (inv) => inv.bedInv === 0,
  },
  {
    id: "tree",
    label: (inv) => `🌳 Дерево (${inv.treeInv})`,
    cls: styles.btnTree,
    isEmpty: (inv) => inv.treeInv === 0,
  },
  {
    id: "barn",
    label: (inv) => `🏠 Сарай (${inv.barnInv})`,
    cls: styles.btnBarn,
    isEmpty: (inv) => inv.barnInv === 0,
  },
  {
    id: "move",
    label: (_, holding) => (holding ? "✋ Скинути (ESC)" : "✋ Перемістити"),
    cls: styles.btnMove,
  },
  {
    id: "clear",
    label: () => "🗑️ Очистити",
    cls: styles.btnClear,
  },
];

interface IActionBarProps {
  currentMode: ModeType;
  holding: boolean;
  inv: { bedInv: number; treeInv: number; barnInv: number };
  onSetMode: (mode: ModeType) => void;
}

export const ActionBar = ({
  currentMode,
  holding,
  inv,
  onSetMode,
}: IActionBarProps) => (
  <div className={styles.toolbar}>
    {BUTTONS.map(({ id, label, cls, isEmpty }) => {
      const empty = isEmpty?.(inv) ?? false;
      return (
        <button
          key={id}
          className={`${styles.btn} ${cls} ${currentMode === id ? styles.btnActive : ""} ${empty ? styles.btnEmpty : ""}`}
          onClick={() => onSetMode(id)}
        >
          {label(inv, holding)}
        </button>
      );
    })}
  </div>
);
