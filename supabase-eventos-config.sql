create table if not exists public.eventos_config (
  key text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  paid boolean not null default false,
  capacity integer not null default 450,
  audience text,
  description text,
  address text,
  maps_url text,
  starts_at text,
  ends_at text,
  active boolean not null default true,
  data jsonb not null default '{}'::jsonb
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_eventos_config_updated_at on public.eventos_config;
create trigger set_eventos_config_updated_at
before update on public.eventos_config
for each row
execute function public.set_updated_at();

alter table public.eventos_config enable row level security;

drop policy if exists "Site pode ler eventos" on public.eventos_config;
create policy "Site pode ler eventos"
on public.eventos_config
for select
to anon
using (true);

drop policy if exists "Site pode criar eventos" on public.eventos_config;
create policy "Site pode criar eventos"
on public.eventos_config
for insert
to anon
with check (true);

drop policy if exists "Site pode atualizar eventos" on public.eventos_config;
create policy "Site pode atualizar eventos"
on public.eventos_config
for update
to anon
using (true)
with check (true);
