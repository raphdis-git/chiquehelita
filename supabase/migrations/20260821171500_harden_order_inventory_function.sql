alter function public.update_order_status_with_inventory(uuid, text) security invoker;

grant insert on public.inventory_movements to authenticated;
grant usage, select on sequence public.inventory_movements_id_seq to authenticated;

drop policy if exists inventory_movements_admin_insert on public.inventory_movements;
create policy inventory_movements_admin_insert on public.inventory_movements
for insert to authenticated with check ((select private.is_admin()));

