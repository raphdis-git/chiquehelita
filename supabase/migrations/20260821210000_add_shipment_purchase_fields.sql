alter table public.store_settings
  add column if not exists sender_name text,
  add column if not exists sender_email text,
  add column if not exists sender_phone text,
  add column if not exists sender_tax_id text,
  add column if not exists sender_state_register text,
  add column if not exists sender_address text,
  add column if not exists sender_address_number text,
  add column if not exists sender_address_complement text,
  add column if not exists sender_district text,
  add column if not exists sender_city text,
  add column if not exists sender_state text;

alter table public.orders
  add column if not exists shipping_label_url text,
  add column if not exists shipping_cart_created_at timestamptz,
  add column if not exists shipping_purchased_at timestamptz,
  add column if not exists shipping_generated_at timestamptz;

alter table public.orders
  drop constraint if exists orders_shipping_label_url_check,
  add constraint orders_shipping_label_url_check check (
    shipping_label_url is null or shipping_label_url ~ '^https://'
  );

comment on column public.orders.shipping_label_url is 'Link público para impressão da etiqueta gerada pelo Melhor Envio.';
comment on column public.orders.shipping_cart_created_at is 'Data em que o envio foi adicionado ao carrinho do Melhor Envio.';
comment on column public.orders.shipping_purchased_at is 'Data em que o frete foi comprado no Melhor Envio.';
comment on column public.orders.shipping_generated_at is 'Data em que a etiqueta foi gerada no Melhor Envio.';
