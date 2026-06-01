import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import type { dbClient } from "@banana/db/client";
import {
  userDailyQuest,
  userEnergyCheckin,
  userSideQuest,
  userWin,
} from "@banana/db/schema";

// ─── Energy Check-In ─────────────────────────────────────────────────────────

export const getTodayCheckin = async (
  db: dbClient,
  { userId, date }: { userId: string; date: string },
) => {
  const [row] = await db
    .select()
    .from(userEnergyCheckin)
    .where(
      and(
        eq(userEnergyCheckin.userId, userId),
        eq(userEnergyCheckin.date, date),
      ),
    );
  return row ?? null;
};

export const getRecentCheckins = async (
  db: dbClient,
  { userId, limit }: { userId: string; limit: number },
) => {
  return db
    .select()
    .from(userEnergyCheckin)
    .where(eq(userEnergyCheckin.userId, userId))
    .orderBy(desc(userEnergyCheckin.date))
    .limit(limit);
};

export const calculateStreak = async (
  db: dbClient,
  { userId }: { userId: string },
): Promise<number> => {
  const rows = await db
    .select({ date: userEnergyCheckin.date })
    .from(userEnergyCheckin)
    .where(eq(userEnergyCheckin.userId, userId))
    .orderBy(desc(userEnergyCheckin.date))
    .limit(365);

  if (rows.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < rows.length; i++) {
    const expectedDate = new Date(today);
    expectedDate.setDate(expectedDate.getDate() - i);
    const expected = expectedDate.toISOString().split("T")[0];

    if (rows[i]?.date === expected) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
};

export const upsertCheckin = async (
  db: dbClient,
  {
    userId,
    date,
    energyLevel,
    note,
  }: {
    userId: string;
    date: string;
    energyLevel: number;
    note?: string;
  },
) => {
  const [result] = await db
    .insert(userEnergyCheckin)
    .values({ userId, date, energyLevel, note })
    .onConflictDoUpdate({
      target: [userEnergyCheckin.userId, userEnergyCheckin.date],
      set: { energyLevel, note, updatedAt: new Date() },
    })
    .returning();
  return result;
};

// ─── Daily Quests ────────────────────────────────────────────────────────────

export const getTodayQuests = async (
  db: dbClient,
  { userId, date }: { userId: string; date: string },
) => {
  return db
    .select()
    .from(userDailyQuest)
    .where(
      and(eq(userDailyQuest.userId, userId), eq(userDailyQuest.date, date)),
    );
};

export const upsertQuest = async (
  db: dbClient,
  {
    userId,
    date,
    category,
    action,
  }: {
    userId: string;
    date: string;
    category: string;
    action: string;
  },
) => {
  const [result] = await db
    .insert(userDailyQuest)
    .values({ userId, date, category, action })
    .onConflictDoUpdate({
      target: [userDailyQuest.userId, userDailyQuest.date, userDailyQuest.category],
      set: { action, updatedAt: new Date() },
    })
    .returning();
  return result;
};

export const completeQuest = async (
  db: dbClient,
  {
    userId,
    date,
    category,
  }: { userId: string; date: string; category: string },
) => {
  const [result] = await db
    .update(userDailyQuest)
    .set({ completed: true, updatedAt: new Date() })
    .where(
      and(
        eq(userDailyQuest.userId, userId),
        eq(userDailyQuest.date, date),
        eq(userDailyQuest.category, category),
      ),
    )
    .returning();
  return result;
};

export const uncompleteQuest = async (
  db: dbClient,
  {
    userId,
    date,
    category,
  }: { userId: string; date: string; category: string },
) => {
  const [result] = await db
    .update(userDailyQuest)
    .set({ completed: false, updatedAt: new Date() })
    .where(
      and(
        eq(userDailyQuest.userId, userId),
        eq(userDailyQuest.date, date),
        eq(userDailyQuest.category, category),
      ),
    )
    .returning();
  return result;
};

// ─── Wins ────────────────────────────────────────────────────────────────────

export const getTodayWins = async (
  db: dbClient,
  { userId, date }: { userId: string; date: string },
) => {
  return db
    .select()
    .from(userWin)
    .where(and(eq(userWin.userId, userId), eq(userWin.date, date)))
    .orderBy(desc(userWin.createdAt));
};

export const createWin = async (
  db: dbClient,
  { userId, date, text }: { userId: string; date: string; text: string },
) => {
  const [result] = await db
    .insert(userWin)
    .values({ userId, date, text })
    .returning();
  return result;
};

export const getRecentWins = async (
  db: dbClient,
  { userId, limit }: { userId: string; limit: number },
) => {
  return db
    .select()
    .from(userWin)
    .where(eq(userWin.userId, userId))
    .orderBy(desc(userWin.createdAt))
    .limit(limit);
};

// ─── Side Quests ─────────────────────────────────────────────────────────────

export const getActiveSideQuests = async (
  db: dbClient,
  {
    userId,
    explored,
    limit,
  }: { userId: string; explored?: boolean; limit: number },
) => {
  const conditions = [eq(userSideQuest.userId, userId)];
  if (explored !== undefined) {
    conditions.push(eq(userSideQuest.explored, explored));
  }

  return db
    .select()
    .from(userSideQuest)
    .where(and(...conditions))
    .orderBy(desc(userSideQuest.createdAt))
    .limit(limit);
};

export const createSideQuest = async (
  db: dbClient,
  { userId, text }: { userId: string; text: string },
) => {
  const [result] = await db
    .insert(userSideQuest)
    .values({ userId, text })
    .returning();
  return result;
};

export const markSideQuestExplored = async (
  db: dbClient,
  { userId, id }: { userId: string; id: number },
) => {
  const [result] = await db
    .update(userSideQuest)
    .set({ explored: true, exploredAt: new Date(), updatedAt: new Date() })
    .where(and(eq(userSideQuest.userId, userId), eq(userSideQuest.id, id)))
    .returning();
  return result;
};

export const deleteSideQuest = async (
  db: dbClient,
  { userId, id }: { userId: string; id: number },
) => {
  const [result] = await db
    .delete(userSideQuest)
    .where(and(eq(userSideQuest.userId, userId), eq(userSideQuest.id, id)))
    .returning({ id: userSideQuest.id });
  return result;
};
