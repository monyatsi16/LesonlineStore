import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BrainCircuit, BarChart3, Store, Shield, TrendingUp, Users } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      <Hero />
      
      <main className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-heading font-bold text-foreground mb-3" data-testid="text-section-title">
            How SmartPrice Works
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            A dynamic pricing platform built for Lesotho's e-commerce businesses. Register your store, add your products, and let our Gradient Boosting model find the best prices.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <Card className="text-center p-6">
            <CardContent className="pt-6">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Store className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-bold mb-2">1. Register Your Business</h3>
              <p className="text-sm text-muted-foreground">
                Create an account with your business name. We set up your dashboard with demo products so you can see the platform in action.
              </p>
            </CardContent>
          </Card>
          <Card className="text-center p-6">
            <CardContent className="pt-6">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <BrainCircuit className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-bold mb-2">2. Run the Pricing Model</h3>
              <p className="text-sm text-muted-foreground">
                Our Gradient Boosting algorithm analyses demand, inventory, and competitor factors to recommend optimal prices in Maloti (LSL).
              </p>
            </CardContent>
          </Card>
          <Card className="text-center p-6">
            <CardContent className="pt-6">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <TrendingUp className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-bold mb-2">3. Grow Your Revenue</h3>
              <p className="text-sm text-muted-foreground">
                Apply price recommendations with one click. Track sales, monitor inventory, and watch your business grow.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <div className="bg-slate-100 rounded-lg p-8 flex flex-col justify-center">
            <h3 className="text-2xl font-bold font-heading mb-2">Built for Lesotho</h3>
            <p className="text-muted-foreground mb-4">
              All prices in Lesotho Maloti (LSL). Designed for local retailers, wholesalers, and online stores across Maseru and beyond.
            </p>
            <div className="flex gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-primary" />
                <span>Secure & Private</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-primary" />
                <span>Multi-Business</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <BarChart3 className="h-4 w-4 text-primary" />
                <span>Real Analytics</span>
              </div>
            </div>
          </div>
          <div className="bg-primary/5 rounded-lg p-8 flex flex-col justify-center border border-primary/10">
            <h3 className="text-2xl font-bold font-heading mb-2 text-primary">Ready to Start?</h3>
            <p className="text-muted-foreground mb-6">
              Register your e-commerce business and get instant access to your personalised pricing dashboard.
            </p>
            <Link href="/auth">
              <Button className="w-fit" data-testid="button-register-cta">Create Free Account</Button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="bg-slate-900 text-slate-300 py-12 mt-12 border-t border-slate-800">
        <div className="container mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h4 className="font-bold text-white mb-4">Platform</h4>
            <ul className="space-y-2 text-sm">
              <li>How It Works</li>
              <li>Pricing Model</li>
              <li>Features</li>
              <li>FAQ</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">For Businesses</h4>
            <ul className="space-y-2 text-sm">
              <li>Retailers</li>
              <li>Wholesalers</li>
              <li>Online Stores</li>
              <li>Manufacturers</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Resources</h4>
            <ul className="space-y-2 text-sm">
              <li>Documentation</li>
              <li>API Reference</li>
              <li>Case Studies</li>
              <li>Blog</li>
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
          &copy; 2026 SmartPrice Lesotho. Dynamic pricing for every e-commerce business.
        </div>
      </footer>
    </div>
  );
}
