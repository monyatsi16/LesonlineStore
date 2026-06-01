import { EventEmitter } from "events";

export type PriceChangeEvent = {
  productId: number;
  newPrice: number;
  source: "scheduler" | "productViewed" | "stockChanged" | "competitorPriceChanged" | "manual" | "admin";
  changedAt: string;
};

const emitter = new EventEmitter();

export function publishPriceChange(event: PriceChangeEvent): void {
  emitter.emit("price-change", event);
}

export function onPriceChange(listener: (event: PriceChangeEvent) => void): () => void {
  emitter.on("price-change", listener);
  return () => {
    emitter.off("price-change", listener);
  };
}