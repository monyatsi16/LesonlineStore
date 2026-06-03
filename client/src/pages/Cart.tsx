import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { resolveApiUrl } from "@/lib/api";
import {
  Trash2, ShieldCheck, ArrowRight, ShoppingCart, Minus, Plus,
  Zap, Lock, ChevronRight, Package, MapPin, Truck, Check
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { Product } from "@shared/schema";

interface CartItem {
  productId: number;
  quantity: number;
  product?: Product;
}

function getCartItems(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem("lesonline_cart") || "[]");
  } catch { return []; }
}

function saveCartItems(items: CartItem[]) {
  localStorage.setItem("lesonline_cart", JSON.stringify(items));
  window.dispatchEvent(new Event("cart-updated"));
}

export function addToCart(productId: number, quantity: number) {
  const items = getCartItems();
  const existing = items.find(i => i.productId === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({ productId, quantity });
  }
  saveCartItems(items);
}

export default function Cart() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [cartItems, setCartItems] = useState<CartItem[]>(getCartItems());
  const [products, setProducts] = useState<Product[]>([]);
  const [step, setStep] = useState<"cart" | "checkout">("cart");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [addrStreet, setAddrStreet] = useState("");
  const [addrArea, setAddrArea] = useState("");
  const [addrDistrict, setAddrDistrict] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash_on_delivery" | "bank_transfer" | "card">("cash_on_delivery");
  const [isOrdering, setIsOrdering] = useState(false);

  useEffect(() => {
    fetch(resolveApiUrl("/api/marketplace"))
      .then(r => r.json())
      .then(setProducts)
      .catch(() => {});
  }, []);

  const cartWithProducts = cartItems.map(item => ({
    ...item,
    product: products.find(p => p.id === item.productId),
  })).filter(item => item.product);

  const subtotal = cartWithProducts.reduce((acc, item) => acc + ((item.product?.price || 0) * item.quantity), 0);
  const total = subtotal;

  const updateQuantity = (productId: number, delta: number) => {
    const newItems = cartItems.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        const product = products.find(p => p.id === productId);
        return { ...item, quantity: Math.min(newQty, product?.stock || 999) };
      }
      return item;
    });
    setCartItems(newItems);
    saveCartItems(newItems);
  };

  const removeItem = (productId: number) => {
    const newItems = cartItems.filter(i => i.productId !== productId);
    setCartItems(newItems);
    saveCartItems(newItems);
  };

  const handleCheckout = async () => {
    if (!buyerName || !buyerEmail || !addrStreet || !addrArea || !addrDistrict) {
      toast({
        title: "Missing details",
        description: "Please complete contact and delivery address fields.",
        variant: "destructive",
      });
      return;
    }
    setIsOrdering(true);

    try {
      const deliveryAddress = {
        street: addrStreet,
        area: addrArea,
        district: addrDistrict,
        country: "Lesotho",
      };

      const res = await fetch(resolveApiUrl("/api/orders/checkout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartWithProducts.map(i => ({ productId: i.productId, quantity: i.quantity })),
          buyerName,
          buyerEmail,
          buyerPhone,
          shippingMethod: "checkpoint",
          deliveryAddress,
          paymentMethod,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      const orderData = await res.json();

      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/seller"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/overview"] });

      sessionStorage.setItem("lesonline_order_confirm", JSON.stringify({
        orderIds: orderData.orderIds,
        totalAmount: orderData.total,
        itemCount: orderData.itemCount,
        buyerName,
        buyerEmail,
        deliveryAddress,
        paymentMethod,
      }));

      setCartItems([]);
      saveCartItems([]);
      setStep("cart");
      setBuyerName("");
      setBuyerEmail("");
      setBuyerPhone("");
      setAddrStreet("");
      setAddrArea("");
      setAddrDistrict("");
      setPaymentMethod("cash_on_delivery");
      setLocation("/order-confirmed");
    } catch (err: any) {
      toast({ title: "Order Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsOrdering(false);
    }
  };

  if (step === "checkout" && cartWithProducts.length > 0) {
    return (
      <div className="min-h-screen bg-gray-50/50 font-sans">
        <Navbar />

        <div className="border-b bg-white">
          <div className="container mx-auto px-4 py-3">
            <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-primary transition-colors">Home</Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <button onClick={() => setStep("cart")} className="hover:text-primary transition-colors">Cart</button>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-foreground font-medium">Checkout</span>
            </nav>
          </div>
        </div>

        <main className="container mx-auto px-4 py-8 lg:py-12 max-w-4xl">
          <h1 className="text-2xl lg:text-3xl font-heading font-bold mb-8" data-testid="text-checkout-title">
            Checkout
          </h1>

          <div className="grid lg:grid-cols-5 gap-8">
            <div className="lg:col-span-3 space-y-6">
              <Card className="rounded-2xl border shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-heading">Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs font-medium mb-1.5 block text-muted-foreground uppercase tracking-wide">Full Name</label>
                    <Input
                      placeholder="e.g. Thabo Mokoena"
                      value={buyerName}
                      onChange={e => setBuyerName(e.target.value)}
                      className="rounded-lg h-11"
                      data-testid="input-checkout-name"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1.5 block text-muted-foreground uppercase tracking-wide">Email Address</label>
                    <Input
                      type="email"
                      placeholder="you@email.com"
                      value={buyerEmail}
                      onChange={e => setBuyerEmail(e.target.value)}
                      className="rounded-lg h-11"
                      data-testid="input-checkout-email"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1.5 block text-muted-foreground uppercase tracking-wide">Phone Number</label>
                    <Input
                      placeholder="+266 ..."
                      value={buyerPhone}
                      onChange={e => setBuyerPhone(e.target.value)}
                      className="rounded-lg h-11"
                      data-testid="input-checkout-phone"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-heading">Delivery Address</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs font-medium mb-1.5 block text-muted-foreground uppercase tracking-wide">Street / Village</label>
                    <Input
                      placeholder="e.g. Ha Abia, Main Road"
                      value={addrStreet}
                      onChange={e => setAddrStreet(e.target.value)}
                      className="rounded-lg h-11"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium mb-1.5 block text-muted-foreground uppercase tracking-wide">Area / Town</label>
                      <Input
                        placeholder="e.g. Maseru"
                        value={addrArea}
                        onChange={e => setAddrArea(e.target.value)}
                        className="rounded-lg h-11"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1.5 block text-muted-foreground uppercase tracking-wide">District</label>
                      <Input
                        placeholder="e.g. Maseru District"
                        value={addrDistrict}
                        onChange={e => setAddrDistrict(e.target.value)}
                        className="rounded-lg h-11"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-700">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span>Country: <strong>Lesotho</strong> — We deliver nationwide.</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-heading">Shipping Method</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border-2 border-primary rounded-xl p-4 bg-primary/[0.02]">
                    <div className="flex items-start gap-3">
                      <div className="h-5 w-5 rounded-full border-2 border-primary flex items-center justify-center mt-0.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">Collection at LESonline Pickup Point</span>
                          <span className="text-sm font-medium text-green-600">Free</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          3-5 business days after placing your order. You will be contacted to collect your order.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                    <Truck className="h-3.5 w-3.5" />
                    <span>We deliver Nationwide (LESOTHO). Shipping times depend on payment clearance.</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-heading">Payment Method</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <label className="flex items-center gap-3 border rounded-xl p-3 cursor-pointer hover:border-primary/40 transition-colors">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cash_on_delivery"
                      checked={paymentMethod === "cash_on_delivery"}
                      onChange={() => setPaymentMethod("cash_on_delivery")}
                    />
                    <div>
                      <p className="text-sm font-medium">Cash on Delivery</p>
                      <p className="text-xs text-muted-foreground">Pay when you receive your order at the checkpoint.</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 border rounded-xl p-3 cursor-pointer hover:border-primary/40 transition-colors">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="bank_transfer"
                      checked={paymentMethod === "bank_transfer"}
                      onChange={() => setPaymentMethod("bank_transfer")}
                    />
                    <div>
                      <p className="text-sm font-medium">Bank Transfer</p>
                      <p className="text-xs text-muted-foreground">Transfer to LesOnline account and share proof of payment.</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 border rounded-xl p-3 cursor-pointer hover:border-primary/40 transition-colors">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="card"
                      checked={paymentMethod === "card"}
                      onChange={() => setPaymentMethod("card")}
                    />
                    <div>
                      <p className="text-sm font-medium">Card Payment</p>
                      <p className="text-xs text-muted-foreground">Pay securely with debit or credit card.</p>
                    </div>
                  </label>
                </CardContent>
              </Card>

              <Button
                className="w-full h-12 text-base font-heading font-bold rounded-xl bg-[#0E1F6C] hover:bg-[#0E1F6C]/90"
                disabled={!buyerName || !buyerEmail || !addrStreet || !addrArea || !addrDistrict || isOrdering}
                onClick={handleCheckout}
                data-testid="button-place-order"
              >
                {isOrdering ? "Placing Order..." : `Place Order — M${total.toLocaleString()}`}
              </Button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                <Lock className="h-3 w-3" />
                <span>Your information is secure</span>
              </div>
            </div>

            <div className="lg:col-span-2">
              <Card className="sticky top-24 rounded-2xl border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-heading">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {cartWithProducts.map(item => (
                    <div key={item.productId} className="flex gap-3 items-start">
                      <div className="h-14 w-14 bg-gray-50 rounded-lg border p-1.5 shrink-0">
                        <img src={item.product!.image} alt={item.product!.name} className="h-full w-full object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.product!.name}</p>
                        <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                      <span className="text-sm font-semibold whitespace-nowrap">M{(item.product!.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}

                  <Separator className="my-3" />

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">M{subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="text-sm text-green-600 font-medium">Free (Pickup)</span>
                  </div>

                  <Separator className="my-3" />

                  <div className="flex justify-between text-lg font-bold">
                    <span className="font-heading">Total</span>
                    <span className="text-primary font-heading" data-testid="text-checkout-total">M{total.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans">
      <Navbar />

      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium">Shopping Cart</span>
          </nav>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8 lg:py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl lg:text-3xl font-heading font-bold" data-testid="text-cart-title">
            Your cart
          </h1>
          {cartWithProducts.length > 0 && (
            <Link href="/" className="text-sm text-primary hover:underline font-medium">
              Continue shopping
            </Link>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {cartWithProducts.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border shadow-sm">
                <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="font-heading font-bold text-lg mb-2">Your cart is empty</h2>
                <p className="text-muted-foreground mb-6 text-sm">Browse our products and find something you love.</p>
                <Button
                  onClick={() => setLocation('/')}
                  className="rounded-xl bg-[#0E1F6C] hover:bg-[#0E1F6C]/90 font-heading"
                  data-testid="button-continue-shopping"
                >
                  Continue shopping
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            ) : (
              cartWithProducts.map((item) => (
                <Card key={item.productId} className="overflow-hidden rounded-xl border shadow-sm" data-testid={`card-cart-item-${item.productId}`}>
                  <CardContent className="p-4 sm:p-5 flex gap-4 sm:gap-5">
                    <Link href={`/product/${item.productId}`} className="shrink-0">
                      <div className="h-24 w-24 sm:h-28 sm:w-28 bg-gray-50 rounded-xl border p-3 flex items-center justify-center hover:border-primary/30 transition-colors cursor-pointer">
                        <img src={item.product!.image} alt={item.product!.name} className="h-full w-full object-contain" />
                      </div>
                    </Link>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <Link href={`/product/${item.productId}`}>
                            <h3 className="font-heading font-semibold text-sm sm:text-base hover:text-primary transition-colors cursor-pointer truncate pr-2">{item.product!.name}</h3>
                          </Link>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px] font-normal">{item.product!.category}</Badge>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Package className="h-3 w-3" />
                              {item.product!.stock} in stock
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-full shrink-0"
                          onClick={() => removeItem(item.productId)}
                          data-testid={`button-remove-${item.productId}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex items-end justify-between mt-4">
                        <div className="flex items-center border rounded-xl overflow-hidden bg-gray-50">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-none hover:bg-gray-100"
                            onClick={() => updateQuantity(item.productId, -1)}
                            data-testid={`button-decrease-${item.productId}`}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <span className="w-10 text-center text-sm font-semibold bg-white border-x">{item.quantity}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-none hover:bg-gray-100"
                            onClick={() => updateQuantity(item.productId, 1)}
                            data-testid={`button-increase-${item.productId}`}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">M{item.product!.price.toLocaleString()} each</div>
                          <div className="font-heading font-bold text-lg text-primary" data-testid={`text-item-total-${item.productId}`}>
                            M{(item.product!.price * item.quantity).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-24 rounded-2xl border-2 overflow-hidden shadow-sm">
              <CardHeader className="bg-[#0E1F6C] text-white pb-4 px-5 pt-5">
                <CardTitle className="text-base font-heading flex items-center gap-2">
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {cartWithProducts.map(item => (
                  <div key={item.productId} className="flex justify-between text-sm gap-2">
                    <span className="text-muted-foreground truncate">{item.product!.name} <span className="text-foreground">×{item.quantity}</span></span>
                    <span className="font-medium whitespace-nowrap">M{(item.product!.price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}

                {cartWithProducts.length > 0 && (
                  <>
                    <Separator />

                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-muted-foreground">Subtotal</span>
                      <span className="font-semibold">M{subtotal.toLocaleString()}</span>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Taxes and shipping calculated at checkout
                    </div>

                    <Separator />

                    <div className="flex justify-between text-lg font-bold">
                      <span className="font-heading">Total</span>
                      <span className="text-primary font-heading" data-testid="text-total">M{total.toLocaleString()}</span>
                    </div>
                  </>
                )}

                <div className="flex items-start gap-2.5 p-3 rounded-xl border bg-gray-50 text-xs">
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-foreground">Pickup at LESonline</span>
                    <span className="text-muted-foreground">3-5 business days after order</span>
                  </div>
                </div>

                <div className="bg-primary/[0.03] border border-primary/20 p-3 rounded-xl text-xs flex gap-2.5 items-start">
                  <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Zap className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <span className="font-semibold block text-foreground">AI-Optimized Pricing</span>
                    <span className="text-muted-foreground">Prices are dynamically optimized using market data</span>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-100 p-3 rounded-xl text-xs flex gap-2.5 items-start">
                  <div className="h-6 w-6 rounded-md bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                  </div>
                  <div>
                    <span className="font-semibold block text-foreground">LesOnline Verified</span>
                    <span className="text-muted-foreground">All sellers are verified on the marketplace</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="p-5 pt-0 flex flex-col gap-3">
                <Button
                  className="w-full h-12 text-base font-heading font-bold rounded-xl bg-[#0E1F6C] hover:bg-[#0E1F6C]/90"
                  onClick={() => setStep("checkout")}
                  disabled={cartWithProducts.length === 0}
                  data-testid="button-checkout"
                >
                  Check out
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  <span>Secure checkout</span>
                </div>
              </CardFooter>
            </Card>
          </div>
        </div>
      </main>

      <footer className="border-t bg-white py-8 mt-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} LesOnline. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
