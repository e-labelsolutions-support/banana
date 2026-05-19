import type { NextApiRequest, NextApiResponse } from "next";

import { createNextApiContext } from "@banana/api/trpc";
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MattermostResponse>,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ text: "Method not allowed" });
  }

  const commandToken = process.env.MATTERMOST_COMMAND_TOKEN;
  if (!commandToken) {
    return res.status(500).json({ text: "Mattermost command token not configured." });
  }

  const token = req.body.token;
  if (token !== commandToken) {
    return res.status(401).json({ text: "Invalid command token." });
  }

  const commandText: string = (req.body.text ?? "").trim();
  const userEmail: string = req.body.user_email ?? "";
  const userName: string = req.body.user_name ?? "";

  if (!userEmail) {
    return res.json({ text: "Could not determine your email from Mattermost." });
  }

  const { db } = await createNextApiContext(req);

  try {
    const parts = commandText.split(/\s+/);
    const subcommand = parts[0]?.toLowerCase();

    if (subcommand === "create") {
      return await handleCreate(req, res, db, parts.slice(1), userEmail, userName);
    }

    if (subcommand === "plan") {
      return await handlePlan(req, res, db, parts.slice(1), userEmail, userName);
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
    args.push(match[1]);
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

async function handleCreate(
  _req: NextApiRequest,
  res: NextApiResponse<MattermostResponse>,
  db: import("@banana/db/client").dbClient,
  parts: string[],
  userEmail: string,
  _userName: string,
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

  // Resolve user ID from email
  const members = await db.query.workspaceMembers.findMany({
    where: (m, { eq, and, isNull }) =>
      and(eq(m.email, userEmail), isNull(m.deletedAt)),
    limit: 1,
    columns: { userId: true },
  });
  const userId = members[0]?.userId;
  if (!userId) {
    return res.json({ text: "Could not find your user account in Banana." });
  }

  let listId: number;
  let workspaceId: number;

  if (boardName) {
    const board = await findBoardByName(db, workspace.id, userId, boardName);
    if (!board) {
      return res.json({ text: `Board "${boardName}" not found.` });
    }
    const firstList = board.lists?.[0];
    if (!firstList) {
      return res.json({ text: `Board "${boardName}" has no lists.` });
    }
    // Get the full list with internal ID
    const list = await db.query.lists.findFirst({
      where: (l, { eq }) => eq(l.publicId, firstList.publicId),
      columns: { id: true, workspaceId: true },
    });
    if (!list) {
      return res.json({ text: "Could not resolve list." });
    }
    listId = list.id;
    workspaceId = list.workspaceId;
  } else {
    // Use the first board's first list
    const boards = await boardRepo.getAllByWorkspaceId(db, workspace.id, userId);
    if (!boards.length || !boards[0].lists?.length) {
      return res.json({ text: "No boards found in your workspace." });
    }
    const list = await db.query.lists.findFirst({
      where: (l, { eq }) => eq(l.publicId, boards[0].lists![0].publicId),
      columns: { id: true, workspaceId: true },
    });
    if (!list) {
      return res.json({ text: "Could not resolve list." });
    }
    listId = list.id;
    workspaceId = list.workspaceId;
  }

  const card = await cardRepo.create(db, {
    title: taskTitle,
    description: `Created via Mattermost by ${userEmail}`,
    createdBy: userId,
    listId,
    workspaceId,
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
  _req: NextApiRequest,
  res: NextApiResponse<MattermostResponse>,
  db: import("@banana/db/client").dbClient,
  parts: string[],
  userEmail: string,
  _userName: string,
) {
  const zaiApiKey = process.env.ZAI_API_KEY;
  if (!zaiApiKey) {
    return res.json({ text: "Z.ai integration is not configured. Set `ZAI_API_KEY` to enable planning." });
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

  // Resolve user ID from email
  const members = await db.query.workspaceMembers.findMany({
    where: (m, { eq, and, isNull }) =>
      and(eq(m.email, userEmail), isNull(m.deletedAt)),
    limit: 1,
    columns: { userId: true },
  });
  const userId = members[0]?.userId;
  if (!userId) {
    return res.json({ text: "Could not find your user account in Banana." });
  }

  let listId: number;
  let workspaceId: number;

  if (boardName) {
    const board = await findBoardByName(db, workspace.id, userId, boardName);
    if (!board) {
      return res.json({ text: `Board "${boardName}" not found.` });
    }
    const firstList = board.lists?.[0];
    if (!firstList) {
      return res.json({ text: `Board "${boardName}" has no lists.` });
    }
    const list = await db.query.lists.findFirst({
      where: (l, { eq }) => eq(l.publicId, firstList.publicId),
      columns: { id: true, workspaceId: true },
    });
    if (!list) {
      return res.json({ text: "Could not resolve list." });
    }
    listId = list.id;
    workspaceId = list.workspaceId;
  } else {
    const boards = await boardRepo.getAllByWorkspaceId(db, workspace.id, userId);
    if (!boards.length || !boards[0].lists?.length) {
      return res.json({ text: "No boards found in your workspace." });
    }
    const list = await db.query.lists.findFirst({
      where: (l, { eq }) => eq(l.publicId, boards[0].lists![0].publicId),
      columns: { id: true, workspaceId: true },
    });
    if (!list) {
      return res.json({ text: "Could not resolve list." });
    }
    listId = list.id;
    workspaceId = list.workspaceId;
  }

  // Call Z.ai to generate a plan
  const systemPrompt = `You are a project planning assistant. Given a procedure description, break it into concrete, actionable tasks with checklists.

Return ONLY valid JSON (no markdown, no code fences) as an array of objects:
[{
  "title": "Task title",
  "description": "Brief description",
  "checklist": ["Item 1", "Item 2", "Item 3"]
}]

Keep tasks specific and actionable. Each task should have 3-8 checklist items.`;

  try {
    const response = await fetch("https://api.zai.chat/v1/chat/completions", {
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
      const errText = await response.text();
      log.error({ status: response.status, body: errText }, "Z.ai API error");
      return res.json({ text: `Z.ai API error: ${response.status}. Please try again later.` });
    }

    const data = await response.json() as { choices: { message: { content: string } }[] };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return res.json({ text: "Z.ai returned an empty response." });
    }

    // Parse the JSON response
    let tasks: { title: string; description: string; checklist: string[] }[];
    try {
      const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      tasks = JSON.parse(cleaned);
    } catch {
      log.error({ content }, "Failed to parse Z.ai response as JSON");
      return res.json({ text: "Failed to parse the AI plan. Please try again." });
    }

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.json({ text: "The AI plan was empty. Please try a more specific description." });
    }

    // Create all tasks with checklists
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const createdCards: { title: string; url: string }[] = [];

    for (const task of tasks) {
      const card = await cardRepo.create(db, {
        title: task.title,
        description: task.description || `Created via Mattermost plan: ${planDescription}`,
        createdBy: userId,
        listId,
        workspaceId,
        position: "end",
      });

      if (card && task.checklist?.length > 0) {
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
