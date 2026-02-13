import { Router } from "express";
import type { SecretKey } from "@mapthew/shared/types";
import { SECRET_KEYS } from "@mapthew/shared/secrets";
import { secretsManager } from "../../config.js";

const router: Router = Router();

// GET /api/secrets — return masked secrets
router.get("/", async (_req, res) => {
  try {
    const masked = await secretsManager.getMasked();
    res.json(masked);
  } catch (error) {
    console.error("Error fetching secrets:", error);
    res.status(500).json({ error: "Failed to fetch secrets" });
  }
});

// PUT /api/secrets — set a secret
router.put("/", async (req, res) => {
  try {
    const { key, value } = req.body as { key: string; value: string };

    if (!key || typeof value !== "string" || !value.trim()) {
      res.status(400).json({ error: "key and value are required" });
      return;
    }

    if (value.length > 4096) {
      res.status(400).json({ error: "value exceeds maximum length" });
      return;
    }

    if (!SECRET_KEYS[key as SecretKey]) {
      res.status(400).json({ error: `Invalid secret key: ${key}` });
      return;
    }

    await secretsManager.set(key as SecretKey, value.trim());
    res.json({ success: true });
  } catch (error) {
    console.error("Error setting secret:", error);
    res.status(500).json({ error: "Failed to set secret" });
  }
});

// DELETE /api/secrets/:key — delete a secret
router.delete("/:key", async (req, res) => {
  try {
    const { key } = req.params;

    if (!SECRET_KEYS[key as SecretKey]) {
      res.status(400).json({ error: `Invalid secret key: ${key}` });
      return;
    }

    await secretsManager.delete(key as SecretKey);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting secret:", error);
    res.status(500).json({ error: "Failed to delete secret" });
  }
});

export default router;
