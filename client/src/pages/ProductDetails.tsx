import { Navbar } from "@/components/Navbar";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, Truck, ShieldCheck, Eye, Package, ArrowRight } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@shared/schema";

interface MarketplaceProduct extends Product {
  sellerName: string;
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
      <div className="min-h-screen bg-background font-sans">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Loading product...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background font-sans">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Product not found.</div>
      </div>
    );
  }

  const specs = (product.specs && typeof product.specs === 'object') ? product.specs as Record<string, string> : {};

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />

      <div className="bg-slate-50 border-b">
        <div className="container mx-auto px-4 py-3 text-sm text-muted-foreground">
          <Link href="/">Home</Link> / {product.category} / <span className="text-foreground font-medium">{product.name}</span>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-12">

          <div className="md:col-span-5 lg:col-span-4">
            <div className="border rounded-lg overflow-hidden bg-white mb-4">
              <div className="aspect-square p-8 flex items-center justify-center">
                <img src={product.image} alt={product.name} className="max-w-full max-h-full object-contain" data-testid="img-product" />
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                {product.views} views
              </div>
              <div className="flex items-center gap-1">
                <Package className="h-4 w-4" />
                {product.stock} in stock
              </div>
            </div>
          </div>

          <div className="md:col-span-7 lg:col-span-5">
            <h1 className="text-2xl font-heading font-semibold text-foreground mb-4 leading-snug" data-testid="text-product-name">
              {product.name}
            </h1>

            <div className="flex items-center gap-4 text-sm mb-4">
              <div className="flex items-center gap-1 text-orange-500 font-bold">
                <Star className="h-4 w-4 fill-current" />
                {product.rating}
              </div>
              <div className="text-muted-foreground border-l pl-4">
                <span className="text-foreground font-medium">{product.reviews}</span> Reviews
              </div>
            </div>

            <div className="mb-4">
              <Badge variant="outline" className="text-sm">{product.sellerName}</Badge>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border mb-6">
              <div className="mb-4">
                <div className="text-sm text-muted-foreground mb-1">Price</div>
                <div className="text-3xl font-bold text-primary" data-testid="text-product-price">
                  M{product.price.toLocaleString()} <span className="text-sm font-normal text-slate-500">/ piece</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div className="text-muted-foreground">Min. Order:</div>
                <div className="font-medium">{product.moq} Pieces</div>
                <div className="text-muted-foreground">Stock:</div>
                <div className="font-medium">{product.stock} units</div>
                <div className="text-muted-foreground">Category:</div>
                <div className="font-medium">{product.category}</div>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex items-start gap-3 text-sm">
                <Truck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium block">Delivery in Lesotho</span>
                  <span className="text-muted-foreground">Seller arranges shipping after order confirmation</span>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium block">SmartPrice Verified</span>
                  <span className="text-muted-foreground">Listed on SmartPrice marketplace</span>
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-12 lg:col-span-3">
            <Card className="sticky top-24">
              <CardHeader className="bg-primary/5 border-b pb-4">
                <CardTitle className="text-lg">Place Order</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Your Name</label>
                  <Input
                    placeholder="Full name"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    data-testid="input-buyer-name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Email</label>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    data-testid="input-buyer-email"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Phone (optional)</label>
                  <Input
                    placeholder="+266 ..."
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    data-testid="input-buyer-phone"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Quantity</label>
                  <Input
                    type="number"
                    min={product.moq}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    data-testid="input-quantity"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Min: {product.moq} pieces</p>
                </div>

                <div className="bg-slate-50 p-3 rounded border text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-muted-foreground">Unit price</span>
                    <span>M{product.price.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-muted-foreground">Quantity</span>
                    <span>{quantity}</span>
                  </div>
                  <div className="flex justify-between font-bold text-primary border-t pt-1 mt-1">
                    <span>Total</span>
                    <span data-testid="text-order-total">M{(product.price * quantity).toLocaleString()}</span>
                  </div>
                </div>

                <Button
                  className="w-full"
                  disabled={!buyerName || !buyerEmail || quantity < product.moq || product.stock === 0 || orderMutation.isPending}
                  onClick={() => orderMutation.mutate()}
                  data-testid="button-place-order"
                >
                  {orderMutation.isPending ? "Placing Order..." : "Place Order"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="bg-white border rounded-lg overflow-hidden">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b bg-slate-50 p-0 h-12">
              <TabsTrigger value="details" className="h-12 px-6 rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Product Details</TabsTrigger>
              <TabsTrigger value="reviews" className="h-12 px-6 rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Reviews ({product.reviews})</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="p-8">
              <h3 className="text-lg font-bold mb-6">Overview</h3>
              <div className="mb-8">
                <h4 className="font-medium mb-4 text-slate-900 bg-slate-100 p-2">Key Specifications</h4>
                <Table>
                  <TableBody>
                    {Object.entries(specs).map(([key, value]) => (
                      <TableRow key={key}>
                        <TableCell className="bg-slate-50 w-1/3 font-medium text-muted-foreground">{key}</TableCell>
                        <TableCell>{value}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div>
                <h4 className="font-medium mb-4 text-slate-900 bg-slate-100 p-2">Product Description</h4>
                <p className="text-muted-foreground leading-relaxed max-w-3xl">{product.description}</p>
              </div>
            </TabsContent>
            <TabsContent value="reviews" className="p-8">
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <p>Reviews coming soon</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
