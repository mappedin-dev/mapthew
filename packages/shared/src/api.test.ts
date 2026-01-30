import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import { verifyHmacSignature, fetchGitHubPRDetails } from "./api.js";

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

  it("works with GitHub webhook format", () => {
    // GitHub uses sha256=<signature> format
    const githubPayload = '{"action":"opened","number":1}';
    const githubSecret = "webhook-secret";
    const signature = generateSignature(githubSecret, githubPayload, "sha256=");

    expect(verifyHmacSignature(githubSecret, githubPayload, signature)).toBe(
      true,
    );
  });

  it("works with JIRA webhook format", () => {
    // JIRA uses raw signature (no prefix)
    const jiraPayload = '{"webhookEvent":"comment_created"}';
    const jiraSecret = "jira-secret";
    const signature = generateSignature(jiraSecret, jiraPayload);

    expect(verifyHmacSignature(jiraSecret, jiraPayload, signature)).toBe(true);
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

describe("fetchGitHubPRDetails", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.stubGlobal("fetch", originalFetch);
  });

  it("returns PR details on success", async () => {
    const mockResponse = {
      number: 42,
      title: "Add new feature",
      head: { ref: "feature/DXTR-123-new-feature" },
      base: { ref: "main" },
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await fetchGitHubPRDetails("token", "owner", "repo", 42);

    expect(result).toEqual({
      number: 42,
      title: "Add new feature",
      branchName: "feature/DXTR-123-new-feature",
      baseBranch: "main",
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/owner/repo/pulls/42",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
      }),
    );
  });

  it("returns null when token is not provided", async () => {
    const result = await fetchGitHubPRDetails("", "owner", "repo", 42);
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns null on API error", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      text: async () => "Not found",
    } as Response);

    const result = await fetchGitHubPRDetails("token", "owner", "repo", 999);
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

    const result = await fetchGitHubPRDetails("token", "owner", "repo", 42);
    expect(result).toBeNull();
  });
});
