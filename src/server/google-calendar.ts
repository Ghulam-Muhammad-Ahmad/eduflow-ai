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

function getConfiguredRedirectUri(req: NextApiRequest): string {
  const envRedirect = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (envRedirect) return envRedirect;

  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol =
    typeof forwardedProto === "string"
      ? forwardedProto
      : process.env.NODE_ENV === "development"
        ? "http"
        : "https";
  const host = req.headers.host;

  if (!host) {
    throw new Error("Unable to determine Google OAuth redirect URI.");
  }

  return `${protocol}://${host}/api/google/callback`;
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
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      (process.env.GOOGLE_OAUTH_REDIRECT_URI || process.env.NEXT_PUBLIC_SUPABASE_URL)
  );
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
