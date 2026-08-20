create index if not exists shipping_oauth_states_user_id_idx
  on public.shipping_oauth_states (user_id);

create policy shipping_oauth_states_deny_public
on public.shipping_oauth_states
for all to anon, authenticated
using (false)
with check (false);

create policy shipping_integrations_deny_public
on public.shipping_integrations
for all to anon, authenticated
using (false)
with check (false);
