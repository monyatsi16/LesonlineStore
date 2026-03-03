import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { Link } from "wouter";
import type { Product } from "@shared/schema";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link href={`/product/${product.id}`}>
      <Card className="group h-full overflow-hidden hover:shadow-lg transition-shadow cursor-pointer border-border/60" data-testid={`card-product-${product.id}`}>
        <div className="relative aspect-square overflow-hidden bg-white">
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute top-2 left-2">
            <Badge variant="secondary" className="bg-white/90 backdrop-blur text-xs font-medium">
              MOQ: {product.moq} {product.moq > 1 ? 'pcs' : 'pc'}
            </Badge>
          </div>
        </div>
        
        <CardContent className="p-4">
          <div className="flex items-center gap-1 mb-2">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span className="text-xs font-medium text-slate-700">{product.rating}</span>
            <span className="text-xs text-muted-foreground">({product.reviews})</span>
          </div>
          
          <h3 className="font-medium text-sm leading-snug line-clamp-2 mb-2 group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          
          <div className="mb-2">
            <span className="text-lg font-bold text-foreground" data-testid={`text-price-${product.id}`}>
              M{product.price.toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground ml-1">/ piece</span>
          </div>

          <p className="text-xs text-muted-foreground truncate">
            {product.supplier}
          </p>
        </CardContent>
        
        <CardFooter className="p-4 pt-0">
          <Button variant="outline" className="w-full text-xs h-8" data-testid={`button-contact-${product.id}`}>
            Contact Supplier
          </Button>
        </CardFooter>
      </Card>
    </Link>
  );
}
