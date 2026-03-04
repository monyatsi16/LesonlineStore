import { Link, useLocation } from "wouter";
import { Search, ShoppingCart, User, Menu, Bell, LogOut, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

export function Navbar() {
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 mr-4 cursor-pointer no-underline">
            <div className="bg-primary text-primary-foreground font-bold text-lg px-2 py-1 rounded">
              SP
            </div>
            <span className="font-heading font-bold text-2xl tracking-tight hidden sm:block text-foreground">
              SmartPrice
            </span>
        </Link>

        <div className="flex-1 max-w-2xl hidden sm:flex">
          <div className="flex w-full items-center space-x-0 rounded-md border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <Input 
              type="text" 
              placeholder="Search products..." 
              className="border-0 focus-visible:ring-0 rounded-none shadow-none flex-1"
              data-testid="input-search"
            />
            <Button size="icon" className="rounded-l-none h-auto py-2.5 px-6 w-auto">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {isAuthenticated && (
            <Link href="/dashboard">
              <Button variant={location === '/dashboard' ? 'secondary' : 'ghost'} className="gap-2 hidden md:flex" data-testid="link-dashboard">
                <LayoutDashboard className="h-4 w-4" />
                My Dashboard
              </Button>
            </Link>
          )}

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <div className="hidden lg:flex flex-col items-end mr-1">
                <span className="text-sm font-medium" data-testid="text-user-name">{user?.name}</span>
                <span className="text-[10px] text-muted-foreground" data-testid="text-business-name">{user?.businessName}</span>
              </div>
              <Button variant="ghost" className="gap-2" onClick={logout} data-testid="button-logout">
                <LogOut className="h-5 w-5 text-muted-foreground" />
                <span className="hidden lg:inline text-sm font-medium">Sign Out</span>
              </Button>
            </div>
          ) : (
            <Link href="/auth">
              <Button variant="ghost" className="gap-2" data-testid="button-sign-in">
                <User className="h-5 w-5 text-muted-foreground" />
                <span className="hidden lg:inline text-sm font-medium">Sign In</span>
              </Button>
            </Link>
          )}
        </div>
      </div>
      
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
