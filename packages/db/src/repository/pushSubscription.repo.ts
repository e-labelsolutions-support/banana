import { and, eq } from "drizzle-orm";

import type { dbClient } from "@banana/db/client";
import { pushSubscription } from "@banana/db/schema";

export const upsertByUserAndEndpoint = async (
  db: dbClient,
  input: {
    userId: string;
    endpoint: string;
    subscriptionJson: string;
  },
) => {
  const [existing] = await db
    .select({ id: pushSubscription.id })
    .from(pushSubscription)
    .where(
      and(
        eq(pushSubscription.userId, input.userId),
        eq(pushSubscription.endpoint, input.endpoint),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(pushSubscription)
      .set({
        subscriptionJson: input.subscriptionJson,
        updatedAt: new Date(),
      })
      .where(eq(pushSubscription.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(pushSubscription)
    .values({
      userId: input.userId,
      endpoint: input.endpoint,
      subscriptionJson: input.subscriptionJson,
    })
    .returning();

  return created;
};

export const getByUser = async (db: dbClient, userId: string) => {
  return db
    .select()
    .from(pushSubscription)
    .where(eq(pushSubscription.userId, userId));
};

export const existsByUser = async (db: dbClient, userId: string) => {
  const rows = await db
    .select({ id: pushSubscription.id })
    .from(pushSubscription)
    .where(eq(pushSubscription.userId, userId))
    .limit(1);
  return rows.length > 0;
};

export const existsByUserAndEndpoint = async (
  db: dbClient,
  userId: string,
  endpoint: string,
) => {
  const rows = await db
    .select({ id: pushSubscription.id })
    .from(pushSubscription)
    .where(
      and(
        eq(pushSubscription.userId, userId),
        eq(pushSubscription.endpoint, endpoint),
      ),
    )
    .limit(1);
  return rows.length > 0;
};

export const deleteByUserAndEndpoint = async (
  db: dbClient,
  userId: string,
  endpoint: string,
) => {
  await db
    .delete(pushSubscription)
    .where(
      and(
        eq(pushSubscription.userId, userId),
        eq(pushSubscription.endpoint, endpoint),
      ),
    );
};

export const deleteByUser = async (db: dbClient, userId: string) => {
  await db.delete(pushSubscription).where(eq(pushSubscription.userId, userId));
};
