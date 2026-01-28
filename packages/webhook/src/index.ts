import express, { type Request, type Response } from "express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { createQueue } from "@dexter/shared/queue";
import {
  PORT,
  queue,
  JIRA_WEBHOOK_SECRET,
  GITHUB_WEBHOOK_SECRET,
} from "./config.js";
import type { RequestWithRawBody } from "./middleware/index.js";
import jiraRoutes from "./routes/jira.js";
import githubRoutes from "./routes/github.js";

const app = express();

// Setup Bull Board dashboard
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin");

createBullBoard({
  queues: [new BullMQAdapter(queue)],
  serverAdapter,
});

app.use("/admin", serverAdapter.getRouter());

// Parse JSON bodies and capture raw body for signature verification
app.use(
  express.json({
    verify: (req: Request, _res: Response, buf: Buffer) => {
      (req as RequestWithRawBody).rawBody = buf.toString("utf8");
    },
  }),
);

// Routes
app.use("/webhook/jira", jiraRoutes);
app.use("/webhook/github", githubRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
  console.log(
    `  JIRA webhook secret: ${
      JIRA_WEBHOOK_SECRET ? "configured" : "NOT configured"
    }`,
  );
  console.log(
    `  GitHub webhook secret: ${
      GITHUB_WEBHOOK_SECRET ? "configured" : "NOT configured"
    }`,
  );
});
