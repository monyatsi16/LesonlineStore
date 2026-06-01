import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUp, ArrowDown, Minus, RefreshCw, Zap, TrendingUp, DollarSign, Package, BrainCircuit, Plus, ShoppingBag, Eye, Clock3, Route, Search, SlidersHorizontal } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { Product, PriceRecommendation, SalesData, Order } from "@shared/schema";

type TrackingEvent = {
  status: string;
  label: string;
  timestamp: string;
  note?: string;
};

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [checkpointDrafts, setCheckpointDrafts] = useState<Record<number, { status: string; note: string }>>({});

  const adminQueryOptions = {
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always" as const,
    refetchInterval: 30_000,
    enabled: !isAuthLoading && !!user,
  };
  const userScope = user?.id ?? "anonymous";
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products", userScope], ...adminQueryOptions });
  const recommendationsQuery = useQuery<PriceRecommendation[]>({ queryKey: ["/api/recommendations", userScope], ...adminQueryOptions });
  const recommendations = recommendationsQuery.data ?? [];
  const { data: salesData = [] } = useQuery<SalesData[]>({ queryKey: ["/api/sales", userScope], ...adminQueryOptions });
  const { data: sellerOrders = [] } = useQuery<Order[]>({ queryKey: ["/api/orders/seller", userScope], ...adminQueryOptions });

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

  const checkpointMutation = useMutation({
    mutationFn: async ({
      orderId,
      status,
      note,
    }: {
      orderId: number;
      status: string;
      note?: string;
    }) => {
      const labelMap: Record<string, string> = {
        paid: "Order Placed",
        processing: "Seller Processing",
        in_transit: "In Transit",
        at_checkpoint: "At Checkpoint",
        ready: "Ready for Pickup",
        fulfilled: "Delivered / Collected",
        cancelled: "Order Cancelled",
      };

      await apiRequest("POST", `/api/orders/${orderId}/checkpoint`, {
        status,
        label: labelMap[status] || "Checkpoint Update",
        note: note || undefined,
      });
    },
    onSuccess: (_data, variables) => {
      toast({ title: "Checkpoint Updated", description: `Order #${variables.orderId} moved to ${variables.status.replace(/_/g, " ")}.` });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/seller"] });
      setCheckpointDrafts((prev) => ({
        ...prev,
        [variables.orderId]: { ...prev[variables.orderId], note: "", status: variables.status },
      }));
    },
  });

  const getDraft = (order: Order) =>
    checkpointDrafts[order.id] || {
      status: order.status === "paid" ? "processing" : order.status,
      note: "",
    };

  const getTimeline = (order: Order): TrackingEvent[] => {
    if (Array.isArray(order.trackingHistory) && order.trackingHistory.length > 0) {
      return [...order.trackingHistory]
        .filter((event): event is TrackingEvent => Boolean(event?.status && event?.label && event?.timestamp))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }

    return [
      {
        status: order.status,
        label: "Current Status",
        timestamp: order.createdAt ? new Date(order.createdAt).toISOString() : new Date().toISOString(),
      },
    ];
  };

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
  const paidOrders = sellerOrders.filter(o => o.status === "paid").length;
  const processingOrders = sellerOrders.filter(o => o.status === "processing").length;
  const readyOrders = sellerOrders.filter((o) => o.status === "ready").length;

  const paymentMethodLabel = (method?: string) => {
    if (method === "bank_transfer") return "Bank Transfer";
    if (method === "card") return "Card Payment";
    return "Cash on Delivery";
  };

  const filteredSellerOrders = sellerOrders.filter((order) => {
    const matchesStatus = orderStatusFilter === "all" || order.status === orderStatusFilter;
    const haystack = `${order.id} ${order.buyerName} ${order.buyerEmail}`.toLowerCase();
    const matchesSearch = haystack.includes(orderSearch.trim().toLowerCase());
    return matchesStatus && matchesSearch;
  });

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
    <AdminLayout title={user?.businessName || "Dashboard"} subtitle="Manage your products, orders, and pricing on the marketplace">
      <div className="flex gap-2 flex-wrap mb-8">
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
              <p className="text-xs text-muted-foreground">{paidOrders} paid · {processingOrders} processing · {readyOrders} ready</p>
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

        {products.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-6">
                <Package className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-heading font-bold mb-2">Welcome to your Dashboard!</h2>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                You haven't listed any products yet. Add your first product to start selling on the LesOnline marketplace.
              </p>
              <Button className="gap-2" onClick={() => setAddProductOpen(true)} data-testid="button-add-first-product">
                <Plus className="h-4 w-4" />
                Add Your First Product
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {salesData.length > 0 ? (
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
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Sales Analytics (LSL)</CardTitle>
                    <CardDescription>Revenue from marketplace orders.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <TrendingUp className="h-10 w-10 mb-4 opacity-30" />
                      <p className="font-medium">No sales data yet</p>
                      <p className="text-xs mt-1">Sales will appear here once buyers start ordering your products.</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {sellerOrders.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Orders</CardTitle>
                    <CardDescription>Smart order board with checkpoint updates, payment method, and collection readiness</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 grid gap-2 md:grid-cols-[1fr_180px]">
                      <div className="relative">
                        <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input
                          value={orderSearch}
                          onChange={(e) => setOrderSearch(e.target.value)}
                          placeholder="Search by order #, buyer name, or email"
                          className="pl-9 h-9"
                          data-testid="input-order-search"
                        />
                      </div>
                      <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                        <SelectTrigger className="h-9" data-testid="select-order-status-filter">
                          <div className="flex items-center gap-2">
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            <SelectValue placeholder="Filter status" />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="in_transit">In Transit</SelectItem>
                          <SelectItem value="at_checkpoint">At Checkpoint</SelectItem>
                          <SelectItem value="ready">Ready for Pickup</SelectItem>
                          <SelectItem value="fulfilled">Fulfilled</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="mb-4 flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">Total: {sellerOrders.length}</Badge>
                      <Badge variant="outline">Filtered: {filteredSellerOrders.length}</Badge>
                      <Badge variant="outline">Ready: {readyOrders}</Badge>
                    </div>

                    <div className="space-y-3">
                      {filteredSellerOrders.slice(0, 10).map(order => (
                        <div key={order.id} className="flex items-center justify-between border-b pb-3 last:border-0" data-testid={`row-order-${order.id}`}>
                          <div>
                            <p className="font-medium text-sm">Order #{order.id} — {order.buyerName}</p>
                            <p className="text-xs text-muted-foreground">{order.buyerEmail} · Qty: {order.quantity} · {paymentMethodLabel(order.paymentMethod)}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Placed: {order.createdAt ? new Date(order.createdAt).toLocaleString() : "-"}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Select
                                value={getDraft(order).status}
                                onValueChange={(value) =>
                                  setCheckpointDrafts((prev) => ({
                                    ...prev,
                                    [order.id]: { ...getDraft(order), status: value },
                                  }))
                                }
                              >
                                <SelectTrigger className="h-8 w-[160px]" data-testid={`select-checkpoint-status-${order.id}`}>
                                  <SelectValue placeholder="Checkpoint" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="processing">Processing</SelectItem>
                                  <SelectItem value="in_transit">In Transit</SelectItem>
                                  <SelectItem value="at_checkpoint">At Checkpoint</SelectItem>
                                  <SelectItem value="ready">Ready</SelectItem>
                                  <SelectItem value="fulfilled">Fulfilled</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                value={getDraft(order).note}
                                onChange={(e) =>
                                  setCheckpointDrafts((prev) => ({
                                    ...prev,
                                    [order.id]: { ...getDraft(order), note: e.target.value },
                                  }))
                                }
                                className="h-8 w-[220px]"
                                placeholder="Checkpoint note (optional)"
                                data-testid={`input-checkpoint-note-${order.id}`}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="font-bold text-sm">M{order.totalPrice.toLocaleString()}</div>
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                order.status === "paid" ? "bg-blue-100 text-blue-800" :
                                order.status === "processing" ? "bg-yellow-100 text-yellow-800" :
                                order.status === "in_transit" ? "bg-indigo-100 text-indigo-800" :
                                order.status === "at_checkpoint" ? "bg-cyan-100 text-cyan-800" :
                                order.status === "ready" ? "bg-purple-100 text-purple-800" :
                                order.status === "fulfilled" ? "bg-green-100 text-green-800" :
                                "bg-gray-100 text-gray-800"
                              }`}>
                                {order.status}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                checkpointMutation.mutate({
                                  orderId: order.id,
                                  status: getDraft(order).status,
                                  note: getDraft(order).note,
                                })
                              }
                              disabled={checkpointMutation.isPending}
                              data-testid={`button-checkpoint-update-${order.id}`}
                            >
                              Update Checkpoint
                            </Button>
                            {order.status === "paid" && (
                              <Button size="sm" variant="outline" onClick={() => updateOrderMutation.mutate({ orderId: order.id, status: "processing" })} data-testid={`button-process-${order.id}`}>
                                Quick Process
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}

                      {filteredSellerOrders.length === 0 && (
                        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground" data-testid="empty-filtered-orders">
                          No orders match this search/filter yet.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {sellerOrders.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Route className="h-4 w-4 text-primary" />
                      Order Checkpoint Timelines
                    </CardTitle>
                    <CardDescription>Live progression history for your most recent orders</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-5">
                      {sellerOrders.slice(0, 8).map((order) => {
                        const timeline = getTimeline(order);
                        return (
                          <div key={`timeline-${order.id}`} className="rounded-xl border p-4 bg-white" data-testid={`card-order-timeline-${order.id}`}>
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <p className="font-semibold text-sm">Order #{order.id}</p>
                                <p className="text-xs text-muted-foreground">{order.buyerName} · {order.buyerEmail}</p>
                              </div>
                              <Badge variant="outline" className="text-[10px]">{timeline.length} checkpoints</Badge>
                            </div>

                            <div className="space-y-2">
                              {timeline.map((event, idx) => (
                                <div key={`${order.id}-${event.timestamp}-${idx}`} className="flex gap-3">
                                  <div className="pt-0.5">
                                    <Clock3 className="h-3.5 w-3.5 text-primary" />
                                  </div>
                                  <div className="flex-1 rounded-md border p-2.5">
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="text-xs font-medium">{event.label}</p>
                                      <span className="text-[10px] text-muted-foreground">{new Date(event.timestamp).toLocaleString()}</span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">Status: {event.status.replace(/_/g, " ")}</p>
                                    {event.note ? <p className="text-[10px] mt-1">{event.note}</p> : null}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Your Products</CardTitle>
                    <CardDescription>{products.length} listed on marketplace</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => setAddProductOpen(true)} data-testid="button-add-product-inline">
                    <Plus className="h-3 w-3" />
                    Add
                  </Button>
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
                  {recommendationsQuery.isError ? (
                    <div className="p-6 text-center text-destructive" data-testid="recommendations-fetch-error">
                      <p className="font-medium">Could not load recommendations right now.</p>
                      <p className="text-xs mt-2 text-muted-foreground">
                        {recommendationsQuery.error instanceof Error ? recommendationsQuery.error.message : "Request failed"}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => recommendationsQuery.refetch()}
                      >
                        Retry
                      </Button>
                    </div>
                  ) : recommendations.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-4">
                        <CheckIcon className="h-6 w-6" />
                      </div>
                      {products.length > 0 ? (
                        <>
                          <p>All prices are optimized!</p>
                          <p className="text-xs mt-2">Click "Run Gradient Boosting" to check again.</p>
                        </>
                      ) : (
                        <>
                          <p>No products yet</p>
                          <p className="text-xs mt-2">Add products first, then run the model for pricing recommendations.</p>
                        </>
                      )}
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
                          <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-3">
                            <div className="flex-1 bg-slate-100 rounded p-3 flex flex-col items-center text-center">
                              <div className="text-[10px] text-muted-foreground uppercase">Current / Suggested</div>
                              <div className="flex items-center justify-center gap-3 mt-2">
                                <div className="text-sm text-muted-foreground line-through">M{rec.currentPrice.toFixed(2)}</div>
                                <div className="font-mono font-semibold text-primary flex items-center gap-1">
                                  M{rec.recommendedPrice.toFixed(2)}
                                  {rec.trend === 'up' && <ArrowUp className="h-3 w-3" />}
                                  {rec.trend === 'down' && <ArrowDown className="h-3 w-3" />}
                                  {rec.trend === 'stable' && <Minus className="h-3 w-3" />}
                                </div>
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
        )}
    </AdminLayout>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
