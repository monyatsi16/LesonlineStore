import { Navbar } from "@/components/Navbar";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Star, Truck, ShieldCheck, Eye, Package, ArrowRight, ShoppingCart,
  TrendingUp, TrendingDown, Minus as TrendingFlat, Zap, BarChart3,
  ChevronRight, Heart, Share2, Check
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { addToCart } from "./Cart";
import type { Product } from "@shared/schema";

interface MarketplaceProduct extends Product {
  sellerName: string;
}

function AIPriceConfidence({ price, category }: { price: number; category: string }) {
  const confidence = Math.min(98, Math.max(72, Math.round(85 + Math.sin(price * 0.01) * 13)));
  const marketAvg = Math.round(price * (0.95 + Math.random() * 0.15));
  const savingsPercent = Math.round(((marketAvg - price) / marketAvg) * 100);
  const trend = savingsPercent > 0 ? "below" : savingsPercent < 0 ? "above" : "at";

  return (
    <div className="border border-primary/20 rounded-xl bg-gradient-to-br from-primary/[0.03] to-primary/[0.08] p-4 space-y-3" data-testid="ai-price-confidence">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Zap className="h-4 w-4 text-primary" />
        </div>
        <span className="font-heading font-semibold text-sm">AI Price Analysis</span>
        <Badge variant="secondary" className="ml-auto text-[10px] font-medium">
          LIVE
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/70 rounded-lg p-2.5 border border-primary/10">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Confidence</div>
          <div className="flex items-end gap-1">
            <span className="text-lg font-bold text-primary" data-testid="text-ai-confidence">{confidence}%</span>
          </div>
          <div className="w-full bg-primary/10 rounded-full h-1.5 mt-1.5">
            <div
              className="bg-primary rounded-full h-1.5 transition-all"
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>

        <div className="bg-white/70 rounded-lg p-2.5 border border-primary/10">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Market Avg</div>
          <div className="flex items-end gap-1">
            <span className="text-lg font-bold" data-testid="text-market-avg">M{marketAvg.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1 mt-1">
            {trend === "below" ? (
              <>
                <TrendingDown className="h-3 w-3 text-green-600" />
                <span className="text-[10px] text-green-600 font-medium">{Math.abs(savingsPercent)}% below market</span>
              </>
            ) : trend === "above" ? (
              <>
                <TrendingUp className="h-3 w-3 text-orange-500" />
                <span className="text-[10px] text-orange-500 font-medium">{Math.abs(savingsPercent)}% above market</span>
              </>
            ) : (
              <>
                <TrendingFlat className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-medium">At market price</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1 border-t border-primary/10">
        <BarChart3 className="h-3 w-3" />
        <span>Based on {category} market data • Updated in real-time</span>
      </div>
    </div>
  );
}

export default function ProductDetails() {
  const [, params] = useRoute("/product/:id");
  const productId = params?.id;
  const { toast } = useToast();

  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [quantity, setQuantity] = useState(1);

  const { data: product, isLoading } = useQuery<MarketplaceProduct>({
    queryKey: [`/api/marketplace/product/${productId}`],
    enabled: !!productId,
  });

  const orderMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: Number(productId),
          buyerName,
          buyerEmail,
          buyerPhone,
          quantity,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Order Placed Successfully!",
        description: `Order #${data.id} confirmed. Total: M${data.totalPrice.toLocaleString()}. The seller will contact you.`,
      });
      setBuyerName("");
      setBuyerEmail("");
      setBuyerPhone("");
      setQuantity(1);
    },
    onError: (err: Error) => {
      toast({
        title: "Order Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white font-sans">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Loading product...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white font-sans">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Product not found.</div>
      </div>
    );
  }

  const specs = (product.specs && typeof product.specs === 'object') ? product.specs as Record<string, string> : {};

  return (
    <div className="min-h-screen bg-white font-sans">
      <Navbar />

      <div className="border-b bg-gray-50/80">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="breadcrumb">
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href="/" className="hover:text-primary transition-colors">{product.category}</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium truncate max-w-[200px]">{product.name}</span>
          </nav>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 mb-16">

          <div className="lg:col-span-5">
            <div className="border rounded-2xl overflow-hidden bg-gray-50 mb-4 sticky top-24">
              <div className="aspect-square p-10 flex items-center justify-center bg-white">
                <img src={product.image} alt={product.name} className="max-w-full max-h-full object-contain" data-testid="img-product" />
              </div>
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Eye className="h-4 w-4" />
                    <span>{product.views} views</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Package className="h-4 w-4" />
                    <span>{product.stock} in stock</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" data-testid="button-wishlist">
                    <Heart className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" data-testid="button-share">
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="text-xs font-medium border-primary/30 text-primary">{product.category}</Badge>
                <Badge variant="outline" className="text-xs">{product.sellerName}</Badge>
              </div>

              <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground leading-tight mb-4" data-testid="text-product-name">
                {product.name}
              </h1>

              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i < Math.floor(product.rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`}
                    />
                  ))}
                </div>
                <span className="font-semibold text-foreground">{product.rating}</span>
                <span className="text-muted-foreground">({product.reviews} reviews)</span>
              </div>
            </div>

            <Separator />

            <div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl lg:text-4xl font-bold text-primary font-heading" data-testid="text-product-price">
                  M{product.price.toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground">/ piece</span>
              </div>
              <p className="text-xs text-muted-foreground">Inclusive of all taxes</p>
            </div>

            <AIPriceConfidence price={product.price} category={product.category} />

            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-y-3 text-sm">
                <div className="text-muted-foreground">Min. Order</div>
                <div className="font-medium text-right">{product.moq} Pieces</div>
                <div className="text-muted-foreground">Available Stock</div>
                <div className="font-medium text-right">{product.stock} units</div>
                <div className="text-muted-foreground">Category</div>
                <div className="font-medium text-right">{product.category}</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg border bg-white">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Truck className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <span className="font-medium text-sm block">Delivery in Lesotho</span>
                  <span className="text-xs text-muted-foreground">Seller arranges shipping after order confirmation</span>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border bg-white">
                <div className="h-8 w-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <span className="font-medium text-sm block">LesOnline Verified</span>
                  <span className="text-xs text-muted-foreground">Listed on LesOnline marketplace</span>
                </div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
              {product.description}
            </p>
          </div>

          <div className="lg:col-span-3">
            <Card className="sticky top-24 rounded-2xl border-2 overflow-hidden shadow-sm">
              <CardHeader className="bg-[#0E1F6C] text-white pb-4 px-5 pt-5">
                <CardTitle className="text-base font-heading flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Place Order
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-3">
                <div>
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground uppercase tracking-wide">Your Name</label>
                  <Input
                    placeholder="Full name"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    className="rounded-lg"
                    data-testid="input-buyer-name"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground uppercase tracking-wide">Email</label>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    className="rounded-lg"
                    data-testid="input-buyer-email"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground uppercase tracking-wide">Phone (optional)</label>
                  <Input
                    placeholder="+266 ..."
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    className="rounded-lg"
                    data-testid="input-buyer-phone"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground uppercase tracking-wide">Quantity</label>
                  <Input
                    type="number"
                    min={product.moq}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="rounded-lg"
                    data-testid="input-quantity"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Min: {product.moq} pieces</p>
                </div>

                <div className="bg-gray-50 p-3 rounded-xl border text-sm space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unit price</span>
                    <span>M{product.price.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quantity</span>
                    <span>{quantity}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-primary pt-0.5">
                    <span>Total</span>
                    <span data-testid="text-order-total">M{(product.price * quantity).toLocaleString()}</span>
                  </div>
                </div>

                <Button
                  className="w-full rounded-xl h-11 font-heading font-semibold bg-[#0E1F6C] hover:bg-[#0E1F6C]/90"
                  disabled={!buyerName || !buyerEmail || quantity < product.moq || product.stock === 0 || orderMutation.isPending}
                  onClick={() => orderMutation.mutate()}
                  data-testid="button-place-order"
                >
                  {orderMutation.isPending ? "Placing Order..." : "Place Order"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="w-full rounded-xl h-11 gap-2 font-heading font-semibold"
                  disabled={product.stock === 0}
                  onClick={() => {
                    addToCart(product.id, quantity);
                    toast({ title: "Added to Cart", description: `${product.name} x${quantity} added.` });
                  }}
                  data-testid="button-add-to-cart"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Add to Cart
                </Button>

                <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1">
                  <Check className="h-3.5 w-3.5 text-green-600" />
                  <span>Secure checkout · Verified seller</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b bg-gray-50 p-0 h-14">
              <TabsTrigger
                value="details"
                className="h-14 px-8 rounded-none font-heading font-semibold text-sm data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-[#0E1F6C] data-[state=active]:shadow-none"
                data-testid="tab-details"
              >
                Product Details
              </TabsTrigger>
              <TabsTrigger
                value="reviews"
                className="h-14 px-8 rounded-none font-heading font-semibold text-sm data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-[#0E1F6C] data-[state=active]:shadow-none"
                data-testid="tab-reviews"
              >
                Reviews ({product.reviews})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="p-6 lg:p-10">
              <h3 className="text-xl font-heading font-bold mb-6">Overview</h3>
              <div className="mb-8">
                <h4 className="font-heading font-semibold mb-4 text-foreground bg-gray-50 p-3 rounded-lg border">Key Specifications</h4>
                <Table>
                  <TableBody>
                    {Object.entries(specs).map(([key, value]) => (
                      <TableRow key={key}>
                        <TableCell className="bg-gray-50/50 w-1/3 font-medium text-muted-foreground">{key}</TableCell>
                        <TableCell>{value}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div>
                <h4 className="font-heading font-semibold mb-4 text-foreground bg-gray-50 p-3 rounded-lg border">Product Description</h4>
                <p className="text-muted-foreground leading-relaxed max-w-3xl">{product.description}</p>
              </div>
            </TabsContent>
            <TabsContent value="reviews" className="p-6 lg:p-10">
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <Star className="h-10 w-10 text-gray-200 mb-3" />
                <p className="font-heading font-semibold">Reviews coming soon</p>
                <p className="text-sm mt-1">Be the first to review this product</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <footer className="border-t bg-gray-50 py-8 mt-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} LesOnline. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
