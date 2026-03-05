import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Star, Search, ShoppingCart, Eye, Filter } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { Product } from "@shared/schema";

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

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/marketplace"],
  });

  const { data: searchResults } = useQuery<Product[]>({
    queryKey: ["/api/marketplace/search", searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/marketplace/search?q=${encodeURIComponent(searchQuery)}`);
      return res.json();
    },
    enabled: searchQuery.length > 0,
  });

  const displayProducts = searchQuery ? (searchResults || []) : allProducts;
  const filteredProducts = selectedCategory
    ? displayProducts.filter(p => p.category === selectedCategory)
    : displayProducts;

  const categories = Array.from(new Set(allProducts.map(p => p.category)));

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      <Hero />

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1">
            <div className="flex w-full items-center rounded-md border border-input bg-background">
              <Input
                type="text"
                placeholder="Search products on LesOnline marketplace..."
                className="border-0 focus-visible:ring-0 shadow-none flex-1"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-marketplace-search"
              />
              <Button size="icon" className="rounded-l-none px-4">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Button
            variant={selectedCategory === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(null)}
            data-testid="button-category-all"
          >
            All
          </Button>
          {categories.map(cat => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
              data-testid={`button-category-${cat}`}
            >
              {cat}
            </Button>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-heading font-bold" data-testid="text-products-heading">
            {searchQuery ? `Results for "${searchQuery}"` : selectedCategory || "All Products"}
          </h2>
          <span className="text-sm text-muted-foreground">{filteredProducts.length} products</span>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No products found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? "Try a different search term." : "Be the first to list your products!"}
            </p>
            <Link href="/auth">
              <Button data-testid="button-list-products">Start Selling on LesOnline</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredProducts.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
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
