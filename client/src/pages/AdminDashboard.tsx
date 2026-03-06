import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, Package, ShoppingBag, DollarSign, TrendingUp, Trash2,
  BrainCircuit, RefreshCw, ArrowUp, ArrowDown, Minus, Shield
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { Product, Order, User } from "@shared/schema";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

interface PlatformStats {
  totalUsers: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
}

interface AnalyticsData {
  revenueByMonth: { month: string; revenue: number; orders: number }[];
  ordersByCategory: { category: string; count: number; revenue: number }[];
  topSellers: { id: number; name: string; businessName: string; products: number; revenue: number }[];
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: stats } = useQuery<PlatformStats>({ queryKey: ["/api/admin/stats"] });
  const { data: users = [] } = useQuery<(Omit<User, "password">)[]>({ queryKey: ["/api/admin/users"] });
  const { data: allProducts = [] } = useQuery<Product[]>({ queryKey: ["/api/admin/products"] });
  const { data: allOrders = [] } = useQuery<Order[]>({ queryKey: ["/api/admin/orders"] });
  const { data: analytics } = useQuery<AnalyticsData>({ queryKey: ["/api/admin/analytics"] });

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: number) => {
      await apiRequest("DELETE", `/api/admin/products/${productId}`);
    },
    onSuccess: () => {
      toast({ title: "Product Removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      await apiRequest("PATCH", `/api/admin/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      toast({ title: "Role Updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
  });

  const runAllPricingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/pricing/run-all");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Pricing Model Complete",
        description: `Generated ${data.generated} recommendations across all products.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
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

  const pendingOrders = allOrders.filter(o => o.status === "pending").length;
  const confirmedOrders = allOrders.filter(o => o.status === "confirmed").length;

  const categoryGroups = allProducts.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categoryData = Object.entries(categoryGroups).map(([name, value]) => ({ name, value }));

  return (
    <div className="min-h-screen bg-slate-50/50 font-sans">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-heading font-bold text-foreground" data-testid="text-admin-title">
                Admin Dashboard
              </h1>
            </div>
            <p className="text-muted-foreground">Platform-wide management and analytics.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={refreshData} disabled={isRefreshing} className="gap-2" data-testid="button-admin-refresh">
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              className="gap-2 bg-primary hover:bg-primary/90"
              onClick={() => runAllPricingMutation.mutate()}
              disabled={runAllPricingMutation.isPending}
              data-testid="button-run-all-pricing"
            >
              <BrainCircuit className="h-4 w-4" />
              {runAllPricingMutation.isPending ? "Running..." : "Run Pricing (All Products)"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-admin-total-users">{stats?.totalUsers ?? 0}</div>
              <p className="text-xs text-muted-foreground">Registered sellers</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-admin-total-products">{stats?.totalProducts ?? 0}</div>
              <p className="text-xs text-muted-foreground">Listed on marketplace</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-admin-total-orders">{stats?.totalOrders ?? 0}</div>
              <p className="text-xs text-muted-foreground">{pendingOrders} pending · {confirmedOrders} confirmed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue (LSL)</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-admin-total-revenue">M{(stats?.totalRevenue ?? 0).toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Platform-wide</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
            <TabsTrigger value="products" data-testid="tab-products">Products</TabsTrigger>
            <TabsTrigger value="orders" data-testid="tab-orders">Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Over Time</CardTitle>
                  <CardDescription>Monthly revenue from all marketplace orders</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  {analytics?.revenueByMonth && analytics.revenueByMonth.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.revenueByMonth} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorAdminRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `M${v}`} />
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderRadius: "8px", border: "1px solid hsl(var(--border))" }} />
                        <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorAdminRevenue)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <TrendingUp className="h-10 w-10 mb-4 opacity-30" />
                      <p>No revenue data yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Orders by Category</CardTitle>
                  <CardDescription>Product distribution across categories</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  {categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                          {categoryData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <Package className="h-10 w-10 mb-4 opacity-30" />
                      <p>No product data yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {analytics?.topSellers && analytics.topSellers.length > 0 && (
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Top Sellers</CardTitle>
                    <CardDescription>Sellers ranked by revenue</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.topSellers} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="businessName" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `M${v}`} />
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderRadius: "8px", border: "1px solid hsl(var(--border))" }} />
                        <Legend />
                        <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Revenue (LSL)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="products" fill="#10b981" name="Products" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>All Users</CardTitle>
                <CardDescription>{users.length} registered users on the platform</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {users.map((u) => (
                    <div key={u.id} className="flex items-center justify-between border-b pb-3 last:border-0" data-testid={`row-user-${u.id}`}>
                      <div>
                        <p className="font-medium text-sm">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email} · {u.businessName}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={u.role === "admin" ? "default" : "secondary"} data-testid={`badge-role-${u.id}`}>
                          {u.role}
                        </Badge>
                        {u.id !== user?.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => changeRoleMutation.mutate({ userId: u.id, role: u.role === "admin" ? "retailer" : "admin" })}
                            disabled={changeRoleMutation.isPending}
                            data-testid={`button-toggle-role-${u.id}`}
                          >
                            {u.role === "admin" ? "Make Retailer" : "Make Admin"}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {users.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-10 w-10 mx-auto mb-4 opacity-30" />
                      <p>No users found</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>All Products</CardTitle>
                <CardDescription>{allProducts.length} products listed across all sellers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {allProducts.map((product) => {
                    const seller = users.find(u => u.id === product.userId);
                    return (
                      <div key={product.id} className="flex items-center justify-between border-b pb-3 last:border-0" data-testid={`row-admin-product-${product.id}`}>
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded bg-slate-100 p-1 border">
                            <img src={product.image} alt="" className="h-full w-full object-contain" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{product.name}</p>
                            <p className="text-xs text-muted-foreground">
                              M{product.price.toLocaleString()} · {product.stock} in stock · {seller?.businessName || "Unknown"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{product.category}</Badge>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteProductMutation.mutate(product.id)}
                            disabled={deleteProductMutation.isPending}
                            data-testid={`button-delete-product-${product.id}`}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {allProducts.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-10 w-10 mx-auto mb-4 opacity-30" />
                      <p>No products listed yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>All Orders</CardTitle>
                <CardDescription>{allOrders.length} orders across the platform</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {allOrders.map((order) => {
                    const product = allProducts.find(p => p.id === order.productId);
                    return (
                      <div key={order.id} className="flex items-center justify-between border-b pb-3 last:border-0" data-testid={`row-admin-order-${order.id}`}>
                        <div>
                          <p className="font-medium text-sm">Order #{order.id} — {order.buyerName}</p>
                          <p className="text-xs text-muted-foreground">
                            {product?.name || `Product #${order.productId}`} · Qty: {order.quantity} · {order.buyerEmail}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-bold text-sm">M{order.totalPrice.toLocaleString()}</div>
                            <Badge
                              variant={
                                order.status === "pending" ? "secondary" :
                                order.status === "confirmed" ? "default" :
                                order.status === "delivered" ? "default" : "outline"
                              }
                              className="text-[10px]"
                              data-testid={`badge-order-status-${order.id}`}
                            >
                              {order.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {allOrders.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <ShoppingBag className="h-10 w-10 mx-auto mb-4 opacity-30" />
                      <p>No orders yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
