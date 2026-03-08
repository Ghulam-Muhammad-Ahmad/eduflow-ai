-- Add logo_url to workspaces (same pattern as profiles.avatar_url)
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS logo_url text;

-- Create workspace-logos storage bucket (same pattern as avatars)
INSERT INTO storage.buckets (id, name, public)
VALUES ('workspace-logos', 'workspace-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for workspace logo uploads and access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Workspace logos are publicly accessible'
  ) THEN
    CREATE POLICY "Workspace logos are publicly accessible"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'workspace-logos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Workspace owners can upload logos'
  ) THEN
    CREATE POLICY "Workspace owners can upload logos"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'workspace-logos'
        AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.workspaces WHERE owner_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Workspace owners can update logos'
  ) THEN
    CREATE POLICY "Workspace owners can update logos"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'workspace-logos'
        AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.workspaces WHERE owner_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Workspace owners can delete logos'
  ) THEN
    CREATE POLICY "Workspace owners can delete logos"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'workspace-logos'
        AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.workspaces WHERE owner_id = auth.uid())
      );
  END IF;
END $$;
