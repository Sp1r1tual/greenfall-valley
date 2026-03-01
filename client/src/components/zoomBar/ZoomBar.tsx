import styles from "./ZoomBar.module.css";

interface IZoomBarProps {
  zoom: number;
}

export const ZoomBar = ({ zoom }: IZoomBarProps) => (
  <div className={styles.zoomIndicator}>🔍 {zoom}%</div>
);
