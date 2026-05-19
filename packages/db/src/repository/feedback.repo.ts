import type { dbClient } from "@banana/db/client";
import { feedback } from "@banana/db/schema";

export const create = async (
  db: dbClient,
  feedbackInput: {
    feedback: string;
    createdBy: string;
    url: string;
  },
) => {
  const [result] = await db
    .insert(feedback)
    .values({
      feedback: feedbackInput.feedback,
      createdBy: feedbackInput.createdBy,
      url: feedbackInput.url,
    })
    .returning({ id: feedback.id });

  return result;
};
