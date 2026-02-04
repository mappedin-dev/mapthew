import { Router } from "express";
import {
  getConfig,
  saveConfig,
  getBotDisplayName,
  CLAUDE_MODELS,
  type AppConfig,
} from "@mapthew/shared";
import { JIRA_BASE_URL } from "../../config.js";

const router: Router = Router();

// GET /api/config
router.get("/", async (_req, res) => {
  try {
    const config = await getConfig();
    res.json({
      botName: config.botName,
      botDisplayName: getBotDisplayName(),
      claudeModel: config.claudeModel,
      availableModels: CLAUDE_MODELS,
      jiraBaseUrl: JIRA_BASE_URL,
    });
  } catch (error) {
    console.error("Error getting config:", error);
    res.status(500).json({ error: "Failed to get config" });
  }
});

// PUT /api/config
router.put("/", async (req, res) => {
  try {
    const { botName, claudeModel } = req.body as Partial<AppConfig>;
    const config = await getConfig();

    if (botName !== undefined) {
      config.botName = botName;
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

    await saveConfig(config);

    const updatedConfig = await getConfig();
    res.json({
      botName: updatedConfig.botName,
      botDisplayName: getBotDisplayName(),
      claudeModel: updatedConfig.claudeModel,
      availableModels: CLAUDE_MODELS,
      jiraBaseUrl: JIRA_BASE_URL,
    });
  } catch (error) {
    console.error("Error updating config:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
