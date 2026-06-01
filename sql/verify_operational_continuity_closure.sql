-- Verification for Operational Continuity Closure.
-- Run after sql/operational_continuity_closure.sql in Supabase SQL Editor.
-- This script reports checks only and does not change data.

select
  'assigned_person column exists' as check_name,
  case when exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'field_ops_work_orders'
      and column_name = 'assigned_person'
      and data_type = 'text'
  ) then 'pass' else 'fail' end as result;

select
  'assigned_person supporting index exists' as check_name,
  case when exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'field_ops_work_orders'
      and indexname = 'idx_field_ops_work_orders_assigned_person'
  ) then 'pass' else 'fail' end as result;

select
  'work order table still has RLS enabled' as check_name,
  case when c.relrowsecurity then 'pass' else 'fail' end as result
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'field_ops_work_orders';

select
  'work order RLS policies still present' as check_name,
  case when count(*) > 0 then 'pass' else 'fail' end as result,
  count(*) as policy_count
from pg_policies
where schemaname = 'public'
  and tablename = 'field_ops_work_orders';

select
  'existing work order rows remain intact' as check_name,
  'info' as result,
  count(*) as total_rows,
  count(*) filter (where assigned_person is not null) as rows_with_structured_assignment,
  count(*) filter (where notes ~* '(?m)^Assigned:\s*') as rows_with_legacy_assignment_notes
from public.field_ops_work_orders;

with legacy as (
  select
    id,
    assigned_person,
    trim((regexp_match(notes, '(?im)^Assigned:\s*([^\n]+)'))[1]) as legacy_assigned_person
  from public.field_ops_work_orders
  where notes ~* '(?m)^Assigned:\s*'
)
select
  'legacy assignment notes safely backfilled when empty' as check_name,
  case
    when count(*) filter (
      where assigned_person is null
         or assigned_person <> legacy_assigned_person
    ) = 0 then 'pass'
    else 'review'
  end as result,
  count(*) as legacy_note_rows,
  count(*) filter (where assigned_person = legacy_assigned_person) as matching_backfilled_rows,
  count(*) filter (where assigned_person is null) as still_missing_rows
from legacy;

select
  'app write payload shape is compatible' as check_name,
  case when exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'field_ops_work_orders'
      and column_name in (
        'title',
        'status',
        'priority',
        'due_date',
        'assigned_person',
        'notes'
      )
    group by table_schema, table_name
    having count(*) = 6
  ) then 'pass' else 'fail' end as result;

select
  'manual client QA still required' as check_name,
  'info' as result,
  'Use an Owner/Admin account in the app to create, edit, and approve a work order with assigned_person.' as note;
