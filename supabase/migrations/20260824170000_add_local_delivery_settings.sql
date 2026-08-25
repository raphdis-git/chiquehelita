alter table public.store_settings
  add column if not exists local_delivery_enabled boolean not null default false,
  add column if not exists local_delivery_price numeric(10,2) not null default 0 check (local_delivery_price >= 0),
  add column if not exists local_delivery_days integer not null default 1 check (local_delivery_days >= 1),
  add column if not exists local_delivery_city text not null default '',
  add column if not exists local_delivery_state text not null default '';

comment on column public.store_settings.local_delivery_enabled is 'Disponibiliza entrega local sem transportadora integrada.';
comment on column public.store_settings.local_delivery_price is 'Valor fixo cobrado pela entrega local.';
comment on column public.store_settings.local_delivery_days is 'Prazo estimado, em dias úteis, para entrega local.';
comment on column public.store_settings.local_delivery_city is 'Cidade atendida pela entrega local.';
comment on column public.store_settings.local_delivery_state is 'UF atendida pela entrega local.';
