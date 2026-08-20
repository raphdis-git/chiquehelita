create table if not exists public.shipping_oauth_states (
  state_hash text primary key,
  provider text not null check (provider in ('melhor_envio')),
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.shipping_integrations (
  provider text primary key check (provider in ('melhor_envio')),
  token_type text not null default 'Bearer',
  access_token_ciphertext text not null,
  access_token_iv text not null,
  refresh_token_ciphertext text not null,
  refresh_token_iv text not null,
  scope text,
  expires_at timestamptz not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shipping_oauth_states enable row level security;
alter table public.shipping_integrations enable row level security;

revoke all on table public.shipping_oauth_states from public, anon, authenticated;
revoke all on table public.shipping_integrations from public, anon, authenticated;
grant select, insert, update, delete on table public.shipping_oauth_states to service_role;
grant select, insert, update, delete on table public.shipping_integrations to service_role;

create index if not exists shipping_oauth_states_expires_at_idx
  on public.shipping_oauth_states (expires_at);

comment on table public.shipping_oauth_states is 'Estados OAuth temporários; acessível apenas pelas funções administrativas.';
comment on table public.shipping_integrations is 'Tokens criptografados das integrações de frete; inacessível pela API pública.';
