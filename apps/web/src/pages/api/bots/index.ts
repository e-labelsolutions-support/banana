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

const log = createLogger("bot-management");

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

interface BotResponse {
  id: string;
  email: string;
  name: string;
  apiKey?: string;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    | BotResponse
    | BotResponse[]
    | { error: string }
  >,
) {
  // Admin auth: require x-admin-api-key header
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

  // GET: List all bot users
  if (req.method === "GET") {
    const bots = await db.query.users.findMany({
      columns: { id: true, email: true, name: true },
      where: (users, { eq }) => eq(users.type, "bot"),
    });
    return res.status(200).json(bots);
  }

  // POST: Create a new bot user
  if (req.method === "POST") {
    const { email, name } = req.body as { email?: string; name?: string };

    if (!email || !name) {
      return res
        .status(400)
        .json({ error: "email and name are required." });
    }

    // Check if user already exists
    const existing = await userRepo.getByEmail(db, email);
    if (existing) {
      return res
        .status(409)
        .json({ error: `User with email ${email} already exists.` });
    }

    // Find the workspace to auto-join (single workspace: the one with most members)
    const workspaces = await db.query.workspaces.findMany({
      columns: { id: true, publicId: true },
      where: (w, { isNull }) => isNull(w.deletedAt),
    });

    if (workspaces.length === 0) {
      return res.status(500).json({ error: "No workspace found." });
    }

    // Create bot user
    const user = await userRepo.create(db, {
      email,
      name,
      type: "bot",
    });

    if (!user?.id) {
      return res.status(500).json({ error: "Failed to create bot user." });
    }

    // Auto-join bot to the workspace
    const workspace = workspaces[0]!;
    const memberRole = await permissionRepo.getRoleByWorkspaceIdAndName(
      db,
      workspace.id,
      "member",
    );
    await memberRepo.create(db, {
      userId: user.id,
      email: user.email,
      workspaceId: workspace.id,
      createdBy: user.id,
      role: "member",
      roleId: memberRole?.id ?? null,
      status: "active",
    });

    log.info({ botId: user.id, email, workspaceId: workspace.id }, "Bot created");

    return res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name ?? name,
    });
  }

  // DELETE: Remove a bot user
  if (req.method === "DELETE") {
    const { email } = req.body as { email?: string };
    if (!email) {
      return res.status(400).json({ error: "email is required." });
    }

    const user = await userRepo.getByEmail(db, email);
    if (!user) {
      return res.status(404).json({ error: "Bot not found." });
    }

    // Remove workspace memberships and delete the user
    await db.delete(workspaceMembers).where(eq(workspaceMembers.userId, user.id));
    await db.delete(users).where(eq(users.id, user.id));

    log.info({ botId: user.id, email }, "Bot deleted");
    return res.status(200).json({ id: user.id, email, name: user.name ?? "" });
  }

  return res.status(405).json({ error: "Method not allowed." });
}

export default withRateLimit(
  { points: 20, duration: 60 },
  withApiLogging(handler),
);
