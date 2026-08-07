import { and, eq } from "drizzle-orm";

import type { dbClient } from "@banana/db/client";
import { integrations } from "@banana/db/schema";

const forUser = (userId: string, provider: string) =>
  and(eq(integrations.userId, userId), eq(integrations.provider, provider));

export const isProviderAvailableForUser = async (
  db: dbClient,
  userId: string,
  provider: string,
) => {
  const integration = await db.query.integrations.findFirst({
    where: forUser(userId, provider),
  });
  return !!integration;
};

export const getProviderForUser = async (
  db: dbClient,
  userId: string,
  provider: string,
) =>
  db.query.integrations.findFirst({
    where: forUser(userId, provider),
  });

export const getProvidersForUser = async (db: dbClient, userId: string) =>
  db.query.integrations.findMany({
    where: eq(integrations.userId, userId),
  });

export const createOrUpdateProvider = async (
  db: dbClient,
  data: {
    userId: string;
    provider: string;
    accessToken: string;
    refreshToken?: string | null;
    expiresAt: Date;
  },
) => {
  await db
    .insert(integrations)
    .values({
      provider: data.provider,
      userId: data.userId,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken ?? null,
      expiresAt: data.expiresAt,
    })
    .onConflictDoUpdate({
      target: [integrations.userId, integrations.provider],
      set: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? null,
        expiresAt: data.expiresAt,
      },
    });
};

export const deleteProviderForUser = async (
  db: dbClient,
  userId: string,
  provider: string,
) => {
  await db
    .delete(integrations)
    .where(
      and(eq(integrations.userId, userId), eq(integrations.provider, provider)),
    );
};
