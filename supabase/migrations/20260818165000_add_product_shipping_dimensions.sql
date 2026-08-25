alter table public.products
  add column if not exists shipping_weight_grams integer check (shipping_weight_grams > 0),
  add column if not exists shipping_height_cm numeric(8,2) check (shipping_height_cm > 0),
  add column if not exists shipping_width_cm numeric(8,2) check (shipping_width_cm > 0),
  add column if not exists shipping_length_cm numeric(8,2) check (shipping_length_cm > 0);

alter table public.store_settings
  add column if not exists packaging_tare_grams integer not null default 100 check (packaging_tare_grams >= 0);

comment on column public.products.shipping_weight_grams is 'Peso individual do produto pronto para embalagem, em gramas.';
comment on column public.products.shipping_height_cm is 'Altura individual usada na composição dos volumes de frete.';
comment on column public.products.shipping_width_cm is 'Largura individual usada na composição dos volumes de frete.';
comment on column public.products.shipping_length_cm is 'Comprimento individual usado na composição dos volumes de frete.';
comment on column public.store_settings.packaging_tare_grams is 'Peso adicional da embalagem externa, em gramas, por volume.';
