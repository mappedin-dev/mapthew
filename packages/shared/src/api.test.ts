import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import { verifyHmacSignature, postJiraComment, postGitHubComment } from "./api.js";
import type { JiraCredentials } from "./types.js";

describe("verifyHmacSignature", () => {
  const secret = "test-secret";
  const payload = '{"test": "data"}';

  function generateSignature(
    secret: string,
    payload: string,
    prefix = "",
  ): string {
    const sig = createHmac("sha256", secret)
      .update(payload, "utf8")
      .digest("hex");
    return prefix + sig;
  }

  it("verifies valid signature without prefix", () => {
    const signature = generateSignature(secret, payload);
    expect(verifyHmacSignature(secret, payload, signature)).toBe(true);
  });

  it("verifies valid signature with sha256= prefix", () => {
    const signature = generateSignature(secret, payload, "sha256=");
    expect(verifyHmacSignature(secret, payload, signature)).toBe(true);
  });

  it("rejects invalid signature", () => {
    const invalidSignature = "invalid-signature-hex";
    expect(verifyHmacSignature(secret, payload, invalidSignature)).toBe(false);
  });

  it("rejects signature with wrong secret", () => {
    const signature = generateSignature("wrong-secret", payload);
    expect(verifyHmacSignature(secret, payload, signature)).toBe(false);
  });

  it("rejects signature with wrong payload", () => {
    const signature = generateSignature(secret, "different payload");
    expect(verifyHmacSignature(secret, payload, signature)).toBe(false);
  });

  it("rejects empty signature", () => {
    expect(verifyHmacSignature(secret, payload, "")).toBe(false);
  });

  it("handles signature with malformed hex", () => {
    expect(verifyHmacSignature(secret, payload, "not-valid-hex")).toBe(false);
  });

  it("handles signature length mismatch", () => {
    const signature = generateSignature(secret, payload);
    // Truncate signature to cause length mismatch
    expect(verifyHmacSignature(secret, payload, signature.slice(0, 10))).toBe(
      false,
    );
  });

  it("handles unicode in payload", () => {
    const unicodePayload = '{"message":"Hello 世界 🎉"}';
    const signature = generateSignature(secret, unicodePayload);
    expect(verifyHmacSignature(secret, unicodePayload, signature)).toBe(true);
  });

  it("handles large payloads", () => {
    const largePayload = JSON.stringify({ data: "x".repeat(10000) });
    const signature = generateSignature(secret, largePayload);
    expect(verifyHmacSignature(secret, largePayload, signature)).toBe(true);
  });
});

describe("postJiraComment", () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const validCredentials: JiraCredentials = {
    baseUrl: "https://test.atlassian.net",
    email: "test@example.com",
    apiToken: "test-token",
  };

  it("posts comment successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "123" }),
    });

    const result = await postJiraComment(validCredentials, "TEST-123", "Test comment");

    expect(result).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://test.atlassian.net/rest/api/3/issue/TEST-123/comment",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("returns error when credentials not configured", async () => {
    const incompleteCredentials: JiraCredentials = {
      baseUrl: "",
      email: "",
      apiToken: "",
    };

    const result = await postJiraComment(incompleteCredentials, "TEST-123", "Test");

    expect(result).toEqual({
      success: false,
      error: "JIRA credentials not configured",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns error on API failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });

    const result = await postJiraComment(validCredentials, "TEST-123", "Test");

    expect(result).toEqual({
      success: false,
      error: "Unauthorized",
    });
  });

  it("returns error on network failure", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const result = await postJiraComment(validCredentials, "TEST-123", "Test");

    expect(result).toEqual({
      success: false,
      error: "Network error",
    });
  });

  it("includes proper authorization header", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await postJiraComment(validCredentials, "TEST-123", "Test");

    const expectedAuth = Buffer.from("test@example.com:test-token").toString("base64");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Basic ${expectedAuth}`,
        }),
      })
    );
  });
});

describe("postGitHubComment", () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("posts comment successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 123 }),
    });

    const result = await postGitHubComment("gh-token", "owner", "repo", 42, "Test comment");

    expect(result).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/owner/repo/issues/42/comments",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer gh-token",
          "Content-Type": "application/json",
          Accept: "application/vnd.github+json",
        }),
        body: JSON.stringify({ body: "Test comment" }),
      })
    );
  });

  it("returns error when token not configured", async () => {
    const result = await postGitHubComment("", "owner", "repo", 42, "Test");

    expect(result).toEqual({
      success: false,
      error: "GITHUB_TOKEN not configured",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns error on API failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve("Not Found"),
    });

    const result = await postGitHubComment("gh-token", "owner", "repo", 999, "Test");

    expect(result).toEqual({
      success: false,
      error: "Not Found",
    });
  });

  it("returns error on network failure", async () => {
    mockFetch.mockRejectedValue(new Error("Connection refused"));

    const result = await postGitHubComment("gh-token", "owner", "repo", 42, "Test");

    expect(result).toEqual({
      success: false,
      error: "Connection refused",
    });
  });
});
