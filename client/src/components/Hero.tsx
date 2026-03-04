import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, BarChart3, TrendingUp } from "lucide-react";
import { Link } from "wouter";

export function Hero() {
  return (
    <div className="relative bg-slate-900 text-white overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-20 bg-gradient-to-br from-primary/30 to-transparent"></div>
      
      <div className="container relative z-10 mx-auto px-4 py-16 md:py-24 lg:py-32">
        <div className="max-w-2xl">
            <div className="bg-primary text-primary-foreground font-bold text-sm px-3 py-1 rounded-full mb-6 inline-block">
              Dynamic Pricing Platform for Lesotho
            </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold tracking-tight mb-6">
            Smart Pricing for <br/>
            <span className="text-primary">Every E-commerce Business</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-200 mb-8 max-w-lg">
            Register your business, manage your products, and let our Gradient Boosting model optimize your prices in Lesotho Maloti (LSL).
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/auth">
              <Button size="lg" className="text-base h-12 px-8" data-testid="button-get-started">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/auth">
              <Button size="lg" variant="secondary" className="text-base h-12 px-8 bg-white/10 text-white hover:bg-white/20 border-white/10 border" data-testid="button-sign-in-hero">
                Sign In to Dashboard
              </Button>
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-3 gap-6 border-t border-white/10 pt-8">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-primary" />
              <div className="text-sm">
                <div className="font-bold">Secure Platform</div>
                <div className="text-slate-400">Your data, your business</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-primary" />
              <div className="text-sm">
                <div className="font-bold">Sales Analytics</div>
                <div className="text-slate-400">Track performance</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div className="text-sm">
                <div className="font-bold text-white">Gradient Boosting</div>
                <div className="text-slate-400">AI-powered pricing</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
