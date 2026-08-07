import { TRPCError } from "@trpc/server";
import { z } from "zod";

import * as integrationsRepo from "@banana/db/repository/integration.repo";

import { onUserDisconnect } from "../services/calendarSync";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const googleCalendarRouter = createTRPCRouter({
  status: protectedProcedure
    .output(z.object({ connected: z.boolean() }))
    .query(async ({ ctx }) => {
      const user = ctx.user;
      if (!user) {
        throw new TRPCError({
          message: "User not authenticated",
          code: "UNAUTHORIZED",
        });
      }

      const connected = await integrationsRepo.isProviderAvailableForUser(
        ctx.db,
        user.id,
        "google_calendar",
      );
      return { connected };
    }),

  disconnect: protectedProcedure
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx }) => {
      const user = ctx.user;
      if (!user) {
        throw new TRPCError({
          message: "User not authenticated",
          code: "UNAUTHORIZED",
        });
      }

      const connected = await integrationsRepo.isProviderAvailableForUser(
        ctx.db,
        user.id,
        "google_calendar",
      );
      if (!connected) return { success: true };

      await onUserDisconnect(ctx.db, user.id);
      await integrationsRepo.deleteProviderForUser(
        ctx.db,
        user.id,
        "google_calendar",
      );
      return { success: true };
    }),
});
