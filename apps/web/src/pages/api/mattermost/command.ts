import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { createNextApiContext } from "@banana/api/trpc";
import { withApiLogging } from "@banana/api/utils/apiLogging";
import { withRateLimit } from "@banana/api/utils/rateLimit";
import * as boardRepo from "@banana/db/repository/board.repo";
import * as cardRepo from "@banana/db/repository/card.repo";
import * as checklistRepo from "@banana/db/repository/checklist.repo";
import * as workspaceRepo from "@banana/db/repository/workspace.repo";
import { createLogger } from "@banana/logger";

const log = createLogger("mattermost-command");

type MattermostResponse = {
  response_type?: "ephemeral" | "in_channel";
  text: string;
};

const MAX_TASK_TITLE = 2000;
const MAX_BOARD_NAME = 255;
const MAX_PLAN_DESCRIPTION = 2000;
const MAX_TASKS_PER_PLAN = 20;

const planTaskSchema = z.object({
  title: z.string().min(1).max(MAX_TASK_TITLE),
  description: z.string().max(10000).optional(),
  checklist: z.array(z.string().min(1).max(500)).max(50).optional(),
});

const planResponseSchema = z.array(planTaskSchema).min(1).max(MAX_TASKS_PER_PLAN);

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MattermostResponse>,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ text: "Method not allowed" });
  }

  const commandToken = process.env.MATTERMOST_COMMAND_TOKEN;
  if (!commandToken) {
    return res.status(500).json({ text: "Mattermost command not configured." });
  }

  const token = req.body.token;
  if (typeof token !== "string" || !timingSafeEqual(token, commandToken)) {
    return res.status(401).json({ text: "Invalid command token." });
  }

  const commandText: string = String(req.body.text ?? "").trim().slice(0, MAX_PLAN_DESCRIPTION);
  const userEmail: string = String(req.body.user_email ?? "").trim();

  if (!userEmail) {
    return res.json({ text: "Could not determine your identity from Mattermost." });
  }

  const { db } = await createNextApiContext(req);

  try {
    const parts = commandText.split(/\s+/);
    const subcommand = parts[0]?.toLowerCase();

    if (subcommand === "create") {
      return await handleCreate(res, db, parts.slice(1), userEmail);
    }

    if (subcommand === "plan") {
      return await handlePlan(res, db, parts.slice(1), userEmail);
    }

    return res.json({
      response_type: "ephemeral",
      text: [
        "**Banana Bot Commands:**",
        "",
        "`/banana create \"Task title\" in \"Board name\"` — Create a new task",
        "`/banana plan \"Procedure description\" in \"Board name\"` — Generate tasks from a plan (requires Z.ai)",
      ].join("\n"),
    });
  } catch (error) {
    log.error({ err: error }, "Mattermost command error");
    return res.json({ text: "Something went wrong. Please try again later." });
  }
}

function parseQuotedArgs(text: string): string[] {
  const args: string[] = [];
  const regex = /"([^"]+)"/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    args.push(match[1].slice(0, MAX_TASK_TITLE));
  }
  return args;
}

async function resolveUserWorkspace(db: import("@banana/db/client").dbClient, email: string) {
  const workspaces = await workspaceRepo.getAllByUserId(db, email);
  if (!workspaces || workspaces.length === 0) return null;
  return workspaces[0];
}

async function findBoardByName(db: import("@banana/db/client").dbClient, workspaceId: number, userId: string, boardName: string) {
  const boards = await boardRepo.getAllByWorkspaceId(db, workspaceId, userId);
  return boards.find(
    (b) => b.name.toLowerCase() === boardName.toLowerCase(),
  );
}

async function resolveBoardAndList(
  db: import("@banana/db/client").dbClient,
  workspace: NonNullable<Awaited<ReturnType<typeof resolveUserWorkspace>>>,
  userId: string,
  boardName: string | undefined,
) {
  if (boardName) {
    const board = await findBoardByName(db, workspace.id, userId, boardName.slice(0, MAX_BOARD_NAME));
    if (!board) return { error: `Board "${boardName}" not found.` };
    const firstList = board.lists?.[0];
    if (!firstList) return { error: `Board "${boardName}" has no lists.` };
    const list = await db.query.lists.findFirst({
      where: (l, { eq }) => eq(l.publicId, firstList.publicId),
      columns: { id: true, workspaceId: true },
    });
    if (!list) return { error: "Could not resolve list." };
    return { listId: list.id, workspaceId: list.workspaceId };
  }

  const boards = await boardRepo.getAllByWorkspaceId(db, workspace.id, userId);
  if (!boards.length || !boards[0].lists?.length) {
    return { error: "No boards found in your workspace." };
  }
  const list = await db.query.lists.findFirst({
    where: (l, { eq }) => eq(l.publicId, boards[0].lists![0].publicId),
    columns: { id: true, workspaceId: true },
  });
  if (!list) return { error: "Could not resolve list." };
  return { listId: list.id, workspaceId: list.workspaceId };
}

async function resolveUserId(db: import("@banana/db/client").dbClient, email: string) {
  const members = await db.query.workspaceMembers.findMany({
    where: (m, { eq, and, isNull }) =>
      and(eq(m.email, email), isNull(m.deletedAt)),
    limit: 1,
    columns: { userId: true },
  });
  return members[0]?.userId ?? null;
}

async function handleCreate(
  res: NextApiResponse<MattermostResponse>,
  db: import("@banana/db/client").dbClient,
  parts: string[],
  userEmail: string,
) {
  const text = parts.join(" ");
  const args = parseQuotedArgs(text);

  const taskTitle = args[0];
  const boardName = args[1];

  if (!taskTitle) {
    return res.json({ text: "Please provide a task title: `/banana create \"Task title\" in \"Board name\"`" });
  }

  const workspace = await resolveUserWorkspace(db, userEmail);
  if (!workspace) {
    return res.json({ text: "You don't have a Banana workspace. Please log in to Banana first." });
  }

  const userId = await resolveUserId(db, userEmail);
  if (!userId) {
    return res.json({ text: "Could not find your user account." });
  }

  const resolved = await resolveBoardAndList(db, workspace, userId, boardName);
  if ("error" in resolved) {
    return res.json({ text: resolved.error });
  }

  const card = await cardRepo.create(db, {
    title: taskTitle,
    description: "Created via Mattermost",
    createdBy: userId,
    listId: resolved.listId,
    workspaceId: resolved.workspaceId,
    position: "end",
  });

  if (!card) {
    return res.json({ text: "Failed to create the task." });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const cardUrl = `${baseUrl}/boards/${card.publicId}`;

  return res.json({
    response_type: "in_channel",
    text: `Created task **[${taskTitle}](${cardUrl})**`,
  });
}

async function handlePlan(
  res: NextApiResponse<MattermostResponse>,
  db: import("@banana/db/client").dbClient,
  parts: string[],
  userEmail: string,
) {
  const zaiApiKey = process.env.ZAI_API_KEY;
  if (!zaiApiKey) {
    return res.json({ text: "Z.ai integration is not configured." });
  }

  const text = parts.join(" ");
  const args = parseQuotedArgs(text);

  const planDescription = args[0];
  const boardName = args[1];

  if (!planDescription) {
    return res.json({ text: "Please provide a description: `/banana plan \"Procedure description\" in \"Board name\"`" });
  }

  const workspace = await resolveUserWorkspace(db, userEmail);
  if (!workspace) {
    return res.json({ text: "You don't have a Banana workspace. Please log in to Banana first." });
  }

  const userId = await resolveUserId(db, userEmail);
  if (!userId) {
    return res.json({ text: "Could not find your user account." });
  }

  const resolved = await resolveBoardAndList(db, workspace, userId, boardName);
  if ("error" in resolved) {
    return res.json({ text: resolved.error });
  }

  const systemPrompt = `You are a project planning assistant. Given a procedure description, break it into concrete, actionable tasks with checklists.

Return ONLY valid JSON (no markdown, no code fences) as an array of objects:
[{
  "title": "Task title",
  "description": "Brief description",
  "checklist": ["Item 1", "Item 2", "Item 3"]
}]

Keep tasks specific and actionable. Each task should have 3-8 checklist items.`;

  const zaiUrl = process.env.ZAI_API_URL || "https://api.zai.chat/v1/chat/completions";

  try {
    const response = await fetch(zaiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${zaiApiKey}`,
      },
      body: JSON.stringify({
        model: process.env.ZAI_MODEL || "z-ai-default",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: planDescription },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      log.error({ status: response.status }, "Z.ai API error");
      return res.json({ text: `Z.ai API error: ${response.status}. Please try again later.` });
    }

    const data = await response.json() as { choices: { message: { content: string } }[] };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return res.json({ text: "Z.ai returned an empty response." });
    }

    let parsed: unknown;
    try {
      const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      log.error("Failed to parse Z.ai response as JSON");
      return res.json({ text: "Failed to parse the AI plan. Please try again." });
    }

    const validationResult = planResponseSchema.safeParse(parsed);
    if (!validationResult.success) {
      log.error({ issues: validationResult.error.issues }, "Z.ai response failed validation");
      return res.json({ text: "The AI plan format was invalid. Please try again." });
    }

    const tasks = validationResult.data;

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const createdCards: { title: string; url: string }[] = [];

    for (const task of tasks) {
      const card = await cardRepo.create(db, {
        title: task.title,
        description: task.description || "Created via Mattermost plan",
        createdBy: userId,
        listId: resolved.listId,
        workspaceId: resolved.workspaceId,
        position: "end",
      });

      if (card && task.checklist?.length) {
        const checklist = await checklistRepo.create(db, {
          cardId: card.id,
          name: "Checklist",
          createdBy: userId,
        });

        if (checklist) {
          await checklistRepo.bulkCreateItems(
            db,
            task.checklist
              .filter((item) => item.trim().length > 0)
              .map((title, i) => ({
                checklistId: checklist.id,
                title,
                createdBy: userId,
                index: i,
                completed: false,
              })),
          );
        }
      }

      if (card) {
        createdCards.push({ title: task.title, url: `${baseUrl}/boards/${card.publicId}` });
      }
    }

    const taskList = createdCards
      .map((c, i) => `${i + 1}. [${c.title}](${c.url})`)
      .join("\n");

    return res.json({
      response_type: "in_channel",
      text: `**Plan created: ${createdCards.length} tasks**\n\n${taskList}`,
    });
  } catch (error) {
    log.error({ err: error }, "Plan generation error");
    return res.json({ text: "Failed to generate plan. Please try again later." });
  }
}

export default withRateLimit(
  { points: 20, duration: 60 },
  withApiLogging(handler),
);
