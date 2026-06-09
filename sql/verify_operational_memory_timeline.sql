-- Verify Operational Memory & Accountability Timeline
-- Run after sql/operational_memory_timeline.sql in Supabase SQL Editor.

with required_columns(column_name) as (
  values
    ('id'),
    ('workspace_id'),
    ('record_type'),
    ('record_id'),
    ('related_record_type'),
    ('related_record_id'),
    ('event_type'),
    ('actor_id'),
    ('actor_label'),
    ('note'),
    ('metadata'),
    ('event_timestamp'),
    ('created_at')
),
column_check as (
  select
    rc.column_name,
    exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'field_ops_timeline_events'
        and c.column_name = rc.column_name
    ) as exists_ok
  from required_columns rc
),
index_check as (
  select
    exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'field_ops_timeline_events'
        and indexname = 'field_ops_timeline_workspace_record_idx'
    ) as record_index_ok,
    exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'field_ops_timeline_events'
        and indexname = 'field_ops_timeline_workspace_event_idx'
    ) as event_index_ok
),
rls_check as (
  select
    coalesce((
      select relrowsecurity
      from pg_class
      where oid = 'public.field_ops_timeline_events'::regclass
    ), false) as rls_enabled
),
policy_check as (
  select
    exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'field_ops_timeline_events'
        and policyname = 'Workspace members can read timeline events'
    ) as read_policy_ok,
    exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'field_ops_timeline_events'
        and policyname = 'Workspace members can create timeline events'
    ) as insert_policy_ok
),
constraint_check as (
  select
    exists (
      select 1
      from pg_constraint
      where conname = 'field_ops_timeline_record_type_check'
    ) as record_type_constraint_ok,
    exists (
      select 1
      from pg_constraint
      where conname = 'field_ops_timeline_event_type_check'
    ) as event_type_constraint_ok
)
select
  'timeline table exists' as check_name,
  case when to_regclass('public.field_ops_timeline_events') is not null then 'pass' else 'fail' end as result,
  'Required for structured operational memory events.' as note
union all
select
  'timeline required columns exist',
  case when bool_and(exists_ok) then 'pass' else 'fail' end,
  string_agg(column_name || '=' || case when exists_ok then 'ok' else 'missing' end, ', ' order by column_name)
from column_check
union all
select
  'timeline supporting indexes exist',
  case when record_index_ok and event_index_ok then 'pass' else 'fail' end,
  'record_index=' || record_index_ok || ', event_index=' || event_index_ok
from index_check
union all
select
  'timeline RLS enabled',
  case when rls_enabled then 'pass' else 'fail' end,
  'RLS must be enabled before browser access.'
from rls_check
union all
select
  'timeline policies exist',
  case when read_policy_ok and insert_policy_ok then 'pass' else 'fail' end,
  'read_policy=' || read_policy_ok || ', insert_policy=' || insert_policy_ok
from policy_check
union all
select
  'timeline event constraints exist',
  case when record_type_constraint_ok and event_type_constraint_ok then 'pass' else 'fail' end,
  'record_type_constraint=' || record_type_constraint_ok || ', event_type_constraint=' || event_type_constraint_ok
from constraint_check
union all
select
  'manual client QA still required',
  'info',
  'Use an Owner/Admin account to create, assign, complete, upload, archive/reopen, and confirm Timeline entries render.';
