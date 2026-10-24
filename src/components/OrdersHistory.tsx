import { useEffect, useState, useCallback } from 'react';
import { Search, Eye, Receipt } from 'lucide-react';
import { ordersApi } from '@/lib/api';
import { formatCurrency, formatDateTime, paymentLabel } from '@/lib/format';
import type { Order, OrderItem } from '@/types';

export function OrdersHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ordersApi.list();
      setOrders(data);
    } catch (err) {
      console.error('Failed to load orders:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const viewOrder = async (order: Order) => {
    setSelectedOrder(order);
    setLoadingItems(true);
    try {
      const fullOrder = await ordersApi.get(order.id);
      setOrderItems(fullOrder.order_items || []);
    } catch (err) {
      setOrderItems([]);
    }
    setLoadingItems(false);
  };

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      (o.customer_name || '').toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-stone-900">Orders</h2>
        <p className="text-stone-500 text-sm">
          {orders.length} orders | {formatCurrency(totalRevenue)} total revenue
        </p>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
        <input
          type="text"
          placeholder="Search by order number or customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-stone-400">
          <Receipt className="w-12 h-12 mb-3" />
          <p>No orders yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Order #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Payment</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Total</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-stone-900">{order.order_number}</td>
                    <td className="px-4 py-3 text-sm text-stone-600">{order.customer_name || 'Walk-in'}</td>
                    <td className="px-4 py-3 text-sm text-stone-500">{formatDateTime(order.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-stone-100 text-stone-600 capitalize">
                        {paymentLabel(order.payment_method)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-stone-900 text-right">
                      {formatCurrency(Number(order.total))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => viewOrder(order)}
                        className="inline-flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order detail modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedOrder(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-stone-100">
              <h2 className="text-xl font-bold text-stone-900">Order Details</h2>
              <p className="text-sm text-stone-500 mt-1">{selectedOrder.order_number}</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-stone-400 text-xs uppercase">Customer</p>
                  <p className="font-medium text-stone-900">{selectedOrder.customer_name || 'Walk-in'}</p>
                </div>
                <div>
                  <p className="text-stone-400 text-xs uppercase">Date</p>
                  <p className="font-medium text-stone-900">{formatDateTime(selectedOrder.created_at)}</p>
                </div>
                <div>
                  <p className="text-stone-400 text-xs uppercase">Payment</p>
                  <p className="font-medium text-stone-900">{paymentLabel(selectedOrder.payment_method)}</p>
                </div>
                <div>
                  <p className="text-stone-400 text-xs uppercase">Status</p>
                  <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700 capitalize">
                    {selectedOrder.status}
                  </span>
                </div>
              </div>

              <div className="border-t border-stone-100 pt-4">
                <h3 className="text-sm font-semibold text-stone-900 mb-3">Items</h3>
                {loadingItems ? (
                  <div className="flex justify-center py-4">
                    <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {orderItems.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm py-1.5">
                        <span className="text-stone-600">
                          {item.product_name} <span className="text-stone-400">x{item.quantity}</span>
                        </span>
                        <span className="font-medium text-stone-900">{formatCurrency(Number(item.line_total))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-stone-100 pt-4 space-y-1.5 text-sm">
                <div className="flex justify-between text-stone-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(Number(selectedOrder.subtotal))}</span>
                </div>
                {Number(selectedOrder.discount) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(Number(selectedOrder.discount))}</span>
                  </div>
                )}
                {Number(selectedOrder.tax_amount) > 0 && (
                  <div className="flex justify-between text-stone-600">
                    <span>Tax</span>
                    <span>{formatCurrency(Number(selectedOrder.tax_amount))}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-stone-900 pt-2 border-t border-stone-100">
                  <span>Total</span>
                  <span>{formatCurrency(Number(selectedOrder.total))}</span>
                </div>
                {selectedOrder.notes && (
                  <p className="text-xs text-stone-500 pt-2">{selectedOrder.notes}</p>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-stone-100">
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-full py-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
