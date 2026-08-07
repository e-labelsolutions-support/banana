import type { NextApiRequest, NextApiResponse } from "next";

import { initAuth } from "@banana/auth/server";
import { withApiLogging } from "@banana/api/utils/apiLogging";
import { withRateLimit } from "@banana/api/utils/rateLimit";
import { createDrizzleClient } from "@banana/db/client";
import * as cardAttachmentRepo from "@banana/db/repository/cardAttachment.repo";
import * as workspaceRepo from "@banana/db/repository/workspace.repo";
import { generateDownloadUrl } from "@banana/shared/utils";

const db = createDrizzleClient();
const auth = initAuth(db);

const toWebHeaders = (nodeHeaders: NextApiRequest["headers"]): Headers => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeHeaders)) {
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else if (typeof value === "string") {
      headers.set(key, value);
    }
  }
  return headers;
};

export default withRateLimit(
  { points: 100, duration: 60 },
  withApiLogging(async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== "GET") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    const { attachmentPublicId, filename } = req.query;
    if (
      !attachmentPublicId ||
      typeof attachmentPublicId !== "string" ||
      attachmentPublicId.length < 12
    ) {
      return res.status(400).json({ message: "attachmentPublicId is required" });
    }

    const session = await auth.api.getSession({ headers: toWebHeaders(req.headers) });
    if (!session?.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const attachment = await cardAttachmentRepo.getByPublicId(
      db,
      attachmentPublicId,
    );
    if (!attachment || attachment.deletedAt) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    const workspaceId = attachment.card.list.board.workspaceId;
    const isMember = await workspaceRepo.isUserInWorkspace(
      db,
      session.user.id,
      workspaceId,
    );
    if (!isMember) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const bucket = process.env.NEXT_PUBLIC_ATTACHMENTS_BUCKET_NAME;
    if (!bucket) {
      return res.status(500).json({ message: "Attachments bucket not configured" });
    }

    const downloadFilename =
      typeof filename === "string"
        ? encodeURIComponent(filename)
        : encodeURIComponent(attachment.originalFilename || "attachment");

    let presignedUrl: string;
    try {
      presignedUrl = await generateDownloadUrl(bucket, attachment.s3Key, 300);
    } catch {
      return res.status(500).json({ message: "Failed to generate download URL" });
    }

    let upstream: Response;
    try {
      upstream = await fetch(presignedUrl);
    } catch {
      return res.status(502).json({ message: "Failed to reach storage backend" });
    }

    if (!upstream.ok || !upstream.body) {
      return res
        .status(upstream.status || 502)
        .json({ message: "Failed to fetch attachment" });
    }

    res.setHeader(
      "Content-Type",
      attachment.contentType || "application/octet-stream",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${downloadFilename}"; filename*=UTF-8''${downloadFilename}`,
    );

    const reader = upstream.body.getReader();
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) res.write(Buffer.from(value));
        }
        res.end();
      } catch {
        if (!res.writableEnded) res.end();
      }
    };
    await pump();
  }),
);
