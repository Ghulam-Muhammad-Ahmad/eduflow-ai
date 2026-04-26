-- Allow users to read documents shared directly with them
create policy "Users can view documents shared with them"
  on public.documents
  for select
  using (
    exists (
      select 1 from public.document_user_shares dus
      where dus.document_id = id
      and dus.shared_with_user_id = auth.uid()
    )
  );

-- Allow users to download storage objects for documents shared with them
create policy "Users can download documents shared with them"
  on storage.objects
  for select
  using (
    bucket_id = 'documents'
    and exists (
      select 1
      from public.documents d
      join public.document_user_shares dus on dus.document_id = d.id
      where d.file_path = name
      and dus.shared_with_user_id = auth.uid()
    )
  );
