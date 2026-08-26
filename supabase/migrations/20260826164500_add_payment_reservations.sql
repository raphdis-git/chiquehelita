alter table public.orders add column if not exists checkout_state text not null default 'order';
alter table public.orders drop constraint if exists orders_checkout_state_check;
alter table public.orders add constraint orders_checkout_state_check check (checkout_state in ('reservation', 'order'));
create index if not exists orders_checkout_state_created_at_idx on public.orders (checkout_state, created_at desc);

create or replace function private.expire_abandoned_infinitepay_orders(p_timeout interval default interval '30 minutes')
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  v_order public.orders; v_item record; v_expired integer := 0; v_updated integer; v_now timestamptz := now();
begin
  for v_order in select * from public.orders
    where checkout_state = 'reservation' and payment_provider = 'infinitepay'
      and payment_status in ('pending', 'failed') and created_at <= v_now - p_timeout
      and status not in ('shipped', 'completed', 'cancelled')
    order by created_at for update skip locked
  loop
    if v_order.inventory_committed_at is not null and v_order.inventory_released_at is null then
      for v_item in select * from public.order_items where order_id = v_order.id order by id loop
        if v_item.variant_id is not null then
          update public.product_variant_stock set stock = stock + v_item.quantity where variant_id = v_item.variant_id and size = v_item.size;
          get diagnostics v_updated = row_count;
          if v_updated <> 1 then raise exception 'Não foi possível devolver um item ao estoque do pedido %.', v_order.order_number; end if;
          insert into public.inventory_movements(order_id, order_item_id, variant_id, size, quantity_change, reason, created_by)
          values (v_order.id, v_item.id, v_item.variant_id, v_item.size, v_item.quantity, 'order_cancelled', null);
        end if;
      end loop;
    end if;
    update public.orders set status = 'cancelled', payment_status = 'cancelled',
      inventory_released_at = case when inventory_committed_at is not null and inventory_released_at is null then v_now else inventory_released_at end,
      updated_at = v_now where id = v_order.id;
    v_expired := v_expired + 1;
  end loop;
  return v_expired;
end; $$;
revoke all on function private.expire_abandoned_infinitepay_orders(interval) from public, anon, authenticated;
