create or replace function public.commit_order_inventory(p_order_id uuid)
returns public.orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.orders;
  v_item record;
  v_updated integer;
  v_now timestamptz := now();
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Pedido não encontrado.';
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'Não é possível reservar estoque para um pedido cancelado.';
  end if;

  if v_order.inventory_committed_at is not null and v_order.inventory_released_at is null then
    return v_order;
  end if;

  for v_item in
    select *
    from public.order_items
    where order_id = p_order_id
    order by id
    for update
  loop
    if v_item.variant_id is null then
      raise exception 'Um item do pedido não possui variação para controlar o estoque.';
    end if;

    update public.product_variant_stock
    set stock = stock - v_item.quantity
    where variant_id = v_item.variant_id
      and size = v_item.size
      and stock >= v_item.quantity;
    get diagnostics v_updated = row_count;

    if v_updated <> 1 then
      raise exception 'Estoque insuficiente para % — tamanho %.', v_item.product_name, v_item.size;
    end if;

    insert into public.inventory_movements(
      order_id, order_item_id, variant_id, size, quantity_change, reason, created_by
    ) values (
      p_order_id, v_item.id, v_item.variant_id, v_item.size, -v_item.quantity, 'order_committed', auth.uid()
    );
  end loop;

  update public.orders
  set inventory_committed_at = v_now,
      inventory_released_at = null,
      updated_at = v_now
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.commit_order_inventory(uuid) from public, anon, authenticated;
grant execute on function public.commit_order_inventory(uuid) to service_role;

