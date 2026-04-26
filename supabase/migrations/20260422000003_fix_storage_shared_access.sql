-- Drop the storage policy that relied on inline documents join (RLS chain caused 404)
drop policy if exists "Users can download documents shared with them" on storage.objects;

-- SECURITY DEFINER bypasses RLS on both documents + document_user_shares
create or replace function public.can_user_access_shared_storage_object(p_file_path text, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.documents d
    join public.document_user_shares dus on dus.document_id = d.id
    where d.file_path = p_file_path
      and dus.shared_with_user_id = p_user_id
  );
end;
$$;

grant execute on function public.can_user_access_shared_storage_object(text, uuid) to authenticated;

create policy "Users can download documents shared with them"
  on storage.objects
  for select
  using (
    bucket_id = 'documents'
    and public.can_user_access_shared_storage_object(name, auth.uid())
  );
