alter table public.orders
  add column if not exists tracking_status text not null default 'awaiting_shipment',
  add column if not exists tracking_code text,
  add column if not exists tracking_url text,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists tracking_updated_at timestamptz;

alter table public.orders
  drop constraint if exists orders_tracking_status_check,
  add constraint orders_tracking_status_check check (tracking_status in (
    'awaiting_shipment', 'posted', 'in_transit', 'out_for_delivery',
    'delivered', 'exception', 'returned'
  )),
  drop constraint if exists orders_tracking_url_check,
  add constraint orders_tracking_url_check check (
    tracking_url is null or tracking_url ~ '^https://'
  );

comment on column public.orders.tracking_status is 'Andamento logístico informado pela loja ou transportadora.';
comment on column public.orders.tracking_code is 'Código público de rastreio do envio.';
comment on column public.orders.tracking_url is 'Link HTTPS público para acompanhamento do envio.';

