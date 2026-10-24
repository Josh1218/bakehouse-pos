import type { PostgrestError } from '@supabase/supabase-js';
import type { Product, Category, Order, OrderItem } from '@/types';
import { supabase } from '@/lib/supabase';

// Same function names and shapes as the old PHP/XAMPP client, so the screens
// did not need to change. Everything below now talks to Supabase.

const NETWORK_MESSAGE = 'Cannot reach Supabase. Check your internet connection and the project URL in your .env / GitHub secrets.';

function toError(error: PostgrestError | { message: string; code?: string }): Error {
  const message = error.message || 'Request failed';
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return new Error(NETWORK_MESSAGE);
  }
  if ('code' in error && error.code === '23505') {
    return new Error('That already exists (duplicate value).');
  }
  return new Error(message);
}

// Runs a Supabase query and returns its data, or throws a readable Error.
async function run<T>(query: PromiseLike<{ data: unknown; error: PostgrestError | null }>): Promise<T> {
  let res: { data: unknown; error: PostgrestError | null };
  try {
    res = await query;
  } catch {
    throw new Error(NETWORK_MESSAGE);
  }
  if (res.error) throw toError(res.error);
  return res.data as T;
}

const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `cat-${randomHex(3)}`;
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr); // works on http:// LAN addresses too (randomUUID does not)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- Categories ----------

export const categoriesApi = {
  list: () => run<Category[]>(supabase.from('categories').select('*').order('name')),
  create: async (data: { name: string }) => {
    const name = data.name.trim();
    try {
      return await run<Category>(
        supabase.from('categories').insert({ name, slug: slugify(name) }).select().single()
      );
    } catch (err) {
      if (err instanceof Error && /duplicate key|already exists/i.test(err.message)) {
        throw new Error('A category with that name already exists');
      }
      throw err;
    }
  },
  update: async (id: string, data: { name: string }) => {
    const name = data.name.trim();
    try {
      return await run<Category>(
        supabase.from('categories').update({ name, slug: slugify(name) }).eq('id', id).select().single()
      );
    } catch (err) {
      if (err instanceof Error && /duplicate key|already exists/i.test(err.message)) {
        throw new Error('A category with that name already exists');
      }
      throw err;
    }
  },
  remove: async (id: string) => {
    await run<unknown>(supabase.from('categories').delete().eq('id', id));
    return { success: true };
  },
};

// ---------- Products ----------

type ProductInput = {
  name: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  category_id: string | null;
  is_active: boolean;
};

function normalizeProduct(p: Product): Product {
  return { ...p, price: num(p.price), stock: num(p.stock) };
}

export const productsApi = {
  list: async () => {
    const rows = await run<Product[]>(
      supabase.from('products').select('*, categories(id, name, slug, created_at)').order('name')
    );
    return rows.map(normalizeProduct);
  },
  listActive: async () => {
    const rows = await run<Product[]>(
      supabase
        .from('products')
        .select('*, categories(id, name, slug, created_at)')
        .eq('is_active', true)
        .order('name')
    );
    return rows.map(normalizeProduct);
  },
  create: (data: ProductInput) =>
    run<{ id: string }>(supabase.from('products').insert(data).select('id').single()),
  update: (id: string, data: ProductInput) =>
    run<{ id: string }>(supabase.from('products').update(data).eq('id', id).select('id').single()),
  remove: async (id: string) => {
    await run<unknown>(supabase.from('products').delete().eq('id', id));
    return { success: true };
  },
};

// ---------- Image upload (Supabase Storage, bucket "product-images") ----------

const IMAGE_BUCKET = 'product-images';
const IMAGE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export const uploadApi = {
  image: async (file: Blob, fileName: string): Promise<{ url: string }> => {
    const ext = IMAGE_EXT[file.type];
    if (!ext) throw new Error('Only JPG, PNG, GIF or WEBP images are allowed');
    if (file.size > 5 * 1024 * 1024) throw new Error('Image is too large (max 5 MB)');

    const path = `${Date.now()}-${randomHex(6)}.${ext}`;
    let res;
    try {
      res = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
        contentType: file.type,
        cacheControl: '31536000',
      });
    } catch {
      throw new Error(NETWORK_MESSAGE);
    }
    if (res.error) throw toError(res.error);

    const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
    void fileName; // kept so the call signature matches the old API
    return { url: data.publicUrl };
  },
};

// ---------- Orders ----------

function normalizeOrder(o: Order): Order {
  const order: Order = {
    ...o,
    subtotal: num(o.subtotal),
    tax_rate: num(o.tax_rate),
    tax_amount: num(o.tax_amount),
    discount: num(o.discount),
    total: num(o.total),
  };
  if (o.order_items) {
    order.order_items = [...o.order_items]
      .map(
        (i: OrderItem): OrderItem => ({
          ...i,
          unit_price: num(i.unit_price),
          line_total: num(i.line_total),
          quantity: num(i.quantity),
        })
      )
      .sort((a, b) => a.product_name.localeCompare(b.product_name));
  }
  return order;
}

export const ordersApi = {
  // Supabase returns at most 1000 rows per request by default.
  list: async () => {
    const rows = await run<Order[]>(
      supabase.from('orders').select('*').order('created_at', { ascending: false })
    );
    return rows.map(normalizeOrder);
  },
  get: async (id: string) => {
    const row = await run<Order>(supabase.from('orders').select('*, order_items(*)').eq('id', id).single());
    return normalizeOrder(row);
  },
  create: (data: {
    customer_name: string | null;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    discount: number;
    total: number;
    payment_method: string;
    payment_status: string;
    status: string;
    notes?: string | null;
    items: {
      product_id: string | null;
      product_name: string;
      unit_price: number;
      quantity: number;
      line_total: number;
    }[];
  }) => run<{ id: string; order_number: string }>(supabase.rpc('create_order', { payload: data })),
};

// ---------- Dashboard ----------

export interface DashboardStats {
  today_revenue: number;
  today_orders: number;
  total_revenue: number;
  total_orders: number;
  total_products: number;
  low_stock_count: number;
  recent_orders: Order[];
  top_products: { name: string; qty: number; revenue: number }[];
}

export const dashboardApi = {
  get: async () => {
    const stats = await run<DashboardStats>(supabase.rpc('dashboard_stats'));
    return { ...stats, recent_orders: (stats.recent_orders ?? []).map(normalizeOrder) };
  },
};

// ---------- Reports ----------

export interface DailySalesPoint {
  date: string;
  label: string;
  order_count: number;
  subtotal: number;
  tax: number;
  discount: number;
  revenue: number;
}

export interface MonthlySalesPoint {
  month: string;
  label: string;
  order_count: number;
  subtotal: number;
  tax: number;
  discount: number;
  revenue: number;
}

export interface BestSellerItem {
  product_id: string | null;
  product_name: string;
  unit_price: number;
  qty_sold: number;
  revenue: number;
  order_count: number;
}

export interface CategorySalesItem {
  category: string;
  qty_sold: number;
  revenue: number;
  product_count: number;
}

export interface PaymentMethodSales {
  method: string;
  order_count: number;
  revenue: number;
}

export interface HourlySalesPoint {
  hour: number;
  label: string;
  order_count: number;
  revenue: number;
}

export interface ReportSummary {
  today_revenue: number;
  today_orders: number;
  week_revenue: number;
  week_orders: number;
  month_revenue: number;
  month_orders: number;
  last_month_revenue: number;
  last_month_orders: number;
  all_time_revenue: number;
  all_time_orders: number;
  avg_order_value: number;
  best_day_date: string | null;
  best_day_revenue: number;
  best_day_orders: number;
}

export const reportsApi = {
  daily: () => run<DailySalesPoint[]>(supabase.rpc('report_daily')),
  monthly: () => run<MonthlySalesPoint[]>(supabase.rpc('report_monthly')),
  bestSellers: (limit = 10) => run<BestSellerItem[]>(supabase.rpc('report_bestsellers', { lim: limit })),
  category: () => run<CategorySalesItem[]>(supabase.rpc('report_category')),
  payment: () => run<PaymentMethodSales[]>(supabase.rpc('report_payment')),
  hourly: () => run<HourlySalesPoint[]>(supabase.rpc('report_hourly')),
  summary: () => run<ReportSummary>(supabase.rpc('report_summary')),
};
