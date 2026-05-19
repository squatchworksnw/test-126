-- Upload / Import Review RLS policy template
-- Run only if sql/upload_review_rls_debug.sql shows missing insert policies.
-- Review names/columns first. This assumes:
--   field_ops_memberships.workspace_id
--   field_ops_memberships.user_id
--   field_ops_memberships.role in ('owner', 'admin', 'submitter')
--   field_ops_documents.workspace_id, created_by
--   field_ops_import_reviews.workspace_id, created_by
--   storage.objects.bucket_id, storage.objects.name

alter table public.field_ops_documents enable row level security;
alter table public.field_ops_import_reviews enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'field_ops_documents'
      and policyname = 'workspace members can insert document metadata'
  ) then
    create policy "workspace members can insert document metadata"
    on public.field_ops_documents
    for insert
    to authenticated
    with check (
      created_by = auth.uid()
      and exists (
        select 1
        from public.field_ops_memberships m
        where m.workspace_id = field_ops_documents.workspace_id
          and m.user_id = auth.uid()
          and m.role in ('owner', 'admin', 'submitter')
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'field_ops_import_reviews'
      and policyname = 'workspace members can insert review intake'
  ) then
    create policy "workspace members can insert review intake"
    on public.field_ops_import_reviews
    for insert
    to authenticated
    with check (
      created_by = auth.uid()
      and exists (
        select 1
        from public.field_ops_memberships m
        where m.workspace_id = field_ops_import_reviews.workspace_id
          and m.user_id = auth.uid()
          and m.role in ('owner', 'admin', 'submitter')
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'workspace members can upload documents'
  ) then
    create policy "workspace members can upload documents"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'documents'
      and exists (
        select 1
        from public.field_ops_memberships m
        where m.workspace_id::text = split_part(name, '/', 1)
          and m.user_id = auth.uid()
          and m.role in ('owner', 'admin', 'submitter')
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'workspace members can read documents'
  ) then
    create policy "workspace members can read documents"
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'documents'
      and exists (
        select 1
        from public.field_ops_memberships m
        where m.workspace_id::text = split_part(name, '/', 1)
          and m.user_id = auth.uid()
      )
    );
  end if;
end
$$;
