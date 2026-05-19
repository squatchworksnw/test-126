-- Upload / Import Review RLS debug helper
-- Run in Supabase SQL Editor.
-- This script inspects the policy path for document uploads and review intake.
-- It does not bypass RLS and does not require a service-role key in the frontend.

-- 1. Confirm the required identity/workspace columns exist.
select
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('field_ops_documents', 'field_ops_import_reviews', 'field_ops_memberships')
  and column_name in (
    'id',
    'workspace_id',
    'created_by',
    'submitted_by',
    'user_id',
    'role',
    'archived_at'
  )
order by table_name, column_name;

-- 2. Confirm RLS is enabled.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('field_ops_documents', 'field_ops_import_reviews', 'field_ops_memberships')
order by c.relname;

-- 3. Review active policies for the upload/review path.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('field_ops_documents', 'field_ops_import_reviews', 'field_ops_memberships')
order by tablename, policyname;

-- 4. Confirm Storage policies for the documents bucket.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by policyname;

-- Expected frontend insert payloads after this patch:
-- field_ops_documents:
--   workspace_id = current workspace id
--   created_by = auth.uid()
--   storage_bucket = 'documents'
--   storage_path starts with workspace_id || '/'
--
-- field_ops_import_reviews:
--   workspace_id = current workspace id
--   created_by = auth.uid()
--   document_id = optional linked field_ops_documents.id
--
-- Required policy behavior:
-- 1. Owner/Admin/Submitter with a row in field_ops_memberships may insert field_ops_documents for their workspace.
-- 2. Owner/Admin/Submitter with a row in field_ops_memberships may insert field_ops_import_reviews for their workspace.
-- 3. Submitter may create intake/review rows, but may not create live field_ops_work_orders directly.
-- 4. Storage upload to bucket 'documents' must allow authenticated workspace members to upload paths under their workspace id.
-- 5. Storage read should only allow workspace members for that path/workspace.
