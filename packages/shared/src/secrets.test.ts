import { vi, beforeEach, afterEach } from "vitest";
import {
  maskSecret,
  VaultCredential,
  SecretsManager,
  SECRET_KEYS,
} from "./secrets.js";
import type { SecretKey } from "./types.js";

// ---------------------------------------------------------------------------
// Module mock: @azure/keyvault-secrets
// ---------------------------------------------------------------------------
vi.mock("@azure/keyvault-secrets", () => ({
  SecretClient: vi.fn().mockImplementation(() => ({
    getSecret: vi.fn(),
    setSecret: vi.fn(),
    beginDeleteSecret: vi.fn(),
    purgeDeletedSecret: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function secretNotFoundError() {
  return Object.assign(new Error("not found"), { code: "SecretNotFound" });
}

/** Lowkey Vault returns Java exception class name instead of Azure-standard code */
function lowkeyVaultNotFoundError() {
  return Object.assign(new Error("not found"), {
    code: "com.github.nagyesta.lowkeyvault.service.exception.NotFoundException",
    statusCode: 404,
  });
}

// =========================================================================
// maskSecret
// =========================================================================
describe("maskSecret", () => {
  it("returns empty string for undefined", () => {
    expect(maskSecret(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(maskSecret("")).toBe("");
  });

  it('returns "******" for short strings (< 12 chars)', () => {
    expect(maskSecret("short")).toBe("******");
    expect(maskSecret("12345678901")).toBe("******"); // 11 chars
  });

  it("shows first 2 and last 2 chars with ****** in middle for longer strings", () => {
    expect(maskSecret("abcdefghijkl")).toBe("ab******kl"); // exactly 12
    expect(maskSecret("my-secret-token-value")).toBe("my******ue");
  });
});

// =========================================================================
// VaultCredential
// =========================================================================
describe("VaultCredential", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.stubGlobal("fetch", originalFetch);
  });

  it("fetches and returns a token", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "test-token-123",
        expires_on: Math.floor(Date.now() / 1000) + 3600,
      }),
    } as unknown as Response);

    const cred = new VaultCredential("http://identity", "hdr");
    const token = await cred.getToken("https://vault.azure.net/.default");

    expect(token.token).toBe("test-token-123");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("http://identity"),
      expect.objectContaining({
        headers: { "x-identity-header": "hdr" },
      }),
    );
  });

  it("caches token and does not re-fetch while valid", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "cached",
        expires_on: Math.floor(Date.now() / 1000) + 3600,
      }),
    } as unknown as Response);

    const cred = new VaultCredential("http://ep", "h");
    const t1 = await cred.getToken("scope");
    const t2 = await cred.getToken("scope");

    expect(t1).toBe(t2);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("re-fetches when token is expired past the 5-min buffer", async () => {
    // First token expires within the 5-minute buffer → second call must re-fetch
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "token-1",
          expires_on: Math.floor(Date.now() / 1000) + 4 * 60, // 4 min from now
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "token-2",
          expires_on: Math.floor(Date.now() / 1000) + 3600,
        }),
      } as unknown as Response);

    const cred = new VaultCredential("http://ep", "h");
    const t1 = await cred.getToken("scope");
    expect(t1.token).toBe("token-1");

    const t2 = await cred.getToken("scope");
    expect(t2.token).toBe("token-2");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("throws descriptive error on non-200 response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    } as unknown as Response);

    const cred = new VaultCredential("http://ep", "h");
    await expect(cred.getToken("scope")).rejects.toThrow(
      "Failed to obtain vault token from identity endpoint: 403 Forbidden",
    );
  });

  it("throws error when response is missing access_token or expires_on", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as unknown as Response);

    const cred = new VaultCredential("http://ep", "h");
    await expect(cred.getToken("scope")).rejects.toThrow(
      "Identity endpoint response missing access_token or expires_on",
    );
  });

  it("handles array of scopes (uses first one)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "t",
        expires_on: Math.floor(Date.now() / 1000) + 3600,
      }),
    } as unknown as Response);

    const cred = new VaultCredential("http://ep", "h");
    await cred.getToken(["https://first.scope", "https://second.scope"]);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent("https://first.scope")),
      expect.anything(),
    );
  });
});

// =========================================================================
// SecretsManager
// =========================================================================
describe("SecretsManager", () => {
  const originalFetch = global.fetch;

  /** Vault-key → plaintext value map used as the default for most tests. */
  const TEST_SECRETS: Record<string, string> = {
    "jira-email": "user@example.com",
    "jira-api-token": "jira-token-abcdef123456",
    "jira-webhook-secret": "jira-wh-secret-123456",
    "github-token": "ghp_token123456789012",
    "github-webhook-secret": "github-wh-secret-12345",
    "figma-api-key": "figma-key-1234567890",
    "anthropic-api-key": "sk-ant-1234567890abcdef",
  };

  function makeFakeTokenResponse(): Response {
    return {
      ok: true,
      json: async () => ({
        access_token: "fake-token",
        expires_on: Math.floor(Date.now() / 1000) + 3600,
      }),
      text: async () => "",
    } as unknown as Response;
  }

  /**
   * Create a SecretsManager, configure SecretClient mocks, call init, and
   * return the manager + individual mock handles.
   */
  async function initManager(opts?: {
    readOnly?: boolean;
    getSecretImpl?: (name: string) => Promise<{ value: string | undefined }>;
  }) {
    const { SecretClient } = await import("@azure/keyvault-secrets");

    const mockGetSecret = vi.fn();
    const mockSetSecret = vi.fn().mockResolvedValue({});
    const mockPurgeDeletedSecret = vi.fn().mockResolvedValue({});
    const mockBeginDeleteSecret = vi.fn().mockResolvedValue({
      pollUntilDone: vi.fn().mockResolvedValue({}),
    });

    if (opts?.getSecretImpl) {
      mockGetSecret.mockImplementation(opts.getSecretImpl);
    } else {
      // Default: every vault key returns a value
      mockGetSecret.mockImplementation(async (name: string) => {
        if (name in TEST_SECRETS) return { value: TEST_SECRETS[name] };
        throw secretNotFoundError();
      });
    }

    vi.mocked(SecretClient).mockImplementation(
      () =>
        ({
          getSecret: mockGetSecret,
          setSecret: mockSetSecret,
          beginDeleteSecret: mockBeginDeleteSecret,
          purgeDeletedSecret: mockPurgeDeletedSecret,
        }) as any,
    );

    const manager = new SecretsManager({ readOnly: opts?.readOnly ?? true });
    await manager.init({
      vaultUrl: "https://test.vault.azure.net",
      identityEndpoint: "http://localhost:8081/msi/token",
      identityHeader: "test-header",
    });

    return { manager, mockGetSecret, mockSetSecret, mockBeginDeleteSecret, mockPurgeDeletedSecret };
  }

  // -----------------------------------------------------------------------
  // Setup / teardown
  // -----------------------------------------------------------------------
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeFakeTokenResponse()),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.stubGlobal("fetch", originalFetch);
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // init
  // -----------------------------------------------------------------------
  describe("init", () => {
    it("creates client and populates cache on init", async () => {
      const { manager } = await initManager();

      const all = await manager.getAll();
      expect(all.jiraEmail).toBe("user@example.com");
      expect(all.githubToken).toBe("ghp_token123456789012");
      expect(all.anthropicApiKey).toBe("sk-ant-1234567890abcdef");
    });

    it("works in readOnly mode", async () => {
      const { manager } = await initManager({ readOnly: true });

      const all = await manager.getAll();
      expect(all.jiraEmail).toBe("user@example.com");
    });
  });

  // -----------------------------------------------------------------------
  // get / set / delete
  // -----------------------------------------------------------------------
  describe("get / set / delete", () => {
    it("get() returns cached value", async () => {
      const { manager } = await initManager();
      expect(await manager.get("jiraEmail")).toBe("user@example.com");
    });

    it("get() refreshes cache when TTL expired", async () => {
      const { manager, mockGetSecret } = await initManager();

      // Advance past 5-min TTL
      vi.advanceTimersByTime(6 * 60 * 1000);

      mockGetSecret.mockClear();
      mockGetSecret.mockResolvedValue({ value: "refreshed" });

      await manager.get("jiraEmail");

      // refresh should have re-fetched all keys
      expect(mockGetSecret).toHaveBeenCalled();
    });

    it("set() writes to vault and updates cache", async () => {
      const { manager, mockSetSecret } = await initManager({ readOnly: false });

      await manager.set("jiraEmail", "new@example.com");

      expect(mockSetSecret).toHaveBeenCalledWith(
        "jira-email",
        "new@example.com",
      );
      expect(await manager.get("jiraEmail")).toBe("new@example.com");
    });

    it("set() throws in readOnly mode", async () => {
      const { manager } = await initManager({ readOnly: true });

      await expect(manager.set("jiraEmail", "x")).rejects.toThrow(
        "SecretsManager is in read-only mode",
      );
    });

    it("delete() soft-deletes, purges, and removes from cache", async () => {
      const { manager, mockBeginDeleteSecret, mockPurgeDeletedSecret } = await initManager({ readOnly: false });

      await manager.delete("jiraEmail");

      expect(mockBeginDeleteSecret).toHaveBeenCalledWith("jira-email");
      expect(mockPurgeDeletedSecret).toHaveBeenCalledWith("jira-email");
      expect(await manager.get("jiraEmail")).toBeUndefined();
    });

    it("delete() throws in readOnly mode", async () => {
      const { manager } = await initManager({ readOnly: true });

      await expect(manager.delete("jiraEmail")).rejects.toThrow(
        "SecretsManager is in read-only mode",
      );
    });
  });

  // -----------------------------------------------------------------------
  // getAll / getMasked
  // -----------------------------------------------------------------------
  describe("getAll", () => {
    it("returns all cached values as an object", async () => {
      const { manager } = await initManager();
      const all = await manager.getAll();

      expect(all).toEqual({
        jiraEmail: "user@example.com",
        jiraApiToken: "jira-token-abcdef123456",
        jiraWebhookSecret: "jira-wh-secret-123456",
        githubToken: "ghp_token123456789012",
        githubWebhookSecret: "github-wh-secret-12345",
        figmaApiKey: "figma-key-1234567890",
        anthropicApiKey: "sk-ant-1234567890abcdef",
      });
    });
  });

  describe("getMasked", () => {
    it("returns properly masked SecretsStatus", async () => {
      const { manager } = await initManager();
      const masked = await manager.getMasked();

      expect(masked).toEqual({
        jira: {
          baseUrl: "",
          email: "user@example.com",
          tokenMasked: "ji******56",
          webhookSecretMasked: "ji******56",
        },
        github: {
          tokenMasked: "gh******12",
          webhookSecretMasked: "gi******45",
        },
        figma: {
          apiKeyMasked: "fi******90",
        },
      });
    });
  });

  // -----------------------------------------------------------------------
  // refresh
  // -----------------------------------------------------------------------
  describe("refresh", () => {
    it("loads all secrets from vault into cache", async () => {
      const { manager } = await initManager();

      const all = await manager.getAll();
      for (const [key, { vaultKey }] of Object.entries(SECRET_KEYS)) {
        expect(all[key as SecretKey]).toBe(TEST_SECRETS[vaultKey]);
      }
    });

    it("handles SecretNotFound gracefully (sets undefined in cache)", async () => {
      const { manager } = await initManager({
        readOnly: true,
        getSecretImpl: async (name: string) => {
          if (name === "jira-email") return { value: "user@example.com" };
          throw secretNotFoundError();
        },
      });

      const all = await manager.getAll();
      expect(all.jiraEmail).toBe("user@example.com");
      expect(all.jiraApiToken).toBeUndefined();
      expect(all.githubToken).toBeUndefined();
    });

    it("handles Lowkey Vault 404 errors as not-found (statusCode fallback)", async () => {
      const { manager } = await initManager({
        readOnly: true,
        getSecretImpl: async (name: string) => {
          if (name === "jira-email") return { value: "user@example.com" };
          throw lowkeyVaultNotFoundError();
        },
      });

      const all = await manager.getAll();
      expect(all.jiraEmail).toBe("user@example.com");
      expect(all.jiraApiToken).toBeUndefined();
      expect(all.githubToken).toBeUndefined();
    });
  });
});
