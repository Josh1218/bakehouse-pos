import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ShoppingCart, Package, Receipt, LayoutDashboard, Tag, Croissant, BarChart3, LogOut } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Login } from '@/components/Login';
import type { Page } from '@/types';
import { POSTerminal } from '@/components/POSTerminal';
import { ProductsManager } from '@/components/ProductsManager';
import { OrdersHistory } from '@/components/OrdersHistory';
import { Dashboard } from '@/components/Dashboard';
import { CategoriesManager } from '@/components/CategoriesManager';
import { SalesReports } from '@/components/SalesReports';

const navItems: { page: Page; label: string; icon: typeof ShoppingCart }[] = [
  { page: 'pos', label: 'Point of Sale', icon: ShoppingCart },
  { page: 'products', label: 'Products', icon: Package },
  { page: 'orders', label: 'Orders', icon: Receipt },
  { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { page: 'reports', label: 'Sales Reports', icon: BarChart3 },
  { page: 'categories', label: 'Categories', icon: Tag },
];

const shortLabels: Record<Page, string> = {
  pos: 'Sell',
  products: 'Products',
  orders: 'Orders',
  dashboard: 'Home',
  reports: 'Reports',
  categories: 'Tags',
};

function PosApp({ email, onSignOut }: { email: string | undefined; onSignOut: () => void }) {
  const [currentPage, setCurrentPage] = useState<Page>('pos');

  const renderPage = () => {
    switch (currentPage) {
      case 'pos':
        return <POSTerminal />;
      case 'products':
        return <ProductsManager />;
      case 'orders':
        return <OrdersHistory />;
      case 'dashboard':
        return <Dashboard />;
      case 'reports':
        return <SalesReports />;
      case 'categories':
        return <CategoriesManager />;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-stone-50 text-stone-900">
      {/* Phone: slim top bar (normal flow, never overlaps content) */}
      <header className="md:hidden shrink-0 bg-stone-900 text-stone-100 flex items-center gap-2 px-4 h-12">
        <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
          <Croissant className="w-5 h-5 text-stone-900" />
        </div>
        <span className="font-bold flex-1">Bakehouse POS</span>
        <button onClick={onSignOut} aria-label="Sign out" className="p-2 text-stone-300 hover:text-white">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Tablet: icon-only side rail. Desktop: full sidebar with labels. */}
      <aside className="hidden md:flex w-20 lg:w-64 flex-col bg-stone-900 text-stone-100 shrink-0">
        <div className="flex items-center justify-center lg:justify-start gap-3 px-3 lg:px-6 py-5 border-b border-stone-700">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
            <Croissant className="w-6 h-6 text-stone-900" />
          </div>
          <div className="hidden lg:block">
            <h1 className="text-lg font-bold leading-tight">Bakehouse</h1>
            <p className="text-xs text-stone-400">POS System</p>
          </div>
        </div>
        <nav className="flex-1 px-2 lg:px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.page;
            return (
              <button
                key={item.page}
                onClick={() => setCurrentPage(item.page)}
                title={item.label}
                aria-label={item.label}
                className={`w-full flex flex-col lg:flex-row items-center justify-center lg:justify-start gap-1 lg:gap-3 px-2 lg:px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-amber-500 text-stone-900'
                    : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="text-[10px] leading-none lg:hidden">{shortLabels[item.page]}</span>
                <span className="hidden lg:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="px-2 lg:px-4 py-3 border-t border-stone-700">
          {email && <p className="hidden lg:block px-2 pb-2 text-xs text-stone-400 truncate">{email}</p>}
          <button
            onClick={onSignOut}
            title="Sign out"
            aria-label="Sign out"
            className="w-full flex items-center justify-center lg:justify-start gap-3 px-2 lg:px-3 py-2.5 rounded-lg text-sm text-stone-300 hover:bg-stone-800 hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="hidden lg:inline">Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main content: always exactly the space left over, scrolls on its own */}
      <main className="flex-1 min-h-0 min-w-0 overflow-auto">{renderPage()}</main>

      {/* Phone: bottom tab bar with icons (normal flow, so nothing hides behind it) */}
      <nav
        className="md:hidden shrink-0 bg-stone-900 border-t border-stone-700 grid grid-cols-6"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = currentPage === item.page;
          return (
            <button
              key={item.page}
              onClick={() => setCurrentPage(item.page)}
              aria-label={item.label}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                active ? 'text-amber-400' : 'text-stone-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] leading-none">{shortLabels[item.page]}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function SetupNeeded() {
  return (
    <div className="min-h-[100dvh] bg-stone-50 flex items-center justify-center p-6">
      <div className="max-w-md bg-white border border-stone-200 rounded-2xl p-6 space-y-3 text-stone-700">
        <h1 className="text-xl font-bold text-stone-900">Supabase is not connected yet</h1>
        <p className="text-sm">
          This build is missing <code className="bg-stone-100 px-1 rounded">VITE_SUPABASE_URL</code> and{' '}
          <code className="bg-stone-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code>.
        </p>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>Running locally: copy <code className="bg-stone-100 px-1 rounded">.env.example</code> to <code className="bg-stone-100 px-1 rounded">.env</code> and fill it in, then restart <code className="bg-stone-100 px-1 rounded">npm run dev</code>.</li>
          <li>On GitHub Pages: add both as repository secrets, then re-run the deploy workflow.</li>
        </ul>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setChecking(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) return <SetupNeeded />;

  if (checking) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-stone-50">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return <Login />;

  return <PosApp email={session.user.email} onSignOut={() => void supabase.auth.signOut()} />;
}
