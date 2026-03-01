import styles from "./Currency.module.css";

interface ICurrencyProps {
  coins: number;
}

export const Currency = ({ coins }: ICurrencyProps) => (
  <div className={styles.stats}>
    <span className={styles.coinIcon} />
    Монети: <span>{coins}</span>
  </div>
);
