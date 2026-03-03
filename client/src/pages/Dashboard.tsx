import { Navbar } from "@/components/Navbar";
import { PRODUCTS, PRICE_RECOMMENDATIONS, SALES_DATA } from "@/lib/mockData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUp, ArrowDown, Minus, RefreshCw, Zap, TrendingUp, DollarSign, Package } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { toast } = useToast();
  const [recommendations, setRecommendations] = useState(PRICE_RECOMMENDATIONS);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleApplyPrice = (id: string, newPrice: number) => {
    toast({
      title: "Price Updated Successfully",
      description: `Product price updated to M${newPrice.toFixed(2)} via LESonline API.`,
    });
    // Remove from list to simulate applied
    setRecommendations(prev => prev.filter(r => r.id !== id));
  };

  const refreshData = () => {
    setIsRefreshing(true);
    // Simulate API fetch
    setTimeout(() => {
      setIsRefreshing(false);
      toast({
        title: "Data Refreshed",
        description: "Latest market insights retrieved from backend.",
      });
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 font-sans">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground">Retailer Dashboard</h1>
            <p className="text-muted-foreground">Overview of your store performance and pricing insights.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={refreshData} disabled={isRefreshing} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Syncing...' : 'Refresh Data'}
            </Button>
            <Button className="gap-2 bg-primary hover:bg-primary/90">
              <Zap className="h-4 w-4" />
              Auto-Optimize All
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue (LSL)</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">M45,231.89</div>
              <p className="text-xs text-muted-foreground">+20.1% from last month</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+2350</div>
              <p className="text-xs text-muted-foreground">+180.1% from last month</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sales</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+12,234</div>
              <p className="text-xs text-muted-foreground">+19% from last month</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Competitor Alert</CardTitle>
              <Zap className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3 Alerts</div>
              <p className="text-xs text-muted-foreground">Price changes detected</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Chart Section */}
          <div className="lg:col-span-2 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Sales Analytics</CardTitle>
                <CardDescription>Revenue and Order volume trends.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={SALES_DATA} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
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
                  {PRODUCTS.slice(0, 3).map(product => (
                    <div key={product.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded bg-slate-100 p-1 border">
                           <img src={product.image} alt="" className="h-full w-full object-contain" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{product.name}</p>
                          <p className="text-xs text-muted-foreground">SKU: {product.id}00{product.id}</p>
                        </div>
                      </div>
                      <div className="text-right">
                         <div className="font-bold">{product.stock} units</div>
                         <div className={`text-xs ${product.stock < 100 ? 'text-red-500' : 'text-green-500'}`}>
                           {product.stock < 100 ? 'Low Stock' : 'In Stock'}
                         </div>
                      </div>
                    </div>
                  ))}
                 </div>
              </CardContent>
            </Card>
          </div>

          {/* Gradient Boosting Pricing Model */}
          <div className="lg:col-span-1">
             <Card className="h-full border-primary/20 shadow-lg shadow-primary/5">
               <CardHeader className="bg-primary/5 border-b border-primary/10">
                 <div className="flex items-center gap-2">
                   <BrainCircuit className="h-5 w-5 text-primary" />
                   <CardTitle>Gradient Boosting Model</CardTitle>
                 </div>
                 <CardDescription>
                   Dynamic price optimization for LESonline.Store
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
                       <div key={rec.id} className="p-4 hover:bg-slate-50 transition-colors">
                         <div className="flex justify-between items-start mb-2">
                           <h4 className="font-medium text-sm line-clamp-1 flex-1 mr-2" title={rec.productName}>
                             {rec.productName}
                           </h4>
                           <Badge variant={rec.confidence > 0.8 ? "default" : "secondary"} className="text-[10px] h-5">
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
                           onClick={() => handleApplyPrice(rec.id, rec.recommendedPrice)}
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
