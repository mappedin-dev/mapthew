import path from "path";
import { fileURLToPath } from "url";
import express, { type Request, type Response } from "express";
import { PORT, REDIS_URL, VERBOSE_LOGS } from "./config.js";
import { getBotName } from "@mapthew/shared/utils";
import { initConfigStore, getConfig } from "@mapthew/shared/config";
import type { RequestWithRawBody } from "./middleware/index.js";
import { jwtCheck, requireAdminPermission } from "./middleware/auth.js";
import jiraRoutes from "./routes/jira.js";
import githubRoutes from "./routes/github.js";
import apiRoutes from "./routes/api/index.js";
import sessionsRoutes from "./routes/sessions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Initialize config store with Redis
initConfigStore(REDIS_URL);

// Load config from Redis on startup
getConfig().then((config) => {
  console.log(`  Loaded config: botName=${config.botName}`);
});

// Serve dashboard static files
const dashboardPath = path.join(__dirname, "../../dashboard/dist");
app.use("/admin", express.static(dashboardPath));

// SPA fallback for hash routing (optional, but good for direct /admin access)
app.get("/admin/*", (_req, res) => {
  res.sendFile(path.join(dashboardPath, "index.html"));
});

// Parse JSON bodies and capture raw body for signature verification
app.use(
  express.json({
    verify: (req: Request, _res: Response, buf: Buffer) => {
      (req as RequestWithRawBody).rawBody = buf.toString("utf8");
    },
  }),
);

// Routes
app.use("/api", jwtCheck, requireAdminPermission, apiRoutes);
app.use("/webhook/jira", jiraRoutes);
app.use("/webhook/github", githubRoutes);
app.use("/api/sessions", jwtCheck, requireAdminPermission, sessionsRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
  console.log(`  Listening as: @${getBotName()}`);
  if (VERBOSE_LOGS) console.log(`  Verbose logging enabled`);
});
