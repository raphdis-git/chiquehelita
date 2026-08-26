alter table public.store_settings
  add column if not exists infinitepay_enabled boolean not null default false,
  add column if not exists infinitepay_test_mode boolean not null default true,
  add column if not exists infinitepay_handle text not null default '';

comment on column public.store_settings.infinitepay_test_mode is
  'Quando ativo, simula o resultado do checkout sem criar uma cobrança real.';

alter table public.orders
  add column if not exists payment_provider text,
  add column if not exists payment_status text not null default 'not_required',
  add column if not exists payment_test_mode boolean not null default false,
  add column if not exists payment_checkout_token uuid,
  add column if not exists payment_invoice_slug text,
  add column if not exists payment_transaction_nsu text,
  add column if not exists payment_receipt_url text,
  add column if not exists payment_paid_at timestamptz;

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('not_required', 'pending', 'paid', 'failed', 'cancelled'));

create unique index if not exists orders_payment_checkout_token_idx
  on public.orders (payment_checkout_token)
  where payment_checkout_token is not null;

