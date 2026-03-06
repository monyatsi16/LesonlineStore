import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, ShieldCheck, ArrowRight, ShoppingCart, Minus, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
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
  const [cartItems, setCartItems] = useState<CartItem[]>(getCartItems());
  const [products, setProducts] = useState<Product[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [isOrdering, setIsOrdering] = useState(false);

  useEffect(() => {
    fetch("/api/marketplace")
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
    if (!buyerName || !buyerEmail) return;
    setIsOrdering(true);

    try {
      for (const item of cartWithProducts) {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: item.productId,
            quantity: item.quantity,
            buyerName,
            buyerEmail,
            buyerPhone,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message);
        }
      }

      toast({
        title: "Orders Placed Successfully!",
        description: `${cartWithProducts.length} order(s) placed. Total: M${total.toLocaleString()}. Sellers will contact you.`,
      });
      setCartItems([]);
      saveCartItems([]);
      setCheckoutOpen(false);
      setBuyerName("");
      setBuyerEmail("");
      setBuyerPhone("");
    } catch (err: any) {
      toast({ title: "Order Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsOrdering(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-heading font-bold mb-6" data-testid="text-cart-title">
          <ShoppingCart className="inline h-6 w-6 mr-2" />
          Shopping Cart ({cartWithProducts.length} items)
        </h1>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {cartWithProducts.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border">
                <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">Your cart is empty.</p>
                <Button onClick={() => window.location.href = '/'} data-testid="button-continue-sourcing">Browse Products</Button>
              </div>
            ) : (
              cartWithProducts.map((item) => (
                <Card key={item.productId} className="overflow-hidden" data-testid={`card-cart-item-${item.productId}`}>
                  <CardContent className="p-4 flex gap-4">
                    <div className="h-24 w-24 bg-slate-100 rounded border p-2 flex-shrink-0">
                      <img src={item.product!.image} alt={item.product!.name} className="h-full w-full object-contain" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-sm truncate pr-4">{item.product!.name}</h3>
                          <p className="text-xs text-muted-foreground mb-1">{item.product!.category}</p>
                          <p className="text-xs text-muted-foreground">MOQ: {item.product!.moq} · Stock: {item.product!.stock}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => removeItem(item.productId)} data-testid={`button-remove-${item.productId}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-1 border rounded-md">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.productId, -1)} data-testid={`button-decrease-${item.productId}`}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-10 text-center text-sm font-medium">{item.quantity}</span>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.productId, 1)} data-testid={`button-increase-${item.productId}`}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">M{item.product!.price.toLocaleString()} each</div>
                          <div className="font-bold text-lg text-primary" data-testid={`text-item-total-${item.productId}`}>
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
            <Card className="sticky top-24">
              <CardHeader className="bg-slate-50 border-b pb-4">
                <CardTitle className="text-lg">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {cartWithProducts.map(item => (
                  <div key={item.productId} className="flex justify-between text-sm">
                    <span className="text-muted-foreground truncate mr-2">{item.product!.name} x{item.quantity}</span>
                    <span className="font-medium whitespace-nowrap">M{(item.product!.price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}

                <Separator />

                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary" data-testid="text-total">M{total.toLocaleString()}</span>
                </div>

                <div className="bg-orange-50 p-3 rounded text-xs text-orange-800 flex gap-2 items-start">
                  <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">LesOnline Verified</span>
                    All sellers are verified on the LesOnline marketplace.
                  </div>
                </div>
              </CardContent>
              <CardFooter className="p-6 pt-0">
                <Button className="w-full h-12 text-lg font-bold" onClick={() => setCheckoutOpen(true)} disabled={cartWithProducts.length === 0} data-testid="button-checkout">
                  Checkout <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>

        <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Complete Your Order</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Your Full Name</label>
                <Input placeholder="e.g. Thabo Mokoena" value={buyerName} onChange={e => setBuyerName(e.target.value)} data-testid="input-checkout-name" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Email Address</label>
                <Input type="email" placeholder="you@email.com" value={buyerEmail} onChange={e => setBuyerEmail(e.target.value)} data-testid="input-checkout-email" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Phone (optional)</label>
                <Input placeholder="+266 ..." value={buyerPhone} onChange={e => setBuyerPhone(e.target.value)} data-testid="input-checkout-phone" />
              </div>
              <div className="bg-slate-50 p-3 rounded border">
                <div className="flex justify-between font-bold text-primary">
                  <span>Total: {cartWithProducts.length} items</span>
                  <span>M{total.toLocaleString()}</span>
                </div>
              </div>
              <Button className="w-full" disabled={!buyerName || !buyerEmail || isOrdering} onClick={handleCheckout} data-testid="button-place-order">
                {isOrdering ? "Placing Orders..." : `Place Order — M${total.toLocaleString()}`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
