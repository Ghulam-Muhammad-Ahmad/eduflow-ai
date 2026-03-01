import type { NextApiRequest, NextApiResponse } from "next";

const PADDLE_API_BASE =
  process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "production"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";

/**
 * Creates a Paddle transaction and returns the checkout URL.
 * Frontend redirects to this URL for full-page checkout (no overlay).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.PADDLE_API_KEY?.trim();
  if (!apiKey) {
    console.error("[checkout-url] PADDLE_API_KEY not set");
    return res.status(500).json({ error: "Checkout not configured" });
  }

  const body = req.body as {
    priceId?: string;
    successUrl?: string;
    customData?: Record<string, string>;
  };
  const priceId = body?.priceId?.trim();
  if (!priceId) {
    return res.status(400).json({ error: "priceId is required" });
  }

  // Use Paddle's default payment link (set in Dashboard → Checkout → Checkout settings).
  // Passing a custom URL requires the domain to be approved; null avoids "domain not approved" errors.
  const payload = {
    items: [{ price_id: priceId, quantity: 1 }],
    custom_data: body.customData ?? {},
    collection_mode: "automatic" as const,
    checkout: {
      url: null,
    },
  };

  const response = await fetch(`${PADDLE_API_BASE}/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[checkout-url] Paddle API error:", response.status, errText);
    return res.status(response.status).json({
      error: "Failed to create checkout",
      details: response.status === 401 ? "Invalid PADDLE_API_KEY" : undefined,
    });
  }

  const data = (await response.json()) as {
    data?: {
      id?: string;
      checkout?: { url?: string };
    };
  };
  const url = data?.data?.checkout?.url ?? null;
  if (!url) {
    return res.status(500).json({ error: "No checkout URL in response" });
  }

  const successUrl = body.successUrl?.trim();
  const finalUrl = successUrl ? `${url}${url.includes("?") ? "&" : "?"}success_url=${encodeURIComponent(successUrl)}` : url;

  return res.status(200).json({ url: finalUrl, transactionId: data?.data?.id });
}
