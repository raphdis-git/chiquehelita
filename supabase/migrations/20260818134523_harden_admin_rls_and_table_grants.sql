-- Harden helper functions used by RLS.
alter function public.set_updated_at() set search_path = '';

revoke execute on function public.is_admin() from public;
revoke execute on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

-- Avoid evaluating auth.uid() once per row.
alter policy admin_users_self_read
on public.admin_users
using ((select auth.uid()) = user_id and active = true);

-- Apply least-privilege grants. RLS remains the row-level authorization layer.
revoke all privileges on table
  public.admin_users,
  public.store_settings,
  public.products,
  public.product_sizes,
  public.product_variants,
  public.product_variant_stock,
  public.product_variant_images,
  public.catalog_options
from anon, authenticated;

grant select on table
  public.store_settings,
  public.products,
  public.product_sizes,
  public.product_variants,
  public.product_variant_stock,
  public.product_variant_images
to anon;

grant select on table public.admin_users to authenticated;
grant select, update on table public.store_settings to authenticated;
grant select, insert, update, delete on table
  public.products,
  public.product_sizes,
  public.product_variants,
  public.product_variant_stock,
  public.product_variant_images,
  public.catalog_options
to authenticated;

