import { PLAYGROUND, ZOOM } from "../configs/game.config";

export const getSceneOrigin = () => {
  const isoH =
    (PLAYGROUND.GRID_W + PLAYGROUND.GRID_H) * (PLAYGROUND.TILE_HEIGHT / 2);

  const screenCX = window.innerWidth / 2 / ZOOM.DEFAULT_ZOOM;
  const screenCY = window.innerHeight / 2 / ZOOM.DEFAULT_ZOOM;

  return {
    x: screenCX,
    y: screenCY - isoH / 2,
  };
};
