-- Drop broken policies
drop policy if exists "Users can view documents shared with them" on public.documents;
drop policy if exists "document owner can manage user shares" on public.document_user_shares;

-- SECURITY DEFINER: check document_user_shares without triggering documents RLS
create or replace function public.is_document_shared_with_user(p_doc_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.document_user_shares
    where document_id = p_doc_id
      and shared_with_user_id = p_user_id
  );
end;
$$;

-- SECURITY DEFINER: check document ownership without triggering document_user_shares RLS
create or replace function public.is_document_owned_by(p_doc_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.documents
    where id = p_doc_id
      and user_id = p_user_id
  );
end;
$$;

grant execute on function public.is_document_shared_with_user(uuid, uuid) to authenticated;
grant execute on function public.is_document_owned_by(uuid, uuid) to authenticated;

-- Re-create documents SELECT policy using SECURITY DEFINER function
create policy "Users can view documents shared with them"
  on public.documents
  for select
  using (
    public.is_document_shared_with_user(id, auth.uid())
  );

-- Re-create document_user_shares owner policy using SECURITY DEFINER function
create policy "document owner can manage user shares"
  on public.document_user_shares
  for all
  using (
    public.is_document_owned_by(document_id, auth.uid())
  );
