alter table public.orders
  add column if not exists inventory_committed_at timestamptz,
  add column if not exists inventory_released_at timestamptz;

create table if not exists public.inventory_movements (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  size text not null,
  quantity_change integer not null check (quantity_change <> 0),
  reason text not null check (reason in ('order_committed', 'order_cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists inventory_movements_order_id_idx on public.inventory_movements(order_id, created_at desc);
alter table public.inventory_movements enable row level security;
revoke all on public.inventory_movements from public, anon, authenticated;
grant select, insert on public.inventory_movements to authenticated;
grant usage, select on sequence public.inventory_movements_id_seq to authenticated;

drop policy if exists inventory_movements_admin_select on public.inventory_movements;
create policy inventory_movements_admin_select on public.inventory_movements
for select to authenticated using ((select private.is_admin()));

drop policy if exists inventory_movements_admin_insert on public.inventory_movements;
create policy inventory_movements_admin_insert on public.inventory_movements
for insert to authenticated with check ((select private.is_admin()));

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
  if not (select private.is_admin()) then
    raise exception 'Acesso administrativo necessário.';
  end if;
  if p_status not in ('new','contacted','confirmed','preparing','shipped','completed','cancelled') then
    raise exception 'Status do pedido inválido.';
  end if;

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
      update public.product_variant_stock
      set stock = stock - v_item.quantity
      where variant_id = v_item.variant_id and size = v_item.size and stock >= v_item.quantity;
      get diagnostics v_updated = row_count;
      if v_updated <> 1 then
        raise exception 'Estoque insuficiente para % — tamanho %.', v_item.product_name, v_item.size;
      end if;
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

  update public.orders set
    status = p_status,
    inventory_committed_at = v_order.inventory_committed_at,
    inventory_released_at = v_order.inventory_released_at,
    updated_at = v_now
  where id = p_order_id returning * into v_order;
  return v_order;
end;
$$;

revoke all on function public.update_order_status_with_inventory(uuid, text) from public, anon;
grant execute on function public.update_order_status_with_inventory(uuid, text) to authenticated;
