-- Operational Continuity Closure
-- Run once before deploying the structured assignment app changes.

alter table public.field_ops_work_orders
  add column if not exists assigned_person text;

create index if not exists idx_field_ops_work_orders_assigned_person
  on public.field_ops_work_orders (workspace_id, assigned_person)
  where archived_at is null and assigned_person is not null;

update public.field_ops_work_orders
set assigned_person = trim((regexp_match(notes, '(?im)^Assigned:\s*([^\n]+)'))[1])
where assigned_person is null
  and notes ~* '(?m)^Assigned:\s*';

comment on column public.field_ops_work_orders.assigned_person
  is 'Structured person, team, or vendor assignment used by Assigned Work.';
