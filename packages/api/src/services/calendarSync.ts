import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { createLogger } from "@banana/logger";

import type { dbClient } from "@banana/db/client";
import {
  boards,
  cardToWorkspaceMembers,
  cards,
  lists,
  workspaceMembers,
} from "@banana/db/schema";

import {
  createEvent,
  deleteEventByCard,
  findEventIdByCard,
  getValidAccessToken,
  patchEvent,
  type CardEventData,
} from "../utils/googleCalendar";

const log = createLogger("calendarSync");

export interface SyncCardInput {
  cardPublicId: string;
  title: string;
  description: string;
  dueDate: Date | null;
  boardName?: string | null;
  listName?: string | null;
}

const toEventData = (card: SyncCardInput): CardEventData | null => {
  if (!card.dueDate) return null;
  return {
    cardPublicId: card.cardPublicId,
    title: card.title,
    description: card.description,
    dueDate: card.dueDate,
    boardName: card.boardName,
    listName: card.listName,
  };
};

export async function getCardMemberUserIds(
  db: dbClient,
  cardPublicId: string,
): Promise<string[]> {
  const result = await db
    .select({ userId: workspaceMembers.userId })
    .from(cardToWorkspaceMembers)
    .innerJoin(
      workspaceMembers,
      eq(cardToWorkspaceMembers.workspaceMemberId, workspaceMembers.id),
    )
    .innerJoin(cards, eq(cardToWorkspaceMembers.cardId, cards.id))
    .where(
      and(
        eq(cards.publicId, cardPublicId),
        isNull(cards.deletedAt),
        isNull(workspaceMembers.deletedAt),
      ),
    );
  return result.map((r) => r.userId).filter((id): id is string => id !== null);
}

async function getAssignedDueCards(
  db: dbClient,
  userId: string,
): Promise<SyncCardInput[]> {
  const result = await db
    .select({
      cardPublicId: cards.publicId,
      title: cards.title,
      description: cards.description,
      dueDate: cards.dueDate,
      boardName: boards.name,
      listName: lists.name,
    })
    .from(cardToWorkspaceMembers)
    .innerJoin(
      workspaceMembers,
      eq(cardToWorkspaceMembers.workspaceMemberId, workspaceMembers.id),
    )
    .innerJoin(cards, eq(cardToWorkspaceMembers.cardId, cards.id))
    .innerJoin(lists, eq(cards.listId, lists.id))
    .innerJoin(boards, eq(lists.boardId, boards.id))
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        isNotNull(cards.dueDate),
        isNull(cards.deletedAt),
        isNull(workspaceMembers.deletedAt),
        isNull(lists.deletedAt),
        isNull(boards.deletedAt),
      ),
    );

  return result.map((row) => ({
    cardPublicId: row.cardPublicId,
    title: row.title,
    description: row.description ?? "",
    dueDate: row.dueDate,
    boardName: row.boardName,
    listName: row.listName,
  }));
}

async function syncForUser(
  db: dbClient,
  userId: string,
  card: SyncCardInput,
  action: "upsert" | "delete",
): Promise<void> {
  const accessToken = await getValidAccessToken(db, userId);
  if (!accessToken) return;

  try {
    if (action === "delete") {
      await deleteEventByCard(accessToken, card.cardPublicId);
      return;
    }
    const eventData = toEventData(card);
    if (!eventData) {
      await deleteEventByCard(accessToken, card.cardPublicId);
      return;
    }
    const existingId = await findEventIdByCard(accessToken, card.cardPublicId);
    if (existingId) {
      await patchEvent(accessToken, existingId, eventData);
    } else {
      await createEvent(accessToken, eventData);
    }
  } catch (error) {
    log.error({ userId, cardPublicId: card.cardPublicId, action, error }, "sync failed");
  }
}

async function syncForUsers(
  db: dbClient,
  card: SyncCardInput,
  userIds: string[],
  action: "upsert" | "delete",
): Promise<void> {
  if (userIds.length === 0) return;
  await Promise.allSettled(userIds.map((userId) => syncForUser(db, userId, card, action)));
}

export async function onCardChanged(
  db: dbClient,
  card: SyncCardInput,
  memberUserIds: string[],
): Promise<void> {
  await syncForUsers(db, card, memberUserIds, "upsert");
}

export async function onCardDeleted(
  db: dbClient,
  cardPublicId: string,
  memberUserIds: string[],
): Promise<void> {
  await syncForUsers(
    db,
    { cardPublicId, title: "", description: "", dueDate: null },
    memberUserIds,
    "delete",
  );
}

interface BulkDeleteCard {
  publicId: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
}

export async function onCardsBulkDeleted(
  db: dbClient,
  cardsToDelete: BulkDeleteCard[],
): Promise<void> {
  const withDueDate = cardsToDelete.filter((c) => c.dueDate);
  if (withDueDate.length === 0) return;

  await Promise.allSettled(
    withDueDate.map(async (card) => {
      const memberUserIds = await getCardMemberUserIds(db, card.publicId);
      await onCardDeleted(db, card.publicId, memberUserIds);
    }),
  );
}

export async function onUserConnect(db: dbClient, userId: string): Promise<void> {
  const accessToken = await getValidAccessToken(db, userId);
  if (!accessToken) {
    log.warn({ userId }, "connect: no token, skipping initial sync");
    return;
  }

  const cardsToSync = await getAssignedDueCards(db, userId);
  if (cardsToSync.length === 0) {
    log.info({ userId }, "connect: no cards to sync");
    return;
  }

  log.info({ userId, count: cardsToSync.length }, "connect: starting initial sync");
  const results = await Promise.allSettled(
    cardsToSync.map((card) => syncForUser(db, userId, card, "upsert")),
  );
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    log.warn({ userId, failed, total: cardsToSync.length }, "connect: partial sync failure");
  }
}

export async function onUserDisconnect(db: dbClient, userId: string): Promise<void> {
  const accessToken = await getValidAccessToken(db, userId);
  if (!accessToken) return;

  const cardsToRemove = await getAssignedDueCards(db, userId);
  if (cardsToRemove.length === 0) return;

  log.info({ userId, count: cardsToRemove.length }, "disconnect: removing events");
  await Promise.allSettled(
    cardsToRemove.map((card) => deleteEventByCard(accessToken, card.cardPublicId)),
  );
}
