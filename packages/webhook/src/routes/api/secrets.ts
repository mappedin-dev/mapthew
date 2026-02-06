import { Router } from "express";
import type { SecretsStatus } from "@mapthew/shared/types";
import {
  JIRA_EMAIL,
  JIRA_API_TOKEN,
  JIRA_WEBHOOK_SECRET,
  GITHUB_TOKEN,
  GITHUB_WEBHOOK_SECRET,
  FIGMA_API_KEY,
} from "../../config.js";

const router: Router = Router();

/**
 * Mask a secret string, revealing only a safe portion
 * - Empty/undefined: returns ""
 * - < 12 chars: returns "****" (too short to safely reveal)
 * - 12-20 chars: shows first 2 and last 2
 * - > 20 chars: shows first 4 and last 4
 */
function maskSecret(secret: string | undefined): string {
  if (!secret) return "";
  if (secret.length < 12) return "******";
  return `${secret.slice(0, 2)}******${secret.slice(-2)}`;
}

// GET /api/secrets
router.get("/", (_req, res) => {
  const secrets: SecretsStatus = {
    jira: {
      email: JIRA_EMAIL ?? "",
      tokenMasked: maskSecret(JIRA_API_TOKEN),
      webhookSecretMasked: maskSecret(JIRA_WEBHOOK_SECRET),
    },
    github: {
      tokenMasked: maskSecret(GITHUB_TOKEN),
      webhookSecretMasked: maskSecret(GITHUB_WEBHOOK_SECRET),
    },
    figma: {
      apiKeyMasked: maskSecret(FIGMA_API_KEY),
    },
  };
  res.json(secrets);
});

export default router;
