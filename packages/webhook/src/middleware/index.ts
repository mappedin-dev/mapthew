import type { Request } from "express";

/**
 * Extended request type with raw body for signature verification
 */
export type RequestWithRawBody = Request & { rawBody?: string };

export { jiraWebhookAuth } from "./jira.js";
export { githubWebhookAuth } from "./github.js";
