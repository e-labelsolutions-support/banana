import type { dbClient } from "@banana/db/client";
import { env } from "next-runtime-env";

import * as integrationsRepo from "@banana/db/repository/integration.repo";

import { decryptToken, encryptToken } from "./encryption";
import type { OAuthPkce } from "./oauth";
import { signState } from "./oauth";

export interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  source?: { title: string; url: string };
  extendedProperties?: { private?: { cardPublicId?: string } };
}

export interface CardEventData {
  cardPublicId: string;
  title: string;
  description: string;
  dueDate: Date;
  boardName?: string | null;
  listName?: string | null;
}

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";

const getClientId = (): string => {
  const id = process.env.GOOGLE_CLIENT_ID ?? env("GOOGLE_CLIENT_ID");
  if (!id) throw new Error("GOOGLE_CLIENT_ID not set");
  return id;
};

const getClientSecret = (): string => {
  const secret = process.env.GOOGLE_CLIENT_SECRET ?? env("GOOGLE_CLIENT_SECRET");
  if (!secret) throw new Error("GOOGLE_CLIENT_SECRET not set");
  return secret;
};

const getRedirectUri = (): string => {
  const base = env("NEXT_PUBLIC_BASE_URL") ?? "http://localhost:3000";
  return `${base}/api/calendar/oauth/callback`;
};

const getBaseUrl = (): string => env("NEXT_PUBLIC_BASE_URL") ?? "http://localhost:3000";

export interface AuthUrlResult {
  url: string;
  nonce: string;
  signature: string;
  verifier: string;
}

export function buildAuthUrl(userId: string, pkce: OAuthPkce): AuthUrlResult {
  const { nonce, signature } = signState(userId);
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state: `${nonce}.${signature}`,
    code_challenge: pkce.challenge,
    code_challenge_method: pkce.challengeMethod,
  });
  return {
    url: `${GOOGLE_AUTH_URL}?${params.toString()}`,
    nonce,
    signature,
    verifier: pkce.verifier,
  };
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: Date }> {
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });

  if (!resp.ok) {
    throw new Error(`Token exchange failed (${resp.status}): ${await resp.text()}`);
  }

  const data = (await resp.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      grant_type: "refresh_token",
    }),
  });

  if (!resp.ok) {
    throw new Error(`Token refresh failed (${resp.status}): ${await resp.text()}`);
  }

  const data = (await resp.json()) as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

export async function getValidAccessToken(
  db: dbClient,
  userId: string,
): Promise<string | null> {
  const integration = await integrationsRepo.getProviderForUser(
    db,
    userId,
    "google_calendar",
  );
  if (!integration) return null;

  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);
  if (integration.expiresAt > fiveMinFromNow) {
    return decryptToken(integration.accessToken);
  }

  if (!integration.refreshToken) return null;

  const { accessToken, expiresAt } = await refreshAccessToken(
    decryptToken(integration.refreshToken),
  );
  await integrationsRepo.createOrUpdateProvider(db, {
    provider: "google_calendar",
    userId,
    accessToken: encryptToken(accessToken),
    refreshToken: integration.refreshToken,
    expiresAt,
  });
  return accessToken;
}

export async function storeTokens(
  db: dbClient,
  userId: string,
  tokens: { accessToken: string; refreshToken: string | null; expiresAt: Date },
): Promise<void> {
  await integrationsRepo.createOrUpdateProvider(db, {
    provider: "google_calendar",
    userId,
    accessToken: encryptToken(tokens.accessToken),
    refreshToken: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
    expiresAt: tokens.expiresAt,
  });
}

function buildEvent(card: CardEventData): GoogleCalendarEvent {
  const oneHourLater = new Date(card.dueDate.getTime() + 60 * 60 * 1000);
  return {
    summary: card.title,
    description: `${card.boardName ?? ""} › ${card.listName ?? ""}\n\n${card.description}`,
    start: { dateTime: card.dueDate.toISOString(), timeZone: "UTC" },
    end: { dateTime: oneHourLater.toISOString(), timeZone: "UTC" },
    source: { title: "Banana", url: `${getBaseUrl()}/cards/${card.cardPublicId}` },
    extendedProperties: { private: { cardPublicId: card.cardPublicId } },
  };
}

async function calendarApiFetch<T>(
  accessToken: string,
  path: string,
  options: RequestInit = {},
): Promise<T | null> {
  const resp = await fetch(`${GOOGLE_CALENDAR_API}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!resp.ok) {
    if (resp.status === 404) return null;
    throw new Error(`Google Calendar API error (${resp.status}): ${await resp.text()}`);
  }

  if (resp.status === 204) return null;
  return (await resp.json()) as T;
}

interface GoogleEventList {
  items?: { id: string }[];
}

interface GoogleEvent {
  id: string;
}

export async function findEventIdByCard(
  accessToken: string,
  cardPublicId: string,
): Promise<string | null> {
  const result = await calendarApiFetch<GoogleEventList>(
    accessToken,
    `/calendars/primary/events?privateExtendedProperty=cardPublicId=${cardPublicId}`,
  );
  return result?.items?.[0]?.id ?? null;
}

export async function createEvent(
  accessToken: string,
  card: CardEventData,
): Promise<string> {
  const event = await calendarApiFetch<GoogleEvent>(accessToken, "/calendars/primary/events", {
    method: "POST",
    body: JSON.stringify(buildEvent(card)),
  });
  if (!event?.id) throw new Error("Google Calendar did not return an event id");
  return event.id;
}

export async function patchEvent(
  accessToken: string,
  eventId: string,
  card: CardEventData,
): Promise<void> {
  await calendarApiFetch(accessToken, `/calendars/primary/events/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify(buildEvent(card)),
  });
}

export async function deleteEvent(accessToken: string, eventId: string): Promise<void> {
  await calendarApiFetch(accessToken, `/calendars/primary/events/${eventId}`, {
    method: "DELETE",
  });
}

export async function upsertEvent(
  accessToken: string,
  card: CardEventData,
): Promise<void> {
  const existingId = await findEventIdByCard(accessToken, card.cardPublicId);
  if (existingId) {
    await patchEvent(accessToken, existingId, card);
    return;
  }
  await createEvent(accessToken, card);
}

export async function deleteEventByCard(
  accessToken: string,
  cardPublicId: string,
): Promise<void> {
  const existingId = await findEventIdByCard(accessToken, cardPublicId);
  if (existingId) await deleteEvent(accessToken, existingId);
}
