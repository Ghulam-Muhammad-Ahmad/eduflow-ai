create table public.document_user_shares (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  shared_with_user_id uuid not null references auth.users(id) on delete cascade,
  shared_at timestamptz not null default now(),
  unique (document_id, shared_with_user_id)
);

alter table public.document_user_shares enable row level security;

-- Document owner can manage all shares for their documents
create policy "document owner can manage user shares"
  on public.document_user_shares
  for all
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_id
      and d.user_id = auth.uid()
    )
  );

-- Recipient can read shares directed at them
create policy "shared user can read their shares"
  on public.document_user_shares
  for select
  using (shared_with_user_id = auth.uid());
