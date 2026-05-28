create table if not exists public.congresso_inscricoes (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  full_name text,
  email text,
  cpf text,
  church text,
  payment_method text,
  payment_status text not null default 'Pendente',
  payment_reference text,
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

drop trigger if exists set_congresso_inscricoes_updated_at on public.congresso_inscricoes;
create trigger set_congresso_inscricoes_updated_at
before update on public.congresso_inscricoes
for each row
execute function public.set_updated_at();

alter table public.congresso_inscricoes enable row level security;

drop policy if exists "Site pode ler inscricoes" on public.congresso_inscricoes;
create policy "Site pode ler inscricoes"
on public.congresso_inscricoes
for select
to anon
using (true);

drop policy if exists "Site pode criar inscricoes" on public.congresso_inscricoes;
create policy "Site pode criar inscricoes"
on public.congresso_inscricoes
for insert
to anon
with check (true);

drop policy if exists "Site pode atualizar inscricoes" on public.congresso_inscricoes;
create policy "Site pode atualizar inscricoes"
on public.congresso_inscricoes
for update
to anon
using (true)
with check (true);

drop policy if exists "Site pode remover inscricoes" on public.congresso_inscricoes;
create policy "Site pode remover inscricoes"
on public.congresso_inscricoes
for delete
to anon
using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprovantes',
  'comprovantes',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Site pode ler comprovantes" on storage.objects;
create policy "Site pode ler comprovantes"
on storage.objects
for select
to anon
using (bucket_id = 'comprovantes');

drop policy if exists "Site pode enviar comprovantes" on storage.objects;
create policy "Site pode enviar comprovantes"
on storage.objects
for insert
to anon
with check (bucket_id = 'comprovantes');
