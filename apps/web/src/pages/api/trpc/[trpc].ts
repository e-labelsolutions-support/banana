import type { NextApiRequest, NextApiResponse } from "next";
import { createNextApiHandler } from "@trpc/server/adapters/next";

import { appRouter } from "@banana/api/root";
import { createTRPCContext } from "@banana/api/trpc";
import { env } from "~/env";
import { withRateLimit } from "@banana/api/utils/rateLimit";

const nextApiHandler = createNextApiHandler({
  router: appRouter,
  createContext: createTRPCContext,
  onError:
    env.NODE_ENV === "development"
      ? ({ path, error }) => {
          console.error(
            `❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`,
          );
        }
      : undefined,
});

export default withRateLimit(
  { points: 100, duration: 60 },
  async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    const result = await nextApiHandler(req, res);
    return result;
  },
);
