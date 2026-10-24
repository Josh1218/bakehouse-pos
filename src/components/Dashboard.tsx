import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, ShoppingCart, DollarSign, Package, Clock } from 'lucide-react';
import { dashboardApi, type DashboardStats as ApiStats } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/format';
import type { Order } from '@/types';

interface DashboardStats {
  todayRevenue: number;
  todayOrders: number;
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  lowStockCount: number;
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    todayRevenue: 0,
    todayOrders: 0,
    totalRevenue: 0,
    totalOrders: 0,
    totalProducts: 0,
    lowStockCount: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number; revenue: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const data: ApiStats = await dashboardApi.get();
      setStats({
        todayRevenue: data.today_revenue,
        todayOrders: data.today_orders,
        totalRevenue: data.total_revenue,
        totalOrders: data.total_orders,
        totalProducts: data.total_products,
        lowStockCount: data.low_stock_count,
      });
      setRecentOrders(data.recent_orders);
      setTopProducts(data.top_products);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
    {
      label: "Today's Revenue",
      value: formatCurrency(stats.todayRevenue),
      icon: DollarSign,
      color: 'bg-green-500',
      bg: 'bg-green-50',
      text: 'text-green-700',
    },
    {
      label: "Today's Orders",
      value: stats.todayOrders.toString(),
      icon: ShoppingCart,
      color: 'bg-amber-500',
      bg: 'bg-amber-50',
      text: 'text-amber-700',
    },
    {
      label: 'Total Revenue',
      value: formatCurrency(stats.totalRevenue),
      icon: TrendingUp,
      color: 'bg-blue-500',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
    },
    {
      label: 'Total Products',
      value: stats.totalProducts.toString(),
      icon: Package,
      color: 'bg-stone-700',
      bg: 'bg-stone-100',
      text: 'text-stone-700',
    },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-stone-900">Dashboard</h2>
        <p className="text-stone-500 text-sm">Overview of your bakery's performance</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-xl border border-stone-200 p-5">
              <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${card.text}`} />
              </div>
              <p className="text-stone-500 text-xs uppercase tracking-wider mb-1">{card.label}</p>
              <p className="text-2xl font-bold text-stone-900">{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Low stock alert */}
      {stats.lowStockCount > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <Package className="w-5 h-5 text-orange-600 shrink-0" />
          <p className="text-sm text-orange-700">
            <span className="font-bold">{stats.lowStockCount}</span> product{stats.lowStockCount !== 1 ? 's' : ''} running low on stock (less than 5 remaining)
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent orders */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-stone-400" />
            <h3 className="font-bold text-stone-900">Recent Orders</h3>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-stone-400 text-sm py-8 text-center">No orders yet</p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between py-2 border-b border-stone-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-stone-900">{order.order_number}</p>
                    <p className="text-xs text-stone-400">
                      {order.customer_name || 'Walk-in'} · {formatDateTime(order.created_at)}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-stone-900">{formatCurrency(Number(order.total))}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top products */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-stone-400" />
            <h3 className="font-bold text-stone-900">Top Products</h3>
          </div>
          {topProducts.length === 0 ? (
            <p className="text-stone-400 text-sm py-8 text-center">No sales data yet</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((product, idx) => (
                <div key={product.name} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-900 truncate">{product.name}</p>
                    <p className="text-xs text-stone-400">{product.qty} sold</p>
                  </div>
                  <span className="text-sm font-bold text-stone-900">{formatCurrency(product.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
