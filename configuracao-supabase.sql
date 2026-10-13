create table if not exists public.user_routes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  route_data jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_routes enable row level security;

drop policy if exists "user_routes_select_own" on public.user_routes;
drop policy if exists "user_routes_insert_own" on public.user_routes;
drop policy if exists "user_routes_update_own" on public.user_routes;
drop policy if exists "user_routes_delete_own" on public.user_routes;

create policy "user_routes_select_own" on public.user_routes for select to authenticated using (auth.uid() = user_id);
create policy "user_routes_insert_own" on public.user_routes for insert to authenticated with check (auth.uid() = user_id);
create policy "user_routes_update_own" on public.user_routes for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_routes_delete_own" on public.user_routes for delete to authenticated using (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_routes'
  ) then
    alter publication supabase_realtime add table public.user_routes;
  end if;
end $$;

create table if not exists public.user_corrections (
  user_id uuid not null references auth.users(id) on delete cascade,
  correction_key text not null,
  lat double precision not null,
  lng double precision not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, correction_key)
);

alter table public.user_corrections enable row level security;

drop policy if exists "user_corrections_select_own" on public.user_corrections;
drop policy if exists "user_corrections_insert_own" on public.user_corrections;
drop policy if exists "user_corrections_update_own" on public.user_corrections;
drop policy if exists "user_corrections_delete_own" on public.user_corrections;

create policy "user_corrections_select_own" on public.user_corrections for select to authenticated using (auth.uid() = user_id);
create policy "user_corrections_insert_own" on public.user_corrections for insert to authenticated with check (auth.uid() = user_id);
create policy "user_corrections_update_own" on public.user_corrections for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_corrections_delete_own" on public.user_corrections for delete to authenticated using (auth.uid() = user_id);
