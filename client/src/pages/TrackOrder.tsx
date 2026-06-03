import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { resolveApiUrl } from "@/lib/api";
import { Separator } from "@/components/ui/separator";
import { MapPin, Package, Search, Clock3, CheckCircle2, Truck } from "lucide-react";
import { useMemo, useState } from "react";

type TrackingEvent = {
  status: string;
  label: string;
  timestamp: string;
  note?: string;
};

type TrackOrderResponse = {
  id: number;
  status: string;
  paymentMethod?: "cash_on_delivery" | "bank_transfer" | "card";
  buyerName: string;
  quantity: number;
  totalPrice: number;
  deliveryAddress?: {
    street?: string;
    area?: string;
    district?: string;
    country?: string;
  };
  trackingHistory?: TrackingEvent[];
  createdAt?: string;
  productName: string;
  productImage: string;
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

export default function TrackOrder() {
  const [orderId, setOrderId] = useState(() => new URLSearchParams(window.location.search).get("orderId") || "");
  const [email, setEmail] = useState(() => new URLSearchParams(window.location.search).get("email") || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TrackOrderResponse | null>(null);

  const orderedEvents = useMemo(() => {
    if (!result?.trackingHistory) return [];
    return [...result.trackingHistory].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }, [result]);

  const handleTrack = async () => {
    const id = Number(orderId);
    if (!Number.isFinite(id) || id <= 0 || !email.trim()) {
      setError("Enter a valid order number and email.");
      return;
    }

    setError("");
    setResult(null);
    setIsLoading(true);

    try {
      const res = await fetch(resolveApiUrl(`/api/orders/track/${id}?email=${encodeURIComponent(email.trim())}`));
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Unable to track order");
      setResult(data);
    } catch (err: any) {
      setError(err?.message || "Unable to track order");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans">
      <Navbar />

      <main className="container mx-auto px-4 py-8 lg:py-12 max-w-3xl space-y-6">
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-heading">Track Your Order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <Input
                placeholder="Order number (e.g. 124)"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                data-testid="input-track-order-id"
              />
              <Input
                type="email"
                placeholder="Order email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="input-track-order-email"
              />
            </div>
            <Button
              className="w-full md:w-auto bg-[#0E1F6C] hover:bg-[#0E1F6C]/90"
              onClick={handleTrack}
              disabled={isLoading}
              data-testid="button-track-order"
            >
              <Search className="mr-2 h-4 w-4" />
              {isLoading ? "Checking..." : "Track Order"}
            </Button>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </CardContent>
        </Card>

        {result ? (
          <Card className="rounded-2xl border shadow-sm" data-testid="card-track-result">
            <CardContent className="p-5 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Order #{result.id}</p>
                  <h2 className="font-heading font-bold text-lg">{result.productName}</h2>
                  <p className="text-sm text-muted-foreground">Buyer: {result.buyerName}</p>
                </div>
                <Badge className={statusColor[result.status] || "bg-gray-100 text-gray-700"}>
                  {result.status.replace(/_/g, " ")}
                </Badge>
              </div>

              <div className="grid sm:grid-cols-3 gap-3 text-sm">
                <div className="p-3 rounded-xl border bg-white">
                  <p className="text-muted-foreground">Quantity</p>
                  <p className="font-semibold">{result.quantity}</p>
                </div>
                <div className="p-3 rounded-xl border bg-white">
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-semibold">M{result.totalPrice.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-xl border bg-white">
                  <p className="text-muted-foreground">Ordered</p>
                  <p className="font-semibold">{result.createdAt ? new Date(result.createdAt).toLocaleDateString() : "-"}</p>
                </div>
              </div>

              <div className="p-3 rounded-xl border bg-white text-sm">
                <p className="text-muted-foreground">Payment Method</p>
                <p className="font-semibold">{paymentMethodLabel(result.paymentMethod)}</p>
              </div>

              <div className="p-3 rounded-xl border bg-white text-sm">
                <div className="flex items-center gap-2 font-medium mb-1">
                  <MapPin className="h-4 w-4" />
                  Delivery Address
                </div>
                <p className="text-muted-foreground">
                  {[result.deliveryAddress?.street, result.deliveryAddress?.area, result.deliveryAddress?.district, result.deliveryAddress?.country]
                    .filter(Boolean)
                    .join(", ") || "No address provided"}
                </p>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="font-heading font-semibold flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Delivery Checkpoints
                </h3>
                {orderedEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tracking events yet.</p>
                ) : (
                  orderedEvents.map((event, index) => (
                    <div key={`${event.timestamp}-${index}`} className="flex gap-3 items-start">
                      <div className="mt-0.5">
                        {index === orderedEvents.length - 1 ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <Clock3 className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1 rounded-lg border p-3 bg-white">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">{event.label}</p>
                          <span className="text-xs text-muted-foreground">
                            {new Date(event.timestamp).toLocaleString()}
                          </span>
                        </div>
                        {event.note ? <p className="text-xs text-muted-foreground mt-1">{event.note}</p> : null}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Package className="h-3.5 w-3.5" />
                Live, dynamic tracking updates are driven from seller/admin checkpoint updates.
              </div>
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  );
}
