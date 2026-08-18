alter policy products_public_read_active
on public.products
to anon, authenticated
using (active = true);

drop policy if exists products_admin_read_all on public.products;
create policy products_admin_read_all on public.products
for select to authenticated using (public.is_admin());

alter policy product_sizes_public_read
on public.product_sizes
to anon, authenticated
using (exists (
  select 1 from public.products p
  where p.id = product_sizes.product_id and p.active = true
));

drop policy if exists product_sizes_admin_read_all on public.product_sizes;
create policy product_sizes_admin_read_all on public.product_sizes
for select to authenticated using (public.is_admin());

alter policy product_variants_public_read
on public.product_variants
to anon, authenticated
using (active = true and exists (
  select 1 from public.products p
  where p.id = product_variants.product_id and p.active = true
));

drop policy if exists product_variants_admin_read_all on public.product_variants;
create policy product_variants_admin_read_all on public.product_variants
for select to authenticated using (public.is_admin());

alter policy product_variant_stock_public_read
on public.product_variant_stock
to anon, authenticated
using (exists (
  select 1 from public.product_variants v
  join public.products p on p.id = v.product_id
  where v.id = product_variant_stock.variant_id
    and v.active = true and p.active = true
));

drop policy if exists product_variant_stock_admin_read_all on public.product_variant_stock;
create policy product_variant_stock_admin_read_all on public.product_variant_stock
for select to authenticated using (public.is_admin());

alter policy product_variant_images_public_read
on public.product_variant_images
to anon, authenticated
using (exists (
  select 1 from public.product_variants v
  join public.products p on p.id = v.product_id
  where v.id = product_variant_images.variant_id
    and v.active = true and p.active = true
));

drop policy if exists product_variant_images_admin_read_all on public.product_variant_images;
create policy product_variant_images_admin_read_all on public.product_variant_images
for select to authenticated using (public.is_admin());

