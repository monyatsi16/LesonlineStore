import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, BarChart3, TrendingUp, ShoppingBag } from "lucide-react";
import { Link } from "wouter";

export function Hero() {
  return (
    <div className="relative bg-slate-900 text-white overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-20 bg-gradient-to-br from-primary/30 to-transparent"></div>

      <div className="container relative z-10 mx-auto px-4 py-16 md:py-24 lg:py-28">
        <div className="max-w-2xl">
            <div className="bg-primary text-primary-foreground font-bold text-sm px-3 py-1 rounded-full mb-6 inline-block">
              LesOnline — Lesotho's #1 Online Store
            </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold tracking-tight mb-6">
            Shop Smarter with <br/>
            <span className="text-primary">AI-Powered Pricing</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-200 mb-8 max-w-lg">
            Lesotho's marketplace with 300+ real products. Our Gradient Boosting model trained on LesOnline data optimizes prices using real orders, stock levels, and market analytics.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/auth">
              <Button size="lg" className="text-base h-12 px-8" data-testid="button-get-started">
                Start Selling
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="#products">
              <Button size="lg" variant="secondary" className="text-base h-12 px-8 bg-white/10 text-white hover:bg-white/20 border-white/10 border" data-testid="button-browse">
                <ShoppingBag className="mr-2 h-4 w-4" />
                Browse Products
              </Button>
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-3 gap-6 border-t border-white/10 pt-8">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-primary" />
              <div className="text-sm">
                <div className="font-bold">331 Real Products</div>
                <div className="text-slate-400">Scraped from LesOnline</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-primary" />
              <div className="text-sm">
                <div className="font-bold">15 Categories</div>
                <div className="text-slate-400">Market data trained</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div className="text-sm">
                <div className="font-bold text-white">5-Tree GB Model</div>
                <div className="text-slate-400">Real pricing AI</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
