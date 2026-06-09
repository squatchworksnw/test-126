-- Operational Memory & Accountability Timeline
-- Idempotent: creates the timeline table and policies without dropping or rewriting existing records.

create table if not exists public.field_ops_timeline_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.field_ops_workspaces(id) on delete cascade,
  record_type text not null,
  record_id uuid not null,
  related_record_type text,
  related_record_id uuid,
  event_type text not null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_label text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  event_timestamp timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint field_ops_timeline_record_type_check check (
    record_type in ('work_order', 'maintenance_request', 'vehicle', 'asset', 'building', 'scheduled_work', 'document')
  ),
  constraint field_ops_timeline_event_type_check check (
    event_type in (
      'created',
      'reviewed',
      'approved',
      'rejected',
      'returned_more_information',
      'assigned',
      'reassigned',
      'completed',
      'archived',
      'reopened',
      'document_uploaded',
      'comment_added',
      'service_updated'
    )
  )
);

alter table public.field_ops_timeline_events enable row level security;

create index if not exists field_ops_timeline_workspace_record_idx
  on public.field_ops_timeline_events(workspace_id, record_type, record_id, event_timestamp desc);

create index if not exists field_ops_timeline_workspace_event_idx
  on public.field_ops_timeline_events(workspace_id, event_type, event_timestamp desc);

grant select, insert on public.field_ops_timeline_events to authenticated;

drop policy if exists "Workspace members can read timeline events" on public.field_ops_timeline_events;
create policy "Workspace members can read timeline events"
  on public.field_ops_timeline_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.field_ops_memberships m
      where m.workspace_id = field_ops_timeline_events.workspace_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "Workspace members can create timeline events" on public.field_ops_timeline_events;
create policy "Workspace members can create timeline events"
  on public.field_ops_timeline_events
  for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and exists (
      select 1
      from public.field_ops_memberships m
      where m.workspace_id = field_ops_timeline_events.workspace_id
        and m.user_id = auth.uid()
    )
  );
