import crypto from "crypto";
import { eq } from "drizzle-orm";
import type { NextApiRequest, NextApiResponse } from "next";

import { createNextApiContext } from "@banana/api/trpc";
import { withApiLogging } from "@banana/api/utils/apiLogging";
import { withRateLimit } from "@banana/api/utils/rateLimit";
import * as memberRepo from "@banana/db/repository/member.repo";
import * as permissionRepo from "@banana/db/repository/permission.repo";
import * as userRepo from "@banana/db/repository/user.repo";
import { users, workspaceMembers } from "@banana/db/schema";
import { createLogger } from "@banana/logger";

const log = createLogger("user-mattermost-sync");

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
  first_name?: string;
  last_name?: string;
  nickname?: string;
  is_bot: boolean;
}

interface SyncResult {
  synced: number;
  created: number;
  skipped: number;
  users: { email: string; name: string; status: string }[];
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

  // Fetch all users from Mattermost (non-bot)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

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

  // Filter to human (non-bot) users only
  const mmHumans = mmUsers.filter((u) => !u.is_bot);

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

  const results: SyncResult["users"] = [];
  let created = 0;
  let skipped = 0;

  for (const mmUser of mmHumans) {
    const displayName =
      mmUser.nickname ||
      [mmUser.first_name, mmUser.last_name].filter(Boolean).join(" ") ||
      mmUser.username;

    // Check if already exists
    const existing = await userRepo.getByEmail(db, mmUser.email);

    if (existing) {
      // Update name if changed
      if (existing.name !== displayName) {
        await db
          .update(users)
          .set({ name: displayName, updatedAt: new Date() })
          .where(eq(users.id, existing.id));
      }

      // Ensure they're in the workspace
      const membership = await db.query.workspaceMembers.findFirst({
        columns: { id: true },
        where: (wm, { eq: eqFn, and, isNull }) =>
          and(
            eqFn(wm.userId, existing.id),
            eqFn(wm.workspaceId, workspaceId),
            isNull(wm.deletedAt),
          ),
      });

      if (!membership) {
        await memberRepo.create(db, {
          userId: existing.id,
          email: existing.email,
          workspaceId,
          createdBy: existing.id,
          role: "member",
          roleId: memberRole?.id ?? null,
          status: "active",
        });
        results.push({ email: mmUser.email, name: displayName, status: "joined" });
        log.info({ userId: existing.id, email: mmUser.email }, "Existing user joined workspace");
      } else {
        results.push({ email: mmUser.email, name: displayName, status: "existing" });
      }
      skipped++;
      continue;
    }

    // Create new user
    const user = await userRepo.create(db, {
      email: mmUser.email,
      name: displayName,
      type: "human",
    });

    if (!user?.id) {
      results.push({ email: mmUser.email, name: displayName, status: "error" });
      continue;
    }

    // Auto-join to workspace
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
    results.push({ email: mmUser.email, name: displayName, status: "created" });
    log.info({ userId: user.id, email: mmUser.email }, "User synced from Mattermost");
  }

  return res.status(200).json({
    synced: mmHumans.length,
    created,
    skipped,
    users: results,
  });
}

export default withRateLimit(
  { points: 10, duration: 60 },
  withApiLogging(handler),
);
