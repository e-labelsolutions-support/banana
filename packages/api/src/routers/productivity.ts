import { z } from "zod";

import * as productivityRepo from "@banana/db/repository/productivity.repo";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const todayDate = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const productivityRouter = createTRPCRouter({
  // ─── Energy Check-In ───────────────────────────────────────────────────────

  getEnergyCheckin: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) throw new Error("User not authenticated");
    const today = todayDate();

    const [checkin, streak, recentCheckins] = await Promise.all([
      productivityRepo.getTodayCheckin(ctx.db, { userId, date: today }),
      productivityRepo.calculateStreak(ctx.db, { userId }),
      productivityRepo.getRecentCheckins(ctx.db, { userId, limit: 7 }),
    ]);

    return { today: checkin, streak, recentCheckins };
  }),

  setEnergyCheckin: protectedProcedure
    .input(
      z.object({
        energyLevel: z.number().min(1).max(5),
        note: z.string().max(280).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new Error("User not authenticated");
      const today = todayDate();

      const result = await productivityRepo.upsertCheckin(ctx.db, {
        userId,
        date: today,
        energyLevel: input.energyLevel,
        note: input.note,
      });

      return result;
    }),

  // ─── Daily Quests ──────────────────────────────────────────────────────────

  getDailyQuests: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) throw new Error("User not authenticated");
    const today = todayDate();

    const quests = await productivityRepo.getTodayQuests(ctx.db, {
      userId,
      date: today,
    });

    return { quests, date: today };
  }),

  setDailyQuest: protectedProcedure
    .input(
      z.object({
        category: z.enum(["health", "work", "relationships"]),
        action: z.string().min(1).max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new Error("User not authenticated");
      const today = todayDate();

      const result = await productivityRepo.upsertQuest(ctx.db, {
        userId,
        date: today,
        category: input.category,
        action: input.action,
      });

      return result;
    }),

  completeDailyQuest: protectedProcedure
    .input(
      z.object({
        category: z.enum(["health", "work", "relationships"]),
        completed: z.boolean().optional().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new Error("User not authenticated");
      const today = todayDate();

      const result = input.completed
        ? await productivityRepo.completeQuest(ctx.db, {
            userId,
            date: today,
            category: input.category,
          })
        : await productivityRepo.uncompleteQuest(ctx.db, {
            userId,
            date: today,
            category: input.category,
          });

      return result;
    }),

  // ─── Wins ──────────────────────────────────────────────────────────────────

  getTodayWins: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) throw new Error("User not authenticated");
    const today = todayDate();

    const wins = await productivityRepo.getTodayWins(ctx.db, {
      userId,
      date: today,
    });

    return { wins, date: today };
  }),

  createWin: protectedProcedure
    .input(z.object({ text: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new Error("User not authenticated");
      const today = todayDate();

      const result = await productivityRepo.createWin(ctx.db, {
        userId,
        date: today,
        text: input.text,
      });

      return result;
    }),

  // ─── Side Quests ───────────────────────────────────────────────────────────

  getSideQuests: protectedProcedure
    .input(
      z.object({
        showExplored: z.boolean().optional().default(false),
        limit: z.number().min(1).max(50).optional().default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new Error("User not authenticated");

      const quests = await productivityRepo.getActiveSideQuests(ctx.db, {
        userId,
        explored: input.showExplored ? undefined : false,
        limit: input.limit,
      });

      return quests;
    }),

  createSideQuest: protectedProcedure
    .input(z.object({ text: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new Error("User not authenticated");

      const result = await productivityRepo.createSideQuest(ctx.db, {
        userId,
        text: input.text,
      });

      return result;
    }),

  markSideQuestExplored: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new Error("User not authenticated");

      const result = await productivityRepo.markSideQuestExplored(ctx.db, {
        userId,
        id: input.id,
      });

      return result;
    }),

  deleteSideQuest: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new Error("User not authenticated");

      const result = await productivityRepo.deleteSideQuest(ctx.db, {
        userId,
        id: input.id,
      });

      return result;
    }),
});
