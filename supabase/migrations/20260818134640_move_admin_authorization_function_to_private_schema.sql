create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

alter function public.is_admin() set schema private;
alter function private.is_admin() set search_path = '';

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

