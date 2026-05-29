create table if not exists public.admin_config (
  id text primary key,
  admin_user text not null,
  password_hash text not null,
  updated_at timestamptz not null default now()
);

alter table public.admin_config enable row level security;

insert into public.admin_config (id, admin_user, password_hash)
values (
  'main',
  'secretaria',
  'a8be719ce804dbd06ea3eb3c9a9dc49feb56cc8248bda78a535af8180c34bb37'
)
on conflict (id) do nothing;

drop policy if exists "Site pode ler config admin" on public.admin_config;
create policy "Site pode ler config admin"
on public.admin_config
for select
to anon
using (true);

drop policy if exists "Site pode atualizar config admin" on public.admin_config;
create policy "Site pode atualizar config admin"
on public.admin_config
for update
to anon
using (true)
with check (true);

drop policy if exists "Site pode criar config admin" on public.admin_config;
create policy "Site pode criar config admin"
on public.admin_config
for insert
to anon
with check (true);
