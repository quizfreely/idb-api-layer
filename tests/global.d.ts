import { idbApiLayer, idbLayerImg, db } from "../dist/index"
export {};

declare global {
  interface Window {
    idbApiLayer: typeof idbApiLayer;
    idbLayerImg: typeof idbLayerImg;
    db: typeof db;
  }
}