import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

type PriceChangeEvent = {
  productId: number;
};

export default function PriceSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const stream = new EventSource("/api/price-events");

    const handlePriceChange = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as PriceChangeEvent;
        queryClient.invalidateQueries({ queryKey: ["/api/marketplace"] });
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
        queryClient.invalidateQueries({ queryKey: ["/api/analytics/overview"] });
        queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/price-updates"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/price-updates/latest"] });
        queryClient.invalidateQueries({ queryKey: [`/api/marketplace/product/${payload.productId}`] });
      } catch {
        // Ignore malformed messages and rely on EventSource reconnect.
      }
    };

    stream.addEventListener("price-change", handlePriceChange as EventListener);

    return () => {
      stream.removeEventListener("price-change", handlePriceChange as EventListener);
      stream.close();
    };
  }, [queryClient]);

  return null;
}