import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";
import type { Response, NextFunction } from "express";
import type { RequestWithRawBody } from "./index.js";

// Mock the config module before importing the middleware
vi.mock("../config.js", () => ({
  GITHUB_WEBHOOK_SECRET: "test-github-secret",
}));

import { githubWebhookAuth } from "./github.js";

function createMockRequest(overrides: Partial<RequestWithRawBody> = {}): RequestWithRawBody {
  return {
    headers: {},
    rawBody: undefined,
    ...overrides,
  } as RequestWithRawBody;
}

function createMockResponse(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

function generateSignature(secret: string, payload: string): string {
  const sig = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  return `sha256=${sig}`;
}

describe("githubWebhookAuth middleware", () => {
  let mockNext: NextFunction;

  beforeEach(() => {
    mockNext = vi.fn();
  });

  it("calls next() for valid signature", () => {
    const payload = '{"action":"opened"}';
    const signature = generateSignature("test-github-secret", payload);

    const req = createMockRequest({
      headers: { "x-hub-signature-256": signature },
      rawBody: payload,
    });
    const res = createMockResponse();

    githubWebhookAuth(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 401 when signature header is missing", () => {
    const req = createMockRequest({
      headers: {},
      rawBody: '{"action":"opened"}',
    });
    const res = createMockResponse();

    githubWebhookAuth(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Missing webhook signature" });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("returns 500 when raw body is not available", () => {
    const req = createMockRequest({
      headers: { "x-hub-signature-256": "sha256=somesignature" },
      rawBody: undefined,
    });
    const res = createMockResponse();

    githubWebhookAuth(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Raw body not available for signature verification",
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("returns 401 for invalid signature", () => {
    const payload = '{"action":"opened"}';
    const wrongSignature = generateSignature("wrong-secret", payload);

    const req = createMockRequest({
      headers: { "x-hub-signature-256": wrongSignature },
      rawBody: payload,
    });
    const res = createMockResponse();

    githubWebhookAuth(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid webhook signature" });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("returns 401 for tampered payload", () => {
    const originalPayload = '{"action":"opened"}';
    const signature = generateSignature("test-github-secret", originalPayload);
    const tamperedPayload = '{"action":"closed"}';

    const req = createMockRequest({
      headers: { "x-hub-signature-256": signature },
      rawBody: tamperedPayload,
    });
    const res = createMockResponse();

    githubWebhookAuth(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid webhook signature" });
    expect(mockNext).not.toHaveBeenCalled();
  });
});
