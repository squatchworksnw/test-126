create table if not exists public.field_ops_user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nature_nickname text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.field_ops_user_profiles enable row level security;

grant select, insert, update on public.field_ops_user_profiles to authenticated;

drop policy if exists "field ops profiles self select" on public.field_ops_user_profiles;
create policy "field ops profiles self select"
  on public.field_ops_user_profiles
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "field ops profiles self insert" on public.field_ops_user_profiles;
create policy "field ops profiles self insert"
  on public.field_ops_user_profiles
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "field ops profiles self update" on public.field_ops_user_profiles;
create policy "field ops profiles self update"
  on public.field_ops_user_profiles
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
