import { eq, and, isNull } from "drizzle-orm";

import type { dbClient } from "@banana/db/client";
import * as cardRepo from "@banana/db/repository/card.repo";
import { cardToWorkspaceMembers, workspaceMembers } from "@banana/db/schema";
import { createLogger } from "@banana/logger";
import { env } from "next-runtime-env";

const log = createLogger("mattermost");

function getMattermostConfig() {
  const url = process.env.MATTERMOST_URL;
  const token = process.env.MATTERMOST_BOT_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

function redactEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex < 1) return "***";
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  return `${local[0]}***@${domain[0] ?? "*"}***`;
}

type MattermostConfig = NonNullable<ReturnType<typeof getMattermostConfig>>;

async function mattermostApi(
  config: MattermostConfig,
  path: string,
  options: RequestInit = {},
) {
  const url = `${config.url}/api/v4${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
        Authorization: `Bearer ${config.token}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      log.error({ path, status: response.status }, "Mattermost API error");
      return null;
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    log.error({ err: error, path }, "Mattermost API request failed");
    return null;
  }
}

async function getMattermostUserIdByEmail(
  config: MattermostConfig,
  email: string,
): Promise<string | null> {
  const response = await mattermostApi(
    config,
    `/users/email/${encodeURIComponent(email)}`,
  );
  if (!response) return null;

  const user = await response.json() as { id: string } | undefined;
  return user?.id ?? null;
}

async function getDirectMessageChannel(
  config: MattermostConfig,
  botUserId: string,
  targetUserId: string,
): Promise<string | null> {
  const response = await mattermostApi(config, "/channels/direct", {
    method: "POST",
    body: JSON.stringify([botUserId, targetUserId]),
  });
  if (!response) return null;

  const channel = await response.json() as { id: string } | undefined;
  return channel?.id ?? null;
}

async function getBotUserId(config: MattermostConfig): Promise<string | null> {
  const response = await mattermostApi(config, "/users/me");
  if (!response) return null;

  const user = await response.json() as { id: string } | undefined;
  return user?.id ?? null;
}

async function sendMattermostDM(
  config: MattermostConfig,
  mattermostUserId: string,
  message: string,
): Promise<boolean> {
  const botUserId = await getBotUserId(config);
  if (!botUserId) return false;

  const channelId = await getDirectMessageChannel(config, botUserId, mattermostUserId);
  if (!channelId) return false;

  const response = await mattermostApi(config, "/posts", {
    method: "POST",
    body: JSON.stringify({
      channel_id: channelId,
      message,
    }),
  });

  return response !== null;
}

async function getCardMemberEmails(
  db: dbClient,
  cardId: number,
  excludeUserId?: string,
): Promise<string[]> {
  const result = await db
    .select({ email: workspaceMembers.email })
    .from(cardToWorkspaceMembers)
    .innerJoin(
      workspaceMembers,
      and(
        eq(cardToWorkspaceMembers.workspaceMemberId, workspaceMembers.id),
        isNull(workspaceMembers.deletedAt),
      ),
    )
    .where(eq(cardToWorkspaceMembers.cardId, cardId));

  if (excludeUserId) {
    const excludeMember = await db
      .select({ email: workspaceMembers.email })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, excludeUserId))
      .limit(1);
    const excludeEmail = excludeMember[0]?.email;
    return result.map((r) => r.email).filter((e) => e !== excludeEmail);
  }

  return result.map((r) => r.email);
}

export async function sendMattermostNotification(
  db: dbClient,
  cardId: number,
  cardPublicId: string,
  actorUserId: string,
  actorName: string,
  action: string,
  details?: string,
  targetEmail?: string,
): Promise<void> {
  const config = getMattermostConfig();
  if (!config) return;

  try {
    const fullCard = await cardRepo.getByPublicId(db, cardPublicId);
    const cardTitle = fullCard?.title ?? "Card";

    const memberEmails = targetEmail
      ? [targetEmail]
      : await getCardMemberEmails(db, cardId, actorUserId);
    if (memberEmails.length === 0) return;

    const baseUrl = env("NEXT_PUBLIC_BASE_URL");
    const cardUrl = `${baseUrl}/cards/${cardPublicId}`;

    let message = `**${actorName}** ${action} on [${cardTitle}](${cardUrl})`;
    if (details) {
      message += `\n> ${details}`;
    }

    const results = await Promise.allSettled(
      memberEmails.map(async (email) => {
        const mmUserId = await getMattermostUserIdByEmail(config, email);
        if (!mmUserId) {
          log.warn({ email: redactEmail(email) }, "Mattermost user not found for email");
          return;
        }
        const sent = await sendMattermostDM(config, mmUserId, message);
        log.info({ sent }, "Mattermost DM result");
      }),
    );

    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      log.warn({ failed, total: memberEmails.length }, "Some Mattermost DMs failed");
    }
  } catch (error) {
    log.error({ err: error, cardId }, "Failed to send Mattermost notification");
  }
}
