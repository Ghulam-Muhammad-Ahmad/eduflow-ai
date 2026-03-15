"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    Paddle?: {
      Environment?: { set: (env: "sandbox" | "production") => void };
      Initialize: (opts: { token: string }) => void;
      Checkout?: {
        open: (opts: {
          transactionId?: string;
          items?: Array<{ priceId: string; quantity: number }>;
          customData?: Record<string, string>;
          settings?: {
            displayMode?: string;
            frameTarget?: string;
            frameInitialHeight?: string;
            frameStyle?: string;
            successUrl?: string;
          };
        }) => void;
      };
    };
  }
}

const PADDLE_SCRIPT = "https://cdn.paddle.com/paddle/v2/paddle.js";

export function usePaddleReady(): boolean {
  const [ready, setReady] = useState(false);
  const token = typeof window !== "undefined" ? process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN : null;

  useEffect(() => {
    if (!token) {
      setReady(false);
      return;
    }
    if (window.Paddle?.Checkout) {
      setReady(true);
      return;
    }
    const existing = document.querySelector(`script[src="${PADDLE_SCRIPT}"]`);
    if (existing) {
      const check = () => (window.Paddle?.Checkout ? setReady(true) : setTimeout(check, 50));
      check();
      return;
    }
    const script = document.createElement("script");
    script.src = PADDLE_SCRIPT;
    script.async = true;
    script.onload = () => {
      const env = (process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT || "sandbox") as "sandbox" | "production";
      if (env === "sandbox" && window.Paddle?.Environment?.set) {
        window.Paddle.Environment.set("sandbox");
      }
      window.Paddle?.Initialize({ token });
      setReady(true);
    };
    document.head.appendChild(script);
    return () => {};
  }, [token]);

  return !!token && ready;
}

/**
 * Redirects to checkout page (full-page flow, no overlay).
 * Calls API to create a Paddle transaction, then navigates to the returned URL.
 */
export async function openPaddleCheckout(options: {
  priceId: string;
  customData: Record<string, string>;
  /** Full URL to redirect to after checkout completes. */
  successUrl?: string;
}): Promise<void> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const successUrl = options.successUrl || `${origin}/auth/callback`;

  try {
    const res = await fetch("/api/paddle/checkout-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        priceId: options.priceId,
        successUrl,
        customData: options.customData,
      }),
    });
    if (!res.ok) {
      const err = (await res.json()).error || "Failed to start checkout";
      console.error("[Paddle] checkout-url error:", err);
      return;
    }
    const { url } = (await res.json()) as { url: string };
    if (url) window.location.href = url;
  } catch (e) {
    console.error("[Paddle] checkout redirect failed:", e);
  }
}
