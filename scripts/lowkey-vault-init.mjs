#!/usr/bin/env node

/**
 * Reads `.env.local` and generates a Lowkey Vault import file so secrets are
 * available the instant the container starts — no runtime seeding needed.
 *
 * Output: docker/lowkey-vault-import/vault.json.hbs
 *
 * The file uses Handlebars placeholders ({{host}}, {{port}}, {{now 0}}) so
 * Lowkey Vault can resolve them at import time.
 */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Same mapping as SECRET_KEYS in packages/shared/src/secrets.ts
const SECRET_KEYS = {
  jiraBaseUrl: { vaultKey: "jira-base-url", envVar: "JIRA_BASE_URL" },
  jiraEmail: { vaultKey: "jira-email", envVar: "JIRA_EMAIL" },
  jiraApiToken: { vaultKey: "jira-api-token", envVar: "JIRA_API_TOKEN" },
  jiraWebhookSecret: { vaultKey: "jira-webhook-secret", envVar: "JIRA_WEBHOOK_SECRET" },
  githubToken: { vaultKey: "github-token", envVar: "GITHUB_TOKEN" },
  githubWebhookSecret: { vaultKey: "github-webhook-secret", envVar: "GITHUB_WEBHOOK_SECRET" },
  figmaApiKey: { vaultKey: "figma-api-key", envVar: "FIGMA_API_KEY" },
  anthropicApiKey: { vaultKey: "anthropic-api-key", envVar: "ANTHROPIC_API_KEY" },
};

// ---------------------------------------------------------------------------
// Parse .env
// ---------------------------------------------------------------------------
function parseEnv(filePath) {
  const vars = {};
  const content = readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    vars[key] = value;
  }
  return vars;
}

// ---------------------------------------------------------------------------
// Build import JSON
// ---------------------------------------------------------------------------
function buildSecretVersion(vaultKey, value) {
  return {
    vaultBaseUri: "https://{{host}}:{{port}}",
    entityId: vaultKey,
    entityVersion: "00000000000000000000000000000001",
    attributes: {
      enabled: true,
      created: "{{now 0}}",
      updated: "{{now 0}}",
      recoveryLevel: "Recoverable+Purgeable",
      recoverableDays: 90,
    },
    tags: {},
    managed: false,
    value,
    contentType: "text/plain",
  };
}

function buildImport(envVars) {
  const secrets = {};
  let count = 0;

  for (const { vaultKey, envVar } of Object.values(SECRET_KEYS)) {
    const value = envVars[envVar];
    if (!value) continue;
    secrets[vaultKey] = { versions: [buildSecretVersion(vaultKey, value)] };
    count++;
  }

  if (count === 0) {
    console.warn("Warning: no secrets found in .env — vault will be empty");
  } else {
    console.log(`Generated vault import with ${count} secret(s)`);
  }

  return {
    vaults: [
      {
        attributes: {
          baseUri: "https://{{host}}:{{port}}",
          recoveryLevel: "Recoverable+Purgeable",
          recoverableDays: 90,
          created: "{{now 0}}",
          deleted: null,
        },
        keys: {},
        certificates: {},
        secrets,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const envPath = process.env.VAULT_ENV_FILE || resolve(ROOT, ".env.local");
const outDir = process.env.VAULT_OUTPUT_DIR || resolve(ROOT, "docker", "lowkey-vault-import");
const outFile = resolve(outDir, "vault.json.hbs");

const envVars = parseEnv(envPath);
const importData = buildImport(envVars);

// Handlebars placeholders must NOT be quoted — strip the quotes that
// JSON.stringify adds around "{{now 0}}" etc.
const json = JSON.stringify(importData, null, 2).replace(/"(\{\{[^}]+\}\})"/g, "$1");

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, json + "\n");
console.log(`Wrote ${outFile}`);
