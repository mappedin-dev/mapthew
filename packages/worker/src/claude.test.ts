import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getTimeoutMs } from "./claude.js";

describe("getTimeoutMs", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns default 30 minutes when CLAUDE_TIMEOUT_MS is not set", () => {
    delete process.env.CLAUDE_TIMEOUT_MS;
    expect(getTimeoutMs()).toBe(30 * 60 * 1000);
  });

  it("returns parsed value when CLAUDE_TIMEOUT_MS is a valid number", () => {
    process.env.CLAUDE_TIMEOUT_MS = "60000";
    expect(getTimeoutMs()).toBe(60000);
  });

  it("returns default and warns for non-numeric value", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.CLAUDE_TIMEOUT_MS = "not-a-number";
    expect(getTimeoutMs()).toBe(30 * 60 * 1000);
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });

  it("returns default and warns for zero", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.CLAUDE_TIMEOUT_MS = "0";
    expect(getTimeoutMs()).toBe(30 * 60 * 1000);
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });

  it("returns default and warns for negative value", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.CLAUDE_TIMEOUT_MS = "-5000";
    expect(getTimeoutMs()).toBe(30 * 60 * 1000);
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });

  it("returns default when CLAUDE_TIMEOUT_MS is empty string", () => {
    process.env.CLAUDE_TIMEOUT_MS = "";
    expect(getTimeoutMs()).toBe(30 * 60 * 1000);
  });
});
