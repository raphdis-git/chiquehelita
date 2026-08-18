alter policy products_public_read_active
on public.products to anon
using (active = true);

alter policy products_admin_read_all
on public.products to authenticated
using (active = true or private.is_admin());

alter policy product_sizes_public_read
on public.product_sizes to anon
using (exists (
  select 1 from public.products p
  where p.id = product_sizes.product_id and p.active = true
));

alter policy product_sizes_admin_read_all
on public.product_sizes to authenticated
using (private.is_admin() or exists (
  select 1 from public.products p
  where p.id = product_sizes.product_id and p.active = true
));

alter policy product_variants_public_read
on public.product_variants to anon
using (active = true and exists (
  select 1 from public.products p
  where p.id = product_variants.product_id and p.active = true
));

alter policy product_variants_admin_read_all
on public.product_variants to authenticated
using (private.is_admin() or (
  active = true and exists (
    select 1 from public.products p
    where p.id = product_variants.product_id and p.active = true
  )
));

alter policy product_variant_stock_public_read
on public.product_variant_stock to anon
using (exists (
  select 1 from public.product_variants v
  join public.products p on p.id = v.product_id
  where v.id = product_variant_stock.variant_id
    and v.active = true and p.active = true
));

alter policy product_variant_stock_admin_read_all
on public.product_variant_stock to authenticated
using (private.is_admin() or exists (
  select 1 from public.product_variants v
  join public.products p on p.id = v.product_id
  where v.id = product_variant_stock.variant_id
    and v.active = true and p.active = true
));

alter policy product_variant_images_public_read
on public.product_variant_images to anon
using (exists (
  select 1 from public.product_variants v
  join public.products p on p.id = v.product_id
  where v.id = product_variant_images.variant_id
    and v.active = true and p.active = true
));

alter policy product_variant_images_admin_read_all
on public.product_variant_images to authenticated
using (private.is_admin() or exists (
  select 1 from public.product_variants v
  join public.products p on p.id = v.product_id
  where v.id = product_variant_images.variant_id
    and v.active = true and p.active = true
));

