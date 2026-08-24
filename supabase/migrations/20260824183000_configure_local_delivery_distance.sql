alter table public.store_settings
  add column if not exists local_delivery_origin_postal_code text not null default '',
  add column if not exists local_delivery_origin_address text not null default '',
  add column if not exists local_delivery_origin_number text not null default '',
  add column if not exists local_delivery_origin_district text not null default '',
  add column if not exists local_delivery_origin_city text not null default '',
  add column if not exists local_delivery_origin_state text not null default '',
  add column if not exists local_delivery_cities jsonb not null default '[]'::jsonb,
  add column if not exists local_delivery_distance_ranges jsonb not null default '[]'::jsonb;

update public.store_settings
set
  local_delivery_origin_postal_code = case when local_delivery_origin_postal_code = '' then '74555230' else local_delivery_origin_postal_code end,
  local_delivery_origin_address = case when local_delivery_origin_address = '' then 'Rua 11' else local_delivery_origin_address end,
  local_delivery_origin_number = case when local_delivery_origin_number = '' then 'Qd 25 Lt 13' else local_delivery_origin_number end,
  local_delivery_origin_district = case when local_delivery_origin_district = '' then 'Vila Santa Helena' else local_delivery_origin_district end,
  local_delivery_origin_city = case when local_delivery_origin_city = '' then 'Goiânia' else local_delivery_origin_city end,
  local_delivery_origin_state = case when local_delivery_origin_state = '' then 'GO' else local_delivery_origin_state end,
  local_delivery_cities = case when jsonb_array_length(local_delivery_cities) = 0 then '["Goiânia", "Aparecida de Goiânia"]'::jsonb else local_delivery_cities end,
  local_delivery_distance_ranges = case when jsonb_array_length(local_delivery_distance_ranges) = 0 then '[{"maxKm":5,"price":20},{"maxKm":10,"price":25},{"maxKm":15,"price":30},{"maxKm":20,"price":35},{"maxKm":25,"price":40}]'::jsonb else local_delivery_distance_ranges end;

comment on column public.store_settings.local_delivery_origin_postal_code is 'CEP do ponto de saída da entrega própria.';
comment on column public.store_settings.local_delivery_cities is 'Lista JSON de cidades atendidas pela entrega própria.';
comment on column public.store_settings.local_delivery_distance_ranges is 'Faixas JSON ordenadas com distância máxima em km e preço da entrega.';
