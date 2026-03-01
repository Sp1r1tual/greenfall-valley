import type { ModeType } from "@/common/types";
import {
  TREE_PRICE,
  BARN_PRICE,
  DEFAULT_INV,
} from "./common/configs/game.config";

type OnMessageType = (
  text: string,
  type: "error" | "success" | "normal",
) => void;
type OnModeType = (mode: ModeType) => void;

interface IShopState {
  coins: number;
  bedInv: number;
  treeInv: number;
  barnInv: number;
  treeStock: number;
  barnStock: number;
}

export class ShopService {
  private state: IShopState;
  private onMessage: OnMessageType;
  private onMode: OnModeType;

  constructor(onMessage: OnMessageType, onMode: OnModeType) {
    this.onMessage = onMessage;
    this.onMode = onMode;
    this.state = { ...DEFAULT_INV };
  }

  getState(): Readonly<IShopState> {
    return { ...this.state };
  }

  addCoins(amount: number): void {
    this.state.coins += amount;
  }

  buyBed(): void {
    this.state.bedInv++;
    this.onMessage("✅ Отримано грядку!", "success");
    this.onMode("bed");
  }

  buyTree(): boolean {
    if (this.state.coins < TREE_PRICE || this.state.treeStock === 0)
      return false;
    this.state.coins -= TREE_PRICE;
    this.state.treeInv++;
    this.state.treeStock--;
    this.onMessage("✅ Куплено дерево!", "success");
    this.onMode("tree");
    return true;
  }

  buyBarn(): boolean {
    if (this.state.coins < BARN_PRICE || this.state.barnStock === 0)
      return false;
    this.state.coins -= BARN_PRICE;
    this.state.barnInv++;
    this.state.barnStock--;
    this.onMessage("✅ Куплено сарай!", "success");
    this.onMode("barn");
    return true;
  }

  consumeBed(): boolean {
    if (this.state.bedInv <= 0) return false;
    this.state.bedInv--;
    return true;
  }

  consumeTree(): boolean {
    if (this.state.treeInv <= 0) return false;
    this.state.treeInv--;
    return true;
  }

  consumeBarn(): boolean {
    if (this.state.barnInv <= 0) return false;
    this.state.barnInv--;
    return true;
  }

  returnBed(): void {
    this.state.bedInv++;
  }
  returnTree(): void {
    this.state.treeInv++;
  }
  returnBarn(): void {
    this.state.barnInv++;
  }
}
