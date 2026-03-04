import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Product } from "@shared/schema";

export default function Home() {
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      <Hero />
      
      <main className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-heading font-bold text-foreground" data-testid="text-section-title">Featured Products</h2>
            <p className="text-muted-foreground text-sm mt-1">Browse our catalog of premium home appliances</p>
          </div>
          <Button variant="ghost" className="hidden sm:flex" data-testid="link-view-all">
            View All <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading products...</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        <div className="mt-16 grid md:grid-cols-2 gap-6">
          <div className="bg-slate-100 rounded-lg p-8 flex flex-col justify-center">
            <h3 className="text-2xl font-bold font-heading mb-2">Request for Quotation (RFQ)</h3>
            <p className="text-muted-foreground mb-6">Connect with Lesotho-based manufacturers and suppliers directly.</p>
            <Button className="w-fit" data-testid="button-post-rfq">Post Request</Button>
          </div>
          <div className="bg-orange-50 rounded-lg p-8 flex flex-col justify-center border border-orange-100">
            <h3 className="text-2xl font-bold font-heading mb-2 text-orange-900">Lesotho Trade Assurance</h3>
            <p className="text-orange-800/80 mb-6">Protect your local and regional orders from payment to delivery.</p>
            <Button variant="outline" className="w-fit border-orange-200 text-orange-700 hover:bg-orange-100 hover:text-orange-900" data-testid="button-trade-assurance">Learn More</Button>
          </div>
        </div>
      </main>

      <footer className="bg-slate-900 text-slate-300 py-12 mt-12 border-t border-slate-800">
        <div className="container mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h4 className="font-bold text-white mb-4">Customer Services</h4>
            <ul className="space-y-2 text-sm">
              <li>Help Center</li>
              <li>Contact Us</li>
              <li>Report Abuse</li>
              <li>Submit a Dispute</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">About Us</h4>
            <ul className="space-y-2 text-sm">
              <li>About LESonline</li>
              <li>Corporate Responsibility</li>
              <li>Careers</li>
              <li>Press Center</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Trade Services</h4>
            <ul className="space-y-2 text-sm">
              <li>Trade Assurance</li>
              <li>Business Identity</li>
              <li>Logistics Service</li>
              <li>Letter of Credit</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Sell on LESonline</h4>
            <ul className="space-y-2 text-sm">
              <li>Supplier Membership</li>
              <li>Learning Center</li>
              <li>Partner Program</li>
            </ul>
          </div>
        </div>
        <div className="container mx-auto px-4 mt-12 pt-8 border-t border-slate-800 text-center text-xs text-slate-500">
          &copy; 2026 LESonline.Store All rights reserved.
        </div>
      </footer>
    </div>
  );
}
