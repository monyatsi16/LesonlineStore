import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUp, ArrowDown, Minus, RefreshCw, Zap, TrendingUp, DollarSign, Package, BrainCircuit, Plus, ShoppingBag, Eye } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { Product, PriceRecommendation, SalesData, Order } from "@shared/schema";

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);

  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: recommendations = [] } = useQuery<PriceRecommendation[]>({ queryKey: ["/api/recommendations"] });
  const { data: salesData = [] } = useQuery<SalesData[]>({ queryKey: ["/api/sales"] });
  const { data: sellerOrders = [] } = useQuery<Order[]>({ queryKey: ["/api/orders/seller"] });

  const runModelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pricing/run-model");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Gradient Boosting Model Complete",
        description: `Generated ${data.generated} new price recommendations using real order data.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
    },
  });

  const applyPriceMutation = useMutation({
    mutationFn: async ({ recId, productId, price }: { recId: number; productId: number; price: number }) => {
      await apiRequest("POST", `/api/recommendations/${recId}/apply`, { productId, price });
    },
    onSuccess: (_data, variables) => {
      toast({ title: "Price Updated", description: `Price updated to M${variables.price.toFixed(2)}.` });
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
  });

  const addProductMutation = useMutation({
    mutationFn: async (product: any) => {
      const res = await apiRequest("POST", "/api/products", product);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Product Listed!", description: "Your product is now live on the marketplace." });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setAddProductOpen(false);
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number; status: string }) => {
      await apiRequest("PATCH", `/api/orders/${orderId}/status`, { status });
    },
    onSuccess: () => {
      toast({ title: "Order Updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/seller"] });
    },
  });

  const refreshData = () => {
    setIsRefreshing(true);
    queryClient.invalidateQueries();
    setTimeout(() => {
      setIsRefreshing(false);
      toast({ title: "Data Refreshed" });
    }, 1500);
  };

  const totalRevenue = salesData.reduce((sum, s) => sum + s.revenue, 0);
  const totalOrders = sellerOrders.length;
  const totalViews = products.reduce((sum, p) => sum + (p.views || 0), 0);
  const pendingOrders = sellerOrders.filter(o => o.status === "pending").length;

  const handleAddProduct = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    addProductMutation.mutate({
      name: formData.get("name"),
      price: Number(formData.get("price")),
      moq: Number(formData.get("moq")) || 1,
      supplier: user?.businessName || "",
      image: formData.get("image") || "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop",
      category: formData.get("category"),
      description: formData.get("description"),
      stock: Number(formData.get("stock")) || 0,
      specs: {},
    });
  };

  return (
    <div className="min-h-screen bg-slate-50/50 font-sans">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground" data-testid="text-dashboard-title">
              {user?.businessName || "Dashboard"}
            </h1>
            <p className="text-muted-foreground">Manage your products, orders, and pricing on the marketplace.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={refreshData} disabled={isRefreshing} className="gap-2" data-testid="button-refresh">
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2" data-testid="button-add-product">
                  <Plus className="h-4 w-4" />
                  Add Product
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>List a New Product</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddProduct} className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Product Name</label>
                    <Input name="name" required placeholder="e.g. 60cm Ceramic Hob" data-testid="input-product-name" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium">Price (LSL)</label>
                      <Input name="price" type="number" step="0.01" required placeholder="4500" data-testid="input-product-price" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Stock</label>
                      <Input name="stock" type="number" required placeholder="20" data-testid="input-product-stock" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium">Category</label>
                      <Input name="category" required placeholder="Built-in Hobs" data-testid="input-product-category" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Min. Order Qty</label>
                      <Input name="moq" type="number" defaultValue="1" data-testid="input-product-moq" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Image URL</label>
                    <Input name="image" placeholder="https://..." data-testid="input-product-image" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <Textarea name="description" required placeholder="Describe your product..." data-testid="input-product-description" />
                  </div>
                  <Button type="submit" className="w-full" disabled={addProductMutation.isPending} data-testid="button-submit-product">
                    {addProductMutation.isPending ? "Listing..." : "List on Marketplace"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            <Button className="gap-2 bg-primary hover:bg-primary/90" onClick={() => runModelMutation.mutate()} disabled={runModelMutation.isPending} data-testid="button-run-model">
              <BrainCircuit className="h-4 w-4" />
              {runModelMutation.isPending ? 'Running...' : 'Run Gradient Boosting'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenue (LSL)</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-revenue">M{totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">From marketplace orders</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Orders</CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-orders">{totalOrders}</div>
              <p className="text-xs text-muted-foreground">{pendingOrders} pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-product-count">{products.length}</div>
              <p className="text-xs text-muted-foreground">Listed on marketplace</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Product Views</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-views">{totalViews}</div>
              <p className="text-xs text-muted-foreground">Buyer interest</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Price Alerts</CardTitle>
              <Zap className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-alert-count">{recommendations.length}</div>
              <p className="text-xs text-muted-foreground">Recommendations</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Sales Analytics (LSL)</CardTitle>
                <CardDescription>Revenue from marketplace orders.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `M${value}`} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {sellerOrders.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Orders</CardTitle>
                  <CardDescription>Orders from buyers on the marketplace</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {sellerOrders.slice(0, 10).map(order => (
                      <div key={order.id} className="flex items-center justify-between border-b pb-3 last:border-0" data-testid={`row-order-${order.id}`}>
                        <div>
                          <p className="font-medium text-sm">Order #{order.id} — {order.buyerName}</p>
                          <p className="text-xs text-muted-foreground">{order.buyerEmail} · Qty: {order.quantity}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-bold text-sm">M{order.totalPrice.toLocaleString()}</div>
                            <Badge variant={order.status === "pending" ? "secondary" : order.status === "confirmed" ? "default" : "outline"} className="text-[10px]">
                              {order.status}
                            </Badge>
                          </div>
                          {order.status === "pending" && (
                            <Button size="sm" variant="outline" onClick={() => updateOrderMutation.mutate({ orderId: order.id, status: "confirmed" })} data-testid={`button-confirm-${order.id}`}>
                              Confirm
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Your Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {products.map(product => (
                    <div key={product.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0" data-testid={`row-inventory-${product.id}`}>
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded bg-slate-100 p-1 border">
                          <img src={product.image} alt="" className="h-full w-full object-contain" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{product.name}</p>
                          <p className="text-xs text-muted-foreground">M{product.price.toLocaleString()} · {product.views} views</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{product.stock} units</div>
                        <div className={`text-xs ${product.stock < 10 ? 'text-red-500' : 'text-green-500'}`}>
                          {product.stock === 0 ? 'Out of Stock' : product.stock < 10 ? 'Low Stock' : 'In Stock'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="h-fit border-primary/20 shadow-lg shadow-primary/5">
              <CardHeader className="bg-primary/5 border-b border-primary/10">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="h-5 w-5 text-primary" />
                  <CardTitle>Gradient Boosting Model</CardTitle>
                </div>
                <CardDescription>
                  Uses real order data, views, and stock levels
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {recommendations.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-4">
                      <CheckIcon className="h-6 w-6" />
                    </div>
                    <p>All prices are optimized!</p>
                    <p className="text-xs mt-2">Click "Run Gradient Boosting" to check again.</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {recommendations.map((rec) => (
                      <div key={rec.id} className="p-4 hover:bg-slate-50 transition-colors" data-testid={`card-recommendation-${rec.id}`}>
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-sm line-clamp-1 flex-1 mr-2">{rec.productName}</h4>
                          <Badge variant={rec.confidence > 0.8 ? "default" : "secondary"} className="text-[10px] h-5" data-testid={`text-confidence-${rec.id}`}>
                            {(rec.confidence * 100).toFixed(0)}%
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div className="bg-slate-100 rounded p-2 text-center">
                            <div className="text-[10px] text-muted-foreground uppercase">Current</div>
                            <div className="font-mono font-medium">M{rec.currentPrice.toFixed(2)}</div>
                          </div>
                          <div className="bg-primary/10 rounded p-2 text-center border border-primary/20">
                            <div className="text-[10px] text-primary uppercase font-bold">Suggested</div>
                            <div className="font-mono font-bold text-primary flex items-center justify-center gap-1">
                              M{rec.recommendedPrice.toFixed(2)}
                              {rec.trend === 'up' && <ArrowUp className="h-3 w-3" />}
                              {rec.trend === 'down' && <ArrowDown className="h-3 w-3" />}
                              {rec.trend === 'stable' && <Minus className="h-3 w-3" />}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mb-3">{rec.reason}</div>
                        <Button
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => applyPriceMutation.mutate({ recId: rec.id, productId: rec.productId, price: rec.recommendedPrice })}
                          disabled={applyPriceMutation.isPending}
                          data-testid={`button-apply-${rec.id}`}
                        >
                          Apply Price Change
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
