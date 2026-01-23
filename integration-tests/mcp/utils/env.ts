import * as path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load environment files:
 * 1. .env from project root (credentials)
 * 2. .env.test from mcp folder (test targets)
 */
export function loadEnv(): void {
  // Load credentials from project root
  const envResult = config({
    path: path.resolve(__dirname, "..", "..", "..", ".env"),
  });

  // Load test configuration from mcp folder
  const testEnvResult = config({
    path: path.resolve(__dirname, "..", ".env.test"),
  });

  if (envResult.parsed || testEnvResult.parsed) {
    const sources: string[] = [];
    if (envResult.parsed) sources.push(".env");
    if (testEnvResult.parsed) sources.push(".env.test");
    console.log(`Loaded environment from ${sources.join(", ")}\n`);
  }
}
