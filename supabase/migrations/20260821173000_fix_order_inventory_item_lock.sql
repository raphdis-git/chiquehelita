create or replace function public.update_order_status_with_inventory(p_order_id uuid, p_status text)
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
  v_commit boolean;
  v_release boolean;
begin
  if not (select private.is_admin()) then raise exception 'Acesso administrativo necessário.'; end if;
  if p_status not in ('new','contacted','confirmed','preparing','shipped','completed','cancelled') then raise exception 'Status do pedido inválido.'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;

  v_commit := p_status in ('confirmed','preparing','shipped','completed')
    and (v_order.inventory_committed_at is null or v_order.inventory_released_at is not null);
  v_release := p_status = 'cancelled'
    and v_order.inventory_committed_at is not null
    and v_order.inventory_released_at is null
    and v_order.status not in ('shipped','completed')
    and v_order.shipped_at is null;

  if v_commit then
    for v_item in select * from public.order_items where order_id = p_order_id order by id loop
      if v_item.variant_id is null then raise exception 'Um item do pedido não possui variação para controlar o estoque.'; end if;
      update public.product_variant_stock set stock = stock - v_item.quantity
      where variant_id = v_item.variant_id and size = v_item.size and stock >= v_item.quantity;
      get diagnostics v_updated = row_count;
      if v_updated <> 1 then raise exception 'Estoque insuficiente para % — tamanho %.', v_item.product_name, v_item.size; end if;
      insert into public.inventory_movements(order_id, order_item_id, variant_id, size, quantity_change, reason, created_by)
      values (p_order_id, v_item.id, v_item.variant_id, v_item.size, -v_item.quantity, 'order_committed', auth.uid());
    end loop;
    v_order.inventory_committed_at := v_now;
    v_order.inventory_released_at := null;
  elsif v_release then
    for v_item in select * from public.order_items where order_id = p_order_id order by id loop
      if v_item.variant_id is not null then
        update public.product_variant_stock set stock = stock + v_item.quantity
        where variant_id = v_item.variant_id and size = v_item.size;
        get diagnostics v_updated = row_count;
        if v_updated <> 1 then raise exception 'Não foi possível devolver um item ao estoque.'; end if;
        insert into public.inventory_movements(order_id, order_item_id, variant_id, size, quantity_change, reason, created_by)
        values (p_order_id, v_item.id, v_item.variant_id, v_item.size, v_item.quantity, 'order_cancelled', auth.uid());
      end if;
    end loop;
    v_order.inventory_released_at := v_now;
  end if;

  update public.orders set status = p_status,
    inventory_committed_at = v_order.inventory_committed_at,
    inventory_released_at = v_order.inventory_released_at,
    updated_at = v_now
  where id = p_order_id returning * into v_order;
  return v_order;
end;
$$;

revoke all on function public.update_order_status_with_inventory(uuid, text) from public, anon;
grant execute on function public.update_order_status_with_inventory(uuid, text) to authenticated;

