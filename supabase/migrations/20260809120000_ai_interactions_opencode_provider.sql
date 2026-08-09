-- AI generation moved from the OpenAI API to the OpenCode Go (Zen) gateway.
-- Allow 'opencode' as an ai_interactions.provider value; keep the existing
-- values so historical rows stay valid.

ALTER TABLE public.ai_interactions
  DROP CONSTRAINT IF EXISTS ai_interactions_provider_check;

ALTER TABLE public.ai_interactions
  ADD CONSTRAINT ai_interactions_provider_check CHECK (
    provider = ANY (ARRAY[
      'opencode'::text,
      'openai'::text,
      'gemini'::text
    ])
  );
