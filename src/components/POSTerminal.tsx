import { useEffect, useState, useMemo, useCallback } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingCart, X, Check, CreditCard, Banknote, QrCode } from 'lucide-react';
import { productsApi, categoriesApi, ordersApi } from '@/lib/api';
import { formatCurrency, imageSrc } from '@/lib/format';
import type { Product, Category, CartItem, PaymentMethod } from '@/types';

export function POSTerminal() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [discount, setDiscount] = useState(0);
  const [amountReceived, setAmountReceived] = useState('');
  const [gcashRef, setGcashRef] = useState('');
  const [qrMissing, setQrMissing] = useState(false);
  const [cartOpen, setCartOpen] = useState(false); // phone/tablet cart sheet
  const [customerName, setCustomerName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [orderComplete, setOrderComplete] = useState<{
    orderNumber: string;
    total: number;
    paid: number;
    change: number;
    method: PaymentMethod;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prodData, catData] = await Promise.all([
        productsApi.listActive(),
        categoriesApi.list(),
      ]);
      setProducts(prodData);
      setCategories(catData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !activeCategory || p.category_id === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, activeCategory]);

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    return Math.min(discount, subtotal);
  }, [discount, subtotal]);

  // No tax: total = subtotal - discount (rounded to centavos)
  const total = Math.round((subtotal - discountAmount) * 100) / 100;

  // Payment: GCash is paid exactly (scan the QR); cash uses the amount received
  const paid = paymentMethod === 'cash' ? parseFloat(amountReceived) || 0 : total;
  const change = Math.max(0, Math.round((paid - total) * 100) / 100);
  const shortBy = Math.max(0, Math.round((total - paid) * 100) / 100);
  const canComplete = cart.length > 0 && (paymentMethod !== 'cash' || paid >= total);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const newQty = item.quantity + delta;
          if (newQty > item.product.stock) return item;
          return { ...item, quantity: newQty };
        })
        .filter((item) => item.quantity > 0);
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setCustomerName('');
    setAmountReceived('');
    setGcashRef('');
  };

  const completeOrder = async () => {
    if (!canComplete) return;
    setProcessing(true);
    setError(null);

    try {
      const result = await ordersApi.create({
        customer_name: customerName || null,
        subtotal,
        tax_rate: 0,
        tax_amount: 0,
        discount: discountAmount,
        total,
        payment_method: paymentMethod,
        payment_status: 'paid',
        status: 'completed',
        notes:
          paymentMethod === 'cash'
            ? `Cash received: ${paid.toFixed(2)}; Change: ${change.toFixed(2)}`
            : `GCash paid: ${paid.toFixed(2)}${gcashRef.trim() ? `; Ref: ${gcashRef.trim()}` : ''}`,
        items: cart.map((item) => ({
          product_id: item.product.id,
          product_name: item.product.name,
          unit_price: item.product.price,
          quantity: item.quantity,
          line_total: item.product.price * item.quantity,
        })),
      });

      setOrderComplete({ orderNumber: result.order_number, total, paid, change, method: paymentMethod });
      clearCart();
      setShowCheckout(false);
      setCartOpen(false);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
    }
    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-stone-500 flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          Loading products...
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col lg:flex-row h-full">
      {/* Product selection area */}
      <div className="flex-1 min-h-0 min-w-0 flex flex-col p-3 sm:p-4 lg:p-6 overflow-hidden">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-stone-900">Point of Sale</h2>
          <p className="text-stone-500 text-sm">Tap products to add them to the order</p>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeCategory === null
                ? 'bg-stone-900 text-white'
                : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
            }`}
          >
            All Items
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeCategory === cat.id
                  ? 'bg-stone-900 text-white'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className="flex-1 min-h-0 overflow-auto pb-20 lg:pb-0">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-stone-400">
              <Package className="w-12 h-12 mb-3" />
              <p>No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2 sm:gap-3">
              {filteredProducts.map((product) => {
                const outOfStock = product.stock <= 0;
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={outOfStock}
                    className={`group relative rounded-xl border bg-white overflow-hidden text-left transition-all ${
                      outOfStock
                        ? 'border-stone-200 opacity-50 cursor-not-allowed'
                        : 'border-stone-200 hover:border-amber-400 hover:shadow-lg hover:-translate-y-0.5'
                    }`}
                  >
                    <div className="aspect-square bg-stone-100 overflow-hidden relative">
                      {product.image_url ? (
                        <img
                          src={imageSrc(product.image_url)}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-8 h-8 text-stone-300" />
                        </div>
                      )}
                      {outOfStock && (
                        <div className="absolute inset-0 bg-stone-900/40 flex items-center justify-center">
                          <span className="text-white text-xs font-bold bg-stone-900/80 px-3 py-1 rounded">
                            Out of Stock
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="text-sm font-semibold text-stone-900 line-clamp-1">{product.name}</h3>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-amber-600 font-bold">{formatCurrency(product.price)}</span>
                        <span className="text-xs text-stone-400">{product.stock} left</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cart sidebar */}
      <div
        className={`${cartOpen ? 'flex' : 'hidden'} lg:flex fixed inset-0 z-40 lg:static lg:z-auto lg:w-96 lg:border-l border-stone-200 bg-white flex-col shrink-0`}
      >
        <div className="px-4 py-4 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-stone-700" />
            <h3 className="font-bold text-stone-900">Current Order</h3>
            {cart.length > 0 && (
              <span className="bg-amber-500 text-stone-900 text-xs font-bold px-2 py-0.5 rounded-full">
                {cart.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-stone-400 hover:text-red-500 transition-colors"
                title="Clear cart"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setCartOpen(false)}
              className="lg:hidden p-1 text-stone-500 hover:text-stone-900"
              aria-label="Close order"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-auto px-4 py-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-stone-400 py-10">
              <ShoppingCart className="w-10 h-10 mb-3" />
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs mt-1">Add products to start an order</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-stone-50 border border-stone-100"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-900 truncate">{item.product.name}</p>
                    <p className="text-xs text-stone-500">{formatCurrency(item.product.price)} each</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQty(item.product.id, -1)}
                      className="w-7 h-7 rounded-md bg-white border border-stone-200 flex items-center justify-center hover:bg-stone-100 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                    <button
                      onClick={() => updateQty(item.product.id, 1)}
                      disabled={item.quantity >= item.product.stock}
                      className="w-7 h-7 rounded-md bg-white border border-stone-200 flex items-center justify-center hover:bg-stone-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-right w-16">
                    <p className="text-sm font-bold text-stone-900">
                      {formatCurrency(item.product.price * item.quantity)}
                    </p>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-stone-300 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals and checkout */}
        {cart.length > 0 && (
          <div className="border-t border-stone-200 px-4 py-4 space-y-3" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-stone-600">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-stone-900 pt-2 border-t border-stone-100">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
            <button
              onClick={() => setShowCheckout(true)}
              className="w-full bg-amber-500 hover:bg-amber-600 text-stone-900 font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <CreditCard className="w-5 h-5" />
              Checkout
            </button>
          </div>
        )}
      </div>

      {/* Phone/tablet: floating button that opens the order sheet */}
      {cart.length > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="lg:hidden absolute bottom-3 inset-x-3 z-30 bg-stone-900 text-white rounded-2xl shadow-xl px-4 py-3.5 flex items-center justify-between"
        >
          <span className="flex items-center gap-2 font-semibold">
            <ShoppingCart className="w-5 h-5" />
            View order
            <span className="bg-amber-500 text-stone-900 text-xs font-bold px-2 py-0.5 rounded-full">
              {cart.reduce((n, i) => n + i.quantity, 0)}
            </span>
          </span>
          <span className="font-bold text-amber-400">{formatCurrency(total)}</span>
        </button>
      )}

      {/* Checkout modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowCheckout(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[92dvh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-stone-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-stone-900">Checkout</h2>
              <button onClick={() => setShowCheckout(false)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Order summary */}
              <div className="bg-stone-50 rounded-xl p-4 space-y-2">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex justify-between text-sm">
                    <span className="text-stone-600">
                      {item.product.name} x{item.quantity}
                    </span>
                    <span className="font-medium">{formatCurrency(item.product.price * item.quantity)}</span>
                  </div>
                ))}
                <div className="border-t border-stone-200 pt-2 space-y-1.5">
                  <div className="flex justify-between text-sm text-stone-600">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount</span>
                      <span>-{formatCurrency(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold text-stone-900">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>

              {/* Customer name */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Customer name (optional)</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Walk-in customer"
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>

              {/* Discount */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Discount (PHP)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount || ''}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>

              {/* Payment method */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Payment method</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'cash', label: 'Cash', icon: Banknote },
                    { value: 'gcash', label: 'GCash (QR)', icon: QrCode },
                  ] as const).map((method) => {
                    const Icon = method.icon;
                    return (
                      <button
                        key={method.value}
                        onClick={() => setPaymentMethod(method.value)}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border-2 transition-all ${
                          paymentMethod === method.value
                            ? 'border-amber-500 bg-amber-50 text-amber-700'
                            : 'border-stone-200 text-stone-500 hover:border-stone-300'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-xs font-medium">{method.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Amount received + change (cash only) */}
              {paymentMethod === 'cash' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Amount received (PHP)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-4 py-3 rounded-lg border border-stone-200 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setAmountReceived(total.toFixed(2))}
                        className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-semibold transition-colors"
                      >
                        Exact
                      </button>
                      {[20, 50, 100, 200, 500, 1000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setAmountReceived(String(amt))}
                          className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-colors"
                        >
                          {formatCurrency(amt)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div
                    className={`rounded-xl p-4 flex justify-between items-center ${
                      amountReceived === ''
                        ? 'bg-stone-50 text-stone-500'
                        : shortBy > 0
                        ? 'bg-red-50 text-red-700'
                        : 'bg-green-50 text-green-700'
                    }`}
                  >
                    <span className="text-sm font-medium">
                      {amountReceived !== '' && shortBy > 0 ? 'Still needed' : 'Change'}
                    </span>
                    <span className="text-2xl font-bold">
                      {formatCurrency(amountReceived !== '' && shortBy > 0 ? shortBy : change)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl p-4 bg-blue-50 text-center">
                    <p className="text-sm font-medium text-blue-800 mb-2">Customer scans this QR with GCash</p>
                    {qrMissing ? (
                      <div className="mx-auto w-48 h-48 rounded-lg border-2 border-dashed border-blue-300 flex items-center justify-center text-xs text-blue-700 p-3">
                        No QR image yet. Save your GCash QR as gcash-qr.png (see README).
                      </div>
                    ) : (
                      <img
                        src={`${import.meta.env.BASE_URL}gcash-qr.png`}
                        alt="GCash QR code"
                        onError={() => setQrMissing(true)}
                        className="mx-auto w-48 h-48 object-contain bg-white rounded-lg p-1"
                      />
                    )}
                    <p className="text-xs text-blue-700 mt-2">Amount to pay</p>
                    <p className="text-2xl font-bold text-blue-900">{formatCurrency(total)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">GCash reference no. (optional)</label>
                    <input
                      type="text"
                      value={gcashRef}
                      onChange={(e) => setGcashRef(e.target.value)}
                      placeholder="e.g. 1234 567 890123"
                      className="w-full px-4 py-2.5 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                    <p className="text-xs text-stone-500 mt-1">Press Complete Sale only after you see the payment in your GCash app.</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
                  {error}
                </div>
              )}

              <button
                onClick={completeOrder}
                disabled={processing || !canComplete}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {processing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Complete Sale — {formatCurrency(total)}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success modal */}
      {orderComplete && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full max-h-[92dvh] overflow-auto text-center p-6 sm:p-8">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-stone-900 mb-1">Order Complete!</h2>
            <p className="text-stone-500 text-sm mb-4">{orderComplete.orderNumber}</p>
            <div className="bg-stone-50 rounded-xl p-4 mb-5 space-y-2 text-sm text-left">
              <div className="flex justify-between text-stone-600">
                <span>Total</span>
                <span className="font-semibold text-stone-900">{formatCurrency(orderComplete.total)}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>{orderComplete.method === 'cash' ? 'Amount received' : 'Paid via GCash'}</span>
                <span className="font-semibold text-stone-900">{formatCurrency(orderComplete.paid)}</span>
              </div>
              {orderComplete.method === 'cash' && (
                <div className="flex justify-between items-center pt-2 border-t border-stone-200">
                  <span className="font-medium text-green-700">Change</span>
                  <span className="text-2xl font-bold text-green-700">{formatCurrency(orderComplete.change)}</span>
                </div>
              )}
            </div>
            <button
              onClick={() => setOrderComplete(null)}
              className="w-full bg-stone-900 hover:bg-stone-800 text-white font-medium py-3 rounded-xl transition-colors"
            >
              New Order
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline icon to avoid import issues for empty state
function Package({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
    </svg>
  );
}
