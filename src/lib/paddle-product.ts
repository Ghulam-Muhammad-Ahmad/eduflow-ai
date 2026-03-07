/**
 * Paddle product/price custom_data – server-only.
 * Reads ai_credits and doc_storage (GB) from product or price custom_data
 * (payload or Paddle API). Used by the webhook to drive AI credits and Doc Center limits.
 */

export interface ProductCustomData {
  /** AI credits per period (from custom_data.ai_credits). */
  ai_credits: number | null;
  /** Doc storage limit in GB (from custom_data.doc_storage). Stored in DB as MB. */
  doc_storage_gb: number | null;
}

/** Parse custom_data object (from Paddle payload or API). ai_credits and doc_storage may be string or number. */
function parseCustomData(raw: Record<string, unknown> | null | undefined): ProductCustomData {
  if (!raw || typeof raw !== "object") {
    return { ai_credits: null, doc_storage_gb: null };
  }
  let ai_credits: number | null = null;
  const ac = raw.ai_credits;
  if (typeof ac === "number" && !Number.isNaN(ac) && ac >= 0) ai_credits = ac;
  else if (typeof ac === "string") {
    const n = parseInt(ac, 10);
    if (!Number.isNaN(n) && n >= 0) ai_credits = n;
  }

  let doc_storage_gb: number | null = null;
  const ds = raw.doc_storage;
  if (typeof ds === "number" && !Number.isNaN(ds) && ds >= 0) doc_storage_gb = ds;
  else if (typeof ds === "string") {
    const n = parseFloat(ds);
    if (!Number.isNaN(n) && n >= 0) doc_storage_gb = n;
  }

  return { ai_credits, doc_storage_gb };
}

/** Merge two results: prefer non-null values from first, then second. */
function mergeCustomData(a: ProductCustomData, b: ProductCustomData): ProductCustomData {
  return {
    ai_credits: a.ai_credits ?? b.ai_credits ?? null,
    doc_storage_gb: a.doc_storage_gb ?? b.doc_storage_gb ?? null,
  };
}

/** Payload item shape we might get from subscription webhook (items[0]). */
export interface PaddleSubscriptionItem {
  price?: { id?: string; custom_data?: Record<string, unknown> };
  product?: { id?: string; custom_data?: Record<string, unknown> };
}

/**
 * Get product custom_data from webhook payload item (price and/or product).
 * Returns parsed ai_credits and doc_storage_gb; either may be null if not in payload.
 */
export function getCustomDataFromPayload(item: PaddleSubscriptionItem | null | undefined): ProductCustomData {
  if (!item) return { ai_credits: null, doc_storage_gb: null };
  const fromPrice = parseCustomData(item.price?.custom_data as Record<string, unknown> | undefined);
  const fromProduct = parseCustomData(item.product?.custom_data as Record<string, unknown> | undefined);
  return mergeCustomData(fromProduct, fromPrice);
}

const PADDLE_API_BASE =
  process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "production"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";

/**
 * Fetch price by id from Paddle API; optionally include product.
 * Returns custom_data from price and, if included, product.
 */
async function fetchPriceWithProduct(priceId: string): Promise<ProductCustomData> {
  const apiKey = process.env.PADDLE_API_KEY?.trim();
  if (!apiKey) return { ai_credits: null, doc_storage_gb: null };

  const url = `${PADDLE_API_BASE}/prices/${encodeURIComponent(priceId)}?include=product`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) return { ai_credits: null, doc_storage_gb: null };

  const json = (await res.json()) as {
    data?: {
      custom_data?: Record<string, unknown>;
      product?: { custom_data?: Record<string, unknown> };
    };
  };
  const data = json?.data;
  if (!data) return { ai_credits: null, doc_storage_gb: null };

  const fromPrice = parseCustomData(data.custom_data);
  const fromProduct = data.product ? parseCustomData(data.product.custom_data as Record<string, unknown>) : { ai_credits: null, doc_storage_gb: null };
  return mergeCustomData(fromProduct, fromPrice);
}

/**
 * Get AI credits and doc storage (GB) for a subscription item.
 * Uses payload item first; if custom_data is missing, calls Paddle API for the price.
 */
export async function getProductCustomData(
  priceId: string | null,
  payloadItem: PaddleSubscriptionItem | null | undefined
): Promise<ProductCustomData> {
  const fromPayload = getCustomDataFromPayload(payloadItem);
  const hasAny = fromPayload.ai_credits != null || fromPayload.doc_storage_gb != null;
  if (hasAny) return fromPayload;
  if (priceId) return fetchPriceWithProduct(priceId);
  return { ai_credits: null, doc_storage_gb: null };
}

/** Convert doc_storage (GB) to MB for DB column doc_storage_limit_mb. */
export function docStorageGbToMb(gb: number | null): number | null {
  if (gb == null || Number.isNaN(gb) || gb < 0) return null;
  return Math.round(gb * 1024);
}

/** Price details from Paddle (for display). */
export interface PriceDetails {
  price_id: string;
  /** e.g. "$79.00" */
  formatted: string;
  currency_code: string;
  ai_credits: number | null;
  doc_storage_gb: number | null;
}

/** Format amount string (cents/smallest unit) to display string. */
function formatPriceAmount(amountStr: string, currencyCode: string): string {
  const amount = parseInt(amountStr, 10);
  if (Number.isNaN(amount)) return amountStr;
  const decimals = currencyCode === "JPY" ? 0 : 2;
  const value = amount / Math.pow(10, decimals);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Fetch a single price from Paddle API including product; returns display price and custom_data.
 * Used by plan-prices API for dynamic UI.
 */
export async function fetchPriceDetails(priceId: string): Promise<PriceDetails | null> {
  const apiKey = process.env.PADDLE_API_KEY?.trim();
  if (!apiKey) return null;

  const url = `${PADDLE_API_BASE}/prices/${encodeURIComponent(priceId)}?include=product`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) return null;

  const json = (await res.json()) as {
    data?: {
      id?: string;
      unit_price?: { amount?: string; currency_code?: string };
      custom_data?: Record<string, unknown>;
      product?: { custom_data?: Record<string, unknown> };
    };
  };
  const data = json?.data;
  if (!data?.id) return null;

  const unitPrice = data.unit_price;
  const amountStr = unitPrice?.amount ?? "0";
  const currencyCode = unitPrice?.currency_code ?? "USD";
  const formatted = formatPriceAmount(amountStr, currencyCode);

  const fromPrice = parseCustomData(data.custom_data);
  const fromProduct = data.product
    ? parseCustomData(data.product.custom_data as Record<string, unknown>)
    : { ai_credits: null, doc_storage_gb: null };
  const custom = mergeCustomData(fromProduct, fromPrice);

  return {
    price_id: data.id,
    formatted,
    currency_code: currencyCode,
    ai_credits: custom.ai_credits,
    doc_storage_gb: custom.doc_storage_gb,
  };
}
