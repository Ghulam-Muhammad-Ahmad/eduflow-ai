import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { Spinner } from "@/components/ui/spinner";

const PADDLE_SCRIPT = "https://cdn.paddle.com/paddle/v2/paddle.js";

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

export default function CheckoutPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const txnId = typeof router.query._ptxn === "string" ? router.query._ptxn : null;
  const successUrl = typeof router.query.success_url === "string" ? router.query.success_url : null;

  // If opened via https on localhost (e.g. Paddle default link), redirect to http so the page loads.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.protocol === "https:" && window.location.hostname === "localhost") {
      const httpUrl = `http://localhost:${window.location.port}${window.location.pathname}${window.location.search}`;
      window.location.replace(httpUrl);
      return;
    }
  }, []);

  useEffect(() => {
    if (!txnId || !router.isReady) return;

    const token =
      typeof window !== "undefined" ? process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN : null;
    if (!token) {
      setError("Checkout is not configured.");
      return;
    }

    const initPaddle = () => {
      if (window.Paddle?.Checkout) {
        const env = (process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT || "sandbox") as
          | "sandbox"
          | "production";
        if (env === "sandbox" && window.Paddle.Environment?.set) {
          window.Paddle.Environment.set("sandbox");
        }
        window.Paddle.Initialize({ token });
        setLoaded(true);
        return true;
      }
      return false;
    };

    if (initPaddle()) return;

    const existing = document.querySelector(`script[src="${PADDLE_SCRIPT}"]`);
    if (existing) {
      const check = setInterval(() => {
        if (initPaddle()) clearInterval(check);
      }, 50);
      return () => clearInterval(check);
    }

    const script = document.createElement("script");
    script.src = PADDLE_SCRIPT;
    script.async = true;
    script.onload = () => {
      initPaddle();
    };
    document.head.appendChild(script);
  }, [txnId, router.isReady]);

  useEffect(() => {
    if (!loaded || !window.Paddle?.Checkout?.open || !txnId) return;

    // Paddle looks up frameTarget by class name; ensure the target element exists in the DOM before opening.
    const target = document.querySelector(".paddle-checkout-target");
    if (!target) return;

    const openCheckout = () => {
      try {
        window.Paddle!.Checkout!.open({
          transactionId: txnId,
          settings: {
            displayMode: "inline",
            frameTarget: "paddle-checkout-target",
            frameInitialHeight: "700",
            frameStyle: "width: 100%; min-width: 312px; border: none; background: transparent;",
            successUrl: successUrl ?? undefined,
          },
        });
      } catch (e) {
        console.error("[checkout] Paddle.Checkout.open failed:", e);
      }
    };

    // Defer so the target is fully in the DOM (avoids appendChild on undefined).
    const t = requestAnimationFrame(() => {
      requestAnimationFrame(openCheckout);
    });
    return () => cancelAnimationFrame(t);
  }, [loaded, txnId, successUrl]);

  if (!router.isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!txnId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center text-muted-foreground">
          <p>No checkout session found.</p>
          <a href="/" className="text-primary underline">
            Return home
          </a>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center text-destructive">
          <p>{error}</p>
          <a href="/" className="text-primary underline">
            Return home
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Checkout — EduLabLoom</title>
      </Head>
      <div className="min-h-screen bg-background p-4">
        <div
          ref={containerRef}
          className="paddle-checkout-target mx-auto max-w-2xl"
          style={{ minHeight: 700 }}
        />
        {!loaded && (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        )}
      </div>
    </>
  );
}
