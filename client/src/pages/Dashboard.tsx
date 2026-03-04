import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Minus, RefreshCw, Zap, TrendingUp, DollarSign, Package, BrainCircuit } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { Product, PriceRecommendation, SalesData } from "@shared/schema";

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: recommendations = [] } = useQuery<PriceRecommendation[]>({ queryKey: ["/api/recommendations"] });
  const { data: salesData = [] } = useQuery<SalesData[]>({ queryKey: ["/api/sales"] });

  const runModelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pricing/run-model");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Gradient Boosting Model Complete",
        description: `Generated ${data.generated} new price recommendations.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
    },
  });

  const applyPriceMutation = useMutation({
    mutationFn: async ({ recId, productId, price }: { recId: number; productId: number; price: number }) => {
      await apiRequest("POST", `/api/recommendations/${recId}/apply`, { productId, price });
    },
    onSuccess: (_data, variables) => {
      toast({
        title: "Price Updated Successfully",
        description: `Product price updated to M${variables.price.toFixed(2)}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
  });

  const refreshData = () => {
    setIsRefreshing(true);
    queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
    setTimeout(() => {
      setIsRefreshing(false);
      toast({ title: "Data Refreshed", description: "Latest market insights retrieved." });
    }, 1500);
  };

  const totalRevenue = salesData.reduce((sum, s) => sum + s.revenue, 0);
  const totalOrders = salesData.reduce((sum, s) => sum + s.orders, 0);

  return (
    <div className="min-h-screen bg-slate-50/50 font-sans">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground" data-testid="text-dashboard-title">
              {user?.businessName || "Dashboard"}
            </h1>
            <p className="text-muted-foreground">Welcome, {user?.name}. Here's your store performance and pricing insights.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={refreshData} disabled={isRefreshing} className="gap-2" data-testid="button-refresh">
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Syncing...' : 'Refresh Data'}
            </Button>
            <Button className="gap-2 bg-primary hover:bg-primary/90" onClick={() => runModelMutation.mutate()} disabled={runModelMutation.isPending} data-testid="button-run-model">
              <BrainCircuit className="h-4 w-4" />
              {runModelMutation.isPending ? 'Running Model...' : 'Run Gradient Boosting'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue (LSL)</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-revenue">M{totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">From your sales data</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-orders">{totalOrders}</div>
              <p className="text-xs text-muted-foreground">Across all months</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Your Products</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-product-count">{products.length}</div>
              <p className="text-xs text-muted-foreground">In your catalog</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Model Alerts</CardTitle>
              <Zap className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-alert-count">{recommendations.length} Alerts</div>
              <p className="text-xs text-muted-foreground">Price changes recommended</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Sales Analytics (LSL)</CardTitle>
                <CardDescription>Your revenue trends.</CardDescription>
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
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inventory Health</CardTitle>
              </CardHeader>
              <CardContent>
                 <div className="space-y-4">
                  {products.slice(0, 4).map(product => (
                    <div key={product.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0" data-testid={`row-inventory-${product.id}`}>
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded bg-slate-100 p-1 border">
                           <img src={product.image} alt="" className="h-full w-full object-contain" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{product.name}</p>
                          <p className="text-xs text-muted-foreground">ID: {product.id}</p>
                        </div>
                      </div>
                      <div className="text-right">
                         <div className="font-bold">{product.stock} units</div>
                         <div className={`text-xs ${product.stock < 10 ? 'text-red-500' : 'text-green-500'}`}>
                           {product.stock < 10 ? 'Low Stock' : 'In Stock'}
                         </div>
                      </div>
                    </div>
                  ))}
                 </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
             <Card className="h-full border-primary/20 shadow-lg shadow-primary/5">
               <CardHeader className="bg-primary/5 border-b border-primary/10">
                 <div className="flex items-center gap-2">
                   <BrainCircuit className="h-5 w-5 text-primary" />
                   <CardTitle>Gradient Boosting Model</CardTitle>
                 </div>
                 <CardDescription>
                   Dynamic price optimization for {user?.businessName || "your business"}
                 </CardDescription>
               </CardHeader>
               <CardContent className="p-0">
                 {recommendations.length === 0 ? (
                   <div className="p-8 text-center text-muted-foreground">
                     <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-4">
                       <Check className="h-6 w-6" />
                     </div>
                     <p>All prices are optimized!</p>
                   </div>
                 ) : (
                   <div className="divide-y">
                     {recommendations.map((rec) => (
                       <div key={rec.id} className="p-4 hover:bg-slate-50 transition-colors" data-testid={`card-recommendation-${rec.id}`}>
                         <div className="flex justify-between items-start mb-2">
                           <h4 className="font-medium text-sm line-clamp-1 flex-1 mr-2" title={rec.productName}>
                             {rec.productName}
                           </h4>
                           <Badge variant={rec.confidence > 0.8 ? "default" : "secondary"} className="text-[10px] h-5" data-testid={`text-confidence-${rec.id}`}>
                             {(rec.confidence * 100).toFixed(0)}% Conf.
                           </Badge>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-4 mb-3">
                            <div className="bg-slate-100 rounded p-2 text-center">
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Current</div>
                              <div className="font-mono font-medium">M{rec.currentPrice.toFixed(2)}</div>
                            </div>
                            <div className="bg-primary/10 rounded p-2 text-center relative overflow-hidden border border-primary/20">
                              <div className="text-[10px] text-primary uppercase tracking-wider font-bold">Suggested</div>
                              <div className="font-mono font-bold text-primary flex items-center justify-center gap-1">
                                M{rec.recommendedPrice.toFixed(2)}
                                {rec.trend === 'up' && <ArrowUp className="h-3 w-3" />}
                                {rec.trend === 'down' && <ArrowDown className="h-3 w-3" />}
                                {rec.trend === 'stable' && <Minus className="h-3 w-3" />}
                              </div>
                            </div>
                         </div>

                         <div className="text-xs text-muted-foreground mb-3 flex gap-2 items-start">
                            <div className="mt-0.5 min-w-[4px] h-[4px] rounded-full bg-slate-400"></div>
                            {rec.reason}
                         </div>

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

function Check({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
