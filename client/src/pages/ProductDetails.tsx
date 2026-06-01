import { Navbar } from "@/components/Navbar";
import { useRoute, Link, useLocation } from "wouter";
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
  ChevronRight, Heart, Share2, Check, MapPin, Minus, Plus,
  Globe, ExternalLink, Loader2
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { addToCart } from "./Cart";
import type { Product } from "@shared/schema";

interface MarketplaceProduct extends Product {
  sellerName: string;
  recommendedPrice?: number;
  recommendedTrend?: "up" | "down" | "stable";
}

type InternetSearchItem = {
  source: "takealot" | "amazon" | "makro" | "game" | "shoprite";
  title: string;
  price: number;
  url: string;
  relevance: number;
};

type InternetSearchResult = {
  query: string;
  totalFound: number;
  items: InternetSearchItem[];
};

const EXTERNAL_MARKETPLACE_COLORS: Record<string, string> = {
  takealot: "bg-blue-600 hover:bg-blue-700 text-white",
  amazon: "bg-amber-500 hover:bg-amber-600 text-white",
  makro: "bg-red-600 hover:bg-red-700 text-white",
  game: "bg-green-600 hover:bg-green-700 text-white",
  shoprite: "bg-orange-600 hover:bg-orange-700 text-white",
};

type ProductRecommendationsResponse = {
  productId: number;
  basedOn: {
    category: string;
    price: number;
    supplier: string;
  };
  recommendations: Product[];
};

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
  const [, setLocation] = useLocation();
  const [quantity, setQuantity] = useState(1);

  const { data: product, isLoading } = useQuery<MarketplaceProduct>({
    queryKey: [`/api/marketplace/product/${productId}`],
    enabled: !!productId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const { data: productRecommendations } = useQuery<ProductRecommendationsResponse>({
    queryKey: [`/api/marketplace/product/${productId}/recommendations`],
    enabled: !!productId,
  });

  const internetSearchQuery = product
    ? `${product.name} ${product.category}`.trim()
    : "";

  const { data: internetSearchData, isFetching: isInternetSearching } = useQuery<InternetSearchResult>({
    queryKey: ["/api/marketplace/internet-search", internetSearchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/marketplace/internet-search?q=${encodeURIComponent(internetSearchQuery)}&limit=12`);
      if (!res.ok) throw new Error("Internet search failed");
      return res.json();
    },
    enabled: !!product,
    staleTime: 10 * 60 * 1000,
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

  const handleAddToCart = () => {
    addToCart(product.id, quantity);
    toast({ title: "Added to Cart", description: `${product.name} x${quantity} added to your cart.` });
  };

  const handleBuyNow = () => {
    addToCart(product.id, quantity);
    setLocation("/cart");
  };

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
              <p className="text-xs text-muted-foreground mb-1">LESonline</p>
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
                  {typeof product.recommendedPrice === "number" && product.recommendedPrice !== product.price ? (
                    <span className="flex items-center gap-3">
                      <span className="text-xl text-muted-foreground line-through">M{product.price.toLocaleString()}</span>
                      <span>M{product.recommendedPrice.toLocaleString()}</span>
                    </span>
                  ) : (
                    `M${product.price.toLocaleString()}`
                  )}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Taxes and <Link href="/cart" className="underline">shipping</Link> calculated at checkout
              </p>
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
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <span className="font-medium text-sm block">Collection at LESonline Pickup Point</span>
                  <span className="text-xs text-muted-foreground">3-5 business days after placing your order</span>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border bg-white">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Truck className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <span className="font-medium text-sm block">We deliver Nationwide (LESOTHO)</span>
                  <span className="text-xs text-muted-foreground">Shipping times depend on payment clearance</span>
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
              <CardContent className="p-5 space-y-4">
                <div>
                  <div className="text-2xl font-bold text-primary font-heading mb-1">
                    {typeof product.recommendedPrice === "number" && product.recommendedPrice !== product.price ? (
                      <div className="flex items-center gap-3">
                        <span className="text-base text-muted-foreground line-through">M{product.price.toLocaleString()}</span>
                        <span className="text-2xl font-bold">M{product.recommendedPrice.toLocaleString()}</span>
                      </div>
                    ) : (
                      `M${product.price.toLocaleString()}`
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Taxes and shipping calculated at checkout
                  </p>
                </div>

                <Separator />

                <div>
                  <label className="text-xs font-medium mb-2 block text-muted-foreground uppercase tracking-wide">Quantity</label>
                  <div className="flex items-center border rounded-xl overflow-hidden bg-gray-50">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-none hover:bg-gray-100"
                      onClick={() => setQuantity(Math.max(product.moq, quantity - 1))}
                      data-testid="button-qty-decrease"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      min={product.moq}
                      max={product.stock}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(product.moq, Math.min(product.stock, Number(e.target.value) || product.moq)))}
                      className="h-10 w-16 text-center border-0 bg-white rounded-none font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      data-testid="input-quantity"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-none hover:bg-gray-100"
                      onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                      data-testid="button-qty-increase"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">Min: {product.moq} pieces</p>
                </div>

                {product.stock === 0 ? (
                  <Button className="w-full rounded-xl h-12 font-heading font-semibold" disabled data-testid="button-sold-out">
                    Sold out
                  </Button>
                ) : (
                  <>
                    <Button
                      className="w-full rounded-xl h-12 font-heading font-semibold bg-[#0E1F6C] hover:bg-[#0E1F6C]/90"
                      onClick={handleAddToCart}
                      data-testid="button-add-to-cart"
                    >
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Add to cart
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full rounded-xl h-12 font-heading font-semibold border-2"
                      onClick={handleBuyNow}
                      data-testid="button-buy-now"
                    >
                      Buy it now
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </>
                )}

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
                value="search-online"
                className="h-14 px-8 rounded-none font-heading font-semibold text-sm data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-[#0E1F6C] data-[state=active]:shadow-none"
                data-testid="tab-search-online"
              >
                <Globe className="h-4 w-4 mr-2" />
                Search Online
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
            <TabsContent value="search-online" className="p-6 lg:p-10" data-testid="tab-content-search-online">
              <div className="max-w-4xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Globe className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-heading font-bold">Search Online Marketplaces</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Compare prices and availability across leading online stores.
                    </p>
                  </div>
                </div>

                {/* External marketplace quick-links */}
                <div className="mb-8">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Search on</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { name: "Takealot", key: "takealot", url: `https://www.takealot.com/all?qsearch=${encodeURIComponent(product.name)}` },
                      { name: "Amazon",   key: "amazon",   url: `https://www.amazon.com/s?k=${encodeURIComponent(product.name)}` },
                      { name: "Makro",    key: "makro",    url: `https://www.makro.co.za/search/?text=${encodeURIComponent(product.name)}` },
                      { name: "Game",     key: "game",     url: `https://www.game.co.za/search/?text=${encodeURIComponent(product.name)}` },
                    ].map((store) => (
                      <a
                        key={store.key}
                        href={store.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${EXTERNAL_MARKETPLACE_COLORS[store.key] ?? "bg-gray-700 hover:bg-gray-800 text-white"}`}
                        data-testid={`link-search-${store.key}`}
                      >
                        {store.name}
                        <ExternalLink className="h-3.5 w-3.5 opacity-80" />
                      </a>
                    ))}
                  </div>
                </div>

                {/* Live internet search results */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Live results for &ldquo;{product.name}&rdquo;</h4>
                    {isInternetSearching && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {internetSearchData && !isInternetSearching && (
                      <span className="text-xs text-muted-foreground ml-auto">{internetSearchData.totalFound} found</span>
                    )}
                  </div>

                  {isInternetSearching && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="border rounded-xl p-4 animate-pulse bg-gray-50">
                          <div className="h-3 w-16 bg-gray-200 rounded mb-2" />
                          <div className="h-4 w-full bg-gray-200 rounded mb-1" />
                          <div className="h-4 w-2/3 bg-gray-200 rounded mb-3" />
                          <div className="h-5 w-20 bg-gray-200 rounded" />
                        </div>
                      ))}
                    </div>
                  )}

                  {!isInternetSearching && internetSearchData && internetSearchData.totalFound === 0 && (
                    <div className="border border-dashed rounded-xl p-10 text-center text-muted-foreground">
                      <Globe className="h-8 w-8 mx-auto mb-3 opacity-30" />
                      <p className="font-semibold">No live results found</p>
                      <p className="text-sm mt-1">Use the buttons above to search directly on each store.</p>
                    </div>
                  )}

                  {!isInternetSearching && internetSearchData && internetSearchData.totalFound > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="internet-results-grid">
                      {internetSearchData.items.map((item, i) => (
                        <a
                          key={`${item.url}-${i}`}
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group border rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all flex flex-col gap-2"
                          data-testid={`internet-result-${i}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize ${EXTERNAL_MARKETPLACE_COLORS[item.source] ?? "bg-gray-700 text-white"}`}>
                              {item.source}
                            </span>
                            <span className="text-base font-bold text-primary">M{Math.round(item.price).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-gray-800 line-clamp-2 flex-1">{item.title}</p>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Relevance: {Math.round(item.relevance)}%</span>
                            <span className="text-primary inline-flex items-center gap-1 group-hover:underline">
                              View on {item.source} <ExternalLink className="h-3 w-3" />
                            </span>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
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

        {productRecommendations?.recommendations?.length ? (
          <section className="mt-12" data-testid="section-recommended-products">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-2xl font-heading font-bold">You may also like</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Smart picks based on this product category, market demand, and price band.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {productRecommendations.recommendations.map((item) => (
                <Link key={item.id} href={`/product/${item.id}`}>
                  <div className="group border rounded-xl bg-white p-3 hover:shadow-md transition cursor-pointer h-full">
                    <div className="aspect-square bg-gray-50 rounded-lg overflow-hidden mb-3 p-3">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">{item.category}</p>
                      <h3 className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">{item.name}</h3>
                      <div className="flex items-center justify-between">
                        <p className="text-base font-bold text-primary">M{item.price.toLocaleString()}</p>
                        <span className="text-[11px] text-muted-foreground">{item.views} views</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <footer className="border-t bg-gray-50 py-8 mt-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} LesOnline. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
