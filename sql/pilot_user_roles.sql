-- Simple pilot login setup
-- Run this in Supabase SQL Editor after the three users exist in Authentication > Users.
--
-- 1. In Supabase, create or invite exactly three users.
-- 2. Replace the emails below with the real pilot emails.
-- 3. Run this SQL.
-- 4. The app will load each user's role from field_ops_memberships.
--
-- Valid roles for the current app:
--   owner     = full command center
--   admin     = operations workspace, no ownership controls
--   submitter = simple request/upload portal

do $$
declare
  v_workspace_id uuid;
  v_missing text;
  v_has_membership_id boolean;
begin
  create temporary table if not exists _pilot_user_roles (
    email text primary key,
    role text not null check (role in ('owner', 'admin', 'submitter'))
  ) on commit drop;

  truncate table _pilot_user_roles;

  insert into _pilot_user_roles (email, role)
  values
    ('squatchworksnw@gmail.com', 'owner'),
    ('admin@example.com', 'admin'),
    ('submitter@example.com', 'submitter');

  select id
  into v_workspace_id
  from public.field_ops_workspaces
  order by created_at nulls last, id
  limit 1;

  if v_workspace_id is null then
    raise exception 'No field_ops_workspaces row exists yet. Create the workspace first, then rerun this script.';
  end if;

  select string_agg(p.email, ', ')
  into v_missing
  from _pilot_user_roles p
  left join auth.users u on lower(u.email) = lower(p.email)
  where u.id is null;

  if v_missing is not null then
    raise exception 'Create these users first in Authentication > Users: %', v_missing;
  end if;

  update public.field_ops_memberships m
  set role = p.role
  from _pilot_user_roles p
  join auth.users u on lower(u.email) = lower(p.email)
  where m.workspace_id = v_workspace_id
    and m.user_id = u.id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'field_ops_memberships'
      and column_name = 'id'
  )
  into v_has_membership_id;

  if v_has_membership_id then
    insert into public.field_ops_memberships (id, workspace_id, user_id, role)
    select gen_random_uuid(), v_workspace_id, u.id, p.role
    from _pilot_user_roles p
    join auth.users u on lower(u.email) = lower(p.email)
    where not exists (
      select 1
      from public.field_ops_memberships m
      where m.workspace_id = v_workspace_id
        and m.user_id = u.id
    );
  else
    insert into public.field_ops_memberships (workspace_id, user_id, role)
    select v_workspace_id, u.id, p.role
    from _pilot_user_roles p
    join auth.users u on lower(u.email) = lower(p.email)
    where not exists (
      select 1
      from public.field_ops_memberships m
      where m.workspace_id = v_workspace_id
        and m.user_id = u.id
    );
  end if;
end $$;

select
  w.name as workspace,
  u.email,
  m.role
from public.field_ops_memberships m
join public.field_ops_workspaces w on w.id = m.workspace_id
join auth.users u on u.id = m.user_id
where lower(u.email) in (
  lower('owner@example.com'),
  lower('squatchworksnw@gmail.com'),
  lower('admin@example.com'),
  lower('submitter@example.com')
)
order by
  case m.role when 'owner' then 1 when 'admin' then 2 else 3 end,
  u.email;
