import { createQueue, Queue } from "@mapthew/shared/queue";
import { SecretsManager } from "@mapthew/shared/secrets";
import type { Job } from "@mapthew/shared/types";

export const PORT = process.env.PORT || 3000;
export const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Auth0 - required
export const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
export const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE;

// Azure Key Vault - required
export const AZURE_KEYVAULT_URL = process.env.AZURE_KEYVAULT_URL;
export const AZURE_IDENTITY_ENDPOINT = process.env.AZURE_IDENTITY_ENDPOINT;
export const AZURE_IDENTITY_HEADER = process.env.AZURE_IDENTITY_HEADER;

// Validate required configuration
const missing: string[] = [];
if (!AUTH0_DOMAIN) missing.push("AUTH0_DOMAIN");
if (!AUTH0_AUDIENCE) missing.push("AUTH0_AUDIENCE");
if (!AZURE_KEYVAULT_URL) missing.push("AZURE_KEYVAULT_URL");
if (!AZURE_IDENTITY_ENDPOINT) missing.push("AZURE_IDENTITY_ENDPOINT");
if (!AZURE_IDENTITY_HEADER) missing.push("AZURE_IDENTITY_HEADER");

if (missing.length > 0) {
  console.error("Missing required configuration:");
  missing.forEach((name) => console.error(`  - ${name} is not set`));
  process.exit(1);
}

export const secretsManager = new SecretsManager({ readOnly: false });

export const queue: Queue<Job> = createQueue(REDIS_URL);
