
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  status text not null default 'new' check (status in ('new','contacted','confirmed','preparing','shipped','completed','cancelled')),
  customer_name text not null,
  customer_email text not null,
  customer_tax_id text not null,
  customer_phone text not null,
  address text not null,
  address_number text not null,
  district text not null,
  city text not null,
  state text not null,
  postal_code text not null,
  fulfillment text not null check (fulfillment in ('delivery','pickup')),
  payment_method text not null,
  notes text,
  total_quantity integer not null check (total_quantity > 0),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  color text not null,
  print_pattern text not null,
  size text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  price_type text not null check (price_type in ('retail','wholesale')),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  created_at timestamptz not null default now()
);

create index orders_created_at_idx on public.orders (created_at desc);
create index orders_status_created_at_idx on public.orders (status, created_at desc);
create index order_items_order_id_idx on public.order_items (order_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy orders_admin_select on public.orders for select to authenticated using ((select private.is_admin()));
create policy orders_admin_update on public.orders for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy order_items_admin_select on public.order_items for select to authenticated using ((select private.is_admin()));

revoke all on public.orders, public.order_items from anon, authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;

