import type { Request, Response, NextFunction } from "express";
import { verifyHmacSignature } from "@mapthew/shared/api";
import { GITHUB_WEBHOOK_SECRET } from "../config.js";
import type { RequestWithRawBody } from "./index.js";

/**
 * Middleware to verify GitHub webhook signature
 */
export function githubWebhookAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const signature = req.headers["x-hub-signature-256"] as string;

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

  if (!verifyHmacSignature(GITHUB_WEBHOOK_SECRET!, rawBody, signature)) {
    console.warn("Invalid GitHub webhook signature");
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  next();
}
