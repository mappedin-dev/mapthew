import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BoundedBuffer, getTimeoutMs } from "./claude.js";

describe("BoundedBuffer", () => {
  it("stores text within the limit", () => {
    const buf = new BoundedBuffer(100);
    buf.append("hello");
    expect(buf.toString()).toBe("hello");
    expect(buf.truncated).toBe(false);
  });

  it("accumulates multiple appends", () => {
    const buf = new BoundedBuffer(100);
    buf.append("foo");
    buf.append("bar");
    expect(buf.toString()).toBe("foobar");
    expect(buf.truncated).toBe(false);
  });

  it("truncates older content when limit is exceeded", () => {
    const buf = new BoundedBuffer(5);
    buf.append("abcde"); // exactly at limit
    expect(buf.toString()).toBe("abcde");
    expect(buf.truncated).toBe(false);

    buf.append("fg"); // exceeds limit → keep last 5
    expect(buf.toString()).toBe("cdefg");
    expect(buf.truncated).toBe(true);
  });

  it("keeps only the tail when a single large chunk is appended", () => {
    const buf = new BoundedBuffer(3);
    buf.append("abcdef");
    expect(buf.toString()).toBe("def");
    expect(buf.truncated).toBe(true);
  });

  it("stays truncated once the flag is set", () => {
    const buf = new BoundedBuffer(4);
    buf.append("12345"); // triggers truncation
    expect(buf.truncated).toBe(true);

    // Even after appending small text that fits, truncated stays true
    const buf2 = new BoundedBuffer(4);
    buf2.append("12345");
    buf2.append("a");
    expect(buf2.truncated).toBe(true);
  });

  it("handles empty appends", () => {
    const buf = new BoundedBuffer(10);
    buf.append("");
    buf.append("hi");
    buf.append("");
    expect(buf.toString()).toBe("hi");
    expect(buf.truncated).toBe(false);
  });
});

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
