-- ============================================================
-- Sprint 5: Billing – workspace_subscriptions & user_subscriptions
-- Paddle webhook stores subscription state; trial_ends_at on workspace for app-level trial
-- ============================================================

-- Optional: trial_ends_at on workspaces (app-level 14-day trial before first plan selection)
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- Workspace subscriptions (Owner / Solo Tutor – plan applies to workspace)
CREATE TABLE IF NOT EXISTS public.workspace_subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  paddle_subscription_id text,
  paddle_customer_id    text,
  price_id              text,
  status                text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'inactive')),
  current_period_ends_at timestamptz,
  trial_ends_at         timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_subscriptions_workspace_id ON public.workspace_subscriptions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_subscriptions_paddle_sub_id ON public.workspace_subscriptions(paddle_subscription_id) WHERE paddle_subscription_id IS NOT NULL;

ALTER TABLE public.workspace_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workspace_subscriptions' AND policyname = 'Workspace members can view subscription') THEN
    CREATE POLICY "Workspace members can view subscription"
      ON public.workspace_subscriptions FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.workspaces w
          WHERE w.id = workspace_subscriptions.workspace_id
          AND (w.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = w.id AND wm.user_id = auth.uid()))
        )
      );
  END IF;
END $$;

-- Only service role / webhook can insert/update (no app policy for INSERT/UPDATE; use service key in API route)
-- For app read-only we only need SELECT. Webhook will use service key or a dedicated role.

-- User subscriptions (Student – plan applies to user)
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paddle_subscription_id text,
  paddle_customer_id    text,
  price_id              text,
  status                text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'inactive')),
  current_period_ends_at timestamptz,
  trial_ends_at         timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_paddle_sub_id ON public.user_subscriptions(paddle_subscription_id) WHERE paddle_subscription_id IS NOT NULL;

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_subscriptions' AND policyname = 'Users can view own subscription') THEN
    CREATE POLICY "Users can view own subscription"
      ON public.user_subscriptions FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

-- Trigger: keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_subscription_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_workspace_subscriptions_updated_at ON public.workspace_subscriptions;
CREATE TRIGGER update_workspace_subscriptions_updated_at
  BEFORE UPDATE ON public.workspace_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_subscription_updated_at();

DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON public.user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_subscription_updated_at();
