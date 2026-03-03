import { Link, useLocation } from "wouter";
import { Search, ShoppingCart, User, Menu, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function Navbar() {
  const [location] = useLocation();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center gap-4">
        {/* Logo */}
        <Link href="/">
          <a className="flex items-center gap-2 mr-4 cursor-pointer">
            <div className="bg-primary text-primary-foreground font-bold text-lg px-2 py-1 rounded">
              LSO
            </div>
            <span className="font-heading font-bold text-2xl tracking-tight hidden sm:block text-foreground">
              LESonline.Store
            </span>
          </a>
        </Link>

        {/* Categories Button (Desktop) */}
        <Button variant="outline" className="hidden md:flex gap-2">
          <Menu className="h-4 w-4" />
          Categories
        </Button>

        {/* Search Bar - Alibaba style (Input group with select) */}
        <div className="flex-1 max-w-2xl hidden sm:flex">
          <div className="flex w-full items-center space-x-0 rounded-md border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <div className="px-3 py-2 border-r bg-muted/50 text-sm text-muted-foreground whitespace-nowrap hidden lg:block">
              Products
            </div>
            <Input 
              type="text" 
              placeholder="What are you looking for..." 
              className="border-0 focus-visible:ring-0 rounded-none shadow-none flex-1"
            />
            <Button size="icon" className="rounded-l-none h-auto py-2.5 px-6 w-auto">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 ml-auto">
          
          <Link href="/dashboard">
            <Button variant={location === '/dashboard' ? 'secondary' : 'ghost'} className="gap-2 hidden md:flex">
              <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-200">New</Badge>
              Retailer Dashboard
            </Button>
          </Link>

          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500"></span>
          </Button>

          <Link href="/cart">
            <Button variant="ghost" size="icon" className="relative cursor-pointer">
              <ShoppingCart className="h-5 w-5 text-muted-foreground" />
              <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">2</Badge>
            </Button>
          </Link>

          <Button variant="ghost" className="gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <span className="hidden lg:inline text-sm font-medium">Sign In</span>
          </Button>
        </div>
      </div>
      
      {/* Mobile Search Bar */}
      <div className="sm:hidden px-4 pb-3">
        <div className="flex w-full items-center space-x-2">
          <Input type="text" placeholder="Search products..." className="flex-1" />
          <Button size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
