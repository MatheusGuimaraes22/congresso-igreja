create table if not exists public.admin_users (
  admin_user text primary key,
  password_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

drop trigger if exists set_admin_users_updated_at on public.admin_users;
create trigger set_admin_users_updated_at
before update on public.admin_users
for each row
execute function public.set_updated_at();

alter table public.admin_users enable row level security;

insert into public.admin_users (admin_user, password_hash)
values ('secretaria', 'a8be719ce804dbd06ea3eb3c9a9dc49feb56cc8248bda78a535af8180c34bb37')
on conflict (admin_user) do nothing;

drop policy if exists "Site pode ler usuarios admin" on public.admin_users;
create policy "Site pode ler usuarios admin"
on public.admin_users
for select
to anon
using (true);

drop policy if exists "Site pode criar usuarios admin" on public.admin_users;
create policy "Site pode criar usuarios admin"
on public.admin_users
for insert
to anon
with check (true);

drop policy if exists "Site pode atualizar usuarios admin" on public.admin_users;
create policy "Site pode atualizar usuarios admin"
on public.admin_users
for update
to anon
using (true)
with check (true);
