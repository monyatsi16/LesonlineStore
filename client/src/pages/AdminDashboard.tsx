import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, Package, ShoppingBag, BarChart3, TrendingUp, Trash2,
  BrainCircuit, RefreshCw, ArrowUp, ArrowDown, Minus, Shield,
  Clock, CalendarClock, Zap, CheckCircle2, AlertCircle, Timer,
  ChevronDown, ChevronUp
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

function parseServerTimestamp(value: string): Date {
  const normalized = value.trim().replace(" ", "T");
  const withoutZone = normalized.replace(/(?:Z|[+-]\d{2}:\d{2})$/i, "");
  const [datePart, timePart = "00:00:00"] = withoutZone.split("T");

  const [year, month, day] = datePart.split("-").map(Number);
  const [hours = 0, minutes = 0, secondsWithMs = "0"] = timePart.split(":");
  const [seconds = "0", ms = "0"] = secondsWithMs.split(".");

  if ([year, month, day].every(Number.isFinite)) {
    return new Date(
      year,
      month - 1,
      day,
      Number(hours),
      Number(minutes),
      Number(seconds),
      Number(ms.padEnd(3, "0").slice(0, 3)),
    );
  }

  return new Date(normalized);
}

function formatLesothoDate(value: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-ZA", options).format(parseServerTimestamp(value));
}

function getRelativeTimeFromNow(value: string): string {
  const diffMs = parseServerTimestamp(value).getTime() - Date.now();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return "Due now";

  const minutes = Math.round(diffMs / (1000 * 60));
  if (minutes < 60) return `${minutes} min from now`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr from now`;

  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} from now`;
}

function getRelativeTimeFromMs(remainingMs: number): string {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return "Due now";

  const minutes = Math.round(remainingMs / (1000 * 60));
  if (minutes < 60) return `${minutes} min from now`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr from now`;

  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} from now`;
}

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

interface PriceUpdateLog {
  id: number;
  runAt: string;
  productsAnalyzed: number;
  productsUpdated: number;
  totalPriceChanges: number;
  status: string;
  details: {
    updates: { productId: number; productName: string; oldPrice: number; newPrice: number; confidence: number; trend: string }[];
    skipped: { productId: number; productName: string; currentPrice: number; recommendedPrice: number; confidence: number; changePct: number; skipReason: string }[];
  };
  nextRunAt: string | null;
}

interface SchedulerStatus {
  isActive: boolean;
  isRunning: boolean;
  nextRunAt: string | null;
  remainingMs: number | null;
  intervalMs: number;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [pricingResults, setPricingResults] = useState<{
    totalAnalyzed: number;
    totalChanged: number;
    changes: { productId: number; productName: string; category: string; previousPrice: number; newPrice: number; confidence: number; trend: string; reason: string }[];
  } | null>(null);

  const adminQueryOptions = { staleTime: 10_000, refetchOnWindowFocus: true, refetchOnMount: "always" as const, refetchInterval: 60_000 };
  const { data: stats } = useQuery<PlatformStats>({ queryKey: ["/api/admin/stats"], ...adminQueryOptions });
  const { data: users = [] } = useQuery<(Omit<User, "password">)[]>({ queryKey: ["/api/admin/users"], ...adminQueryOptions });
  const { data: allProducts = [] } = useQuery<Product[]>({ queryKey: ["/api/admin/products"], ...adminQueryOptions });
  const { data: allOrders = [] } = useQuery<Order[]>({ queryKey: ["/api/admin/orders"], ...adminQueryOptions });
  const { data: analytics } = useQuery<AnalyticsData>({ queryKey: ["/api/admin/analytics"], ...adminQueryOptions });
  const { data: priceUpdateLogs = [] } = useQuery<PriceUpdateLog[]>({ queryKey: ["/api/admin/price-updates"], ...adminQueryOptions });
  const { data: latestPriceUpdate } = useQuery<PriceUpdateLog | null>({ queryKey: ["/api/admin/price-updates/latest"], ...adminQueryOptions });
  const { data: schedulerStatus } = useQuery<SchedulerStatus>({ queryKey: ["/api/admin/price-updates/status"], ...adminQueryOptions });

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

  const deleteLogMutation = useMutation({
    mutationFn: async (logId: number) => {
      await apiRequest("DELETE", `/api/admin/price-updates/${logId}`);
    },
    onSuccess: () => {
      toast({ title: "Run Deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/price-updates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/price-updates/latest"] });
    },
  });

  const clearAllLogsMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/admin/price-updates");
    },
    onSuccess: () => {
      toast({ title: "History Cleared", description: "All price update history has been deleted." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/price-updates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/price-updates/latest"] });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      toast({ title: "User Deleted", description: "User and their products have been removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
    },
    onError: (err: any) => {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    },
  });

  const runAllPricingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/pricing/run-all");
      return res.json();
    },
    onSuccess: (data: any) => {
      setPricingResults(data);
      toast({
        title: "Pricing Model Complete",
        description: `Analyzed ${data.totalAnalyzed} products, updated ${data.totalChanged} prices.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
    },
  });

  const runAutoUpdateNowMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/price-updates/run-now");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Auto Price Update Complete",
        description: `Analyzed ${data.productsAnalyzed} products, updated ${data.productsUpdated} prices.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/price-updates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/price-updates/latest"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
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

  const paidOrders = allOrders.filter(o => o.status === "paid").length;
  const processingOrders = allOrders.filter(o => o.status === "processing").length;
  const readyOrders = allOrders.filter(o => o.status === "ready").length;
  const fulfilledOrders = allOrders.filter(o => o.status === "fulfilled").length;

  const categoryGroups = allProducts.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categoryData = Object.entries(categoryGroups).map(([name, value]) => ({ name, value }));

  return (
    <AdminLayout title="Admin Dashboard" subtitle="Platform-wide management and analytics">
      <div className="flex gap-2 flex-wrap mb-8">
        <Button variant="outline" onClick={refreshData} disabled={isRefreshing} className="gap-2" data-testid="button-admin-refresh">
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        {pricingResults && (
          <Button variant="outline" onClick={() => setPricingResults(null)} className="gap-2" data-testid="button-close-results">
            Close Results
          </Button>
        )}
      </div>

        {pricingResults && (
          <Card className="mb-8 border-primary/30 shadow-lg">
            <CardHeader className="bg-primary/5 border-b border-primary/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BrainCircuit className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Pricing Model Results</CardTitle>
                    <CardDescription>
                      Analyzed {pricingResults.totalAnalyzed} products — {pricingResults.totalChanged} prices updated
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="default" className="text-sm px-3 py-1">
                  {pricingResults.totalChanged} Changes Applied
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {pricingResults.changes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">All prices are already optimal</p>
                  <p className="text-xs mt-1">No changes needed — prices are within 1% of model recommendations.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {pricingResults.changes.map((change) => {
                    const pctChange = ((change.newPrice - change.previousPrice) / change.previousPrice) * 100;
                    return (
                      <div key={change.productId} className="border rounded-lg p-4 hover:bg-slate-50 transition-colors" data-testid={`row-pricing-result-${change.productId}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 mr-4">
                            <h4 className="font-medium text-sm">{change.productName}</h4>
                            <p className="text-xs text-muted-foreground">{change.category}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={change.confidence > 0.8 ? "default" : "secondary"} className="text-[10px]">
                              {(change.confidence * 100).toFixed(0)}% confidence
                            </Badge>
                            <Badge variant={change.trend === "up" ? "default" : change.trend === "down" ? "destructive" : "secondary"} className="text-[10px]">
                              {change.trend === "up" && <ArrowUp className="h-3 w-3 mr-1" />}
                              {change.trend === "down" && <ArrowDown className="h-3 w-3 mr-1" />}
                              {change.trend === "stable" && <Minus className="h-3 w-3 mr-1" />}
                              {pctChange > 0 ? "+" : ""}{pctChange.toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mb-3">
                          <div className="bg-red-50 rounded-lg p-2 text-center border border-red-100">
                            <div className="text-[10px] text-red-600 uppercase font-bold">Previous Price</div>
                            <div className="font-mono font-bold text-red-700 line-through">M{change.previousPrice.toLocaleString()}</div>
                          </div>
                          <div className="flex items-center justify-center">
                            <ArrowDown className="h-5 w-5 text-muted-foreground rotate-[-90deg]" />
                          </div>
                          <div className="bg-green-50 rounded-lg p-2 text-center border border-green-100">
                            <div className="text-[10px] text-green-600 uppercase font-bold">New Price</div>
                            <div className="font-mono font-bold text-green-700">M{change.newPrice.toLocaleString()}</div>
                          </div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                          <div className="text-[10px] text-blue-600 uppercase font-bold mb-1">Reason for Change</div>
                          <p className="text-xs text-blue-900">{change.reason}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
              <p className="text-xs text-muted-foreground">{paidOrders} paid · {processingOrders} processing · {readyOrders} ready · {fulfilledOrders} fulfilled</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue (LSL)</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-admin-total-revenue">M{(stats?.totalRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground">Platform-wide</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="price-updates" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="price-updates" data-testid="tab-price-updates">Price Updates</TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
            <TabsTrigger value="products" data-testid="tab-products">Products</TabsTrigger>
            <TabsTrigger value="orders" data-testid="tab-orders">Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="price-updates" className="space-y-6">
            <Card className="border-primary/20">
              <CardHeader className="bg-primary/5 border-b border-primary/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <CalendarClock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Automatic Price Updates</CardTitle>
                      <CardDescription>Scheduled dynamic pricing with machine learning recommendations</CardDescription>
                    </div>
                  </div>
                  <Button
                    className="gap-2 bg-[#0E1F6C] hover:bg-[#0E1F6C]/90"
                    onClick={() => runAutoUpdateNowMutation.mutate()}
                    disabled={runAutoUpdateNowMutation.isPending}
                    data-testid="button-run-auto-update"
                  >
                    <Zap className="h-4 w-4" />
                    {runAutoUpdateNowMutation.isPending ? "Updating..." : "Run Now"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                 {latestPriceUpdate ? (
                  <div className="grid sm:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-50 rounded-xl p-4 border text-center">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Last Run</div>
                      <div className="font-bold text-sm" data-testid="text-last-run">
                        {formatLesothoDate(latestPriceUpdate.runAt, { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {formatLesothoDate(latestPriceUpdate.runAt, { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 border text-center">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Next Run</div>
                      <div className="font-bold text-sm" data-testid="text-next-run">
                        {schedulerStatus?.nextRunAt
                          ? formatLesothoDate(schedulerStatus.nextRunAt, { day: "numeric", month: "short", year: "numeric" })
                          : latestPriceUpdate.nextRunAt
                          ? formatLesothoDate(latestPriceUpdate.nextRunAt, { day: "numeric", month: "short", year: "numeric" })
                          : "Not scheduled"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {schedulerStatus?.remainingMs !== null && schedulerStatus?.remainingMs !== undefined
                          ? getRelativeTimeFromMs(schedulerStatus.remainingMs)
                          : latestPriceUpdate.nextRunAt
                          ? getRelativeTimeFromNow(latestPriceUpdate.nextRunAt)
                          : "—"}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 border text-center">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Products Analyzed</div>
                      <div className="font-bold text-lg" data-testid="text-products-analyzed">{latestPriceUpdate.productsAnalyzed}</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 border text-center">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Prices Updated</div>
                      <div className="font-bold text-lg" data-testid="text-prices-updated">{latestPriceUpdate.productsUpdated}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground mb-6">
                    <Timer className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p>No automatic updates run yet. Click "Run Now" to start.</p>
                  </div>
                )} 

                <Badge variant={latestPriceUpdate?.status === "completed" ? "default" : latestPriceUpdate?.status === "scheduled" ? "secondary" : "destructive"} className="mb-4">
                  {latestPriceUpdate?.status === "completed" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                  {latestPriceUpdate?.status === "failed" && <AlertCircle className="h-3 w-3 mr-1" />}
                  {latestPriceUpdate?.status === "scheduled" && <Clock className="h-3 w-3 mr-1" />}
                  {latestPriceUpdate?.status || "Not started"}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Update History</CardTitle>
                    <CardDescription>Click any run to see the full list of product price changes</CardDescription>
                  </div>
                  {priceUpdateLogs.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{priceUpdateLogs.length} runs recorded</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                        onClick={() => {
                          if (confirm("Delete all update history? This cannot be undone.")) {
                            clearAllLogsMutation.mutate();
                          }
                        }}
                        disabled={clearAllLogsMutation.isPending}
                        data-testid="button-clear-all-logs"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Clear All
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {priceUpdateLogs.map((log) => {
                    const isExpanded = expandedLogId === log.id;
                    const updates = log.details?.updates ?? [];
                    const skipped = log.details?.skipped ?? [];
                    return (
                      <div key={log.id} className="border rounded-xl overflow-hidden" data-testid={`row-price-update-${log.id}`}>
                        <button
                          className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors text-left"
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          data-testid={`button-expand-log-${log.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${log.status === "completed" ? "bg-green-100 text-green-600" : log.status === "failed" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}>
                              {log.status === "completed" ? <CheckCircle2 className="h-4 w-4" /> : log.status === "failed" ? <AlertCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                            </div>
                            <div>
                              <p className="font-semibold text-sm">
                                {formatLesothoDate(log.runAt, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                                {" — "}
                                {formatLesothoDate(log.runAt, { hour: "2-digit", minute: "2-digit" })}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {log.productsAnalyzed} products analysed · <span className="font-medium text-foreground">{log.productsUpdated} prices changed</span> · M{Number(log.totalPriceChanges).toFixed(0)} total adjustment
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <Badge variant={log.status === "completed" ? "default" : log.status === "scheduled" ? "secondary" : "destructive"} className="text-[10px]">
                              {log.status}
                            </Badge>
                            {(updates.length > 0 || skipped.length > 0) && (
                              isExpanded
                                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                            <button
                              className="p-1 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm("Delete this run from history?")) {
                                  deleteLogMutation.mutate(log.id);
                                }
                              }}
                              data-testid={`button-delete-log-${log.id}`}
                              title="Delete this run"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t bg-slate-50/60 px-4 py-4">
                            <div className="grid sm:grid-cols-2 gap-3 mb-4">
                              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                                <div className="text-[10px] font-bold uppercase text-green-600 mb-1">Price Changed</div>
                                <div className="text-2xl font-bold text-green-700">{updates.length}</div>
                                <div className="text-[10px] text-green-600 mt-0.5">products updated</div>
                              </div>
                              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                                <div className="text-[10px] font-bold uppercase text-amber-600 mb-1">Not Changed</div>
                                <div className="text-2xl font-bold text-amber-700">{skipped.length}</div>
                                <div className="text-[10px] text-amber-600 mt-0.5">products skipped</div>
                              </div>
                            </div>

                            {updates.length > 0 && (
                              <div className="mb-5">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                                  <p className="text-xs font-bold text-green-700 uppercase tracking-wide">Affected — Price Was Changed</p>
                                </div>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                  {updates.map((update, idx) => {
                                    const pct = ((update.newPrice - update.oldPrice) / update.oldPrice) * 100;
                                    return (
                                      <div
                                        key={idx}
                                        className="flex items-center justify-between bg-white rounded-lg border border-green-100 px-4 py-3"
                                        data-testid={`row-price-change-${log.id}-${update.productId}`}
                                      >
                                        <div className="flex-1 min-w-0 mr-4">
                                          <p className="font-medium text-sm truncate">{update.productName}</p>
                                          <p className="text-[11px] text-muted-foreground mt-0.5">
                                            Confidence: <span className="font-semibold text-green-700">{(update.confidence * 100).toFixed(0)}%</span>
                                            {" · "}
                                            {update.trend === "up" ? "Demand or stock scarcity drove price up" : update.trend === "down" ? "Overstock or low demand drove price down" : "Seasonal or cost adjustment applied"}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                          <div className="text-right">
                                            <div className="text-xs text-muted-foreground line-through">M{Number(update.oldPrice).toLocaleString()}</div>
                                            <div className="font-bold text-sm flex items-center gap-1">
                                              M{Number(update.newPrice).toLocaleString()}
                                              {update.trend === "up" && <ArrowUp className="h-3 w-3 text-green-500" />}
                                              {update.trend === "down" && <ArrowDown className="h-3 w-3 text-red-500" />}
                                              {update.trend === "stable" && <Minus className="h-3 w-3 text-gray-400" />}
                                            </div>
                                          </div>
                                          <Badge
                                            variant={update.trend === "up" ? "default" : update.trend === "down" ? "destructive" : "secondary"}
                                            className="text-[10px] w-14 justify-center"
                                          >
                                            {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
                                          </Badge>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {skipped.length > 0 && (
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="h-2 w-2 rounded-full bg-amber-400"></div>
                                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Not Affected — Price Unchanged</p>
                                </div>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                  {skipped.map((item, idx) => (
                                    <div
                                      key={idx}
                                      className="bg-white rounded-lg border border-amber-100 px-4 py-3"
                                      data-testid={`row-price-skipped-${log.id}-${item.productId}`}
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                          <p className="font-medium text-sm truncate">{item.productName}</p>
                                          <p className="text-[11px] text-amber-700 mt-1 leading-relaxed">{item.skipReason}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                          <div className="text-xs text-muted-foreground">Current</div>
                                          <div className="font-bold text-sm">M{Number(item.currentPrice).toLocaleString()}</div>
                                          <div className="text-[10px] text-muted-foreground">Model: M{Number(item.recommendedPrice).toLocaleString()}</div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {updates.length === 0 && skipped.length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-4">No data recorded for this run.</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {priceUpdateLogs.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground">
                      <CalendarClock className="h-10 w-10 mx-auto mb-4 opacity-30" />
                      <p className="font-medium">No update history yet</p>
                      <p className="text-xs mt-1">Click "Run Now" above to start the first pricing run</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
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
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => changeRoleMutation.mutate({ userId: u.id, role: u.role === "admin" ? "retailer" : "admin" })}
                              disabled={changeRoleMutation.isPending}
                              data-testid={`button-toggle-role-${u.id}`}
                            >
                              {u.role === "admin" ? "Make Retailer" : "Make Admin"}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (confirm(`Delete "${u.name}"? This will also remove all their products.`)) {
                                  deleteUserMutation.mutate(u.id);
                                }
                              }}
                              disabled={deleteUserMutation.isPending}
                              data-testid={`button-delete-user-${u.id}`}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
                            </Button>
                          </>
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
                <CardDescription>{allOrders.length} orders placed on the platform</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {allOrders.map((order) => {
                    const product = allProducts.find(p => p.id === order.productId);
                    const statusColors: Record<string, string> = {
                      paid: "bg-blue-100 text-blue-800",
                      processing: "bg-yellow-100 text-yellow-800",
                      ready: "bg-purple-100 text-purple-800",
                      fulfilled: "bg-green-100 text-green-800",
                      cancelled: "bg-red-100 text-red-800",
                    };
                    const nextStatus: Record<string, string> = {
                      paid: "processing",
                      processing: "ready",
                      ready: "fulfilled",
                    };
                    const nextLabel: Record<string, string> = {
                      paid: "Start Processing",
                      processing: "Mark Ready for Pickup",
                      ready: "Mark Fulfilled",
                    };
                    return (
                      <div key={order.id} className="border rounded-xl p-4 space-y-3" data-testid={`row-admin-order-${order.id}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm">{product?.name || `Product #${order.productId}`}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {order.buyerName} · {order.buyerEmail} · Qty: {order.quantity}
                            </p>
                            {order.buyerPhone && (
                              <p className="text-xs text-muted-foreground">Phone: {order.buyerPhone}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-bold text-sm">M{order.totalPrice.toLocaleString()}</div>
                            <span
                              className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColors[order.status] || "bg-gray-100 text-gray-800"}`}
                              data-testid={`badge-order-status-${order.id}`}
                            >
                              {order.status}
                            </span>
                          </div>
                        </div>
                        {order.status !== "fulfilled" && order.status !== "cancelled" && (
                          <div className="flex gap-2">
                            {nextStatus[order.status] && (
                              <Button
                                size="sm"
                                className="flex-1 text-xs h-8 rounded-lg bg-[#0E1F6C] hover:bg-[#0E1F6C]/90"
                                onClick={async () => {
                                  try {
                                    await apiRequest("PATCH", `/api/orders/${order.id}/status`, { status: nextStatus[order.status] });
                                    queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
                                    queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
                                    toast({ title: `Order #${order.id} updated to "${nextStatus[order.status]}"` });
                                  } catch (err: any) {
                                    toast({ title: "Update Failed", description: err.message, variant: "destructive" });
                                  }
                                }}
                                data-testid={`button-order-next-${order.id}`}
                              >
                                {nextLabel[order.status]}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-8 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                              onClick={async () => {
                                try {
                                  await apiRequest("PATCH", `/api/orders/${order.id}/status`, { status: "cancelled" });
                                  queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
                                  queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
                                  toast({ title: `Order #${order.id} cancelled` });
                                } catch (err: any) {
                                  toast({ title: "Update Failed", description: err.message, variant: "destructive" });
                                }
                              }}
                              data-testid={`button-order-cancel-${order.id}`}
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {allOrders.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <ShoppingBag className="h-10 w-10 mb-4 opacity-30" />
                      <p>No orders yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
    </AdminLayout>
  );
}
