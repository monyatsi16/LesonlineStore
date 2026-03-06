import { Link, useLocation } from "wouter";
import { Search, ShoppingCart, User, LogOut, LayoutDashboard, Shield, BarChart3, Menu, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect, useRef } from "react";

function useCartCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => {
      try {
        const items = JSON.parse(localStorage.getItem("lesonline_cart") || "[]");
        setCount(items.length);
      } catch { setCount(0); }
    };
    update();
    window.addEventListener("cart-updated", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("cart-updated", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return count;
}

const navCategories = [
  { label: "All Products", href: "/" },
  { label: "Electronics", href: "/?category=electronics" },
  { label: "Accessories", href: "/?category=accessories" },
  { label: "Wearables", href: "/?category=wearables" },
  { label: "Textiles", href: "/?category=textiles" },
];

export function Navbar() {
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const cartCount = useCartCount();
  const isAdmin = user?.role === "admin";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shopDropdownOpen, setShopDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShopDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setSearchOpen(false);
  }, [location]);

  return (
    <>
      <div className="w-full bg-[hsl(230,77%,18%)] text-white text-center py-1.5 text-xs sm:text-sm tracking-wide" data-testid="announcement-bar">
        <span>Free shipping on orders over R500 · AI-Powered Dynamic Pricing</span>
      </div>

      <header className="sticky top-0 z-50 w-full bg-[hsl(230,77%,23%)] shadow-lg" data-testid="navbar-header">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-white p-1"
                data-testid="button-mobile-menu"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>

            <Link href="/" className="flex items-center gap-2 cursor-pointer no-underline shrink-0" data-testid="link-logo">
              <div className="bg-white text-[hsl(230,77%,23%)] font-bold text-lg px-2.5 py-1 rounded">
                LO
              </div>
              <span className="font-heading font-bold text-xl tracking-tight text-white hidden sm:block">
                LesOnline
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1 mx-8" data-testid="nav-main">
              <div className="relative" ref={dropdownRef}>
                <button
                  className="flex items-center gap-1 text-white/90 hover:text-white px-3 py-2 text-sm font-medium transition-colors"
                  onClick={() => setShopDropdownOpen(!shopDropdownOpen)}
                  data-testid="button-shop-dropdown"
                >
                  Shop
                  <ChevronDown className={`h-4 w-4 transition-transform ${shopDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {shopDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-md shadow-xl py-2 min-w-[200px] z-50" data-testid="dropdown-shop">
                    {navCategories.map((cat) => (
                      <Link
                        key={cat.label}
                        href={cat.href}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-[hsl(230,77%,23%)] no-underline transition-colors"
                        onClick={() => setShopDropdownOpen(false)}
                        data-testid={`link-category-${cat.label.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {cat.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {isAuthenticated && (
                <>
                  <Link href="/dashboard" data-testid="link-dashboard">
                    <span className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors no-underline ${location === '/dashboard' ? 'text-white' : 'text-white/90 hover:text-white'}`}>
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboard
                    </span>
                  </Link>
                  <Link href="/analytics" data-testid="link-analytics">
                    <span className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors no-underline ${location === '/analytics' ? 'text-white' : 'text-white/90 hover:text-white'}`}>
                      <BarChart3 className="h-4 w-4" />
                      Analytics
                    </span>
                  </Link>
                  {isAdmin && (
                    <Link href="/admin" data-testid="link-admin">
                      <span className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors no-underline ${location === '/admin' ? 'text-white' : 'text-white/90 hover:text-white'}`}>
                        <Shield className="h-4 w-4" />
                        Admin
                      </span>
                    </Link>
                  )}
                </>
              )}
            </nav>

            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="text-white/90 hover:text-white p-2 transition-colors"
                data-testid="button-search-toggle"
              >
                <Search className="h-5 w-5" />
              </button>

              <Link href="/cart" data-testid="link-cart">
                <span className="relative text-white/90 hover:text-white p-2 inline-flex transition-colors">
                  <ShoppingCart className="h-5 w-5" />
                  {cartCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full h-4.5 w-4.5 flex items-center justify-center min-w-[18px] px-1" data-testid="text-cart-count">
                      {cartCount}
                    </span>
                  )}
                </span>
              </Link>

              {isAuthenticated ? (
                <div className="flex items-center gap-1">
                  <div className="hidden lg:flex flex-col items-end mr-1">
                    <span className="text-sm font-medium text-white" data-testid="text-user-name">{user?.name}</span>
                    <div className="flex items-center gap-1">
                      {isAdmin && <Badge className="bg-red-500/80 text-white border-0 text-[9px] h-4 px-1">Admin</Badge>}
                      <span className="text-[10px] text-white/60" data-testid="text-business-name">{user?.businessName}</span>
                    </div>
                  </div>
                  <button
                    onClick={logout}
                    className="text-white/90 hover:text-white p-2 transition-colors"
                    data-testid="button-logout"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <Link href="/auth" data-testid="button-sign-in">
                  <span className="text-white/90 hover:text-white p-2 inline-flex items-center gap-1.5 transition-colors">
                    <User className="h-5 w-5" />
                    <span className="hidden lg:inline text-sm font-medium">Sign In</span>
                  </span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {searchOpen && (
          <div className="border-t border-white/10 bg-[hsl(230,77%,20%)]" data-testid="search-bar-expanded">
            <div className="container mx-auto px-4 py-3">
              <div className="flex items-center gap-2 max-w-2xl mx-auto">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    className="w-full bg-white/10 text-white placeholder-white/50 border border-white/20 rounded-md py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                    autoFocus
                    data-testid="input-search"
                  />
                </div>
                <button
                  onClick={() => setSearchOpen(false)}
                  className="text-white/70 hover:text-white p-1"
                  data-testid="button-close-search"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-[hsl(230,77%,20%)]" data-testid="mobile-menu">
            <nav className="container mx-auto px-4 py-3 flex flex-col gap-1">
              <p className="text-white/50 text-xs uppercase tracking-wider px-3 pt-2 pb-1">Shop</p>
              {navCategories.map((cat) => (
                <Link
                  key={cat.label}
                  href={cat.href}
                  className="text-white/90 hover:text-white hover:bg-white/10 px-3 py-2 rounded text-sm no-underline transition-colors"
                  data-testid={`mobile-link-category-${cat.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {cat.label}
                </Link>
              ))}

              {isAuthenticated && (
                <>
                  <div className="border-t border-white/10 my-2" />
                  <Link href="/dashboard" className="flex items-center gap-2 text-white/90 hover:text-white hover:bg-white/10 px-3 py-2 rounded text-sm no-underline transition-colors" data-testid="mobile-link-dashboard">
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Link>
                  <Link href="/analytics" className="flex items-center gap-2 text-white/90 hover:text-white hover:bg-white/10 px-3 py-2 rounded text-sm no-underline transition-colors" data-testid="mobile-link-analytics">
                    <BarChart3 className="h-4 w-4" />
                    Analytics
                  </Link>
                  {isAdmin && (
                    <Link href="/admin" className="flex items-center gap-2 text-white/90 hover:text-white hover:bg-white/10 px-3 py-2 rounded text-sm no-underline transition-colors" data-testid="mobile-link-admin">
                      <Shield className="h-4 w-4" />
                      Admin
                    </Link>
                  )}
                </>
              )}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
