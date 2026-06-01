import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Package, MapPin, Mail, ArrowRight, ShoppingBag } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";

interface OrderConfirmData {
  orderIds: number[];
  totalAmount: number;
  itemCount: number;
  buyerName: string;
  buyerEmail: string;
  paymentMethod?: "cash_on_delivery" | "bank_transfer" | "card";
  deliveryAddress?: {
    street?: string;
    area?: string;
    district?: string;
    country?: string;
  };
}

function getConfirmationData(): OrderConfirmData | null {
  try {
    const data = sessionStorage.getItem("lesonline_order_confirm");
    if (!data) return null;
    sessionStorage.removeItem("lesonline_order_confirm");
    return JSON.parse(data);
  } catch { return null; }
}

export default function OrderConfirmation() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<OrderConfirmData | null>(null);

  const paymentMethodLabel = (method?: string) => {
    if (method === "bank_transfer") return "Bank Transfer";
    if (method === "card") return "Card Payment";
    return "Cash on Delivery";
  };

  useEffect(() => {
    const confirmData = getConfirmationData();
    if (!confirmData) {
      setLocation("/");
      return;
    }
    setData(confirmData);
  }, [setLocation]);

  if (!data) {
    return (
      <div className="min-h-screen bg-white font-sans">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Redirecting...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans">
      <Navbar />

      <main className="container mx-auto px-4 py-12 lg:py-16 max-w-lg">
        <Card className="rounded-2xl border-2 shadow-sm overflow-hidden">
          <div className="bg-green-50 p-8 text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-heading font-bold text-green-800 mb-2" data-testid="text-order-confirmed">
              Order Confirmed!
            </h1>
            <p className="text-sm text-green-700">
              Thank you for your order, {data.buyerName}
            </p>
          </div>

          <CardContent className="p-6 space-y-5">
            <div className="bg-white border rounded-xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Order Number(s)</span>
                <span className="font-semibold">#{data.orderIds.join(", #")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Items</span>
                <span className="font-medium">{data.itemCount} item(s)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payment Method</span>
                <span className="font-medium">{paymentMethodLabel(data.paymentMethod)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span className="font-heading">Total Paid</span>
                <span className="text-primary font-heading" data-testid="text-confirmed-total">M{data.totalAmount.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-xl border bg-blue-50/50">
                <Package className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">What happens next?</p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    We are processing your order. You will be contacted once your order is ready for collection.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl border">
                <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Delivery / Checkpoint Address</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[
                      data.deliveryAddress?.street,
                      data.deliveryAddress?.area,
                      data.deliveryAddress?.district,
                      data.deliveryAddress?.country,
                    ].filter(Boolean).join(", ") || "3-5 business days after payment clears. We deliver Nationwide (LESOTHO)."}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl border">
                <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Confirmation sent to</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{data.buyerEmail}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <Button
                asChild
                variant="outline"
                className="w-full h-12 rounded-xl font-heading font-semibold"
                data-testid="button-track-order-confirm"
              >
                <Link href={`/track?orderId=${data.orderIds[0]}&email=${encodeURIComponent(data.buyerEmail)}`}>
                  Track This Order
                </Link>
              </Button>
              <Button
                className="w-full h-12 rounded-xl font-heading font-semibold bg-[#0E1F6C] hover:bg-[#0E1F6C]/90"
                onClick={() => setLocation("/")}
                data-testid="button-continue-shopping-confirm"
              >
                Continue Shopping
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Need help? Chat with us on <a href="https://wa.me/26663646142?text=Hey+there%2C+I+have+a+question+about+my+order!" className="text-primary underline" target="_blank" rel="noopener noreferrer">WhatsApp</a>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
