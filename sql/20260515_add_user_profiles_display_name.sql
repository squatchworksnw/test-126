alter table public.field_ops_user_profiles
  add column if not exists display_name text;

update public.field_ops_user_profiles
set display_name = coalesce(display_name, nature_nickname)
where display_name is null
  and nature_nickname is not null;
