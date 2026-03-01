import { useState } from "react";

import type { IInventorySnapshot } from "../../common/types";

import styles from "./Shop.module.css";

interface IShopProps {
  inv: IInventorySnapshot;
  onBuyBed: () => void;
  onBuyTree: () => void;
  onBuyBarn: () => void;
}

export const Shop = ({ inv, onBuyBed, onBuyTree, onBuyBarn }: IShopProps) => {
  const [open, setOpen] = useState(true);

  return (
    <div className={styles.shopWrapper}>
      <button className={styles.shopToggle} onClick={() => setOpen((v) => !v)}>
        {open ? "🏪 Магазин ▲" : "🏪 Магазин ▼"}
      </button>

      {open && (
        <div className={styles.shop}>
          <div className={styles.shopTitle}>Оберіть товар</div>
          <div className={styles.shopItems}>
            <div className={styles.shopItem}>
              <div className={styles.shopItemIcon}>🟫</div>
              <div className={styles.shopItemName}>Грядка</div>
              <div className={styles.shopItemPrice}>БЕЗКОШТОВНО</div>
              <div className={styles.shopItemStock}>∞ в наявності</div>
              <button className={styles.shopItemBtn} onClick={onBuyBed}>
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
                onClick={onBuyTree}
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
                onClick={onBuyBarn}
                disabled={inv.coins < 200 || inv.barnStock === 0}
              >
                Купити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
