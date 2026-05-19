-- Owner-managed people + roles
-- Run this once in Supabase SQL Editor.
--
-- This lets the frontend Settings page manage workspace roles safely.
-- It does NOT expose a service-role key to the browser.
--
-- Important:
-- 1. The person being added must already exist in Authentication > Users.
-- 2. The signed-in user calling this must already be an owner of the workspace.

create or replace function public.field_ops_list_workspace_members(p_workspace_id uuid)
returns table (
  user_id uuid,
  email text,
  role text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists (
    select 1
    from public.field_ops_memberships m
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  ) then
    raise exception 'Only workspace owners can manage people.';
  end if;

  return query
  select
    m.user_id,
    u.email::text,
    m.role::text,
    m.created_at,
    m.updated_at
  from public.field_ops_memberships m
  join auth.users u on u.id = m.user_id
  where m.workspace_id = p_workspace_id
  order by
    case m.role when 'owner' then 1 when 'admin' then 2 else 3 end,
    u.email;
end;
$$;

create or replace function public.field_ops_set_member_role_by_email(
  p_workspace_id uuid,
  p_email text,
  p_role text
)
returns table (
  user_id uuid,
  email text,
  role text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_has_membership_id boolean;
begin
  if p_role not in ('owner', 'admin', 'submitter') then
    raise exception 'Role must be owner, admin, or submitter.';
  end if;

  if not exists (
    select 1
    from public.field_ops_memberships m
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  ) then
    raise exception 'Only workspace owners can manage people.';
  end if;

  select u.id
  into v_user_id
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    raise exception 'That email does not exist in Supabase Auth yet. Add or invite the user in Authentication > Users first.';
  end if;

  update public.field_ops_memberships m
  set role = p_role
  where m.workspace_id = p_workspace_id
    and m.user_id = v_user_id;

  if not found then
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
      values (gen_random_uuid(), p_workspace_id, v_user_id, p_role);
    else
      insert into public.field_ops_memberships (workspace_id, user_id, role)
      values (p_workspace_id, v_user_id, p_role);
    end if;
  end if;

  return query
  select v_user_id, trim(p_email)::text, p_role::text;
end;
$$;

grant execute on function public.field_ops_list_workspace_members(uuid) to authenticated;
grant execute on function public.field_ops_set_member_role_by_email(uuid, text, text) to authenticated;
