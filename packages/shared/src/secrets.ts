import { SecretClient } from "@azure/keyvault-secrets";
import type { SecretKey, SecretsStatus } from "./types.js";

/** Minimal AccessToken shape (matches @azure/core-auth) */
interface AccessToken {
  token: string;
  expiresOnTimestamp: number;
}

/** Minimal TokenCredential shape (matches @azure/core-auth) */
interface TokenCredential {
  getToken(scopes: string | string[]): Promise<AccessToken>;
}

/** Check if an error is a Key Vault "not found" error.
 *  Azure Key Vault returns code "SecretNotFound".
 *  Lowkey Vault (local dev emulator) returns its own Java exception class name
 *  with statusCode 404, so we also accept any 404 as "not found". */
function isSecretNotFound(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: unknown; statusCode?: unknown };
  return e.code === "SecretNotFound" || e.statusCode === 404;
}

/**
 * Token credential for Azure Key Vault using managed identity endpoint.
 */
export class VaultCredential implements TokenCredential {
  private cachedToken: AccessToken | null = null;

  constructor(
    private endpoint: string,
    private header: string,
  ) {}

  async getToken(scopes: string | string[]): Promise<AccessToken> {
    // Return cached token if still valid (5 min buffer)
    if (
      this.cachedToken &&
      this.cachedToken.expiresOnTimestamp > Date.now() + 5 * 60 * 1000
    ) {
      return this.cachedToken;
    }

    const scope = Array.isArray(scopes) ? scopes[0] : scopes;
    const url = `${this.endpoint}?resource=${encodeURIComponent(scope)}&api-version=2019-08-01`;

    const res = await fetch(url, {
      headers: { "x-identity-header": this.header },
    });

    if (!res.ok) {
      const message = await res.text().catch(() => "unknown error");
      throw new Error(
        `Failed to obtain vault token from identity endpoint: ${res.status} ${message}`,
      );
    }

    const json = (await res.json()) as {
      access_token?: string;
      expires_on?: number;
    };

    if (!json.access_token || !json.expires_on) {
      throw new Error(
        "Identity endpoint response missing access_token or expires_on",
      );
    }

    this.cachedToken = {
      token: json.access_token,
      expiresOnTimestamp: json.expires_on * 1000,
    };

    return this.cachedToken;
  }
}

/**
 * Maps SecretKey identifiers to vault key names and environment variable names.
 */
export const SECRET_KEYS: Record<
  SecretKey,
  { vaultKey: string; envVar: string }
> = {
  jiraBaseUrl: { vaultKey: "jira-base-url", envVar: "JIRA_BASE_URL" },
  jiraEmail: { vaultKey: "jira-email", envVar: "JIRA_EMAIL" },
  jiraApiToken: { vaultKey: "jira-api-token", envVar: "JIRA_API_TOKEN" },
  jiraWebhookSecret: {
    vaultKey: "jira-webhook-secret",
    envVar: "JIRA_WEBHOOK_SECRET",
  },
  githubToken: { vaultKey: "github-token", envVar: "GITHUB_TOKEN" },
  githubWebhookSecret: {
    vaultKey: "github-webhook-secret",
    envVar: "GITHUB_WEBHOOK_SECRET",
  },
  figmaApiKey: { vaultKey: "figma-api-key", envVar: "FIGMA_API_KEY" },
  anthropicApiKey: {
    vaultKey: "anthropic-api-key",
    envVar: "ANTHROPIC_API_KEY",
  },
};

/**
 * Mask a secret for safe display, showing only the first and last 2 characters.
 */
export function maskSecret(secret: string | undefined): string {
  if (!secret) return "";
  if (secret.length < 12) return "******";
  return `${secret.slice(0, 2)}******${secret.slice(-2)}`;
}

/**
 * Manages reading, writing, and caching secrets from Azure Key Vault.
 */
export class SecretsManager {
  private client: SecretClient | null = null;
  private cache = new Map<SecretKey, string | undefined>();
  private cacheLoadedAt = 0;
  private refreshPromise: Promise<void> | null = null;
  readonly readOnly: boolean;
  private static CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor({ readOnly = true }: { readOnly?: boolean } = {}) {
    this.readOnly = readOnly;
  }

  private assertInitialized(): asserts this is { client: SecretClient } {
    if (!this.client)
      throw new Error("SecretsManager.init() must be called before use");
  }

  async init(options: {
    vaultUrl: string;
    identityEndpoint: string;
    identityHeader: string;
  }): Promise<void> {
    const credential = new VaultCredential(
      options.identityEndpoint,
      options.identityHeader,
    );
    // Lowkey Vault (local dev) returns a challenge resource that doesn't match
    // the Docker hostname, causing the SDK's domain verification to fail.
    // Only disable this check for non-Azure endpoints; production keeps it enabled.
    const isAzure = options.vaultUrl.includes(".vault.azure.net");
    this.client = new SecretClient(options.vaultUrl, credential, {
      disableChallengeResourceVerification: !isAzure,
    });

    // Retry loop: vault may still be starting (e.g. Lowkey Vault takes ~6s)
    const maxRetries = 10;
    const baseDelayMs = 1000;
    for (let attempt = 1; ; attempt++) {
      try {
        await this.refresh();
        break;
      } catch (err) {
        if (attempt >= maxRetries) {
          throw err;
        }
        const delay = baseDelayMs * attempt;
        console.warn(
          `Vault connection attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  async get(key: SecretKey): Promise<string | undefined> {
    if (!this.isCacheValid()) {
      await this.refresh();
    }
    return this.cache.get(key);
  }

  async getMany<K extends SecretKey>(keys: K[]): Promise<Record<K, string | undefined>> {
    if (!this.isCacheValid()) {
      await this.refresh();
    }
    const result = {} as Record<K, string | undefined>;
    for (const key of keys) {
      result[key] = this.cache.get(key);
    }
    return result;
  }

  async set(key: SecretKey, value: string): Promise<void> {
    if (this.readOnly) {
      throw new Error("SecretsManager is in read-only mode");
    }
    this.assertInitialized();
    const { vaultKey } = SECRET_KEYS[key];
    await this.client.setSecret(vaultKey, value);
    this.cache.set(key, value);
  }

  async delete(key: SecretKey): Promise<void> {
    if (this.readOnly) {
      throw new Error("SecretsManager is in read-only mode");
    }
    this.assertInitialized();
    const { vaultKey } = SECRET_KEYS[key];
    // Soft-delete the secret, then purge it so it's permanently removed
    // and can be re-created with the same name later.
    const poller = await this.client.beginDeleteSecret(vaultKey);
    await poller.pollUntilDone();
    await this.client.purgeDeletedSecret(vaultKey);
    this.cache.delete(key);
  }

  async getAll(): Promise<Record<SecretKey, string | undefined>> {
    if (!this.isCacheValid()) {
      await this.refresh();
    }
    const result = {} as Record<SecretKey, string | undefined>;
    for (const key of Object.keys(SECRET_KEYS) as SecretKey[]) {
      result[key] = this.cache.get(key);
    }
    return result;
  }

  /** Returns defined secrets as { ENV_VAR_NAME: value } — only includes keys with a value. */
  async getEnv(): Promise<Record<string, string>> {
    const all = await this.getAll();
    const env: Record<string, string> = {};
    for (const [key, { envVar }] of Object.entries(SECRET_KEYS)) {
      const value = all[key as SecretKey];
      if (value) env[envVar] = value;
    }
    return env;
  }

  async getMasked(): Promise<SecretsStatus> {
    const all = await this.getAll();
    return {
      jira: {
        baseUrl: all.jiraBaseUrl ?? "",
        email: all.jiraEmail ?? "",
        tokenMasked: maskSecret(all.jiraApiToken),
        webhookSecretMasked: maskSecret(all.jiraWebhookSecret),
      },
      github: {
        tokenMasked: maskSecret(all.githubToken),
        webhookSecretMasked: maskSecret(all.githubWebhookSecret),
      },
      figma: {
        apiKeyMasked: maskSecret(all.figmaApiKey),
      },
    };
  }

  async refresh(): Promise<void> {
    // Deduplicate concurrent refresh calls — return the pending promise
    // so multiple callers don't each trigger a full vault fetch.
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    this.refreshPromise = this.doRefresh().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private async doRefresh(): Promise<void> {
    this.assertInitialized();
    // Build into a temporary map so the cache is swapped atomically —
    // a partial failure won't leave the cache in an inconsistent state.
    const newCache = new Map<SecretKey, string | undefined>();
    for (const [key, { vaultKey }] of Object.entries(SECRET_KEYS)) {
      try {
        const secret = await this.client.getSecret(vaultKey);
        newCache.set(key as SecretKey, secret.value);
      } catch (err) {
        if (isSecretNotFound(err)) {
          newCache.set(key as SecretKey, undefined);
        } else {
          throw err;
        }
      }
    }
    this.cache = newCache;
    this.cacheLoadedAt = Date.now();
  }

  private isCacheValid(): boolean {
    return Date.now() - this.cacheLoadedAt < SecretsManager.CACHE_TTL_MS;
  }
}
