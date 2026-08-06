import type { NextApiRequest } from "next";

type GoogleTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

type GoogleCalendarEventResponse = {
  id?: string;
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType?: string;
      uri?: string;
    }>;
  };
};

export type CalendarConnectionPayload = {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  scope?: string | null;
  tokenType?: string | null;
};

const GOOGLE_CALLBACK_PATH = "/api/google/callback";

/** A header may arrive as a comma-joined list or an array; take the first value. */
function firstHeaderValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0]?.split(",")[0]?.trim() || null;
  if (typeof value === "string") return value.split(",")[0]?.trim() || null;
  return null;
}

/**
 * Where Google sends the user back to after consent.
 *
 * Derived from the incoming request so the flow always returns to the host it started
 * on — localhost in development, the deployment URL on a Vercel preview, the custom
 * domain in production. A single hard-coded value cannot serve all three, and setting
 * it to a localhost URL previously sent every production user to localhost:3000.
 *
 * `GOOGLE_OAUTH_REDIRECT_URI` remains supported, but only as a fallback for setups
 * where the public URL is not visible in the request (e.g. behind a proxy that
 * rewrites Host). Whatever value this returns must be registered as an authorised
 * redirect URI in the Google Cloud console.
 */
export function getConfiguredRedirectUri(req: NextApiRequest): string {
  const host = firstHeaderValue(req.headers["x-forwarded-host"]) ?? req.headers.host ?? null;

  if (host) {
    const forwardedProto = firstHeaderValue(req.headers["x-forwarded-proto"]);
    const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
    const protocol = forwardedProto ?? (isLocal ? "http" : "https");
    return `${protocol}://${host}${GOOGLE_CALLBACK_PATH}`;
  }

  // Trailing slashes break Google's exact-match check against the registered URI.
  const envRedirect = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim().replace(/\/+$/, "");
  if (envRedirect) return envRedirect;

  throw new Error("Unable to determine Google OAuth redirect URI.");
}

function getGoogleClientId() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("Google OAuth is not configured.");
  }
  return clientId;
}

function getGoogleClientSecret() {
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error("Google OAuth is not configured.");
  }
  return clientSecret;
}

async function expectGoogleJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    error_description?: string;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(
      payload.error_description ??
        payload.message ??
        payload.error ??
        "Google request failed."
    );
  }

  return payload;
}

function extractMeetingUrl(event: GoogleCalendarEventResponse) {
  if (event.hangoutLink) return event.hangoutLink;

  const videoEntry = event.conferenceData?.entryPoints?.find(
    (entry) => entry.entryPointType === "video" && entry.uri
  );

  return videoEntry?.uri ?? event.htmlLink ?? null;
}

export function isGoogleCalendarConfigured() {
  // The redirect URI is derived from the request, so only the OAuth credentials
  // themselves need to be configured here.
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function buildGoogleCalendarConnectUrl(
  req: NextApiRequest,
  state: string
) {
  const redirectUri = getConfiguredRedirectUri(req);
  const clientId = getGoogleClientId();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: [
      "openid",
      "email",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly",
    ].join(" "),
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCodeForTokens(
  req: NextApiRequest,
  code: string
): Promise<CalendarConnectionPayload> {
  const redirectUri = getConfiguredRedirectUri(req);
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const payload = await expectGoogleJson<GoogleTokenResponse>(tokenResponse);
  const expiresAt = payload.expires_in
    ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
    : null;

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    expiresAt,
    scope: payload.scope ?? null,
    tokenType: payload.token_type ?? null,
  };
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const payload = await expectGoogleJson<GoogleTokenResponse>(tokenResponse);
  return {
    accessToken: payload.access_token,
    expiresAt: payload.expires_in
      ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
      : null,
    scope: payload.scope ?? null,
    tokenType: payload.token_type ?? null,
  };
}

export async function fetchGoogleUserEmail(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = await expectGoogleJson<{ email?: string }>(response);
  return payload.email ?? null;
}

export async function createGoogleMeetEvent(params: {
  accessToken: string;
  calendarId?: string | null;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  timezone?: string | null;
  attendeeEmails?: string[];
}) {
  const calendarId = encodeURIComponent(params.calendarId || "primary");
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: params.title,
        description: params.description ?? null,
        start: { dateTime: params.startsAt, timeZone: params.timezone || "UTC" },
        end: { dateTime: params.endsAt, timeZone: params.timezone || "UTC" },
        attendees: (params.attendeeEmails ?? []).map((email) => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      }),
    }
  );

  const event = await expectGoogleJson<GoogleCalendarEventResponse>(response);
  return {
    eventId: event.id ?? null,
    meetingUrl: extractMeetingUrl(event),
    calendarId: params.calendarId || "primary",
  };
}

export async function updateGoogleMeetEvent(params: {
  accessToken: string;
  calendarId?: string | null;
  eventId: string;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  timezone?: string | null;
  attendeeEmails?: string[];
}) {
  const calendarId = encodeURIComponent(params.calendarId || "primary");
  const eventId = encodeURIComponent(params.eventId);

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: params.title,
        description: params.description ?? null,
        start: { dateTime: params.startsAt, timeZone: params.timezone || "UTC" },
        end: { dateTime: params.endsAt, timeZone: params.timezone || "UTC" },
        attendees: (params.attendeeEmails ?? []).map((email) => ({ email })),
      }),
    }
  );

  const event = await expectGoogleJson<GoogleCalendarEventResponse>(response);
  return {
    eventId: event.id ?? params.eventId,
    meetingUrl: extractMeetingUrl(event),
    calendarId: params.calendarId || "primary",
  };
}

export async function deleteGoogleCalendarEvent(params: {
  accessToken: string;
  calendarId?: string | null;
  eventId: string;
}) {
  const calendarId = encodeURIComponent(params.calendarId || "primary");
  const eventId = encodeURIComponent(params.eventId);

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}?sendUpdates=none`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
      },
    }
  );

  if (!response.ok && response.status !== 404) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new Error(payload.error?.message ?? "Failed to delete Google Calendar event.");
  }
}
