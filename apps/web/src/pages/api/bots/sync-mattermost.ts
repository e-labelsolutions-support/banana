import crypto from "crypto";
import { eq } from "drizzle-orm";
import type { NextApiRequest, NextApiResponse } from "next";

import { createNextApiContext } from "@banana/api/trpc";
import { withApiLogging } from "@banana/api/utils/apiLogging";
import { withRateLimit } from "@banana/api/utils/rateLimit";
import * as memberRepo from "@banana/db/repository/member.repo";
import * as permissionRepo from "@banana/db/repository/permission.repo";
import * as userRepo from "@banana/db/repository/user.repo";
import { users } from "@banana/db/schema";
import { createLogger } from "@banana/logger";

const log = createLogger("bot-mattermost-sync");

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

interface MattermostUser {
  id: string;
  email: string;
  username: string;
  is_bot: boolean;
  roles?: string;
}

interface SyncResult {
  synced: number;
  created: number;
  skipped: number;
  bots: { email: string; name: string; status: string }[];
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SyncResult | { error: string }>,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

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

  const mattermostUrl = process.env.MATTERMOST_URL?.replace(/\/$/, "");
  const mattermostToken = process.env.MATTERMOST_BOT_TOKEN;
  if (!mattermostUrl || !mattermostToken) {
    return res
      .status(500)
      .json({ error: "Mattermost integration not configured." });
  }

  const { db } = await createNextApiContext(req);

  // Fetch all bot accounts from Mattermost
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  let mmUsers: MattermostUser[];
  try {
    const response = await fetch(
      `${mattermostUrl}/api/v4/users?per_page=200&active=true`,
      {
        headers: { Authorization: `Bearer ${mattermostToken}` },
        signal: controller.signal,
      },
    );
    clearTimeout(timeoutId);

    if (!response.ok) {
      return res
        .status(502)
        .json({ error: `Mattermost API error: ${response.status}` });
    }

    mmUsers = (await response.json()) as MattermostUser[];
  } catch (error) {
    clearTimeout(timeoutId);
    log.error({ err: error }, "Failed to fetch Mattermost users");
    return res.status(502).json({ error: "Failed to connect to Mattermost." });
  }

  // Filter to bot accounts only
  const mmBots = mmUsers.filter((u) => u.is_bot);

  // Find the single workspace
  const workspaces = await db.query.workspaces.findMany({
    columns: { id: true },
    where: (w, { isNull }) => isNull(w.deletedAt),
  });

  if (workspaces.length === 0) {
    return res.status(500).json({ error: "No workspace found." });
  }

  const workspaceId = workspaces[0]!.id;
  const memberRole = await permissionRepo.getRoleByWorkspaceIdAndName(
    db,
    workspaceId,
    "member",
  );

  const results: SyncResult["bots"] = [];
  let created = 0;
  let skipped = 0;

  for (const mmBot of mmBots) {
    const botName = mmBot.username ?? mmBot.email.split("@")[0];

    // Check if already exists
    const existing = await userRepo.getByEmail(db, mmBot.email);

    if (existing) {
      // Update name if changed and mark as bot if not already
      if (existing.type !== "bot" || existing.name !== botName) {
        await db
          .update(users)
          .set({
            name: botName,
            type: "bot",
            updatedAt: new Date(),
          })
          .where(eq(users.id, existing.id));
      }
      results.push({ email: mmBot.email, name: botName, status: "existing" });
      skipped++;
      continue;
    }

    // Create bot user
    const user = await userRepo.create(db, {
      email: mmBot.email,
      name: botName,
      type: "bot",
    });

    if (!user?.id) {
      results.push({ email: mmBot.email, name: botName, status: "error" });
      continue;
    }

    // Auto-join bot to workspace
    await memberRepo.create(db, {
      userId: user.id,
      email: user.email,
      workspaceId,
      createdBy: user.id,
      role: "member",
      roleId: memberRole?.id ?? null,
      status: "active",
    });

    created++;
    results.push({ email: mmBot.email, name: botName, status: "created" });
    log.info({ botId: user.id, email: mmBot.email }, "Bot synced from Mattermost");
  }

  return res.status(200).json({
    synced: mmBots.length,
    created,
    skipped,
    bots: results,
  });
}

export default withRateLimit(
  { points: 10, duration: 60 },
  withApiLogging(handler),
);
