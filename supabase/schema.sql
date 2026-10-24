-- =====================================================================
-- Bakehouse POS - Supabase (Postgres) schema
--
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> New query ->
-- paste this whole file -> Run. Safe to run more than once.
--
-- Security model: only signed-in users (Supabase Auth) can read or
-- write anything. The anon key that ships inside the website can do
-- nothing without a login, so it is safe to publish on GitHub Pages.
-- =====================================================================

-- ---------- Tables ----------

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  price        numeric(10,2) not null default 0,
  stock        integer not null default 0,
  image_url    text,
  category_id  uuid references public.categories(id) on delete set null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists idx_products_category on public.products(category_id);

create table if not exists public.customers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  phone           text,
  email           text,
  loyalty_points  integer not null default 0,
  created_at      timestamptz not null default now()
);

create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    text not null unique,
  customer_id     uuid references public.customers(id) on delete set null,
  customer_name   text,
  subtotal        numeric(10,2) not null default 0,
  tax_rate        numeric(5,2)  not null default 0,
  tax_amount      numeric(10,2) not null default 0,
  discount        numeric(10,2) not null default 0,
  total           numeric(10,2) not null default 0,
  payment_method  text not null default 'cash',
  payment_status  text not null default 'paid',
  status          text not null default 'completed',
  notes           text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_orders_created_at on public.orders(created_at);

create table if not exists public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  product_id    uuid references public.products(id) on delete set null,
  product_name  text not null,
  unit_price    numeric(10,2) not null default 0,
  quantity      integer not null default 1,
  line_total    numeric(10,2) not null default 0
);
create index if not exists idx_order_items_order   on public.order_items(order_id);
create index if not exists idx_order_items_product on public.order_items(product_id);

-- ---------- Row Level Security (signed-in users only) ----------

alter table public.categories  enable row level security;
alter table public.products    enable row level security;
alter table public.customers   enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "staff all categories" on public.categories;
create policy "staff all categories" on public.categories
  for all to authenticated using (true) with check (true);

drop policy if exists "staff all products" on public.products;
create policy "staff all products" on public.products
  for all to authenticated using (true) with check (true);

drop policy if exists "staff all customers" on public.customers;
create policy "staff all customers" on public.customers
  for all to authenticated using (true) with check (true);

-- Orders are a sales record: staff can read and create them, not edit/delete.
drop policy if exists "staff read orders" on public.orders;
create policy "staff read orders" on public.orders
  for select to authenticated using (true);
drop policy if exists "staff create orders" on public.orders;
create policy "staff create orders" on public.orders
  for insert to authenticated with check (true);

drop policy if exists "staff read order items" on public.order_items;
create policy "staff read order items" on public.order_items
  for select to authenticated using (true);
drop policy if exists "staff create order items" on public.order_items;
create policy "staff create order items" on public.order_items
  for insert to authenticated with check (true);

-- ---------- Create an order (atomic: order + items + stock) ----------
-- Replaces api/orders.php POST. Everything happens in one transaction,
-- so a "not enough stock" error cancels the whole order.

create or replace function public.create_order(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order_id uuid := gen_random_uuid();
  v_number   text;
  v_item     jsonb;
  v_qty      int;
  v_pid      uuid;
  v_pname    text;
  v_stock    int;
begin
  if payload->'items' is null
     or jsonb_typeof(payload->'items') <> 'array'
     or jsonb_array_length(payload->'items') = 0 then
    raise exception 'Order items are required';
  end if;

  -- ORD-yymmdd-NNNNNN, using Philippine time
  v_number := 'ORD-' || to_char(now() at time zone 'Asia/Manila', 'YYMMDD')
              || '-' || lpad(floor(random() * 1000000)::int::text, 6, '0');

  insert into orders (id, order_number, customer_name, subtotal, tax_rate, tax_amount,
                      discount, total, payment_method, payment_status, status, notes)
  values (
    v_order_id, v_number,
    nullif(payload->>'customer_name', ''),
    coalesce((payload->>'subtotal')::numeric, 0),
    coalesce((payload->>'tax_rate')::numeric, 0),
    coalesce((payload->>'tax_amount')::numeric, 0),
    coalesce((payload->>'discount')::numeric, 0),
    coalesce((payload->>'total')::numeric, 0),
    coalesce(payload->>'payment_method', 'cash'),
    coalesce(payload->>'payment_status', 'paid'),
    coalesce(payload->>'status', 'completed'),
    left(payload->>'notes', 500)
  );

  for v_item in select * from jsonb_array_elements(payload->'items') loop
    v_qty := coalesce((v_item->>'quantity')::int, 0);
    if coalesce(v_item->>'product_name', '') = '' or v_qty < 1 then
      raise exception 'Each item needs a product name and a quantity of at least 1';
    end if;

    v_pid := nullif(v_item->>'product_id', '')::uuid;

    if v_pid is not null then
      -- lock the product row so two cashiers cannot oversell the same stock
      select p.name, p.stock into v_pname, v_stock
      from products p where p.id = v_pid for update;
      if found and v_stock < v_qty then
        raise exception 'Not enough stock for % (only % left)', v_pname, v_stock;
      end if;
    end if;

    insert into order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
    values (
      v_order_id, v_pid, v_item->>'product_name',
      coalesce((v_item->>'unit_price')::numeric, 0), v_qty,
      coalesce((v_item->>'line_total')::numeric, 0)
    );

    if v_pid is not null then
      update products set stock = greatest(0, stock - v_qty) where id = v_pid;
    end if;
  end loop;

  return jsonb_build_object('id', v_order_id, 'order_number', v_number, 'success', true);
end;
$$;

-- ---------- Dashboard + reports (replace api/dashboard.php, api/reports.php) ----------
-- "Today" always means today in Asia/Manila, no matter where the viewer is.

create or replace function public.dashboard_stats()
returns jsonb
language sql stable security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'today_revenue', coalesce((select sum(total) from orders
        where (created_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date), 0),
    'today_orders', (select count(*) from orders
        where (created_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date),
    'total_revenue', coalesce((select sum(total) from orders), 0),
    'total_orders', (select count(*) from orders),
    'total_products', (select count(*) from products),
    'low_stock_count', (select count(*) from products where stock < 5),
    'recent_orders', coalesce((select jsonb_agg(to_jsonb(o)) from
        (select * from orders order by created_at desc limit 5) o), '[]'::jsonb),
    'top_products', coalesce((select jsonb_agg(t) from
        (select product_name as name, sum(quantity)::int as qty, sum(line_total) as revenue
         from order_items group by product_name order by revenue desc limit 5) t), '[]'::jsonb)
  );
$$;

create or replace function public.report_summary()
returns jsonb
language sql stable security invoker
set search_path = public
as $$
  with o as (
    select total, (created_at at time zone 'Asia/Manila')::date as day from orders
  ),
  t as (select (now() at time zone 'Asia/Manila')::date as today),
  best as (
    select day, sum(total) as revenue, count(*) as orders
    from o group by day order by revenue desc limit 1
  )
  select jsonb_build_object(
    'today_revenue',      coalesce((select sum(total) from o, t where o.day = t.today), 0),
    'today_orders',       (select count(*) from o, t where o.day = t.today),
    'week_revenue',       coalesce((select sum(total) from o, t where o.day >= date_trunc('week', t.today::timestamp)::date), 0),
    'week_orders',        (select count(*) from o, t where o.day >= date_trunc('week', t.today::timestamp)::date),
    'month_revenue',      coalesce((select sum(total) from o, t where o.day >= date_trunc('month', t.today::timestamp)::date), 0),
    'month_orders',       (select count(*) from o, t where o.day >= date_trunc('month', t.today::timestamp)::date),
    'last_month_revenue', coalesce((select sum(total) from o, t
        where date_trunc('month', o.day::timestamp) = date_trunc('month', t.today::timestamp) - interval '1 month'), 0),
    'last_month_orders',  (select count(*) from o, t
        where date_trunc('month', o.day::timestamp) = date_trunc('month', t.today::timestamp) - interval '1 month'),
    'all_time_revenue',   coalesce((select sum(total) from o), 0),
    'all_time_orders',    (select count(*) from o),
    'avg_order_value',    coalesce((select avg(total) from o), 0),
    'best_day_date',      (select to_char(day, 'YYYY-MM-DD') from best),
    'best_day_revenue',   coalesce((select revenue from best), 0),
    'best_day_orders',    coalesce((select orders from best), 0)
  );
$$;

create or replace function public.report_daily()
returns jsonb
language sql stable security invoker
set search_path = public
as $$
  with days as (
    select ((now() at time zone 'Asia/Manila')::date - n) as day
    from generate_series(0, 29) n
  ),
  agg as (
    select (created_at at time zone 'Asia/Manila')::date as day,
           count(*) as c, sum(subtotal) as s, sum(tax_amount) as t,
           sum(discount) as d, sum(total) as r
    from orders group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'date', to_char(days.day, 'YYYY-MM-DD'),
    'label', to_char(days.day, 'Mon FMDD'),
    'order_count', coalesce(agg.c, 0),
    'subtotal', coalesce(agg.s, 0),
    'tax', coalesce(agg.t, 0),
    'discount', coalesce(agg.d, 0),
    'revenue', coalesce(agg.r, 0)
  ) order by days.day), '[]'::jsonb)
  from days left join agg on agg.day = days.day;
$$;

create or replace function public.report_monthly()
returns jsonb
language sql stable security invoker
set search_path = public
as $$
  with months as (
    select (date_trunc('month', (now() at time zone 'Asia/Manila')::date::timestamp)
            - make_interval(months => n))::date as m
    from generate_series(0, 11) n
  ),
  agg as (
    select date_trunc('month', (created_at at time zone 'Asia/Manila')::date::timestamp)::date as m,
           count(*) as c, sum(subtotal) as s, sum(tax_amount) as t,
           sum(discount) as d, sum(total) as r
    from orders group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'month', to_char(months.m, 'YYYY-MM'),
    'label', to_char(months.m, 'Mon YYYY'),
    'order_count', coalesce(agg.c, 0),
    'subtotal', coalesce(agg.s, 0),
    'tax', coalesce(agg.t, 0),
    'discount', coalesce(agg.d, 0),
    'revenue', coalesce(agg.r, 0)
  ) order by months.m), '[]'::jsonb)
  from months left join agg on agg.m = months.m;
$$;

create or replace function public.report_bestsellers(lim int default 10)
returns jsonb
language sql stable security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(b), '[]'::jsonb) from (
    select product_id, product_name, unit_price,
           sum(quantity)::int as qty_sold,
           sum(line_total) as revenue,
           count(distinct order_id)::int as order_count
    from order_items
    group by product_id, product_name, unit_price
    order by qty_sold desc
    limit greatest(1, least(100, lim))
  ) b;
$$;

create or replace function public.report_category()
returns jsonb
language sql stable security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select coalesce(c.name, 'Uncategorized') as category,
           sum(oi.quantity)::int as qty_sold,
           sum(oi.line_total) as revenue,
           count(distinct oi.product_id)::int as product_count
    from order_items oi
    left join products p on p.id = oi.product_id
    left join categories c on c.id = p.category_id
    group by coalesce(c.name, 'Uncategorized')
    order by revenue desc
  ) x;
$$;

create or replace function public.report_payment()
returns jsonb
language sql stable security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select payment_method as method, count(*)::int as order_count, sum(total) as revenue
    from orders group by payment_method order by revenue desc
  ) x;
$$;

create or replace function public.report_hourly()
returns jsonb
language sql stable security invoker
set search_path = public
as $$
  with agg as (
    select extract(hour from created_at at time zone 'Asia/Manila')::int as h,
           count(*) as c, sum(total) as r
    from orders
    where (created_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date
    group by 1
  )
  select jsonb_agg(jsonb_build_object(
    'hour', g.h,
    'label', lpad(g.h::text, 2, '0') || ':00',
    'order_count', coalesce(agg.c, 0),
    'revenue', coalesce(agg.r, 0)
  ) order by g.h)
  from generate_series(0, 23) as g(h) left join agg on agg.h = g.h;
$$;

-- Only signed-in users may call these functions.
revoke execute on function public.create_order(jsonb)      from public, anon;
revoke execute on function public.dashboard_stats()        from public, anon;
revoke execute on function public.report_summary()         from public, anon;
revoke execute on function public.report_daily()           from public, anon;
revoke execute on function public.report_monthly()         from public, anon;
revoke execute on function public.report_bestsellers(int)  from public, anon;
revoke execute on function public.report_category()        from public, anon;
revoke execute on function public.report_payment()         from public, anon;
revoke execute on function public.report_hourly()          from public, anon;

grant execute on function public.create_order(jsonb)      to authenticated;
grant execute on function public.dashboard_stats()        to authenticated;
grant execute on function public.report_summary()         to authenticated;
grant execute on function public.report_daily()           to authenticated;
grant execute on function public.report_monthly()         to authenticated;
grant execute on function public.report_bestsellers(int)  to authenticated;
grant execute on function public.report_category()        to authenticated;
grant execute on function public.report_payment()         to authenticated;
grant execute on function public.report_hourly()          to authenticated;

-- ---------- Product photo storage (replaces api/uploads/) ----------
-- Public bucket: anyone can VIEW a photo link, only signed-in staff can upload/change/delete.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

drop policy if exists "staff upload product images" on storage.objects;
create policy "staff upload product images" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images');

drop policy if exists "staff update product images" on storage.objects;
create policy "staff update product images" on storage.objects
  for update to authenticated using (bucket_id = 'product-images');

drop policy if exists "staff delete product images" on storage.objects;
create policy "staff delete product images" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images');

-- ---------- Realtime (so other devices can live-update later) ----------

do $$
declare t text;
begin
  foreach t in array array['categories', 'products', 'orders', 'order_items'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then
      null; -- already added
    end;
  end loop;
end $$;

-- ---------- Sample data (only added if missing) ----------

insert into public.categories (name, slug) values
  ('Bread', 'bread'),
  ('Pastries', 'pastries'),
  ('Cakes', 'cakes'),
  ('Cookies', 'cookies'),
  ('Beverages', 'beverages')
on conflict (slug) do nothing;

insert into public.products (name, description, price, stock, image_url, category_id, is_active)
select v.name, v.description, v.price, v.stock, v.image_url, c.id, true
from (values
  ('Sourdough Loaf', 'Artisan sourdough bread with a crispy crust', 6.50, 20, 'https://images.pexels.com/photos/1775043/pexels-photo-1775043.jpeg?auto=compress&cs=tinysrgb&w=400', 'bread'),
  ('French Baguette', 'Classic French baguette, fresh baked daily', 3.50, 30, 'https://images.pexels.com/photos/1858475/pexels-photo-1858475.jpeg?auto=compress&cs=tinysrgb&w=400', 'bread'),
  ('Whole Wheat Bread', 'Healthy whole wheat loaf', 5.00, 15, 'https://images.pexels.com/photos/2092058/pexels-photo-2092058.jpeg?auto=compress&cs=tinysrgb&w=400', 'bread'),
  ('Ciabatta', 'Italian white bread with airy texture', 4.50, 18, 'https://images.pexels.com/photos/2092058/pexels-photo-2092058.jpeg?auto=compress&cs=tinysrgb&w=400', 'bread'),
  ('Croissant', 'Buttery, flaky French pastry', 3.00, 40, 'https://images.pexels.com/photos/2135/food-bakery-dessert-breakfast-pastry.jpg?auto=compress&cs=tinysrgb&w=400', 'pastries'),
  ('Pain au Chocolat', 'Chocolate-filled croissant', 3.50, 30, 'https://images.pexels.com/photos/2135/food-bakery-dessert-breakfast-pastry.jpg?auto=compress&cs=tinysrgb&w=400', 'pastries'),
  ('Danish Pastry', 'Flaky Danish with fruit filling', 3.75, 25, 'https://images.pexels.com/photos/2135/food-bakery-dessert-breakfast-pastry.jpg?auto=compress&cs=tinysrgb&w=400', 'pastries'),
  ('Cinnamon Roll', 'Sweet spiral pastry with cinnamon glaze', 4.00, 22, 'https://images.pexels.com/photos/2135/food-bakery-dessert-breakfast-pastry.jpg?auto=compress&cs=tinysrgb&w=400', 'pastries'),
  ('Chocolate Cake', 'Rich double chocolate layer cake (per slice)', 5.50, 12, 'https://images.pexels.com/photos/291528/pexels-photo-291528.jpeg?auto=compress&cs=tinysrgb&w=400', 'cakes'),
  ('Red Velvet Cake', 'Classic red velvet with cream cheese frosting (per slice)', 6.00, 10, 'https://images.pexels.com/photos/291528/pexels-photo-291528.jpeg?auto=compress&cs=tinysrgb&w=400', 'cakes'),
  ('Cheesecake', 'New York style cheesecake (per slice)', 5.75, 14, 'https://images.pexels.com/photos/4040696/pexels-photo-4040696.jpeg?auto=compress&cs=tinysrgb&w=400', 'cakes'),
  ('Birthday Cake (whole)', 'Custom decorated birthday cake', 35.00, 5, 'https://images.pexels.com/photos/1071877/pexels-photo-1071877.jpeg?auto=compress&cs=tinysrgb&w=400', 'cakes'),
  ('Chocolate Chip Cookie', 'Classic chewy chocolate chip cookie', 1.75, 60, 'https://images.pexels.com/photos/3209034/pexels-photo-3209034.jpeg?auto=compress&cs=tinysrgb&w=400', 'cookies'),
  ('Oatmeal Raisin Cookie', 'Soft oatmeal cookie with raisins', 1.75, 40, 'https://images.pexels.com/photos/3209034/pexels-photo-3209034.jpeg?auto=compress&cs=tinysrgb&w=400', 'cookies'),
  ('Sugar Cookie', 'Buttery sugar cookie with icing', 1.50, 50, 'https://images.pexels.com/photos/3209034/pexels-photo-3209034.jpeg?auto=compress&cs=tinysrgb&w=400', 'cookies'),
  ('Espresso', 'Single shot of rich espresso', 2.50, 999, 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=400', 'beverages'),
  ('Cappuccino', 'Espresso with steamed milk and foam', 3.75, 999, 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=400', 'beverages'),
  ('Latte', 'Creamy cafe latte', 4.25, 999, 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=400', 'beverages'),
  ('Hot Chocolate', 'Rich Belgian hot chocolate', 3.50, 999, 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=400', 'beverages')
) as v(name, description, price, stock, image_url, slug)
join public.categories c on c.slug = v.slug
where not exists (select 1 from public.products p where p.name = v.name);
