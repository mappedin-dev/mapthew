import { Router } from "express";
import { getConfig, saveConfig } from "@mapthew/shared/config";
import { CLAUDE_MODELS } from "@mapthew/shared/constants";
import type { AppConfig } from "@mapthew/shared/types";

const router: Router = Router();

// GET /api/config - Returns AppConfig
router.get("/", async (_req, res) => {
  try {
    const config: AppConfig = await getConfig();
    res.json(config);
  } catch (error) {
    console.error("Error getting config:", error);
    res.status(500).json({ error: "Failed to get config" });
  }
});

// PUT /api/config - Updates and returns AppConfig
router.put("/", async (req, res) => {
  try {
    const {
      botName, claudeModel,
      maxSessions, pruneThresholdDays, pruneIntervalDays,
    } = req.body as Partial<AppConfig>;
    const config = await getConfig();

    if (botName !== undefined) {
      const oldBotName = config.botName;
      config.botName = botName;
      if (oldBotName !== botName) {
        console.log(`Bot name updated: "${oldBotName}" -> "${botName}"`);
      }
    }

    if (claudeModel !== undefined) {
      if (!CLAUDE_MODELS.includes(claudeModel)) {
        res.status(400).json({
          error: `Invalid model. Must be one of: ${CLAUDE_MODELS.join(", ")}`,
        });
        return;
      }
      config.claudeModel = claudeModel;
    }

    if (maxSessions !== undefined) {
      if (!Number.isInteger(maxSessions) || maxSessions < 1 || maxSessions > 100) {
        res.status(400).json({ error: "Max sessions must be an integer between 1 and 100." });
        return;
      }
      config.maxSessions = maxSessions;
    }

    if (pruneThresholdDays !== undefined) {
      if (!Number.isInteger(pruneThresholdDays) || pruneThresholdDays < 1 || pruneThresholdDays > 365) {
        res.status(400).json({ error: "Prune threshold must be an integer between 1 and 365 days." });
        return;
      }
      config.pruneThresholdDays = pruneThresholdDays;
    }

    if (pruneIntervalDays !== undefined) {
      if (!Number.isInteger(pruneIntervalDays) || pruneIntervalDays < 1 || pruneIntervalDays > 365) {
        res.status(400).json({ error: "Prune interval must be an integer between 1 and 365 days." });
        return;
      }
      config.pruneIntervalDays = pruneIntervalDays;
    }

    await saveConfig(config);
    console.log(`Config updated: botName=${config.botName}, claudeModel=${config.claudeModel}`);

    const updatedConfig: AppConfig = await getConfig();
    res.json(updatedConfig);
  } catch (error) {
    console.error("Error updating config:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
