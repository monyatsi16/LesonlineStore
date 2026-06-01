import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, RotateCcw, Clock3, Package } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { addToCart } from "./Cart";

type BuyerOrder = {
  id: number;
  status: string;
  paymentMethod?: "cash_on_delivery" | "bank_transfer" | "card";
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  createdAt?: string;
  productId: number;
  productName: string;
  productImage: string;
};

type BuyerOrderHistoryResponse = {
  email: string;
  count: number;
  orders: BuyerOrder[];
};

const statusColor: Record<string, string> = {
  paid: "bg-blue-100 text-blue-700",
  processing: "bg-amber-100 text-amber-700",
  in_transit: "bg-purple-100 text-purple-700",
  at_checkpoint: "bg-cyan-100 text-cyan-700",
  ready: "bg-green-100 text-green-700",
  fulfilled: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

const paymentMethodLabel = (method?: string) => {
  if (method === "bank_transfer") return "Bank Transfer";
  if (method === "card") return "Card Payment";
  return "Cash on Delivery";
};

export default function OrderHistory() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<BuyerOrderHistoryResponse | null>(null);

  const loadHistory = async () => {
    if (!email.trim()) {
      setError("Enter your order email.");
      return;
    }

    setIsLoading(true);
    setError("");
    setHistory(null);

    try {
      const res = await fetch(`/api/orders/history?email=${encodeURIComponent(email.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Unable to load orders");
      setHistory(data);
    } catch (err: any) {
      setError(err?.message || "Unable to load orders");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRepeatOrder = (order: BuyerOrder) => {
    addToCart(order.productId, order.quantity);
    setLocation("/cart");
  };

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans">
      <Navbar />

      <main className="container mx-auto px-4 py-8 lg:py-12 max-w-4xl space-y-6">
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Your Order History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Email used during checkout"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="input-order-history-email"
              />
              <Button
                onClick={loadHistory}
                disabled={isLoading}
                className="bg-[#0E1F6C] hover:bg-[#0E1F6C]/90"
                data-testid="button-load-order-history"
              >
                <Search className="h-4 w-4 mr-1" />
                {isLoading ? "Loading..." : "Find Orders"}
              </Button>
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <p className="text-xs text-muted-foreground">Tip: use the same email from checkout to see all your orders and reorder quickly.</p>
          </CardContent>
        </Card>

        {history ? (
          <Card className="rounded-2xl border shadow-sm" data-testid="card-order-history-results">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{history.count} order(s) found for {history.email}</p>
                <Link href="/track" className="text-sm text-[#0E1F6C] underline">Track an order</Link>
              </div>

              {history.orders.length === 0 ? (
                <div className="rounded-xl border p-8 text-center text-muted-foreground">
                  <Package className="h-6 w-6 mx-auto mb-2" />
                  No orders yet for this email.
                </div>
              ) : (
                history.orders.map((order) => (
                  <div key={order.id} className="rounded-xl border p-4 bg-white">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-16 w-16 rounded-lg border bg-gray-50 p-1.5">
                          <img src={order.productImage} alt={order.productName} className="h-full w-full object-contain" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{order.productName}</p>
                          <p className="text-xs text-muted-foreground">Order #{order.id} • Qty {order.quantity}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock3 className="h-3 w-3" />
                            {order.createdAt ? new Date(order.createdAt).toLocaleString() : "-"}
                          </p>
                        </div>
                      </div>
                      <Badge className={statusColor[order.status] || "bg-gray-100 text-gray-700"}>
                        {order.status.replace(/_/g, " ")}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Total: </span>
                        <span className="font-bold">M{order.totalPrice.toLocaleString()}</span>
                        <span className="text-muted-foreground ml-2">• {paymentMethodLabel(order.paymentMethod)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button asChild variant="outline" size="sm" data-testid={`button-track-order-${order.id}`}>
                          <Link href={`/track?orderId=${order.id}&email=${encodeURIComponent(history.email)}`}>Track</Link>
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleRepeatOrder(order)}
                          className="bg-[#0E1F6C] hover:bg-[#0E1F6C]/90"
                          data-testid={`button-repeat-order-${order.id}`}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          Repeat Order
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  );
}
