import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { ProductCard } from "@/components/ProductCard";
import { PRODUCTS } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      <Hero />
      
      <main className="container mx-auto px-4 py-12">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-heading font-bold text-foreground">Recommended for You</h2>
            <p className="text-muted-foreground text-sm mt-1">Sourced based on your recent activity</p>
          </div>
          <Button variant="ghost" className="hidden sm:flex">
            View All <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
          {PRODUCTS.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
          {/* Duplicate products to fill grid for demo */}
          {PRODUCTS.map((product) => (
            <ProductCard key={`${product.id}-copy`} product={{...product, id: `${product.id}-copy`}} />
          ))}
        </div>

        {/* Categories Banner */}
        <div className="mt-16 grid md:grid-cols-2 gap-6">
          <div className="bg-slate-100 rounded-lg p-8 flex flex-col justify-center">
            <h3 className="text-2xl font-bold font-heading mb-2">Request for Quotation</h3>
            <p className="text-muted-foreground mb-6">One request, multiple quotes. Get the best deal.</p>
            <Button className="w-fit">Post Request</Button>
          </div>
          <div className="bg-orange-50 rounded-lg p-8 flex flex-col justify-center border border-orange-100">
            <h3 className="text-2xl font-bold font-heading mb-2 text-orange-900">Trade Assurance</h3>
            <p className="text-orange-800/80 mb-6">Protect your orders from payment to delivery.</p>
            <Button variant="outline" className="w-fit border-orange-200 text-orange-700 hover:bg-orange-100 hover:text-orange-900">Learn More</Button>
          </div>
        </div>
      </main>

      {/* Footer Demo */}
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
          © 2026 LESonline.Store All rights reserved.
        </div>
      </footer>
    </div>
  );
}
