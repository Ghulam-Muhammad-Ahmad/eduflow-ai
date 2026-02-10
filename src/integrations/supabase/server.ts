import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

export interface GetAuthUserResult {
  user: User | null;
  error: { message: string } | null;
}

/** Parse all cookies from Next.js API request (supports req.cookies and Cookie header fallback). */
function getRequestCookies(req: NextApiRequest): { name: string; value: string }[] {
  const cookies = req.cookies as Record<string, string> | undefined;
  if (cookies && typeof cookies === "object" && Object.keys(cookies).length > 0) {
    return Object.entries(cookies).map(([name, value]) => ({ name, value }));
  }
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader || typeof cookieHeader !== "string") {
    return [];
  }
  return cookieHeader.split(";").reduce<{ name: string; value: string }[]>((acc, part) => {
    const [name, ...valueParts] = part.trim().split("=");
    const value = valueParts.join("=").trim();
    if (name && value !== undefined) {
      acc.push({ name: name.trim(), value });
    }
    return acc;
  }, []);
}

/**
 * Get the authenticated user from the request session (cookies).
 * Use this in API routes instead of trusting userId from req.body.
 * Returns 401 when not authenticated.
 * Uses getAll/setAll for @supabase/ssr so chunked auth cookies (e.g. sb-*-auth-token.0) work in API routes.
 */
export async function getAuthUser(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<GetAuthUserResult> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { user: null, error: { message: "Server auth not configured" } };
  }

  const cookiesToSet: string[] = [];

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return getRequestCookies(req);
      },
      setAll(cookies: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookies.forEach(({ name, value, options = {} }) => {
          const path = (options.path as string) ?? "/";
          const maxAge = (options.maxAge as number) ?? 31536000;
          const secure = (options.secure as boolean) ?? false;
          cookiesToSet.push(
            `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Path=${path}; Max-Age=${maxAge}; SameSite=Lax${secure ? "; Secure" : ""}`
          );
        });
      },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();

  if (cookiesToSet.length > 0) {
    res.setHeader("Set-Cookie", cookiesToSet);
  }

  if (error) {
    return { user: null, error: { message: error.message } };
  }
  return { user, error: null };
}
