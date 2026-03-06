import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect, useCallback } from "react";

const slides = [
  {
    title: "Shop Smarter with AI-Powered Pricing",
    subtitle: "Lesotho's #1 Online Marketplace",
    description: "300+ real products with intelligent pricing powered by our Gradient Boosting model.",
    cta: "Shop Now",
    ctaLink: "#products",
    bg: "from-[#0E1F6C] via-[#162680] to-[#0a1550]",
  },
  {
    title: "Electronics & Gadgets",
    subtitle: "Latest Tech Deals",
    description: "Find the best prices on smartphones, headphones, smartwatches and more.",
    cta: "Browse Electronics",
    ctaLink: "#products",
    bg: "from-[#1a1a2e] via-[#16213e] to-[#0f3460]",
  },
  {
    title: "Home & Living Essentials",
    subtitle: "Transform Your Space",
    description: "Quality home products from trusted Lesotho suppliers at competitive prices.",
    cta: "Explore Home",
    ctaLink: "#products",
    bg: "from-[#2d1b69] via-[#1e1250] to-[#0E1F6C]",
  },
  {
    title: "Fashion & Clothing",
    subtitle: "Style for Everyone",
    description: "Discover the latest fashion trends with dynamic market-driven pricing.",
    cta: "Shop Fashion",
    ctaLink: "#products",
    bg: "from-[#0E1F6C] via-[#1b3a8a] to-[#0d2b5e]",
  },
  {
    title: "Free Delivery in Maseru",
    subtitle: "Fast & Reliable Shipping",
    description: "Order today and get free delivery on orders over M500 within Maseru.",
    cta: "Start Shopping",
    ctaLink: "#products",
    bg: "from-[#0a2647] via-[#144272] to-[#0E1F6C]",
  },
];

export function Hero() {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % slides.length);
  }, []);

  const prev = useCallback(() => {
    setCurrent((c) => (c - 1 + slides.length) % slides.length);
  }, []);

  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next]);

  const slide = slides[current];

  return (
    <div className="relative overflow-hidden" data-testid="hero-slideshow">
      <div
        className={`bg-gradient-to-r ${slide.bg} text-white transition-all duration-700 ease-in-out`}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.08) 0%, transparent 40%)',
          }} />
        </div>

        <div className="container relative z-10 mx-auto px-4 py-16 md:py-24 lg:py-28">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white text-sm px-4 py-1.5 rounded-full mb-6 border border-white/20">
              <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              {slide.subtitle}
            </div>

            <h1 className="text-3xl md:text-5xl lg:text-6xl font-heading font-bold tracking-tight mb-6 leading-tight">
              {slide.title}
            </h1>

            <p className="text-base md:text-lg text-white/80 mb-8 max-w-lg leading-relaxed">
              {slide.description}
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link href={slide.ctaLink}>
                <Button size="lg" className="text-base h-12 px-8 bg-white text-[#0E1F6C] hover:bg-white/90 font-semibold" data-testid="button-hero-cta">
                  {slide.cta}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/auth">
                <Button size="lg" variant="outline" className="text-base h-12 px-8 border-white/30 text-white hover:bg-white/10 bg-transparent" data-testid="button-hero-sell">
                  Start Selling
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <button
          onClick={prev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full p-2 text-white transition-colors"
          data-testid="button-slide-prev"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={next}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full p-2 text-white transition-colors"
          data-testid="button-slide-next"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all duration-300 ${i === current ? "w-8 bg-white" : "w-2 bg-white/40 hover:bg-white/60"}`}
              data-testid={`button-slide-dot-${i}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
