import type { NextApiRequest, NextApiResponse } from "next";

import { initAuth } from "@banana/auth/server";
import { createDrizzleClient } from "@banana/db/client";
import * as integrationsRepo from "@banana/db/repository/integration.repo";
import { encodeStateCookie, generatePkce } from "@banana/api/utils/oauth";
import { buildAuthUrl } from "@banana/api/utils/googleCalendar";

const COOKIE_NAME = "kan_oauth_state";
const MAX_AGE = 10 * 60;

const db = createDrizzleClient();
const auth = initAuth(db);

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
  if (req.method !== "GET") {
    return res.status(405).end();
  }

  const session = await auth.api.getSession({ headers: toWebHeaders(req.headers) });
  if (!session?.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const existing = await integrationsRepo.getProviderForUser(
    db,
    session.user.id,
    "google_calendar",
  );
  if (existing) {
    return res.status(400).json({ message: "Google Calendar already connected" });
  }

  const result = buildAuthUrl(session.user.id, generatePkce());
  const cookie = encodeStateCookie({
    nonce: result.nonce,
    signature: result.signature,
    verifier: result.verifier,
    userId: session.user.id,
  });

  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${cookie}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}`,
  );
  return res.status(200).json({ url: result.url });
}
