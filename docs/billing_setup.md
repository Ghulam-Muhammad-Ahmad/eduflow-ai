# Billing (Paddle) Setup – Sprint 5

## Environment variables

Add to `.env.local` (and configure in your host for production):

### Paddle (Sandbox)

- **`PADDLE_WEBHOOK_SECRET`** – Webhook endpoint secret from Paddle Developer Tools → Notifications. Used to verify `POST /api/webhooks/paddle`.
- **`PADDLE_API_KEY`** – Server-side API key (Developer Tools → Authentication → API keys). Used by `GET/POST /api/paddle/portal-session` to create Customer Portal sessions so users can cancel or update payment from the Billing tab. Do not use the client-side token here.
- **`NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`** – Client-side token (starts with `test_` in sandbox). Used by Paddle.js for checkout.
- **`NEXT_PUBLIC_PADDLE_ENVIRONMENT`** – `sandbox` or `production`.

### Price IDs (optional until products exist)

For each plan × cycle you use, set:

- `NEXT_PUBLIC_PADDLE_PRICE_STUDENT_BASIC_MONTHLY`
- `NEXT_PUBLIC_PADDLE_PRICE_STUDENT_BASIC_ANNUAL`
- `NEXT_PUBLIC_PADDLE_PRICE_STUDENT_PRO_MONTHLY` / `_ANNUAL`
- `NEXT_PUBLIC_PADDLE_PRICE_STUDENT_PLUS_MONTHLY` / `_ANNUAL`
- `NEXT_PUBLIC_PADDLE_PRICE_TUTOR_BASIC_MONTHLY` / `_ANNUAL` (and Pro, Plus)
- `NEXT_PUBLIC_PADDLE_PRICE_BUSINESS_BASIC_MONTHLY` / `_ANNUAL` (and Pro, Plus)

### AI Credits and Doc Storage (plan-linked)

**Preferred: Paddle product/price custom data.** Set `custom_data` on the product or price in Paddle (e.g. `ai_credits: 100`, `doc_storage: 5`). The webhook reads these first; `doc_storage` is in **GB** and is stored as `doc_storage_limit_mb` in the DB. If `custom_data` is missing, the webhook falls back to env-based credits and does not set a doc storage limit (UI uses defaults: 50 MB student, 100 MB teacher).

**Env fallback for AI credits** (used when product custom_data has no `ai_credits`). Credits per plan (monthly pool):

- `AI_CREDITS_STUDENT_BASIC`, `AI_CREDITS_STUDENT_PRO`, `AI_CREDITS_STUDENT_PLUS`
- `AI_CREDITS_TUTOR_BASIC`, `AI_CREDITS_TUTOR_PRO`, `AI_CREDITS_TUTOR_PLUS`
- `AI_CREDITS_BUSINESS_BASIC`, `AI_CREDITS_BUSINESS_PRO`, `AI_CREDITS_BUSINESS_PLUS`
- `AI_CREDITS_DEFAULT` – fallback when user/workspace has no subscription (e.g. 0)

Feature weightage (credits per AI request). Default 1 if unset.

- `AI_CREDIT_WEIGHT_CHECKER`, `AI_CREDIT_WEIGHT_PAPER_GENERATION`, `AI_CREDIT_WEIGHT_WORKSHEET_GENERATION`
- `AI_CREDIT_WEIGHT_RUBRIC_GENERATION`, `AI_CREDIT_WEIGHT_CONTENT_GENERATION`, `AI_CREDIT_WEIGHT_LESSON_PLANNING`
- `AI_CREDIT_WEIGHT_QUIZ_QUESTIONS`, `AI_CREDIT_WEIGHT_DIFFERENTIATION`, `AI_CREDIT_WEIGHT_STUDY_MATERIALS`
- `AI_CREDIT_WEIGHT_CONCEPT_EXPLANATION`, `AI_CREDIT_WEIGHT_STUDY_PLAN`, `AI_CREDIT_WEIGHT_PRACTICE_QUESTIONS`, `AI_CREDIT_WEIGHT_FLASHCARDS`

### Supabase (webhook only)

- **`SUPABASE_SERVICE_ROLE_KEY`** – Service role key so the webhook can write to `workspace_subscriptions` and `user_subscriptions` (bypasses RLS).

## Paddle configuration

1. Create a [Paddle Sandbox](https://sandbox-vendors.paddle.com/) account.
2. Create products and prices for Student, Tutor, and Business (Basic/Pro/Plus; monthly and annual where offered).
3. Enable a 14-day free trial on each **Basic** price.
4. **Set Default payment link** (required or you get `transaction_default_checkout_url_not_set`):
   - Go to **Checkout → Checkout settings**: [Sandbox](https://sandbox-vendors.paddle.com/checkout-settings) | [Production](https://vendors.paddle.com/checkout-settings)
   - Under **Default payment link**, enter the URL of your **checkout page** (e.g. `https://your-domain.com/checkout`). The app uses redirect-to-checkout (no overlay); the `/checkout` page loads Paddle.js and opens the transaction inline.
   - For local dev use **http** (not https): `http://localhost:3000/checkout`. If you use `https://localhost:3000/checkout`, the checkout page will redirect to http so the app can load.
   - Click **Save**.
5. (Optional) **Checkout → Website approval**: In sandbox, domains are auto-approved; add `http://localhost:3000` if you use it as the default payment link.
6. Create a notification destination (URL: `https://your-domain.com/api/webhooks/paddle`) and copy the **endpoint secret** into `PADDLE_WEBHOOK_SECRET`.
7. In Paddle, get your **client-side token** (Developer Tools → Authentication) and set `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`.

## Checkout custom data

When opening checkout, we send:

- **Owner / Tutor:** `customData.workspaceId` = current workspace ID.
- **Student:** `customData.userId` = current user ID.

The webhook uses these to upsert `workspace_subscriptions` or `user_subscriptions`. It also reads **product/price custom_data** (from the payload or via Paddle API): `ai_credits` for the monthly credit pool and `doc_storage` (GB) for Doc Center storage limit (`doc_storage_limit_mb`). If `custom_data` is not in the payload, the webhook calls `GET /prices/{price_id}?include=product` to fetch it (requires `PADDLE_API_KEY`).

## Troubleshooting

| Issue | Fix |
|-------|-----|
| **401 Invalid signature** | Use the **endpoint secret** for this exact webhook URL only: Paddle Dashboard → **Developer tools** → **Notifications** → open the destination for `https://your-ngrok-or-domain/api/webhooks/paddle` → copy the **Secret key** (endpoint secret). Put it in `PADDLE_WEBHOOK_SECRET` with no extra spaces or newlines. Do not use the client-side token or API key. With ngrok, ensure the URL in Paddle matches your current ngrok URL. |
| **400 `transaction_default_checkout_url_not_set`** | Set **Default payment link** in Paddle → Checkout → Checkout settings (step 4 above). Use `http://localhost:3000` for local dev. |
| **CSP `frame-ancestors` (report-only)** | Use `http://localhost` so Paddle's iframe is allowed. Report-only = logged, not blocked. |
| **Google Pay manifest failed** | Safe to ignore in dev. |

## Enforcement (optional)

To gate features by subscription, use `useWorkspaceSubscription(workspaceId)` or `useUserSubscription()` and check `hasAccess`. If `!hasAccess`, redirect to the relevant billing page or show “Choose a plan”.
