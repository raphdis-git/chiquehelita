alter table public.orders
  add column products_amount numeric(12,2),
  add column shipping_provider text,
  add column shipping_service_id text,
  add column shipping_service_name text,
  add column shipping_company text,
  add column shipping_price numeric(12,2) not null default 0 check (shipping_price >= 0),
  add column shipping_delivery_min_days integer check (shipping_delivery_min_days >= 0),
  add column shipping_delivery_max_days integer check (shipping_delivery_max_days >= 0),
  add column shipping_quoted_at timestamptz;

update public.orders set products_amount = total_amount where products_amount is null;

alter table public.orders
  alter column products_amount set not null,
  add constraint orders_products_amount_nonnegative check (products_amount >= 0),
  add constraint orders_shipping_delivery_range check (
    shipping_delivery_min_days is null
    or shipping_delivery_max_days is null
    or shipping_delivery_max_days >= shipping_delivery_min_days
  );
