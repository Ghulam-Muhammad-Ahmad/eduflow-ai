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

The webhook uses these to upsert `workspace_subscriptions` or `user_subscriptions`.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| **401 Invalid signature** | Use the **endpoint secret** for this exact webhook URL only: Paddle Dashboard → **Developer tools** → **Notifications** → open the destination for `https://your-ngrok-or-domain/api/webhooks/paddle` → copy the **Secret key** (endpoint secret). Put it in `PADDLE_WEBHOOK_SECRET` with no extra spaces or newlines. Do not use the client-side token or API key. With ngrok, ensure the URL in Paddle matches your current ngrok URL. |
| **400 `transaction_default_checkout_url_not_set`** | Set **Default payment link** in Paddle → Checkout → Checkout settings (step 4 above). Use `http://localhost:3000` for local dev. |
| **CSP `frame-ancestors` (report-only)** | Use `http://localhost` so Paddle's iframe is allowed. Report-only = logged, not blocked. |
| **Google Pay manifest failed** | Safe to ignore in dev. |

## Enforcement (optional)

To gate features by subscription, use `useWorkspaceSubscription(workspaceId)` or `useUserSubscription()` and check `hasAccess`. If `!hasAccess`, redirect to the relevant billing page or show “Choose a plan”.
