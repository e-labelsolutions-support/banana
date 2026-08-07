import type { NextApiRequest, NextApiResponse } from "next";

import { initAuth } from "@banana/auth/server";
import { createDrizzleClient } from "@banana/db/client";
import { decodeStateCookie, verifyState } from "@banana/api/utils/oauth";
import { exchangeCodeForTokens, storeTokens } from "@banana/api/utils/googleCalendar";
import { onUserConnect } from "@banana/api/services/calendarSync";

const COOKIE_NAME = "kan_oauth_state";

const db = createDrizzleClient();
const auth = initAuth(db);

const redirectWith = (res: NextApiResponse, status: string) =>
  res.redirect(`/settings/integrations?google_calendar=${status}`);

const clearCookieHeader = `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

const toWebHeaders = (nodeHeaders: NextApiRequest["headers"]): Headers => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeHeaders)) {
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else if (typeof value === "string") {
      headers.set(key, value);
    }
  }
  return headers;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state, error } = req.query;

  if (error) {
    res.setHeader("Set-Cookie", clearCookieHeader);
    return redirectWith(res, "error");
  }

  if (typeof code !== "string" || typeof state !== "string") {
    res.setHeader("Set-Cookie", clearCookieHeader);
    return redirectWith(res, "error");
  }

  const dotIndex = state.indexOf(".");
  if (dotIndex < 0) {
    res.setHeader("Set-Cookie", clearCookieHeader);
    return redirectWith(res, "error");
  }
  const nonce = state.slice(0, dotIndex);
  const signature = state.slice(dotIndex + 1);

  const cookieRaw = req.cookies[COOKIE_NAME];
  res.setHeader("Set-Cookie", clearCookieHeader);

  const cookie = cookieRaw ? decodeStateCookie(cookieRaw) : null;
  if (!cookie) return redirectWith(res, "error");

  if (!verifyState(cookie.userId, nonce, signature)) {
    return redirectWith(res, "error");
  }

  const session = await auth.api.getSession({ headers: toWebHeaders(req.headers) });
  if (!session?.user || session.user.id !== cookie.userId) {
    return redirectWith(res, "error");
  }

  try {
    const tokens = await exchangeCodeForTokens(code, cookie.verifier);
    await storeTokens(db, session.user.id, tokens);
    void onUserConnect(db, session.user.id);
    return redirectWith(res, "connected");
  } catch {
    return redirectWith(res, "error");
  }
}
