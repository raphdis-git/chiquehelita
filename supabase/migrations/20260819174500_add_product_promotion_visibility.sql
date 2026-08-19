alter table public.products
  add column if not exists show_in_promotions boolean not null default false;

comment on column public.products.show_in_promotions is 'Define se o produto ativo aparece na seção de promoções da loja.';
