import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Star,
  Search,
  ShoppingCart,
  Eye,
  Filter,
  TrendingUp,
  ArrowUpDown,
  Flame,
  Package,
  X,
  Truck,
  Shield,
  HeadphonesIcon,
  Mail,
  Cpu,
  MapPin,
  Phone,
  Facebook,
  Instagram,
  Twitter,
  ExternalLink,
  Sparkles,
  Tag,
  Globe,
  Clock3,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { resolveApiUrl } from "@/lib/api";
import type { Product } from "@shared/schema";
import { addToCart } from "./Cart";

type ProductWithRecommendation = Product & {
  recommendedPrice?: number;
  recommendedTrend?: string;
};

type SmartSearchResult = {
  query: string;
  totalFound: number;
  products: Product[];
  suggestedCategories: { name: string; count: number }[];
  relatedTerms: string[];
  externalLinks: { name: string; url: string; icon: string }[];
  showExternal: boolean;
};

type InternetSearchResult = {
  query: string;
  totalFound: number;
  items: Array<{
    source: "takealot" | "amazon" | "makro" | "game" | "shoprite";
    title: string;
    price: number;
    url: string;
    relevance: number;
  }>;
};

const EXTERNAL_COLORS: Record<string, string> = {
  takealot: "bg-blue-600 hover:bg-blue-700",
  amazon: "bg-amber-500 hover:bg-amber-600",
  makro: "bg-red-600 hover:bg-red-700",
  game: "bg-green-600 hover:bg-green-700",
};

const CATEGORY_ICONS: Record<string, string> = {
  "Built-in Hobs": "🔥",
  "Built-in Ovens": "♨️",
  "Microwaves": "📡",
  "Stoves": "🍳",
  "Gas Cooktops": "🔥",
  "Range Hoods": "💨",
  "Kitchen Sinks & Mixers": "🚰",
  "Dishwashers & Washing Machines": "🫧",
  "Fridge & Freezer": "❄️",
  "Refrigerators": "🧊",
  "Ovens": "🔲",
  "Fireplaces": "🪵",
  "Geysers": "🌡️",
  "Bathroom": "🚿",
  "Chairs": "🪑",
  "Men's Casual Shoes": "👞",
  "Men's Shoes": "👟",
  "Phones": "📱",
};

type SortOption = "default" | "price-low" | "price-high" | "popular" | "rating" | "newest";

function ProductCard({ product }: { product: ProductWithRecommendation }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdminOrSeller = user?.role === "admin" || user?.role === "seller";

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.stock === 0) return;
    addToCart(product.id, 1);
    toast({
      title: "Added to cart",
      description: `${product.name} added to your cart`,
    });
  };

  return (
    <Link href={`/product/${product.id}`}>
      <div className="group cursor-pointer h-full" data-testid={`card-product-${product.id}`}>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-all duration-200 h-full flex flex-col">
          <div className="aspect-square bg-gray-50 p-4 relative overflow-hidden">
            <img
              src={product.image}
              alt={product.name}
              className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-300"
            />
            {isAdminOrSeller && product.stock < 10 && product.stock > 0 && (
              <span className="absolute top-3 left-3 bg-orange-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                Low Stock
              </span>
            )}
            {product.stock === 0 && (
              <span className="absolute top-3 left-3 bg-gray-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                Sold Out
              </span>
            )}
            {isAdminOrSeller && (
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <Badge variant="secondary" className="bg-[#0E1F6C] text-white text-[9px] border-0">
                  <Cpu className="h-2.5 w-2.5 mr-1" />
                  AI Priced
                </Badge>
              </div>
            )}
          </div>
          <div className="p-4 flex flex-col flex-1">
            <h3 className="font-medium text-sm text-gray-900 line-clamp-2 mb-2 min-h-[2.5rem] leading-snug" data-testid={`text-product-name-${product.id}`}>
              {product.name}
            </h3>
            <div className="flex items-center gap-1 mb-2">
              <Badge variant="outline" className="text-[10px] text-gray-500 border-gray-200 font-normal">
                {product.category}
              </Badge>
            </div>
            <div className="flex items-center gap-1 mb-3">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`h-3 w-3 ${s <= Math.round(product.rating) ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}`}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-500">({product.reviews})</span>
            </div>
            <div className="mt-auto">
              <div className="flex items-end justify-between mb-3">
                <div>
                  <div className="text-lg font-bold text-[#0E1F6C]" data-testid={`text-price-${product.id}`}>
                    {typeof product.recommendedPrice === "number" && product.recommendedPrice !== product.price ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400 line-through">M{product.price.toLocaleString()}</span>
                        <span className="font-bold text-[#0E1F6C]">M{product.recommendedPrice.toLocaleString()}</span>
                      </div>
                    ) : (
                      `M${product.price.toLocaleString()}`
                    )}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <Eye className="h-3 w-3" />
                  {product.views}
                </div>
              </div>
              <Button
                size="sm"
                className={`w-full rounded-lg text-xs font-semibold ${
                  product.stock === 0
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-[#0E1F6C] hover:bg-[#0E1F6C]/90 text-white"
                }`}
                onClick={handleAddToCart}
                disabled={product.stock === 0}
                data-testid={`button-add-to-cart-${product.id}`}
              >
                <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
                {product.stock === 0 ? "Out of Stock" : "Add to Cart"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function CollectionCard({
  title,
  count,
  icon,
  onClick,
  isSelected,
}: {
  title: string;
  count: number;
  icon: string;
  onClick: () => void;
  isSelected: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
        isSelected
          ? "border-[#0E1F6C] bg-[#0E1F6C]/5 shadow-md"
          : "border-gray-200 bg-white hover:border-[#0E1F6C]/30"
      }`}
      data-testid={`card-category-${title}`}
    >
      <span className="text-3xl">{icon}</span>
      <div className="text-center">
        <div className="font-semibold text-sm text-gray-900">{title}</div>
        <div className="text-xs text-gray-500 mt-0.5">{count} {count === 1 ? "product" : "products"}</div>
      </div>
    </button>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [quickTrackOrderId, setQuickTrackOrderId] = useState("");
  const [quickTrackEmail, setQuickTrackEmail] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get("category");
    const search = params.get("search");
    if (cat) {
      setSelectedCategory(cat);
      setTimeout(() => {
        document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    }
    if (search) {
      setSearchQuery(search);
      setTimeout(() => {
        document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    }
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const category = (e as CustomEvent).detail as string;
      setSelectedCategory(category);
      document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
    };
    window.addEventListener("select-category", handler);
    return () => window.removeEventListener("select-category", handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const query = (e as CustomEvent).detail as string;
      setSearchQuery(query);
      setSelectedCategory(null);
      setTimeout(() => {
        document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    };
    window.addEventListener("navbar-search", handler);
    return () => window.removeEventListener("navbar-search", handler);
  }, []);

  const { data: allProducts = [] } = useQuery<Array<Product & { recommendedPrice?: number; recommendedTrend?: string }>>({
    queryKey: ["/api/marketplace"],
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const { data: smartSearch } = useQuery<SmartSearchResult>({
    queryKey: ["/api/marketplace/smart-search", debouncedSearch],
    queryFn: async () => {
      const res = await fetch(resolveApiUrl(`/api/marketplace/smart-search?q=${encodeURIComponent(debouncedSearch)}`));
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: debouncedSearch.length > 1,
  });

  const { data: internetSearch } = useQuery<InternetSearchResult>({
    queryKey: ["/api/marketplace/internet-search", debouncedSearch],
    queryFn: async () => {
      const res = await fetch(resolveApiUrl(`/api/marketplace/internet-search?q=${encodeURIComponent(debouncedSearch)}&limit=16`));
      if (!res.ok) throw new Error("Internet search failed");
      return res.json();
    },
    enabled: debouncedSearch.length > 1,
  });

  const searchResults = smartSearch?.products;

  const categories = useMemo(() => {
    const catMap = new Map<string, { count: number; image?: string }>();
    allProducts.forEach((p) => {
      const existing = catMap.get(p.category);
      if (existing) {
        existing.count++;
      } else {
        catMap.set(p.category, { count: 1, image: p.image });
      }
    });
    return Array.from(catMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [allProducts]);

  const trendingProducts = useMemo(() => {
    return [...allProducts]
      .sort((a, b) => b.views + b.reviews * 10 - (a.views + a.reviews * 10))
      .slice(0, 5);
  }, [allProducts]);

  const displayProducts = debouncedSearch ? (searchResults || []) : allProducts;

  const filteredAndSorted = useMemo(() => {
    let result = selectedCategory
      ? displayProducts.filter((p) => p.category === selectedCategory)
      : displayProducts;

    switch (sortBy) {
      case "price-low":
        result = [...result].sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        result = [...result].sort((a, b) => b.price - a.price);
        break;
      case "popular":
        result = [...result].sort((a, b) => b.views - a.views);
        break;
      case "rating":
        result = [...result].sort((a, b) => b.rating - a.rating);
        break;
      case "newest":
        result = [...result].sort((a, b) => b.id - a.id);
        break;
      default:
        break;
    }

    return result;
  }, [displayProducts, selectedCategory, sortBy]);

  const clearFilters = () => {
    setSelectedCategory(null);
    setSortBy("default");
    setSearchQuery("");
    window.history.pushState({}, "", "/");
  };

  const hasActiveFilters = selectedCategory || sortBy !== "default" || searchQuery;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />

      <Hero />

      <section className="bg-white border-b border-gray-100" data-testid="section-features">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#0E1F6C]/10 flex items-center justify-center">
                <Truck className="h-5 w-5 text-[#0E1F6C]" />
              </div>
              <div>
                <div className="font-semibold text-sm text-gray-900">Free Delivery</div>
                <div className="text-xs text-gray-500">Orders over M500</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#0E1F6C]/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-[#0E1F6C]" />
              </div>
              <div>
                <div className="font-semibold text-sm text-gray-900">Secure Shopping</div>
                <div className="text-xs text-gray-500">100% protected</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#0E1F6C]/10 flex items-center justify-center">
                <Cpu className="h-5 w-5 text-[#0E1F6C]" />
              </div>
              <div>
                <div className="font-semibold text-sm text-gray-900">AI-Powered Pricing</div>
                <div className="text-xs text-gray-500">Smart market prices</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#0E1F6C]/10 flex items-center justify-center">
                <HeadphonesIcon className="h-5 w-5 text-[#0E1F6C]" />
              </div>
              <div>
                <div className="font-semibold text-sm text-gray-900">24/7 Support</div>
                <div className="text-xs text-gray-500">Always here to help</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-r from-[#0E1F6C] to-[#12317f] text-white" data-testid="section-quick-track">
        <div className="container mx-auto px-4 py-6">
          <div className="grid md:grid-cols-[1fr,auto] gap-4 items-center">
            <div>
              <h2 className="font-heading font-bold text-xl flex items-center gap-2">
                <Clock3 className="h-5 w-5" />
                Track Your Delivery Checkpoint
              </h2>
              <p className="text-white/80 text-sm mt-1">Enter your order number and checkout email to view live order progress.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Order #"
                value={quickTrackOrderId}
                onChange={(e) => setQuickTrackOrderId(e.target.value)}
                className="bg-white text-black border-white/20 min-w-[120px]"
                data-testid="input-home-quick-track-order-id"
              />
              <Input
                type="email"
                placeholder="Email"
                value={quickTrackEmail}
                onChange={(e) => setQuickTrackEmail(e.target.value)}
                className="bg-white text-black border-white/20 min-w-[220px]"
                data-testid="input-home-quick-track-email"
              />
              <Button
                onClick={() =>
                  setLocation(`/track?orderId=${encodeURIComponent(quickTrackOrderId)}&email=${encodeURIComponent(quickTrackEmail)}`)
                }
                className="bg-[#c45e72] hover:bg-[#c45e72]/90 text-white"
                disabled={!quickTrackOrderId.trim() || !quickTrackEmail.trim()}
                data-testid="button-home-quick-track"
              >
                Track Now
              </Button>
              <Button asChild variant="outline" className="border-white/40 text-white hover:bg-white/10 hover:text-white" data-testid="button-home-order-history">
                <Link href="/orders">Order History</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <main className="container mx-auto px-4 py-10">
        <section className="mb-12" data-testid="section-categories">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-heading font-bold text-gray-900">Shop by Category</h2>
            <p className="text-gray-500 mt-2 text-sm">Browse our {categories.length} product categories</p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {categories.map((cat) => (
              <CollectionCard
                key={cat.name}
                title={cat.name}
                count={cat.count}
                icon={CATEGORY_ICONS[cat.name] || "📦"}
                isSelected={selectedCategory === cat.name}
                onClick={() =>
                  setSelectedCategory(selectedCategory === cat.name ? null : cat.name)
                }
              />
            ))}
          </div>
        </section>

        {!debouncedSearch && !selectedCategory && trendingProducts.length > 0 && (
          <section className="mb-12" data-testid="section-trending">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                <h2 className="text-2xl font-heading font-bold text-gray-900">Trending Now</h2>
              </div>
              <Link href="#products">
                <Button variant="ghost" size="sm" className="text-[#0E1F6C] hover:text-[#0E1F6C]/80" data-testid="link-view-all-trending">
                  View All
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {trendingProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        <section id="products" data-testid="section-all-products">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="flex w-full items-center rounded-xl border border-gray-200 bg-white shadow-sm">
                <Search className="h-4 w-4 ml-3 text-gray-400" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search products on LesOnline..."
                  className="border-0 focus-visible:ring-0 shadow-none flex-1"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-marketplace-search"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 mr-1"
                    onClick={() => {
                      setSearchQuery("");
                      searchInputRef.current?.focus();
                    }}
                    data-testid="button-clear-search"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-[180px] rounded-xl" data-testid="select-sort">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="popular">Most Popular</SelectItem>
                  <SelectItem value="rating">Highest Rated</SelectItem>
                  <SelectItem value="newest">Newest First</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters} className="h-10 rounded-xl" data-testid="button-clear-filters">
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Filter className="h-4 w-4 text-gray-400" />
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              className={`rounded-full ${selectedCategory === null ? "bg-[#0E1F6C] hover:bg-[#0E1F6C]/90" : ""}`}
              onClick={() => setSelectedCategory(null)}
              data-testid="button-category-all"
            >
              All ({allProducts.length})
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat.name}
                variant={selectedCategory === cat.name ? "default" : "outline"}
                size="sm"
                className={`rounded-full ${selectedCategory === cat.name ? "bg-[#0E1F6C] hover:bg-[#0E1F6C]/90" : ""}`}
                onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
                data-testid={`button-category-${cat.name}`}
              >
                {cat.name} ({cat.count})
              </Button>
            ))}
          </div>

          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-heading font-bold text-gray-900" data-testid="text-products-heading">
              {debouncedSearch
                ? `Results for "${debouncedSearch}"`
                : selectedCategory || "All Products"}
            </h2>
            <span className="text-sm text-gray-500" data-testid="text-product-count">
              {filteredAndSorted.length} products
            </span>
          </div>

          {/* ── Smart Search Panel ─────────────────────────────── */}
          {debouncedSearch && smartSearch && (
            <div className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              {/* External marketplaces */}
              {(smartSearch.showExternal || smartSearch.totalFound === 0) && (
                <div className="px-4 pt-4 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-1.5 mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <ExternalLink className="h-3.5 w-3.5" />
                    {smartSearch.totalFound === 0
                      ? "Not found locally – search on"
                      : "Also search on"}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {smartSearch.externalLinks.map((link) => (
                      <a
                        key={link.name}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-colors ${EXTERNAL_COLORS[link.icon] ?? "bg-gray-700 hover:bg-gray-800"}`}
                      >
                        {link.name}
                        <ExternalLink className="h-3 w-3 opacity-70" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Internet result cards */}
              {internetSearch && internetSearch.totalFound > 0 && (
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-1.5 mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <Globe className="h-3.5 w-3.5" />
                    Internet results ({internetSearch.totalFound})
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {internetSearch.items.slice(0, 8).map((item, index) => (
                      <a
                        key={`${item.url}-${index}`}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border border-gray-200 rounded-lg p-3 hover:border-[#0E1F6C]/40 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                            {item.source}
                          </Badge>
                          <span className="text-xs font-semibold text-[#0E1F6C]">M{Math.round(item.price).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-gray-800 line-clamp-2 mb-1">{item.title}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-500">Relevance {Math.round(item.relevance)}%</span>
                          <span className="text-[10px] text-[#0E1F6C] inline-flex items-center gap-1">
                            Open <ExternalLink className="h-3 w-3" />
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Related terms */}
              {smartSearch.relatedTerms.length > 0 && (
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <Sparkles className="h-3.5 w-3.5" />
                    Related searches
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {smartSearch.relatedTerms.map((term) => (
                      <button
                        key={term}
                        onClick={() => { setSearchQuery(term); setSelectedCategory(null); }}
                        className="px-2.5 py-1 rounded-full border border-gray-200 text-xs text-gray-700 hover:border-[#0E1F6C] hover:text-[#0E1F6C] transition-colors"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested categories */}
              {smartSearch.suggestedCategories.length > 0 && (
                <div className="px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <Tag className="h-3.5 w-3.5" />
                    In categories
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {smartSearch.suggestedCategories.map((cat) => (
                      <button
                        key={cat.name}
                        onClick={() => { setSelectedCategory(cat.name); setSearchQuery(""); }}
                        className="px-2.5 py-1 rounded-full border border-gray-200 text-xs text-gray-700 hover:border-[#0E1F6C] hover:text-[#0E1F6C] transition-colors"
                      >
                        {CATEGORY_ICONS[cat.name] || "📦"} {cat.name} <span className="text-gray-400">({cat.count})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {/* ── End Smart Search Panel ─────────────────────────── */}

          {filteredAndSorted.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
              <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
              <p className="text-gray-500 mb-6">
                {searchQuery
                  ? "Try a different search term or clear the filters."
                  : "Be the first to list your products!"}
              </p>
              {hasActiveFilters ? (
                <Button onClick={clearFilters} className="bg-[#0E1F6C] hover:bg-[#0E1F6C]/90" data-testid="button-reset-filters">Reset Filters</Button>
              ) : (
                <Link href="/auth">
                  <Button className="bg-[#0E1F6C] hover:bg-[#0E1F6C]/90" data-testid="button-list-products">Start Selling on LesOnline</Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredAndSorted.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      </main>

      <section className="bg-[#0E1F6C] text-white py-16" data-testid="section-newsletter">
        <div className="container mx-auto px-4 text-center max-w-xl">
          <Mail className="h-10 w-10 mx-auto mb-4 opacity-80" />
          <h2 className="text-2xl font-heading font-bold mb-3">Stay Updated</h2>
          <p className="text-white/70 mb-6 text-sm">
            Subscribe to get notified about new products, deals, and AI pricing insights.
          </p>
          <div className="flex gap-2 max-w-md mx-auto">
            <Input
              type="email"
              placeholder="Enter your email"
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50 rounded-xl flex-1"
              data-testid="input-newsletter-email"
            />
            <Button className="bg-white text-[#0E1F6C] hover:bg-white/90 rounded-xl px-6 font-semibold" data-testid="button-newsletter-subscribe">
              Subscribe
            </Button>
          </div>
        </div>
      </section>

      <footer className="bg-[#0a1545] text-gray-300" data-testid="footer">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h4 className="font-heading font-bold text-white text-lg mb-4">LesOnline</h4>
              <p className="text-sm text-gray-400 mb-4 leading-relaxed">
                Lesotho's smart online marketplace with AI-powered dynamic pricing for fair, competitive shopping.
              </p>
              <div className="flex gap-3">
                <a href="#" className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors" data-testid="link-social-facebook">
                  <Facebook className="h-4 w-4" />
                </a>
                <a href="#" className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors" data-testid="link-social-instagram">
                  <Instagram className="h-4 w-4" />
                </a>
                <a href="#" className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors" data-testid="link-social-twitter">
                  <Twitter className="h-4 w-4" />
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Marketplace</h4>
              <ul className="space-y-2.5 text-sm">
                <li className="hover:text-white transition-colors cursor-pointer">Browse Products</li>
                <li className="hover:text-white transition-colors cursor-pointer">Categories</li>
                <li className="hover:text-white transition-colors cursor-pointer">Top Sellers</li>
                <li className="hover:text-white transition-colors cursor-pointer">New Arrivals</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Smart Pricing</h4>
              <ul className="space-y-2.5 text-sm">
                <li className="hover:text-white transition-colors cursor-pointer flex items-center gap-1.5">
                  <Cpu className="h-3 w-3 text-[#4a7dff]" /> How It Works
                </li>
                <li className="hover:text-white transition-colors cursor-pointer">Gradient Boosting</li>
                <li className="hover:text-white transition-colors cursor-pointer">Market Analytics</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Contact</h4>
              <ul className="space-y-2.5 text-sm">
                <li className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-gray-500" />
                  Maseru, Lesotho
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-gray-500" />
                  +266 2231 0000
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-gray-500" />
                  hello@lesonline.store
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="container mx-auto px-4 py-6 flex flex-col md:flex-row items-center justify-between text-xs text-gray-500">
            <span>&copy; 2026 LesOnline. All rights reserved.</span>
            <span className="mt-2 md:mt-0 flex items-center gap-1.5">
              Powered by <Cpu className="h-3 w-3 text-[#4a7dff]" /> AI Dynamic Pricing
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}