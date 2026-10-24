import { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp, Calendar, BarChart3, Award, CreditCard, Layers,
  ArrowUp, ArrowDown, Minus, DollarSign, ShoppingCart, Receipt,
} from 'lucide-react';
import {
  reportsApi,
  type DailySalesPoint,
  type MonthlySalesPoint,
  type BestSellerItem,
  type CategorySalesItem,
  type PaymentMethodSales,
  type ReportSummary,
} from '@/lib/api';
import { formatCurrency, formatDate, paymentLabel } from '@/lib/format';

type Tab = 'daily' | 'monthly' | 'bestsellers' | 'category' | 'payment';

const tabs: { id: Tab; label: string; icon: typeof Calendar }[] = [
  { id: 'daily', label: 'Daily Sales', icon: Calendar },
  { id: 'monthly', label: 'Monthly Sales', icon: BarChart3 },
  { id: 'bestsellers', label: 'Best Sellers', icon: Award },
  { id: 'category', label: 'By Category', icon: Layers },
  { id: 'payment', label: 'Payment Methods', icon: CreditCard },
];

function pctChange(current: number, previous: number): { value: number; up: boolean; flat: boolean } {
  if (previous === 0) {
    return { value: current > 0 ? 100 : 0, up: current > 0, flat: current === 0 };
  }
  const change = ((current - previous) / previous) * 100;
  return { value: Math.abs(Math.round(change * 10) / 10), up: change > 0, flat: Math.abs(change) < 0.05 };
}

function BarChart({ data, valueKey, labelKey, colorClass }: {
  data: { label: string; revenue: number; order_count: number }[];
  valueKey: 'revenue' | 'order_count';
  labelKey: string;
  colorClass: string;
}) {
  const values = data.map((d) => d[valueKey] as number);
  const maxVal = Math.max(...values, 1);
  const [hovered, setHovered] = useState<number | null>(null);

  // Show at most 12 bars on mobile, all on desktop
  const displayData = data.length > 15 ? data.filter((_, i) => i % Math.ceil(data.length / 15) === 0 || i === data.length - 1) : data;

  return (
    <div>
      <div className="flex items-end gap-1 sm:gap-2 h-48 px-2">
        {displayData.map((d, i) => {
          const val = d[valueKey] as number;
          const heightPct = (val / maxVal) * 100;
          return (
            <div
              key={i}
              className="flex-1 relative group flex flex-col items-center justify-end h-full"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {hovered === i && (
                <div className="absolute -top-16 z-10 bg-stone-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl pointer-events-none">
                  <p className="font-bold">{d.label}</p>
                  <p>{formatCurrency(d.revenue)}</p>
                  <p className="text-stone-300">{d.order_count} orders</p>
                </div>
              )}
              <div
                className={`w-full rounded-t transition-all duration-300 ${colorClass} ${
                  hovered === i ? 'opacity-100 scale-y-105' : 'opacity-80'
                }`}
                style={{ height: `${Math.max(heightPct, 2)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 sm:gap-2 px-2 mt-2">
        {displayData.map((d, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="text-[10px] text-stone-400 font-medium">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, change, subtitle }: {
  label: string;
  value: string;
  icon: typeof DollarSign;
  change?: { value: number; up: boolean; flat: boolean };
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
          <Icon className="w-5 h-5 text-amber-700" />
        </div>
        {change && !change.flat && (
          <div className={`flex items-center gap-1 text-xs font-semibold ${change.up ? 'text-green-600' : 'text-red-500'}`}>
            {change.up ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
            {change.value}%
          </div>
        )}
        {change && change.flat && (
          <div className="flex items-center gap-1 text-xs font-semibold text-stone-400">
            <Minus className="w-3.5 h-3.5" />
            0%
          </div>
        )}
      </div>
      <p className="text-stone-500 text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-stone-900">{value}</p>
      {subtitle && <p className="text-xs text-stone-400 mt-1">{subtitle}</p>}
    </div>
  );
}

export function SalesReports() {
  const [activeTab, setActiveTab] = useState<Tab>('daily');
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [daily, setDaily] = useState<DailySalesPoint[]>([]);
  const [monthly, setMonthly] = useState<MonthlySalesPoint[]>([]);
  const [bestSellers, setBestSellers] = useState<BestSellerItem[]>([]);
  const [categories, setCategories] = useState<CategorySalesItem[]>([]);
  const [payments, setPayments] = useState<PaymentMethodSales[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sum, dly, mon, bs, cat, pay] = await Promise.all([
        reportsApi.summary(),
        reportsApi.daily(),
        reportsApi.monthly(),
        reportsApi.bestSellers(10),
        reportsApi.category(),
        reportsApi.payment(),
      ]);
      setSummary(sum);
      setDaily(dly);
      setMonthly(mon);
      setBestSellers(bs);
      setCategories(cat);
      setPayments(pay);
    } catch (err) {
      setError('Failed to load reports');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const monthChange = summary ? pctChange(summary.month_revenue, summary.last_month_revenue) : null;
  const ordersChange = summary ? pctChange(summary.month_orders, summary.last_month_orders) : null;

  const dailyTotal = daily.reduce((s, d) => s + d.revenue, 0);
  const dailyOrders = daily.reduce((s, d) => s + d.order_count, 0);
  const monthlyTotal = monthly.reduce((s, m) => s + m.revenue, 0);
  const monthlyOrders = monthly.reduce((s, m) => s + m.order_count, 0);

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-stone-900">Sales Reports</h2>
        <p className="text-stone-500 text-sm">Track performance across daily, monthly, and product breakdowns</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
          {error}
        </div>
      )}

      {/* Summary KPI cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Today"
            value={formatCurrency(summary.today_revenue)}
            icon={DollarSign}
            subtitle={`${summary.today_orders} orders`}
          />
          <StatCard
            label="This Week"
            value={formatCurrency(summary.week_revenue)}
            icon={ShoppingCart}
            subtitle={`${summary.week_orders} orders`}
          />
          <StatCard
            label="This Month"
            value={formatCurrency(summary.month_revenue)}
            icon={TrendingUp}
            change={monthChange || undefined}
            subtitle={`${summary.month_orders} orders`}
          />
          <StatCard
            label="Avg Order Value"
            value={formatCurrency(summary.avg_order_value)}
            icon={Receipt}
            change={ordersChange || undefined}
            subtitle={`${summary.all_time_orders} total orders`}
          />
        </div>
      )}

      {/* Best day highlight */}
      {summary && summary.best_day_date && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6 text-stone-900" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-stone-900">Best Sales Day</p>
            <p className="text-xs text-stone-500">{formatDate(summary.best_day_date)} · {summary.best_day_orders} orders</p>
          </div>
          <p className="text-xl font-bold text-amber-700">{formatCurrency(summary.best_day_revenue)}</p>
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-stone-900 text-white'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'daily' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-stone-200 p-4">
              <p className="text-xs text-stone-500 uppercase tracking-wider mb-1">30-Day Revenue</p>
              <p className="text-xl font-bold text-stone-900">{formatCurrency(dailyTotal)}</p>
            </div>
            <div className="bg-white rounded-xl border border-stone-200 p-4">
              <p className="text-xs text-stone-500 uppercase tracking-wider mb-1">30-Day Orders</p>
              <p className="text-xl font-bold text-stone-900">{dailyOrders}</p>
            </div>
            <div className="bg-white rounded-xl border border-stone-200 p-4">
              <p className="text-xs text-stone-500 uppercase tracking-wider mb-1">Daily Average</p>
              <p className="text-xl font-bold text-stone-900">{formatCurrency(dailyTotal / 30)}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h3 className="font-bold text-stone-900 mb-1">Daily Revenue — Last 30 Days</h3>
            <p className="text-xs text-stone-400 mb-4">Hover over bars to see details</p>
            {daily.length > 0 ? (
              <BarChart data={daily} valueKey="revenue" labelKey="label" colorClass="bg-amber-500" />
            ) : (
              <p className="text-stone-400 text-sm py-12 text-center">No sales data yet</p>
            )}
          </div>
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Date</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Orders</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Subtotal</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Tax</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Discount</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {[...daily].reverse().map((d) => (
                    <tr key={d.date} className="hover:bg-stone-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-stone-900">{d.label}</td>
                      <td className="px-4 py-3 text-sm text-stone-600 text-right">{d.order_count}</td>
                      <td className="px-4 py-3 text-sm text-stone-600 text-right">{formatCurrency(d.subtotal)}</td>
                      <td className="px-4 py-3 text-sm text-stone-600 text-right">{formatCurrency(d.tax)}</td>
                      <td className="px-4 py-3 text-sm text-green-600 text-right">{d.discount > 0 ? `-${formatCurrency(d.discount)}` : '—'}</td>
                      <td className="px-4 py-3 text-sm font-bold text-stone-900 text-right">{formatCurrency(d.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'monthly' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-stone-200 p-4">
              <p className="text-xs text-stone-500 uppercase tracking-wider mb-1">12-Month Revenue</p>
              <p className="text-xl font-bold text-stone-900">{formatCurrency(monthlyTotal)}</p>
            </div>
            <div className="bg-white rounded-xl border border-stone-200 p-4">
              <p className="text-xs text-stone-500 uppercase tracking-wider mb-1">12-Month Orders</p>
              <p className="text-xl font-bold text-stone-900">{monthlyOrders}</p>
            </div>
            <div className="bg-white rounded-xl border border-stone-200 p-4">
              <p className="text-xs text-stone-500 uppercase tracking-wider mb-1">Monthly Average</p>
              <p className="text-xl font-bold text-stone-900">{formatCurrency(monthlyTotal / 12)}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h3 className="font-bold text-stone-900 mb-1">Monthly Revenue — Last 12 Months</h3>
            <p className="text-xs text-stone-400 mb-4">Hover over bars to see details</p>
            {monthly.length > 0 ? (
              <BarChart data={monthly} valueKey="revenue" labelKey="label" colorClass="bg-blue-500" />
            ) : (
              <p className="text-stone-400 text-sm py-12 text-center">No sales data yet</p>
            )}
          </div>
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Month</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Orders</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Subtotal</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Tax</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Discount</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {[...monthly].reverse().map((m) => (
                    <tr key={m.month} className="hover:bg-stone-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-stone-900">{m.label}</td>
                      <td className="px-4 py-3 text-sm text-stone-600 text-right">{m.order_count}</td>
                      <td className="px-4 py-3 text-sm text-stone-600 text-right">{formatCurrency(m.subtotal)}</td>
                      <td className="px-4 py-3 text-sm text-stone-600 text-right">{formatCurrency(m.tax)}</td>
                      <td className="px-4 py-3 text-sm text-green-600 text-right">{m.discount > 0 ? `-${formatCurrency(m.discount)}` : '—'}</td>
                      <td className="px-4 py-3 text-sm font-bold text-stone-900 text-right">{formatCurrency(m.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'bestsellers' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-stone-900">Top 10 Best Sellers</h3>
            </div>
            {bestSellers.length === 0 ? (
              <p className="text-stone-400 text-sm py-12 text-center">No sales data yet</p>
            ) : (
              <div className="space-y-3">
                {bestSellers.map((item, idx) => {
                  const maxQty = bestSellers[0]?.qty_sold || 1;
                  const barWidth = (item.qty_sold / maxQty) * 100;
                  return (
                    <div key={idx} className="flex items-center gap-4">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                        idx === 0 ? 'bg-amber-500 text-stone-900' :
                        idx === 1 ? 'bg-stone-300 text-stone-700' :
                        idx === 2 ? 'bg-orange-300 text-orange-800' :
                        'bg-stone-100 text-stone-500'
                      }`}>
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-stone-900 truncate">{item.product_name}</p>
                          <span className="text-sm font-bold text-stone-900 ml-2 shrink-0">{formatCurrency(item.revenue)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-400 rounded-full transition-all duration-500"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <span className="text-xs text-stone-400 shrink-0 w-20 text-right">{item.qty_sold} sold</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {bestSellers.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-stone-50 border-b border-stone-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">#</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Product</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Unit Price</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Qty Sold</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Orders</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {bestSellers.map((item, idx) => (
                      <tr key={idx} className="hover:bg-stone-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-stone-500">{idx + 1}</td>
                        <td className="px-4 py-3 text-sm font-medium text-stone-900">{item.product_name}</td>
                        <td className="px-4 py-3 text-sm text-stone-600 text-right">{formatCurrency(item.unit_price)}</td>
                        <td className="px-4 py-3 text-sm font-bold text-stone-900 text-right">{item.qty_sold}</td>
                        <td className="px-4 py-3 text-sm text-stone-600 text-right">{item.order_count}</td>
                        <td className="px-4 py-3 text-sm font-bold text-stone-900 text-right">{formatCurrency(item.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'category' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-5 h-5 text-blue-500" />
              <h3 className="font-bold text-stone-900">Sales by Category</h3>
            </div>
            {categories.length === 0 ? (
              <p className="text-stone-400 text-sm py-12 text-center">No sales data yet</p>
            ) : (
              <div className="space-y-4">
                {categories.map((cat, idx) => {
                  const maxRev = categories[0]?.revenue || 1;
                  const barWidth = (cat.revenue / maxRev) * 100;
                  return (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div>
                          <p className="text-sm font-medium text-stone-900">{cat.category}</p>
                          <p className="text-xs text-stone-400">{cat.qty_sold} sold · {cat.product_count} products</p>
                        </div>
                        <span className="text-sm font-bold text-stone-900">{formatCurrency(cat.revenue)}</span>
                      </div>
                      <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'payment' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {payments.length === 0 ? (
              <div className="col-span-3 bg-white rounded-xl border border-stone-200 p-8 text-center">
                <CreditCard className="w-10 h-10 text-stone-300 mx-auto mb-3" />
                <p className="text-stone-400 text-sm">No sales data yet</p>
              </div>
            ) : (
              payments.map((pay, idx) => {
                const totalRev = payments.reduce((s, p) => s + p.revenue, 0);
                const share = totalRev > 0 ? (pay.revenue / totalRev) * 100 : 0;
                const colors = [
                  { bg: 'bg-green-50', text: 'text-green-700', bar: 'bg-green-500', icon: DollarSign },
                  { bg: 'bg-blue-50', text: 'text-blue-700', bar: 'bg-blue-500', icon: CreditCard },
                  { bg: 'bg-purple-50', text: 'text-purple-700', bar: 'bg-purple-500', icon: ShoppingCart },
                ];
                const c = colors[idx % colors.length];
                const Icon = c.icon;
                return (
                  <div key={idx} className="bg-white rounded-xl border border-stone-200 p-5">
                    <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center mb-3`}>
                      <Icon className={`w-5 h-5 ${c.text}`} />
                    </div>
                    <p className="text-stone-500 text-xs uppercase tracking-wider mb-1 ">{paymentLabel(pay.method)}</p>
                    <p className="text-2xl font-bold text-stone-900">{formatCurrency(pay.revenue)}</p>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-stone-400 mb-1">
                        <span>{pay.order_count} orders</span>
                        <span>{Math.round(share)}% share</span>
                      </div>
                      <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                        <div className={`h-full ${c.bar} rounded-full transition-all duration-500`} style={{ width: `${share}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
