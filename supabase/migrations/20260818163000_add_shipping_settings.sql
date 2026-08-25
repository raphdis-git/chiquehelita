alter table public.store_settings
  add column if not exists origin_postal_code text not null default '',
  add column if not exists package_weight_grams integer not null default 500 check (package_weight_grams > 0),
  add column if not exists package_height_cm numeric(8,2) not null default 10 check (package_height_cm > 0),
  add column if not exists package_width_cm numeric(8,2) not null default 20 check (package_width_cm > 0),
  add column if not exists package_length_cm numeric(8,2) not null default 30 check (package_length_cm > 0),
  add column if not exists max_items_per_package integer not null default 5 check (max_items_per_package > 0),
  add column if not exists shipping_handling_days integer not null default 1 check (shipping_handling_days >= 0),
  add column if not exists shipping_markup_percent numeric(8,2) not null default 0 check (shipping_markup_percent >= 0),
  add column if not exists melhor_envio_enabled boolean not null default false,
  add column if not exists correios_enabled boolean not null default false;

comment on column public.store_settings.origin_postal_code is 'CEP de origem usado nas cotações de frete.';
comment on column public.store_settings.package_weight_grams is 'Peso médio, em gramas, de um vestido embalado.';
comment on column public.store_settings.max_items_per_package is 'Quantidade máxima de vestidos considerada em cada pacote.';
comment on column public.store_settings.shipping_handling_days is 'Prazo adicional de preparação somado ao prazo da transportadora.';
comment on column public.store_settings.shipping_markup_percent is 'Acréscimo percentual aplicado ao valor retornado pela transportadora.';
