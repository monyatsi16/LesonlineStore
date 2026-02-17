import heroImage from '../assets/hero-banner.png';
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, Globe, TrendingUp } from "lucide-react";

export function Hero() {
  return (
    <div className="relative bg-slate-900 text-white overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-40">
        <img 
          src={heroImage} 
          alt="Global Trade" 
          className="w-full h-full object-cover"
        />
      </div>
      
      <div className="container relative z-10 mx-auto px-4 py-16 md:py-24 lg:py-32">
        <div className="max-w-2xl">
          <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-white backdrop-blur-md mb-6">
            <span className="flex h-2 w-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
            Global Trading Platform
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold tracking-tight mb-6">
            The Leading B2B <br/>
            <span className="text-primary">E-commerce Marketplace</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-200 mb-8 max-w-lg">
            Source from millions of suppliers, optimize your pricing with AI, and manage logistics all in one place.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <Button size="lg" className="text-base h-12 px-8">
              Start Sourcing
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="secondary" className="text-base h-12 px-8 bg-white/10 text-white hover:bg-white/20 border-white/10 border">
              Learn about AI Pricing
            </Button>
          </div>

          <div className="mt-12 grid grid-cols-3 gap-6 border-t border-white/10 pt-8">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-primary" />
              <div className="text-sm">
                <div className="font-bold">Trade Assurance</div>
                <div className="text-slate-400">Protect your orders</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Globe className="h-8 w-8 text-primary" />
              <div className="text-sm">
                <div className="font-bold">Global Logistics</div>
                <div className="text-slate-400">Ship anywhere</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div className="text-sm">
                <div className="font-bold">Smart Pricing</div>
                <div className="text-slate-400">Data-driven insights</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
