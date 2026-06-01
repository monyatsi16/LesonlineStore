import { Link, useLocation } from "wouter";
import { Search, ShoppingCart, LogOut, Lock, LayoutDashboard, Shield, BarChart3, Menu, X, ChevronDown } from "lucide-react";
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

const kitchenAppliances = [
  "Built-in Hobs",
  "Built-in Ovens",
  "Microwaves",
  "Stoves",
  "Gas Cooktops",
  "Range Hoods",
  "Kitchen Sinks & Mixers",
  "Dishwashers & Washing Machines",
  "Fridge & Freezer",
  "Refrigerators",
  "Ovens",
];

const shoeCategories = [
  "Men's Casual Shoes",
  "Men's Shoes",
];

export function Navbar() {
  const [location, setLocation] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const cartCount = useCartCount();
  const isAdmin = user?.role === "admin";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [kitchenOpen, setKitchenOpen] = useState(false);
  const [shoesOpen, setShoesOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const kitchenRef = useRef<HTMLDivElement>(null);
  const shoesRef = useRef<HTMLDivElement>(null);
  const searchBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (kitchenRef.current && !kitchenRef.current.contains(e.target as Node)) {
        setKitchenOpen(false);
      }
      if (shoesRef.current && !shoesRef.current.contains(e.target as Node)) {
        setShoesOpen(false);
      }
      if (searchBarRef.current && !searchBarRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setKitchenOpen(false);
    setShoesOpen(false);
    setSearchOpen(false);
  }, [location]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  const handleCategoryClick = (category: string) => {
    const url = `/?category=${encodeURIComponent(category)}`;
    window.history.pushState({}, "", url);
    window.dispatchEvent(new CustomEvent("select-category", { detail: category }));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchOpen(false);
    const url = `/?search=${encodeURIComponent(searchQuery.trim())}`;
    window.history.pushState({}, "", url);
    window.dispatchEvent(new CustomEvent("navbar-search", { detail: searchQuery.trim() }));
    if (location !== "/") {
      setLocation("/");
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("navbar-search", { detail: searchQuery.trim() }));
      }, 300);
    }
    setSearchQuery("");
  };

  return (
    <>
      <div className="w-full bg-[#c45e72] text-white text-center py-2 text-sm font-medium tracking-wide" data-testid="announcement-bar">
        We deliver Nationwide ( LESOTHO)
      </div>

      <header className="sticky top-0 z-50 w-full bg-white border-b border-gray-200 shadow-sm" data-testid="navbar-header">
        <div className="container mx-auto px-4">
          <div className="flex items-center h-16 gap-6">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-700 p-1 lg:hidden"
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>

            <Link href="/" className="flex items-center gap-2 cursor-pointer no-underline shrink-0" data-testid="link-logo">
              <div className="bg-black text-white px-3 py-2 rounded-sm">
                <div className="font-heading font-bold text-sm leading-tight tracking-wide">LESonline</div>
                <div className="text-[7px] tracking-[0.2em] text-white/70 uppercase">appliances & more</div>
              </div>
            </Link>

            <nav className="hidden lg:flex items-center gap-0 flex-1" data-testid="nav-main">
              <div className="relative" ref={kitchenRef}>
                <button
                  className="flex items-center gap-1 text-gray-800 hover:text-black px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap"
                  onClick={() => { setKitchenOpen(!kitchenOpen); setShoesOpen(false); }}
                  data-testid="button-kitchen-dropdown"
                >
                  Kitchen Appliances
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${kitchenOpen ? 'rotate-180' : ''}`} />
                </button>
                {kitchenOpen && (
                  <div className="absolute top-full left-0 mt-0.5 bg-white rounded-md shadow-xl border border-gray-100 py-2 min-w-[240px] z-50" data-testid="dropdown-kitchen">
                    {kitchenAppliances.map((cat) => (
                      <Link
                        key={cat}
                        href="/"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#0E1F6C] no-underline transition-colors"
                        onClick={() => { setKitchenOpen(false); handleCategoryClick(cat); }}
                        data-testid={`link-kitchen-${cat.toLowerCase().replace(/[\s&]+/g, '-')}`}
                      >
                        {cat}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <Link
                href="/"
                className="text-gray-800 hover:text-black px-3 py-2 text-sm font-medium transition-colors no-underline whitespace-nowrap underline decoration-1 underline-offset-4"
                onClick={() => handleCategoryClick("Fireplaces")}
                data-testid="link-braai-fireplaces"
              >
                Braai & Fireplaces
              </Link>

              <div className="relative" ref={shoesRef}>
                <button
                  className="flex items-center gap-1 text-gray-800 hover:text-black px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap"
                  onClick={() => { setShoesOpen(!shoesOpen); setKitchenOpen(false); }}
                  data-testid="button-shoes-dropdown"
                >
                  Shoes
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${shoesOpen ? 'rotate-180' : ''}`} />
                </button>
                {shoesOpen && (
                  <div className="absolute top-full left-0 mt-0.5 bg-white rounded-md shadow-xl border border-gray-100 py-2 min-w-[200px] z-50" data-testid="dropdown-shoes">
                    {shoeCategories.map((cat) => (
                      <Link
                        key={cat}
                        href="/"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#0E1F6C] no-underline transition-colors"
                        onClick={() => { setShoesOpen(false); handleCategoryClick(cat); }}
                        data-testid={`link-shoes-${cat.toLowerCase().replace(/[\s']+/g, '-')}`}
                      >
                        {cat}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <Link
                href="/"
                className="text-gray-800 hover:text-black px-3 py-2 text-sm font-medium transition-colors no-underline whitespace-nowrap"
                onClick={() => handleCategoryClick("Chairs")}
                data-testid="link-chairs"
              >
                Chairs
              </Link>

              <Link
                href="/"
                className="text-gray-800 hover:text-black px-3 py-2 text-sm font-medium transition-colors no-underline whitespace-nowrap"
                onClick={() => handleCategoryClick("Geysers")}
                data-testid="link-solar-geyser"
              >
                Solar geyser
              </Link>

              <Link
                href="/"
                className="text-gray-800 hover:text-black px-3 py-2 text-sm font-medium transition-colors no-underline whitespace-nowrap"
                onClick={() => handleCategoryClick("Bathroom")}
                data-testid="link-bathroom"
              >
                Bathroom
              </Link>

              <Link
                href="/track"
                className="text-gray-800 hover:text-black px-3 py-2 text-sm font-medium transition-colors no-underline whitespace-nowrap"
                data-testid="link-track-order"
              >
                Track Order
              </Link>

              <Link
                href="/orders"
                className="text-gray-800 hover:text-black px-3 py-2 text-sm font-medium transition-colors no-underline whitespace-nowrap"
                data-testid="link-order-history"
              >
                Order History
              </Link>

              {isAuthenticated && isAdmin && (
                <>
                  <div className="w-px h-5 bg-gray-200 mx-2" />
                  <Link href="/dashboard" data-testid="link-dashboard">
                    <span className={`flex items-center gap-1.5 px-2 py-2 text-sm font-medium transition-colors no-underline whitespace-nowrap ${location === '/dashboard' ? 'text-[#0E1F6C]' : 'text-gray-600 hover:text-gray-900'}`}>
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboard
                    </span>
                  </Link>
                  <Link href="/analytics" data-testid="link-analytics">
                    <span className={`flex items-center gap-1.5 px-2 py-2 text-sm font-medium transition-colors no-underline whitespace-nowrap ${location === '/analytics' ? 'text-[#0E1F6C]' : 'text-gray-600 hover:text-gray-900'}`}>
                      <BarChart3 className="h-4 w-4" />
                      Analytics
                    </span>
                  </Link>
                  <Link href="/admin" data-testid="link-admin">
                    <span className={`flex items-center gap-1.5 px-2 py-2 text-sm font-medium transition-colors no-underline whitespace-nowrap ${location === '/admin' ? 'text-[#0E1F6C]' : 'text-gray-600 hover:text-gray-900'}`}>
                      <Shield className="h-4 w-4" />
                      Admin
                    </span>
                  </Link>
                </>
              )}

              {isAuthenticated && !isAdmin && (
                <>
                  <div className="w-px h-5 bg-gray-200 mx-2" />
                  <Link href="/dashboard" data-testid="link-dashboard">
                    <span className={`flex items-center gap-1.5 px-2 py-2 text-sm font-medium transition-colors no-underline whitespace-nowrap ${location === '/dashboard' ? 'text-[#0E1F6C]' : 'text-gray-600 hover:text-gray-900'}`}>
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboard
                    </span>
                  </Link>
                  <Link href="/analytics" data-testid="link-analytics">
                    <span className={`flex items-center gap-1.5 px-2 py-2 text-sm font-medium transition-colors no-underline whitespace-nowrap ${location === '/analytics' ? 'text-[#0E1F6C]' : 'text-gray-600 hover:text-gray-900'}`}>
                      <BarChart3 className="h-4 w-4" />
                      Analytics
                    </span>
                  </Link>
                </>
              )}
            </nav>

            <div className="flex items-center gap-3 ml-auto">
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="text-gray-700 hover:text-black transition-colors"
                data-testid="button-search"
              >
                <Search className="h-5 w-5" />
              </button>

              {isAuthenticated ? (
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 text-gray-600 hover:text-red-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50 text-sm font-medium"
                  title="Sign out and return to home page"
                  data-testid="button-logout"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              ) : (
                <Link href="/auth" className="text-gray-700 hover:text-black transition-colors" data-testid="button-admin-login" title="Admin / Seller Login">
                  <Lock className="h-4.5 w-4.5" />
                </Link>
              )}

              <Link href="/cart" className="relative text-gray-700 hover:text-black transition-colors" data-testid="link-cart">
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center" data-testid="text-cart-count">
                    {cartCount}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>

        {searchOpen && (
          <div ref={searchBarRef} className="border-t border-gray-100 bg-white py-3 px-4" data-testid="search-bar">
            <form onSubmit={handleSearchSubmit} className="container mx-auto flex items-center gap-2">
              <div className="flex-1 flex items-center rounded-xl border border-gray-200 bg-gray-50 shadow-sm px-3">
                <Search className="h-4 w-4 text-gray-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search products on LesOnline..."
                  className="flex-1 bg-transparent border-0 outline-none py-2.5 px-2 text-sm text-gray-900 placeholder:text-gray-400"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-navbar-search"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="text-gray-400 hover:text-gray-600 p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="bg-[#0E1F6C] hover:bg-[#0E1F6C]/90 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
                data-testid="button-search-submit"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="text-gray-500 hover:text-gray-700 p-2"
              >
                <X className="h-5 w-5" />
              </button>
            </form>
          </div>
        )}

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-100 bg-white" data-testid="mobile-menu">
            <nav className="container mx-auto px-4 py-3 flex flex-col gap-0.5">
              <p className="text-gray-400 text-xs uppercase tracking-wider px-3 pt-2 pb-1 font-semibold">Kitchen Appliances</p>
              {kitchenAppliances.map((cat) => (
                <Link
                  key={cat}
                  href="/"
                  className="text-gray-700 hover:text-[#0E1F6C] hover:bg-gray-50 px-3 py-2 rounded text-sm no-underline transition-colors"
                  onClick={() => { setMobileMenuOpen(false); handleCategoryClick(cat); }}
                  data-testid={`mobile-link-${cat.toLowerCase().replace(/[\s&]+/g, '-')}`}
                >
                  {cat}
                </Link>
              ))}

              <div className="border-t border-gray-100 my-2" />
              <p className="text-gray-400 text-xs uppercase tracking-wider px-3 pt-1 pb-1 font-semibold">More Categories</p>

              <Link href="/" className="text-gray-700 hover:text-[#0E1F6C] hover:bg-gray-50 px-3 py-2 rounded text-sm no-underline transition-colors" onClick={() => { setMobileMenuOpen(false); handleCategoryClick("Fireplaces"); }}>
                Braai & Fireplaces
              </Link>
              {shoeCategories.map((cat) => (
                <Link
                  key={cat}
                  href="/"
                  className="text-gray-700 hover:text-[#0E1F6C] hover:bg-gray-50 px-3 py-2 rounded text-sm no-underline transition-colors"
                  onClick={() => { setMobileMenuOpen(false); handleCategoryClick(cat); }}
                >
                  {cat}
                </Link>
              ))}
              <Link href="/" className="text-gray-700 hover:text-[#0E1F6C] hover:bg-gray-50 px-3 py-2 rounded text-sm no-underline transition-colors" onClick={() => { setMobileMenuOpen(false); handleCategoryClick("Chairs"); }}>
                Chairs
              </Link>
              <Link href="/" className="text-gray-700 hover:text-[#0E1F6C] hover:bg-gray-50 px-3 py-2 rounded text-sm no-underline transition-colors" onClick={() => { setMobileMenuOpen(false); handleCategoryClick("Geysers"); }}>
                Solar geyser
              </Link>
              <Link href="/" className="text-gray-700 hover:text-[#0E1F6C] hover:bg-gray-50 px-3 py-2 rounded text-sm no-underline transition-colors" onClick={() => { setMobileMenuOpen(false); handleCategoryClick("Bathroom"); }}>
                Bathroom
              </Link>
              <Link href="/track" className="text-gray-700 hover:text-[#0E1F6C] hover:bg-gray-50 px-3 py-2 rounded text-sm no-underline transition-colors" onClick={() => setMobileMenuOpen(false)}>
                Track Order
              </Link>
              <Link href="/orders" className="text-gray-700 hover:text-[#0E1F6C] hover:bg-gray-50 px-3 py-2 rounded text-sm no-underline transition-colors" onClick={() => setMobileMenuOpen(false)}>
                Order History
              </Link>

              {isAuthenticated && isAdmin && (
                <>
                  <div className="border-t border-gray-100 my-2" />
                  <Link href="/dashboard" className="flex items-center gap-2 text-gray-700 hover:text-[#0E1F6C] hover:bg-gray-50 px-3 py-2 rounded text-sm no-underline transition-colors" data-testid="mobile-link-dashboard">
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Link>
                  <Link href="/analytics" className="flex items-center gap-2 text-gray-700 hover:text-[#0E1F6C] hover:bg-gray-50 px-3 py-2 rounded text-sm no-underline transition-colors" data-testid="mobile-link-analytics">
                    <BarChart3 className="h-4 w-4" />
                    Analytics
                  </Link>
                  <Link href="/admin" className="flex items-center gap-2 text-gray-700 hover:text-[#0E1F6C] hover:bg-gray-50 px-3 py-2 rounded text-sm no-underline transition-colors" data-testid="mobile-link-admin">
                    <Shield className="h-4 w-4" />
                    Admin
                  </Link>
                  <div className="border-t border-gray-100 my-2" />
                  <button
                    onClick={() => { setMobileMenuOpen(false); logout(); }}
                    className="flex items-center gap-2 text-red-600 hover:bg-red-50 px-3 py-2 rounded text-sm font-medium transition-colors w-full text-left"
                    data-testid="mobile-button-logout"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </>
              )}

              {isAuthenticated && !isAdmin && (
                <>
                  <div className="border-t border-gray-100 my-2" />
                  <Link href="/dashboard" className="flex items-center gap-2 text-gray-700 hover:text-[#0E1F6C] hover:bg-gray-50 px-3 py-2 rounded text-sm no-underline transition-colors" data-testid="mobile-link-dashboard">
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Link>
                  <Link href="/analytics" className="flex items-center gap-2 text-gray-700 hover:text-[#0E1F6C] hover:bg-gray-50 px-3 py-2 rounded text-sm no-underline transition-colors" data-testid="mobile-link-analytics">
                    <BarChart3 className="h-4 w-4" />
                    Analytics
                  </Link>
                  <div className="border-t border-gray-100 my-2" />
                  <button
                    onClick={() => { setMobileMenuOpen(false); logout(); }}
                    className="flex items-center gap-2 text-red-600 hover:bg-red-50 px-3 py-2 rounded text-sm font-medium transition-colors w-full text-left"
                    data-testid="mobile-button-logout"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </>
              )}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
