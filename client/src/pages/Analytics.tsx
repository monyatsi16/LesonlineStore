import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { AdminLayout } from "@/components/AdminLayout";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, ComposedChart, LabelList,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, BarChart2, BarChart3, PieChart as PieChartIcon, Activity } from "lucide-react";

const COLORS = ["#2563eb", "#16a34a", "#ea580c", "#9333ea", "#e11d48", "#0891b2", "#ca8a04", "#6366f1"];

interface CategoryStats {
  mean: number;
  std: number;
  min: number;
  max: number;
  median: number;
  count: number;
  q25: number;
  q75: number;
}

interface Recommendation {
  id: number;
  productId: number;
  productName: string;
  currentPrice: number;
  recommendedPrice: number;
  confidence: number;
  reason: string;
  trend: string;
  createdAt: string;
}

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  stock: number;
  views: number;
  moq: number;
}

interface AnalyticsOverview {
  categoryStats: Record<string, CategoryStats>;
  products: Product[];
  recommendations: Recommendation[];
  ordersByCategory: Record<string, number>;
  revenueByCategory: Record<string, number>;
}

export default function Analytics() {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery<AnalyticsOverview>({
    queryKey: ["/api/analytics/overview"],
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });

  const { data: fallbackRecommendations } = useQuery<Recommendation[]>({
    queryKey: ["/api/recommendations"],
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });

  if (isLoading) {
    return (
      <AdminLayout title="Pricing Analytics" subtitle="Market insights and dynamic pricing intelligence">
        <div className="flex items-center justify-center py-20" data-testid="analytics-loading">
          <div className="text-gray-500 text-lg">Loading analytics...</div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !data) {
    return (
      <AdminLayout title="Pricing Analytics" subtitle="Market insights and dynamic pricing intelligence">
        <div className="flex items-center justify-center py-20" data-testid="analytics-error">
          <div className="text-red-600">Failed to load analytics data. Please try refreshing the page.</div>
        </div>
      </AdminLayout>
    );
  }

  const { categoryStats, products, recommendations, ordersByCategory, revenueByCategory } = data;

  const visibleRecommendations = recommendations.length > 0 ? recommendations : fallbackRecommendations ?? [];

  const priceDistributionData = Object.entries(categoryStats).map(([category, stats]) => ({
    category,
    min: Number(stats.min.toFixed(2)),
    q25: Number(stats.q25.toFixed(2)),
    median: Number(stats.median.toFixed(2)),
    mean: Number(stats.mean.toFixed(2)),
    q75: Number(stats.q75.toFixed(2)),
    max: Number(stats.max.toFixed(2)),
    count: stats.count,
  }));

  const marketInsightsData = Object.entries(categoryStats).map(([category, stats]) => ({
    category,
    avgPrice: Number(stats.mean.toFixed(2)),
    priceRange: Number((stats.max - stats.min).toFixed(2)),
    products: stats.count,
    volatility: Number(((stats.std / stats.mean) * 100).toFixed(1)),
  }));


  const categoryPerformance = Object.entries(categoryStats).map(([category, stats]) => ({
    category,
    avgPrice: Number(stats.mean.toFixed(0)),
    products: stats.count,
    orders: ordersByCategory[category] || 0,
    revenue: Number((revenueByCategory[category] || 0).toFixed(0)),
  }));

  const radarData = Object.entries(categoryStats).map(([category, stats]) => ({
    category,
    avgPrice: Math.min(stats.mean / 100, 100),
    volume: Math.min(stats.count * 5, 100),
    range: Math.min(((stats.max - stats.min) / stats.mean) * 50, 100),
    orders: Math.min((ordersByCategory[category] || 0) * 10, 100),
    revenue: Math.min((revenueByCategory[category] || 0) / 50, 100),
  }));

  const pieData = Object.entries(categoryStats).map(([category, stats]) => ({
    name: category,
    value: stats.count,
  }));

  const totalProducts = products.length;
  const avgPrice = products.length > 0 ? products.reduce((s, p) => s + p.price, 0) / products.length : 0;
  const totalCategories = Object.keys(categoryStats).length;
  const pendingRecs = visibleRecommendations.length;

  return (
    <AdminLayout title="Pricing Analytics" subtitle="Market insights and dynamic pricing intelligence">
      <div className="space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="stat-total-products">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Products Tracked</p>
                    <p className="text-2xl font-bold">{totalProducts}</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-primary opacity-70" />
                </div>
              </CardContent>
            </Card>
            <Card data-testid="stat-avg-price">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Average Price</p>
                    <p className="text-2xl font-bold">M{avgPrice.toFixed(0)}</p>
                  </div>
                  <BarChart2 className="h-8 w-8 text-green-600 opacity-70" />
                </div>
              </CardContent>
            </Card>
            <Card data-testid="stat-categories">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Categories</p>
                    <p className="text-2xl font-bold">{totalCategories}</p>
                  </div>
                  <PieChartIcon className="h-8 w-8 text-purple-600 opacity-70" />
                </div>
              </CardContent>
            </Card>
            <Card data-testid="stat-recommendations">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Price Recommendations</p>
                    <p className="text-2xl font-bold">{pendingRecs}</p>
                  </div>
                  <Activity className="h-8 w-8 text-orange-600 opacity-70" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="distribution" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5" data-testid="analytics-tabs">
              <TabsTrigger value="distribution" data-testid="tab-distribution">Price Distribution</TabsTrigger>
              <TabsTrigger value="insights" data-testid="tab-insights">Market Insights</TabsTrigger>
              <TabsTrigger value="recommendations" data-testid="tab-recommendations">Recommendations</TabsTrigger>
              <TabsTrigger value="demand" data-testid="tab-demand">Demand Analysis</TabsTrigger>
              <TabsTrigger value="comparison" data-testid="tab-comparison">Category Comparison</TabsTrigger>
            </TabsList>

            <TabsContent value="distribution" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card data-testid="chart-price-ranges">
                  <CardHeader>
                    <CardTitle>Price Ranges by Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={priceDistributionData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={(v) => `M${v}`} />
                        <YAxis type="category" dataKey="category" width={120} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value: number) => `M${value.toFixed(2)}`} />
                        <Legend />
                        <Bar dataKey="min" fill="#94a3b8" name="Min" stackId="range" />
                        <Bar dataKey="median" fill="#2563eb" name="Median" stackId="range2" />
                        <Bar dataKey="max" fill="#e11d48" name="Max" stackId="range3" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card data-testid="chart-product-distribution">
                  <CardHeader>
                    <CardTitle>Products per Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          labelLine
                          label={({ name, value }) => `${name} (${value})`}
                          outerRadius={140}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {pieData.map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="insights" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card data-testid="chart-avg-prices">
                  <CardHeader>
                    <CardTitle>Average Selling Price by Category</CardTitle>
                    <CardDescription>What products in each category sell for on average</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={marketInsightsData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => `M${v}`} />
                        <Tooltip formatter={(value: number) => [`M${value.toLocaleString()}`, "Avg Price"]} />
                        <Bar dataKey="avgPrice" fill="#2563eb" name="Avg Price" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card data-testid="chart-products-per-category">
                  <CardHeader>
                    <CardTitle>Number of Products per Category</CardTitle>
                    <CardDescription>How many products are listed in each category</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={marketInsightsData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip formatter={(value: number) => [value, "Products"]} />
                        <Bar dataKey="products" fill="#10b981" name="Products" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card data-testid="table-market-insights">
                <CardHeader>
                  <CardTitle>Market Insights Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 font-medium">Category</th>
                          <th className="text-right py-3 px-2 font-medium">Products</th>
                          <th className="text-right py-3 px-2 font-medium">Min Price</th>
                          <th className="text-right py-3 px-2 font-medium">Avg Price</th>
                          <th className="text-right py-3 px-2 font-medium">Max Price</th>
                          <th className="text-right py-3 px-2 font-medium">Std Dev</th>
                          <th className="text-right py-3 px-2 font-medium">Volatility</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(categoryStats).map(([category, stats]) => (
                          <tr key={category} className="border-b hover:bg-muted/50" data-testid={`row-insight-${category}`}>
                            <td className="py-3 px-2 font-medium">{category}</td>
                            <td className="text-right py-3 px-2">{stats.count}</td>
                            <td className="text-right py-3 px-2">M{stats.min.toFixed(2)}</td>
                            <td className="text-right py-3 px-2">M{stats.mean.toFixed(2)}</td>
                            <td className="text-right py-3 px-2">M{stats.max.toFixed(2)}</td>
                            <td className="text-right py-3 px-2">M{stats.std.toFixed(2)}</td>
                            <td className="text-right py-3 px-2">
                              <Badge variant={((stats.std / stats.mean) * 100) > 50 ? "destructive" : "secondary"}>
                                {((stats.std / stats.mean) * 100).toFixed(1)}%
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="recommendations" className="space-y-6">
              {visibleRecommendations.length === 0 ? (
                <Card data-testid="no-recommendations">
                  <CardContent className="py-12 text-center">
                    <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Pricing Recommendations</h3>
                    <p className="text-muted-foreground">
                      Run the pricing model from your dashboard to generate price recommendations.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card data-testid="chart-recommendations">
                      <CardHeader>
                        <CardTitle>Current vs Recommended Prices</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={400}>
                          <ComposedChart data={visibleRecommendations.slice(0, 10).map(r => ({
                            name: r.productName.length > 15 ? r.productName.slice(0, 15) + "..." : r.productName,
                            current: r.currentPrice,
                            recommended: r.recommendedPrice,
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                            <YAxis tickFormatter={(v) => `M${v}`} />
                            <Tooltip formatter={(value: number) => `M${value.toFixed(2)}`} />
                            <Legend />
                            <Bar dataKey="recommended" fill="#16a34a" name="Recommended Price">
                              <LabelList dataKey="recommended" position="right" formatter={(value: number) => `M${value.toFixed(0)}`} />
                            </Bar>
                            <Line type="monotone" dataKey="current" stroke="#64748b" strokeWidth={3} dot={false} name="Original Price" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card data-testid="chart-confidence">
                      <CardHeader>
                        <CardTitle>Recommendation Confidence Levels</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart data={visibleRecommendations.slice(0, 10).map(r => ({
                            name: r.productName.length > 15 ? r.productName.slice(0, 15) + "..." : r.productName,
                            confidence: Number((r.confidence * 100).toFixed(1)),
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                            <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                            <Tooltip formatter={(value: number) => `${value}%`} />
                            <Bar dataKey="confidence" fill="#2563eb" name="Confidence" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                  <Card data-testid="table-recommendations">
                    <CardHeader>
                      <CardTitle>Pricing Recommendations History</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-3 px-2 font-medium">Product</th>
                              <th className="text-right py-3 px-2 font-medium">Current</th>
                              <th className="text-right py-3 px-2 font-medium">Recommended</th>
                              <th className="text-right py-3 px-2 font-medium">Change</th>
                              <th className="text-center py-3 px-2 font-medium">Trend</th>
                              <th className="text-right py-3 px-2 font-medium">Confidence</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleRecommendations.map((rec) => {
                              const change = ((rec.recommendedPrice - rec.currentPrice) / rec.currentPrice) * 100;
                              return (
                                <React.Fragment key={rec.id}>
                                  <tr className="border-b hover:bg-muted/50" data-testid={`row-rec-${rec.id}`}>
                                    <td className="py-3 px-2 font-medium">{rec.productName}</td>
                                    <td className="text-right py-3 px-2">M{rec.currentPrice.toFixed(2)}</td>
                                    <td className="text-right py-3 px-2 font-semibold">M{rec.recommendedPrice.toFixed(2)}</td>
                                    <td className="text-right py-3 px-2">
                                      <span className={change > 0 ? "text-green-600" : change < 0 ? "text-red-600" : "text-muted-foreground"}>
                                        {change > 0 ? "+" : ""}{change.toFixed(1)}%
                                      </span>
                                    </td>
                                    <td className="text-center py-3 px-2">
                                      {rec.trend === "up" && <TrendingUp className="h-4 w-4 text-green-600 inline" />}
                                      {rec.trend === "down" && <TrendingDown className="h-4 w-4 text-red-600 inline" />}
                                      {rec.trend === "stable" && <Minus className="h-4 w-4 text-muted-foreground inline" />}
                                    </td>
                                    <td className="text-right py-3 px-2">
                                      <Badge variant={rec.confidence > 0.8 ? "default" : "secondary"}>
                                        {(rec.confidence * 100).toFixed(0)}%
                                      </Badge>
                                    </td>
                                  </tr>
                                  <tr className="border-b bg-muted/30" data-testid={`row-rec-reason-${rec.id}`}>
                                    <td colSpan={6} className="py-2 px-4">
                                      <p className="text-sm text-muted-foreground italic">{rec.reason}</p>
                                    </td>
                                  </tr>
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            <TabsContent value="demand" className="space-y-6">
              {(() => {
                const viewedProducts = products.filter(p => p.views > 0);
                const viewedScatterData = viewedProducts.map(p => ({
                  name: p.name,
                  price: p.price,
                  views: p.views,
                  stock: p.stock,
                  category: p.category,
                }));
                const topViewedProducts = [...viewedProducts]
                  .sort((a, b) => b.views - a.views)
                  .slice(0, 20)
                  .map(p => ({ name: p.name, views: p.views, category: p.category }));

                return (
                  <>
                    <Card data-testid="chart-top-viewed-products">
                      <CardHeader>
                        <CardTitle>Top {topViewedProducts.length} Most Viewed Products</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {topViewedProducts.length === 0 ? (
                          <p className="text-muted-foreground text-center py-8">No products have been viewed yet.</p>
                        ) : (
                          <ResponsiveContainer width="100%" height={Math.max(300, topViewedProducts.length * 40)}>
                            <BarChart data={topViewedProducts} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis type="number" />
                              <YAxis type="category" dataKey="name" width={250} tick={{ fontSize: 11 }} />
                              <Tooltip content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const d = payload[0].payload;
                                  return (
                                    <div className="bg-background border rounded-md p-2 shadow-md text-sm">
                                      <p className="font-medium">{d.name}</p>
                                      <p>Views: {d.views}</p>
                                      <p>Category: {d.category}</p>
                                    </div>
                                  );
                                }
                                return null;
                              }} />
                              <Bar dataKey="views" fill="#2563eb" name="Views" />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card data-testid="chart-price-per-viewed-product">
                        <CardHeader>
                          <CardTitle>Price of Each Viewed Product</CardTitle>
                          <CardDescription>Selling price for every product that has been viewed</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {viewedScatterData.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">No products have been viewed yet.</p>
                          ) : (
                            <ResponsiveContainer width="100%" height={Math.max(300, viewedScatterData.length * 36)}>
                              <BarChart data={[...viewedScatterData].sort((a, b) => b.price - a.price)} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis type="number" tickFormatter={(v) => `M${v}`} />
                                <YAxis type="category" dataKey="name" width={220} tick={{ fontSize: 11 }} />
                                <Tooltip content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const d = payload[0].payload;
                                    return (
                                      <div className="bg-background border rounded-md p-2 shadow-md text-sm">
                                        <p className="font-medium">{d.name}</p>
                                        <p>Price: M{d.price.toLocaleString()}</p>
                                        <p>Views: {d.views}</p>
                                        <p>Category: {d.category}</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }} />
                                <Bar dataKey="price" fill="#2563eb" name="Price (M)" radius={[0, 4, 4, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          )}
                        </CardContent>
                      </Card>

                      <Card data-testid="chart-stock-per-viewed-product">
                        <CardHeader>
                          <CardTitle>Stock Remaining per Product</CardTitle>
                          <CardDescription>How many units are left in stock for each viewed product</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {viewedScatterData.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">No products have been viewed yet.</p>
                          ) : (
                            <ResponsiveContainer width="100%" height={Math.max(300, viewedScatterData.length * 36)}>
                              <BarChart data={[...viewedScatterData].sort((a, b) => a.stock - b.stock)} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis type="number" allowDecimals={false} />
                                <YAxis type="category" dataKey="name" width={220} tick={{ fontSize: 11 }} />
                                <Tooltip content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const d = payload[0].payload;
                                    return (
                                      <div className="bg-background border rounded-md p-2 shadow-md text-sm">
                                        <p className="font-medium">{d.name}</p>
                                        <p>Stock: {d.stock} units remaining</p>
                                        <p>Price: M{d.price.toLocaleString()}</p>
                                        <p>Category: {d.category}</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }} />
                                <Bar dataKey="stock" fill="#16a34a" name="Units in Stock" radius={[0, 4, 4, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <Card data-testid="chart-views-by-category">
                      <CardHeader>
                        <CardTitle>Total Views by Category (Viewed Products Only)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {viewedProducts.length === 0 ? (
                          <p className="text-muted-foreground text-center py-8">No products have been viewed yet.</p>
                        ) : (
                          <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={(() => {
                              const catViews: Record<string, number> = {};
                              viewedProducts.forEach(p => {
                                catViews[p.category] = (catViews[p.category] || 0) + p.views;
                              });
                              return Object.entries(catViews)
                                .map(([category, views]) => ({ category, views }))
                                .filter(c => c.views > 0)
                                .sort((a, b) => b.views - a.views);
                            })()}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                              <YAxis />
                              <Tooltip />
                              <Bar dataKey="views" fill="#0891b2" name="Total Views" />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>
                  </>
                );
              })()}
            </TabsContent>

            <TabsContent value="comparison" className="space-y-6">
                <Card data-testid="chart-revenue-by-category">
                  <CardHeader>
                    <CardTitle>Revenue by Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={categoryPerformance.filter(c => c.revenue > 0)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="revenue" tickFormatter={(v) => `M${v}`} orientation="left" />
                        <YAxis yAxisId="orders" orientation="right" />
                        <Tooltip formatter={(value: number, name: string) => name === "Revenue" ? `M${value}` : value} />
                        <Legend />
                        <Bar dataKey="revenue" yAxisId="revenue" fill="#16a34a" name="Revenue" />
                        <Bar dataKey="orders" yAxisId="orders" fill="#2563eb" name="Orders" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

              <Card data-testid="table-category-comparison">
                <CardHeader>
                  <CardTitle>Category Performance Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 font-medium">Category</th>
                          <th className="text-right py-3 px-2 font-medium">Products</th>
                          <th className="text-right py-3 px-2 font-medium">Avg Price</th>
                          <th className="text-right py-3 px-2 font-medium">Orders</th>
                          <th className="text-right py-3 px-2 font-medium">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryPerformance.map((cat) => (
                          <tr key={cat.category} className="border-b hover:bg-muted/50" data-testid={`row-category-${cat.category}`}>
                            <td className="py-3 px-2 font-medium">{cat.category}</td>
                            <td className="text-right py-3 px-2">{cat.products}</td>
                            <td className="text-right py-3 px-2">M{cat.avgPrice}</td>
                            <td className="text-right py-3 px-2">{cat.orders}</td>
                            <td className="text-right py-3 px-2">M{cat.revenue}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>
      </div>
    </AdminLayout>
  );
}
