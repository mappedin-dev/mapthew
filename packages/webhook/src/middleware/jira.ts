import type { Request, Response, NextFunction } from "express";
import { verifyHmacSignature } from "@mapthew/shared/api";
import { JIRA_WEBHOOK_SECRET } from "../config.js";
import type { RequestWithRawBody } from "./index.js";

/**
 * Middleware to verify JIRA webhook signature
 */
export function jiraWebhookAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const signature =
    (req.headers["x-hub-signature-256"] as string) ||
    (req.headers["x-hub-signature"] as string);

  if (!signature) {
    res.status(401).json({ error: "Missing webhook signature" });
    return;
  }

  const rawBody = (req as RequestWithRawBody).rawBody;
  if (!rawBody) {
    res
      .status(500)
      .json({ error: "Raw body not available for signature verification" });
    return;
  }

  if (!verifyHmacSignature(JIRA_WEBHOOK_SECRET!, rawBody, signature)) {
    console.warn("Invalid JIRA webhook signature");
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  next();
}
