import type { NextApiRequest, NextApiResponse } from "next";

import { openApiDocument } from "@banana/api/openapi";
import { withRateLimit } from "@banana/api/utils/rateLimit";

export default withRateLimit(
  { points: 100, duration: 60 },
  (req: NextApiRequest, res: NextApiResponse) => {
    res.status(200).send(openApiDocument);
  },
);
