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
import { Star, Search, ShoppingCart, Eye, Filter, TrendingUp, ArrowUpDown, Flame, Package, X } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef } from "react";
import type { Product } from "@shared/schema";

const CATEGORY_ICONS: Record<string, string> = {
  "Electronics": "⚡",
  "Clothing": "👕",
  "Home & Garden": "🏡",
  "Sports": "⚽",
  "Beauty": "💄",
  "Automotive": "🚗",
  "Books": "📚",
  "Food & Beverages": "🍔",
  "Health": "💊",
  "Toys": "🧸",
  "Office": "🖥️",
  "Jewelry": "💍",
  "Pet Supplies": "🐾",
  "Music": "🎵",
  "Art": "🎨",
};

const CATEGORY_COLORS: string[] = [
  "from-blue-500/10 to-blue-600/5 border-blue-200 hover:border-blue-400",
  "from-purple-500/10 to-purple-600/5 border-purple-200 hover:border-purple-400",
  "from-emerald-500/10 to-emerald-600/5 border-emerald-200 hover:border-emerald-400",
  "from-orange-500/10 to-orange-600/5 border-orange-200 hover:border-orange-400",
  "from-pink-500/10 to-pink-600/5 border-pink-200 hover:border-pink-400",
  "from-cyan-500/10 to-cyan-600/5 border-cyan-200 hover:border-cyan-400",
  "from-amber-500/10 to-amber-600/5 border-amber-200 hover:border-amber-400",
  "from-red-500/10 to-red-600/5 border-red-200 hover:border-red-400",
  "from-indigo-500/10 to-indigo-600/5 border-indigo-200 hover:border-indigo-400",
  "from-teal-500/10 to-teal-600/5 border-teal-200 hover:border-teal-400",
];

type SortOption = "default" | "price-low" | "price-high" | "popular" | "rating" | "newest";

function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/product/${product.id}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-all cursor-pointer group h-full" data-testid={`card-product-${product.id}`}>
        <div className="aspect-square bg-slate-50 p-4 relative overflow-hidden">
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-contain group-hover:scale-105 transition-transform"
          />
          {product.stock < 10 && product.stock > 0 && (
            <Badge variant="destructive" className="absolute top-2 right-2 text-[10px]">Low Stock</Badge>
          )}
          {product.stock === 0 && (
            <Badge variant="secondary" className="absolute top-2 right-2 text-[10px]">Out of Stock</Badge>
          )}
        </div>
        <CardContent className="p-4">
          <h3 className="font-medium text-sm line-clamp-2 mb-2 min-h-[2.5rem]" data-testid={`text-product-name-${product.id}`}>
            {product.name}
          </h3>
          <div className="flex items-center gap-1 mb-2">
            <Star className="h-3 w-3 fill-orange-400 text-orange-400" />
            <span className="text-xs font-medium">{product.rating}</span>
            <span className="text-xs text-muted-foreground">({product.reviews})</span>
            <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
              <Eye className="h-3 w-3" />{product.views}
            </span>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-lg font-bold text-primary" data-testid={`text-price-${product.id}`}>
                M{product.price.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground">
                MOQ: {product.moq} {product.moq === 1 ? 'piece' : 'pieces'}
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground text-right">
              {product.supplier}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function CategoryCard({
  category,
  count,
  colorIndex,
  isSelected,
  onClick,
  image,
}: {
  category: string;
  count: number;
  colorIndex: number;
  isSelected: boolean;
  onClick: () => void;
  image?: string;
}) {
  const icon = CATEGORY_ICONS[category] || "📦";
  const color = CATEGORY_COLORS[colorIndex % CATEGORY_COLORS.length];

  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 w-36 md:w-auto rounded-xl border-2 bg-gradient-to-br p-4 text-left transition-all hover:shadow-md ${color} ${isSelected ? "ring-2 ring-primary ring-offset-2 shadow-md" : ""}`}
      data-testid={`card-category-${category}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{icon}</span>
        {image && (
          <img src={image} alt={category} className="h-8 w-8 rounded object-cover" />
        )}
      </div>
      <div className="font-semibold text-sm truncate">{category}</div>
      <div className="text-xs text-muted-foreground">{count} {count === 1 ? "product" : "products"}</div>
    </button>
  );
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/marketplace"],
  });

  const { data: searchResults } = useQuery<Product[]>({
    queryKey: ["/api/marketplace/search", debouncedSearch],
    queryFn: async () => {
      const res = await fetch(`/api/marketplace/search?q=${encodeURIComponent(debouncedSearch)}`);
      return res.json();
    },
    enabled: debouncedSearch.length > 0,
  });

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
  };

  const hasActiveFilters = selectedCategory || sortBy !== "default" || searchQuery;

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      <Hero />

      <main className="container mx-auto px-4 py-8">
        <section className="mb-10" data-testid="section-categories">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-heading font-bold flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Browse Categories
            </h2>
            <span className="text-sm text-muted-foreground">{categories.length} categories</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin md:grid md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 md:overflow-x-visible">
            {categories.map((cat, i) => (
              <CategoryCard
                key={cat.name}
                category={cat.name}
                count={cat.count}
                colorIndex={i}
                isSelected={selectedCategory === cat.name}
                onClick={() =>
                  setSelectedCategory(selectedCategory === cat.name ? null : cat.name)
                }
                image={cat.image}
              />
            ))}
          </div>
        </section>

        {!debouncedSearch && !selectedCategory && trendingProducts.length > 0 && (
          <section className="mb-10" data-testid="section-trending">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="h-5 w-5 text-orange-500" />
              <h2 className="text-xl font-heading font-bold">Trending Now</h2>
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
              <div className="flex w-full items-center rounded-lg border border-input bg-background shadow-sm">
                <Search className="h-4 w-4 ml-3 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search products on LesOnline marketplace..."
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
                <SelectTrigger className="w-[180px]" data-testid="select-sort">
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
                <Button variant="outline" size="sm" onClick={clearFilters} className="h-10" data-testid="button-clear-filters">
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
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
                onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
                data-testid={`button-category-${cat.name}`}
              >
                {cat.name} ({cat.count})
              </Button>
            ))}
          </div>

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-heading font-bold" data-testid="text-products-heading">
              {debouncedSearch
                ? `Results for "${debouncedSearch}"`
                : selectedCategory || "All Products"}
            </h2>
            <span className="text-sm text-muted-foreground" data-testid="text-product-count">
              {filteredAndSorted.length} products
            </span>
          </div>

          {filteredAndSorted.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No products found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery
                  ? "Try a different search term or clear the filters."
                  : "Be the first to list your products!"}
              </p>
              {hasActiveFilters ? (
                <Button onClick={clearFilters} data-testid="button-reset-filters">Reset Filters</Button>
              ) : (
                <Link href="/auth">
                  <Button data-testid="button-list-products">Start Selling on LesOnline</Button>
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

      <footer className="bg-slate-900 text-slate-300 py-12 mt-12 border-t border-slate-800">
        <div className="container mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h4 className="font-bold text-white mb-4">Marketplace</h4>
            <ul className="space-y-2 text-sm">
              <li>Browse Products</li>
              <li>Categories</li>
              <li>Top Sellers</li>
              <li>New Arrivals</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">For Sellers</h4>
            <ul className="space-y-2 text-sm">
              <li>Start Selling</li>
              <li>Pricing Tools</li>
              <li>Seller Dashboard</li>
              <li>Order Management</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Smart Pricing</h4>
            <ul className="space-y-2 text-sm">
              <li>How It Works</li>
              <li>Gradient Boosting</li>
              <li>Market Analytics</li>
              <li>Case Studies</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Contact</h4>
            <ul className="space-y-2 text-sm">
              <li>Support</li>
              <li>Partnerships</li>
              <li>Feedback</li>
            </ul>
          </div>
        </div>
        <div className="container mx-auto px-4 mt-12 pt-8 border-t border-slate-800 text-center text-xs text-slate-500">
          &copy; 2026 LesOnline. Lesotho's smart marketplace with AI-powered pricing.
        </div>
      </footer>
    </div>
  );
}
