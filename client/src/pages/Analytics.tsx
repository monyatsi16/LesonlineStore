import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, LineChart, Line,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, BarChart3, PieChart as PieChartIcon, Activity, DollarSign } from "lucide-react";

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
  });

  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center" data-testid="analytics-loading">
          <div className="text-muted-foreground text-lg">Loading analytics...</div>
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center" data-testid="analytics-error">
          <div className="text-destructive">Failed to load analytics data.</div>
        </div>
      </>
    );
  }

  const { categoryStats, products, recommendations, ordersByCategory, revenueByCategory } = data;

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

  const scatterData = products.map((p) => ({
    name: p.name,
    price: p.price,
    views: p.views,
    stock: p.stock,
    category: p.category,
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
  const pendingRecs = recommendations.length;

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-muted/30">
        <div className="container mx-auto px-4 py-8 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-analytics-title">Pricing Analytics</h1>
              <p className="text-muted-foreground mt-1">
                Market insights and dynamic pricing intelligence
              </p>
            </div>
            {user && (
              <Badge variant="outline" className="text-sm" data-testid="badge-user-role">
                {user.role === "admin" ? "Admin View" : "Seller View"}
              </Badge>
            )}
          </div>

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
                  <DollarSign className="h-8 w-8 text-green-600 opacity-70" />
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

              <Card data-testid="chart-price-quartiles">
                <CardHeader>
                  <CardTitle>Price Quartiles by Category (Q25 / Median / Q75)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={priceDistributionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `M${v}`} />
                      <Tooltip formatter={(value: number) => `M${value.toFixed(2)}`} />
                      <Legend />
                      <Bar dataKey="q25" fill="#93c5fd" name="25th Percentile" />
                      <Bar dataKey="median" fill="#2563eb" name="Median" />
                      <Bar dataKey="q75" fill="#1e40af" name="75th Percentile" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="insights" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card data-testid="chart-avg-prices">
                  <CardHeader>
                    <CardTitle>Average Prices by Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={marketInsightsData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => `M${v}`} />
                        <Tooltip formatter={(value: number, name: string) =>
                          name === "volatility" ? `${value}%` : `M${value}`
                        } />
                        <Legend />
                        <Bar dataKey="avgPrice" fill="#2563eb" name="Avg Price" />
                        <Bar dataKey="priceRange" fill="#f97316" name="Price Range" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card data-testid="chart-volatility">
                  <CardHeader>
                    <CardTitle>Price Volatility by Category (%)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={marketInsightsData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => `${v}%`} />
                        <Tooltip formatter={(value: number) => `${value}%`} />
                        <Bar dataKey="volatility" fill="#9333ea" name="Volatility (CV%)" />
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
              {recommendations.length === 0 ? (
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
                          <BarChart data={recommendations.slice(0, 10).map(r => ({
                            name: r.productName.length > 15 ? r.productName.slice(0, 15) + "..." : r.productName,
                            current: r.currentPrice,
                            recommended: r.recommendedPrice,
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                            <YAxis tickFormatter={(v) => `M${v}`} />
                            <Tooltip formatter={(value: number) => `M${value.toFixed(2)}`} />
                            <Legend />
                            <Bar dataKey="current" fill="#94a3b8" name="Current Price" />
                            <Bar dataKey="recommended" fill="#16a34a" name="Recommended Price" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card data-testid="chart-confidence">
                      <CardHeader>
                        <CardTitle>Recommendation Confidence Levels</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart data={recommendations.slice(0, 10).map(r => ({
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
                            {recommendations.map((rec) => {
                              const change = ((rec.recommendedPrice - rec.currentPrice) / rec.currentPrice) * 100;
                              return (
                                <tr key={rec.id} className="border-b hover:bg-muted/50" data-testid={`row-rec-${rec.id}`}>
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card data-testid="chart-scatter-price-views">
                  <CardHeader>
                    <CardTitle>Price vs Views (Demand Signal)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" dataKey="price" name="Price" tickFormatter={(v) => `M${v}`} />
                        <YAxis type="number" dataKey="views" name="Views" />
                        <Tooltip
                          cursor={{ strokeDasharray: "3 3" }}
                          formatter={(value: number, name: string) => name === "Price" ? `M${value}` : value}
                          labelFormatter={() => ""}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload;
                              return (
                                <div className="bg-background border rounded-md p-2 shadow-md text-sm">
                                  <p className="font-medium">{d.name}</p>
                                  <p>Price: M{d.price}</p>
                                  <p>Views: {d.views}</p>
                                  <p>Category: {d.category}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Scatter name="Products" data={scatterData} fill="#2563eb" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card data-testid="chart-scatter-price-stock">
                  <CardHeader>
                    <CardTitle>Price vs Stock Level</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" dataKey="price" name="Price" tickFormatter={(v) => `M${v}`} />
                        <YAxis type="number" dataKey="stock" name="Stock" />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload;
                              return (
                                <div className="bg-background border rounded-md p-2 shadow-md text-sm">
                                  <p className="font-medium">{d.name}</p>
                                  <p>Price: M{d.price}</p>
                                  <p>Stock: {d.stock}</p>
                                  <p>Category: {d.category}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Scatter name="Products" data={scatterData} fill="#16a34a" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card data-testid="chart-views-by-category">
                <CardHeader>
                  <CardTitle>Total Views by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={(() => {
                      const catViews: Record<string, number> = {};
                      products.forEach(p => {
                        catViews[p.category] = (catViews[p.category] || 0) + p.views;
                      });
                      return Object.entries(catViews).map(([category, views]) => ({ category, views }));
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="views" fill="#0891b2" name="Total Views" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="comparison" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card data-testid="chart-radar">
                  <CardHeader>
                    <CardTitle>Category Performance Radar</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="category" tick={{ fontSize: 10 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} />
                        <Radar name="Avg Price" dataKey="avgPrice" stroke="#2563eb" fill="#2563eb" fillOpacity={0.2} />
                        <Radar name="Volume" dataKey="volume" stroke="#16a34a" fill="#16a34a" fillOpacity={0.2} />
                        <Radar name="Orders" dataKey="orders" stroke="#ea580c" fill="#ea580c" fillOpacity={0.2} />
                        <Legend />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card data-testid="chart-revenue-by-category">
                  <CardHeader>
                    <CardTitle>Revenue by Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={categoryPerformance.filter(c => c.revenue > 0)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => `M${v}`} />
                        <Tooltip formatter={(value: number) => `M${value}`} />
                        <Legend />
                        <Bar dataKey="revenue" fill="#16a34a" name="Revenue" />
                        <Bar dataKey="orders" fill="#2563eb" name="Orders" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

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
      </div>
    </>
  );
}
