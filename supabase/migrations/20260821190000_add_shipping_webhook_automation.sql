alter table public.orders
  add column if not exists shipping_external_id text,
  add column if not exists shipping_protocol text,
  add column if not exists shipping_label_status text,
  add column if not exists shipping_last_event_at timestamptz;

create unique index if not exists orders_shipping_external_id_unique_idx
on public.orders(shipping_external_id) where shipping_external_id is not null;

create table if not exists public.shipping_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider = 'melhor_envio'),
  event_key text not null unique,
  event_name text not null,
  external_id text,
  order_id uuid references public.orders(id) on delete set null,
  payload jsonb not null,
  processing_status text not null default 'received' check (processing_status in ('received','processed','unmatched','ignored','error')),
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists shipping_webhook_events_order_idx on public.shipping_webhook_events(order_id, received_at desc);
alter table public.shipping_webhook_events enable row level security;
revoke all on public.shipping_webhook_events from public, anon, authenticated;
grant select on public.shipping_webhook_events to authenticated;

drop policy if exists shipping_webhook_events_admin_select on public.shipping_webhook_events;
create policy shipping_webhook_events_admin_select on public.shipping_webhook_events
for select to authenticated using ((select private.is_admin()));

comment on column public.orders.shipping_external_id is 'ID da etiqueta no Melhor Envio usado para correlacionar webhooks.';
comment on table public.shipping_webhook_events is 'Histórico idempotente das notificações logísticas recebidas.';
