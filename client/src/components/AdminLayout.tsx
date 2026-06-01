import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import {
  Shield,
  BarChart3,
  LogOut,
  Home,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const adminNav = [
  { href: "/admin", label: "Admin Panel", icon: Shield },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

const sellerNav = [
  { href: "/dashboard", label: "Dashboard", icon: Shield },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export function AdminLayout({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: string }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const navItems = isAdmin ? adminNav : sellerNav;

  return (
    <div className="min-h-screen bg-[#f0f2f5] font-sans">
      <div className="flex">
        <aside className="hidden lg:flex flex-col w-64 min-h-screen bg-[#0E1F6C] text-white shrink-0 sticky top-0 h-screen" data-testid="admin-sidebar">
          <div className="p-6 border-b border-white/10">
            <Link href="/" className="no-underline">
              <div className="bg-white text-black px-3 py-2 rounded-sm inline-block">
                <div className="font-heading font-bold text-sm leading-tight tracking-wide">LESonline</div>
                <div className="text-[7px] tracking-[0.2em] text-black/50 uppercase">appliances & more</div>
              </div>
            </Link>
            <div className="mt-3 text-xs text-white/50 uppercase tracking-wider font-semibold">{isAdmin ? "Admin Panel" : "Seller Panel"}</div>
          </div>

          <nav className="flex-1 p-4 space-y-1" data-testid="admin-nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href} className="no-underline">
                  <div
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-white/15 text-white shadow-sm"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                    data-testid={`admin-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                    {isActive && <ChevronRight className="h-4 w-4 ml-auto" />}
                  </div>
                </Link>
              );
            })}

            <div className="border-t border-white/10 my-4" />

            <Link href="/" className="no-underline">
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all" data-testid="admin-nav-storefront">
                <Home className="h-5 w-5" />
                Back to Storefront
              </div>
            </Link>
          </nav>

          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3 mb-3 px-2">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">
                {user?.name?.charAt(0) || "A"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{user?.name || (isAdmin ? "Admin" : "Seller")}</div>
                <div className="text-xs text-white/50 truncate">{user?.email}</div>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-white/70 hover:text-white hover:bg-white/10"
              onClick={logout}
              data-testid="button-admin-logout"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40" data-testid="admin-topbar">
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="lg:hidden">
                  <Link href="/" className="no-underline">
                    <div className="bg-black text-white px-2 py-1 rounded-sm">
                      <div className="font-heading font-bold text-xs leading-tight tracking-wide">LESonline</div>
                    </div>
                  </Link>
                </div>
                <div>
                  <h1 className="text-xl font-heading font-bold text-gray-900" data-testid="text-admin-page-title">{title}</h1>
                  {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <nav className="lg:hidden flex items-center gap-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.href;
                    return (
                      <Link key={item.href} href={item.href} className="no-underline">
                        <div
                          className={`p-2 rounded-lg transition-colors ${
                            isActive
                              ? "bg-[#0E1F6C] text-white"
                              : "text-gray-500 hover:bg-gray-100"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                      </Link>
                    );
                  })}
                </nav>

                <Link href="/" className="no-underline hidden sm:block">
                  <Button variant="outline" size="sm" className="gap-2 text-gray-600" data-testid="button-view-store">
                    <Home className="h-4 w-4" />
                    Storefront
                  </Button>
                </Link>

                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-gray-600 hover:text-red-600 lg:hidden"
                  onClick={logout}
                  data-testid="button-mobile-admin-logout"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </header>

          <main className="p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
