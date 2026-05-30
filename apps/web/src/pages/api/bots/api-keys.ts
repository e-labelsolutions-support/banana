import crypto from "crypto";
import { eq } from "drizzle-orm";
import type { NextApiRequest, NextApiResponse } from "next";

import { createNextApiContext } from "@banana/api/trpc";
import { withApiLogging } from "@banana/api/utils/apiLogging";
import { withRateLimit } from "@banana/api/utils/rateLimit";
import * as userRepo from "@banana/db/repository/user.repo";
import { apikey, users } from "@banana/db/schema";
import { createLogger } from "@banana/logger";

const log = createLogger("bot-api-keys");

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function generateApiKey(): { key: string; hash: string; start: string; prefix: string } {
  const raw = crypto.randomBytes(32).toString("hex");
  const prefix = "kan_";
  const key = `${prefix}${raw}`;
  // Match Better Auth's hashing: SHA-256 → base64url (no padding)
  const hashBuffer = crypto.createHash("sha256").update(key).digest();
  const hash = hashBuffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  // Store first 8 chars of the raw key for identification (matching Better Auth's start field)
  const start = key.substring(0, 8);
  return { key, hash, start, prefix };
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    | { key: string; name: string }
    | { id: number; name: string }[]
    | { error: string }
  >,
) {
  // Admin auth
  const adminKey = process.env.KAN_ADMIN_API_KEY;
  if (!adminKey) {
    return res.status(500).json({ error: "Admin API key not configured." });
  }
  const providedKey = req.headers["x-admin-api-key"];
  if (
    typeof providedKey !== "string" ||
    !timingSafeEqual(providedKey, adminKey)
  ) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  const { db } = await createNextApiContext(req);

  const { email } = req.query as { email?: string };
  if (!email) {
    return res.status(400).json({ error: "email query parameter is required." });
  }

  // Verify the target user is a bot
  const user = await userRepo.getByEmail(db, email);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  // GET: List API keys for a bot
  if (req.method === "GET") {
    const keys = await db.query.apikey.findMany({
      columns: { id: true, name: true, prefix: true, createdAt: true },
      where: eq(apikey.userId, user.id),
    });
    return res.status(200).json(keys);
  }

  // POST: Create a new API key for a bot
  if (req.method === "POST") {
    const { name } = req.body as { name?: string };
    const keyName = name ?? `bot-${email.split("@")[0]}`;

    const { key, hash, start, prefix } = generateApiKey();

    await db.insert(apikey).values({
      name: keyName,
      key: hash,
      start,
      prefix,
      userId: user.id,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    log.info({ userId: user.id, email, keyName }, "API key created for bot");

    return res.status(201).json({ key, name: keyName });
  }

  // DELETE: Revoke an API key
  if (req.method === "DELETE") {
    const { keyId } = req.body as { keyId?: number };
    if (!keyId) {
      return res.status(400).json({ error: "keyId is required." });
    }

    await db.delete(apikey).where(eq(apikey.id, keyId));

    log.info({ userId: user.id, email, keyId }, "API key revoked for bot");
    return res.status(200).json({ key: "", name: "revoked" });
  }

  return res.status(405).json({ error: "Method not allowed." });
}

export default withRateLimit(
  { points: 20, duration: 60 },
  withApiLogging(handler),
);
