import { z } from "zod";

import * as activityRepo from "@banana/db/repository/cardActivity.repo";
import * as boardRepo from "@banana/db/repository/board.repo";
import * as cardRepo from "@banana/db/repository/card.repo";
import * as workspaceRepo from "@banana/db/repository/workspace.repo";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { assertPermission } from "../utils/permissions";

export const dashboardRouter = createTRPCRouter({
  myBoards: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/dashboard/my-boards",
        summary: "Get boards in workspace",
        description:
          "Retrieves all active boards in the authenticated user's workspace",
        tags: ["Dashboard"],
        protect: true,
      },
    })
    .input(
      z.object({
        workspacePublicId: z.string().min(12),
        limit: z.number().min(1).max(50).optional().default(20),
      }),
    )
    .output(
      z.array(
        z.object({
          publicId: z.string(),
          name: z.string(),
          slug: z.string(),
          updatedAt: z.date().nullable(),
          createdAt: z.date(),
          visibility: z.enum(["private", "public"]),
          isArchived: z.boolean(),
        }),
      ),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId)
        throw new Error("User not authenticated");

      const workspace = await workspaceRepo.getByPublicId(
        ctx.db,
        input.workspacePublicId,
      );
      if (!workspace)
        throw new Error("Workspace not found");

      await assertPermission(ctx.db, userId, workspace.id, "board:view");

      return boardRepo.getActiveByWorkspaceId(ctx.db, {
        workspaceId: workspace.id,
        limit: input.limit,
      });
    }),

  myCards: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/dashboard/my-cards",
        summary: "Get cards assigned to the current user",
        description:
          "Retrieves cards assigned to the authenticated user in a workspace",
        tags: ["Dashboard"],
        protect: true,
      },
    })
    .input(
      z.object({
        workspacePublicId: z.string().min(12),
        limit: z.number().min(1).max(50).optional().default(20),
        cursor: z.date().optional(),
      }),
    )
    .output(
      z.object({
        cards: z.array(
          z.object({
            publicId: z.string(),
            title: z.string(),
            dueDate: z.date().nullable(),
            updatedAt: z.date().nullable(),
            boardPublicId: z.string(),
            boardName: z.string(),
            listPublicId: z.string(),
            listName: z.string(),
            labels: z.array(
              z.object({
                name: z.string(),
                colourCode: z.string().nullable(),
              }),
            ),
          }),
        ),
        hasMore: z.boolean(),
        nextCursor: z.date().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId)
        throw new Error("User not authenticated");

      const workspace = await workspaceRepo.getByPublicId(
        ctx.db,
        input.workspacePublicId,
      );
      if (!workspace)
        throw new Error("Workspace not found");

      await assertPermission(ctx.db, userId, workspace.id, "card:view");

      return cardRepo.getAssignedCardsByUserId(ctx.db, {
        workspaceId: workspace.id,
        userId,
        limit: input.limit,
        cursor: input.cursor,
      });
    }),

  recentActivity: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/dashboard/recent-activity",
        summary: "Get recent activity for the current user",
        description:
          "Retrieves recent activity on cards assigned to the authenticated user",
        tags: ["Dashboard"],
        protect: true,
      },
    })
    .input(
      z.object({
        workspacePublicId: z.string().min(12),
        limit: z.number().min(1).max(50).optional().default(20),
        cursor: z.date().optional(),
      }),
    )
    .output(
      z.object({
        activities: z.array(z.any()),
        hasMore: z.boolean(),
        nextCursor: z.date().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId)
        throw new Error("User not authenticated");

      const workspace = await workspaceRepo.getByPublicId(
        ctx.db,
        input.workspacePublicId,
      );
      if (!workspace)
        throw new Error("Workspace not found");

      await assertPermission(ctx.db, userId, workspace.id, "card:view");

      return activityRepo.getRecentForUser(ctx.db, {
        workspaceId: workspace.id,
        userId,
        limit: input.limit,
        cursor: input.cursor,
      });
    }),
});
