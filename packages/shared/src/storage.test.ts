import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import {
  getS3Config,
  isS3StorageEnabled,
  getSessionKey,
  type S3StorageConfig,
} from "./storage.js";

// Test directory setup
let testDir: string;
let originalEnv: NodeJS.ProcessEnv;

describe("storage", () => {
  beforeEach(async () => {
    // Save original environment
    originalEnv = { ...process.env };

    // Create a unique test directory
    testDir = path.join(
      os.tmpdir(),
      `dexter-storage-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await fs.mkdir(testDir, { recursive: true });

    // Clear S3-related env vars
    delete process.env.S3_SESSIONS_BUCKET;
    delete process.env.S3_SESSIONS_REGION;
    delete process.env.S3_SESSIONS_PREFIX;
    delete process.env.S3_ENDPOINT;
    delete process.env.AWS_REGION;
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    // Restore original environment
    process.env = originalEnv;

    // Reset mocks
    vi.clearAllMocks();
  });

  describe("getS3Config", () => {
    it("returns null when S3_SESSIONS_BUCKET is not set", () => {
      expect(getS3Config()).toBeNull();
    });

    it("returns config when S3_SESSIONS_BUCKET is set", () => {
      process.env.S3_SESSIONS_BUCKET = "my-bucket";
      process.env.S3_SESSIONS_REGION = "us-west-2";

      const config = getS3Config();

      expect(config).toEqual({
        bucket: "my-bucket",
        region: "us-west-2",
        prefix: "sessions",
        endpoint: undefined,
      });
    });

    it("falls back to AWS_REGION when S3_SESSIONS_REGION is not set", () => {
      process.env.S3_SESSIONS_BUCKET = "my-bucket";
      process.env.AWS_REGION = "eu-west-1";

      const config = getS3Config();

      expect(config?.region).toBe("eu-west-1");
    });

    it("uses default region when no region is set", () => {
      process.env.S3_SESSIONS_BUCKET = "my-bucket";

      const config = getS3Config();

      expect(config?.region).toBe("us-east-1");
    });

    it("uses custom prefix when set", () => {
      process.env.S3_SESSIONS_BUCKET = "my-bucket";
      process.env.S3_SESSIONS_PREFIX = "custom/prefix";

      const config = getS3Config();

      expect(config?.prefix).toBe("custom/prefix");
    });

    it("includes endpoint when set (for localstack)", () => {
      process.env.S3_SESSIONS_BUCKET = "my-bucket";
      process.env.S3_ENDPOINT = "http://localhost:4566";

      const config = getS3Config();

      expect(config?.endpoint).toBe("http://localhost:4566");
    });
  });

  describe("isS3StorageEnabled", () => {
    it("returns false when S3 is not configured", () => {
      expect(isS3StorageEnabled()).toBe(false);
    });

    it("returns true when S3 is configured", () => {
      process.env.S3_SESSIONS_BUCKET = "my-bucket";
      expect(isS3StorageEnabled()).toBe(true);
    });
  });

  describe("getSessionKey", () => {
    it("generates correct S3 key with default prefix", () => {
      const config: S3StorageConfig = {
        bucket: "my-bucket",
        region: "us-east-1",
        prefix: "sessions",
      };

      expect(getSessionKey(config, "DXTR-123")).toBe("sessions/DXTR-123.tar.gz");
    });

    it("generates correct S3 key with custom prefix", () => {
      const config: S3StorageConfig = {
        bucket: "my-bucket",
        region: "us-east-1",
        prefix: "dexter/sessions",
      };

      expect(getSessionKey(config, "ABC-456")).toBe(
        "dexter/sessions/ABC-456.tar.gz",
      );
    });

    it("handles empty prefix", () => {
      const config: S3StorageConfig = {
        bucket: "my-bucket",
        region: "us-east-1",
      };

      expect(getSessionKey(config, "XYZ-789")).toBe("sessions/XYZ-789.tar.gz");
    });
  });
});

// Test S3 operations with mocked client
describe("storage S3 operations", () => {
  let testDir: string;
  let originalEnv: NodeJS.ProcessEnv;
  let mockSend: Mock;
  let mockS3Client: any;

  // Dynamic imports to allow mocking
  let archiveSessionToS3: typeof import("./storage.js").archiveSessionToS3;
  let restoreSessionFromS3: typeof import("./storage.js").restoreSessionFromS3;
  let sessionExistsInS3: typeof import("./storage.js").sessionExistsInS3;
  let getSessionMetadata: typeof import("./storage.js").getSessionMetadata;
  let deleteSessionFromS3: typeof import("./storage.js").deleteSessionFromS3;
  let createS3Client: typeof import("./storage.js").createS3Client;

  beforeEach(async () => {
    // Save original environment
    originalEnv = { ...process.env };

    // Create a unique test directory
    testDir = path.join(
      os.tmpdir(),
      `dexter-storage-s3-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await fs.mkdir(testDir, { recursive: true });

    // Setup mock
    mockSend = vi.fn();
    mockS3Client = { send: mockSend };

    // Mock the AWS SDK module
    vi.doMock("@aws-sdk/client-s3", () => ({
      S3Client: vi.fn(() => mockS3Client),
      PutObjectCommand: vi.fn((params) => ({ ...params, _type: "put" })),
      GetObjectCommand: vi.fn((params) => ({ ...params, _type: "get" })),
      HeadObjectCommand: vi.fn((params) => ({ ...params, _type: "head" })),
      DeleteObjectCommand: vi.fn((params) => ({ ...params, _type: "delete" })),
    }));

    // Reimport to get mocked version
    const storageModule = await import("./storage.js");
    archiveSessionToS3 = storageModule.archiveSessionToS3;
    restoreSessionFromS3 = storageModule.restoreSessionFromS3;
    sessionExistsInS3 = storageModule.sessionExistsInS3;
    getSessionMetadata = storageModule.getSessionMetadata;
    deleteSessionFromS3 = storageModule.deleteSessionFromS3;
    createS3Client = storageModule.createS3Client;
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    // Restore original environment
    process.env = originalEnv;

    // Reset mocks
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe("archiveSessionToS3", () => {
    it("returns false when .claude directory does not exist", async () => {
      const config: S3StorageConfig = {
        bucket: "my-bucket",
        region: "us-east-1",
        prefix: "sessions",
      };

      const workDir = path.join(testDir, "no-session");
      await fs.mkdir(workDir, { recursive: true });

      const result = await archiveSessionToS3(config, workDir, "DXTR-123");

      expect(result).toBe(false);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("returns false when .claude is a file not a directory", async () => {
      const config: S3StorageConfig = {
        bucket: "my-bucket",
        region: "us-east-1",
        prefix: "sessions",
      };

      const workDir = path.join(testDir, "claude-file");
      await fs.mkdir(workDir, { recursive: true });
      await fs.writeFile(path.join(workDir, ".claude"), "not a directory");

      const result = await archiveSessionToS3(config, workDir, "DXTR-123");

      expect(result).toBe(false);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("creates archive and uploads to S3", async () => {
      mockSend.mockResolvedValue({});

      const config: S3StorageConfig = {
        bucket: "my-bucket",
        region: "us-east-1",
        prefix: "sessions",
      };

      // Create workspace with .claude directory
      const workDir = path.join(testDir, "has-session");
      const claudeDir = path.join(workDir, ".claude");
      await fs.mkdir(claudeDir, { recursive: true });
      await fs.writeFile(
        path.join(claudeDir, "session.jsonl"),
        '{"test": "data"}\n',
      );

      const result = await archiveSessionToS3(config, workDir, "DXTR-123");

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);

      const putCall = mockSend.mock.calls[0][0];
      expect(putCall.Bucket).toBe("my-bucket");
      expect(putCall.Key).toBe("sessions/DXTR-123.tar.gz");
      expect(putCall.ContentType).toBe("application/gzip");
      expect(putCall.Body).toBeInstanceOf(Buffer);
      expect(putCall.Metadata.issueKey).toBe("DXTR-123");
    });

    it("cleans up temporary archive file after upload", async () => {
      mockSend.mockResolvedValue({});

      const config: S3StorageConfig = {
        bucket: "my-bucket",
        region: "us-east-1",
        prefix: "sessions",
      };

      const workDir = path.join(testDir, "cleanup-test");
      const claudeDir = path.join(workDir, ".claude");
      await fs.mkdir(claudeDir, { recursive: true });
      await fs.writeFile(path.join(claudeDir, "data.txt"), "test");

      await archiveSessionToS3(config, workDir, "DXTR-123");

      // Check that temp file was cleaned up
      const files = await fs.readdir(workDir);
      const tempFiles = files.filter((f) => f.startsWith(".session-"));
      expect(tempFiles).toHaveLength(0);
    });

    it("cleans up temporary file even on upload failure", async () => {
      mockSend.mockRejectedValue(new Error("Upload failed"));

      const config: S3StorageConfig = {
        bucket: "my-bucket",
        region: "us-east-1",
        prefix: "sessions",
      };

      const workDir = path.join(testDir, "cleanup-failure-test");
      const claudeDir = path.join(workDir, ".claude");
      await fs.mkdir(claudeDir, { recursive: true });
      await fs.writeFile(path.join(claudeDir, "data.txt"), "test");

      await expect(
        archiveSessionToS3(config, workDir, "DXTR-123"),
      ).rejects.toThrow("Upload failed");

      // Check that temp file was cleaned up despite failure
      const files = await fs.readdir(workDir);
      const tempFiles = files.filter((f) => f.startsWith(".session-"));
      expect(tempFiles).toHaveLength(0);
    });
  });

  describe("sessionExistsInS3", () => {
    it("returns true when session exists", async () => {
      mockSend.mockResolvedValue({});

      const config: S3StorageConfig = {
        bucket: "my-bucket",
        region: "us-east-1",
        prefix: "sessions",
      };

      const result = await sessionExistsInS3(config, "DXTR-123");

      expect(result).toBe(true);
    });

    it("returns false when session does not exist (NotFound)", async () => {
      const notFoundError = new Error("Not Found");
      (notFoundError as any).name = "NotFound";
      mockSend.mockRejectedValue(notFoundError);

      const config: S3StorageConfig = {
        bucket: "my-bucket",
        region: "us-east-1",
        prefix: "sessions",
      };

      const result = await sessionExistsInS3(config, "DXTR-123");

      expect(result).toBe(false);
    });

    it("returns false when session does not exist (NoSuchKey)", async () => {
      const noSuchKeyError = new Error("No Such Key");
      (noSuchKeyError as any).name = "NoSuchKey";
      mockSend.mockRejectedValue(noSuchKeyError);

      const config: S3StorageConfig = {
        bucket: "my-bucket",
        region: "us-east-1",
        prefix: "sessions",
      };

      const result = await sessionExistsInS3(config, "DXTR-123");

      expect(result).toBe(false);
    });

    it("throws for other errors", async () => {
      const otherError = new Error("Access Denied");
      (otherError as any).name = "AccessDenied";
      mockSend.mockRejectedValue(otherError);

      const config: S3StorageConfig = {
        bucket: "my-bucket",
        region: "us-east-1",
        prefix: "sessions",
      };

      await expect(sessionExistsInS3(config, "DXTR-123")).rejects.toThrow(
        "Access Denied",
      );
    });
  });

  describe("getSessionMetadata", () => {
    it("returns metadata when session exists", async () => {
      const lastModified = new Date("2024-01-15T10:30:00Z");
      mockSend.mockResolvedValue({
        ContentLength: 1024000,
        LastModified: lastModified,
      });

      const config: S3StorageConfig = {
        bucket: "my-bucket",
        region: "us-east-1",
        prefix: "sessions",
      };

      const result = await getSessionMetadata(config, "DXTR-123");

      expect(result).toEqual({
        size: 1024000,
        lastModified,
      });
    });

    it("returns null when session does not exist", async () => {
      const notFoundError = new Error("Not Found");
      (notFoundError as any).name = "NotFound";
      mockSend.mockRejectedValue(notFoundError);

      const config: S3StorageConfig = {
        bucket: "my-bucket",
        region: "us-east-1",
        prefix: "sessions",
      };

      const result = await getSessionMetadata(config, "DXTR-123");

      expect(result).toBeNull();
    });
  });

  describe("restoreSessionFromS3", () => {
    it("returns false when no archive exists", async () => {
      const noSuchKeyError = new Error("No Such Key");
      (noSuchKeyError as any).name = "NoSuchKey";
      mockSend.mockRejectedValue(noSuchKeyError);

      const config: S3StorageConfig = {
        bucket: "my-bucket",
        region: "us-east-1",
        prefix: "sessions",
      };

      const workDir = path.join(testDir, "restore-test");
      const result = await restoreSessionFromS3(config, workDir, "DXTR-123");

      expect(result).toBe(false);
    });

    it("returns false when response body is empty", async () => {
      mockSend.mockResolvedValue({ Body: null });

      const config: S3StorageConfig = {
        bucket: "my-bucket",
        region: "us-east-1",
        prefix: "sessions",
      };

      const workDir = path.join(testDir, "restore-empty");
      const result = await restoreSessionFromS3(config, workDir, "DXTR-123");

      expect(result).toBe(false);
    });
  });

  describe("deleteSessionFromS3", () => {
    it("deletes session from S3", async () => {
      mockSend.mockResolvedValue({});

      const config: S3StorageConfig = {
        bucket: "my-bucket",
        region: "us-east-1",
        prefix: "sessions",
      };

      await deleteSessionFromS3(config, "DXTR-123");

      expect(mockSend).toHaveBeenCalledTimes(1);
      const deleteCall = mockSend.mock.calls[0][0];
      expect(deleteCall.Bucket).toBe("my-bucket");
      expect(deleteCall.Key).toBe("sessions/DXTR-123.tar.gz");
    });

    it("does not throw when session does not exist", async () => {
      const noSuchKeyError = new Error("No Such Key");
      (noSuchKeyError as any).name = "NoSuchKey";
      mockSend.mockRejectedValue(noSuchKeyError);

      const config: S3StorageConfig = {
        bucket: "my-bucket",
        region: "us-east-1",
        prefix: "sessions",
      };

      await expect(
        deleteSessionFromS3(config, "DXTR-123"),
      ).resolves.not.toThrow();
    });

    it("throws for other errors", async () => {
      const otherError = new Error("Access Denied");
      (otherError as any).name = "AccessDenied";
      mockSend.mockRejectedValue(otherError);

      const config: S3StorageConfig = {
        bucket: "my-bucket",
        region: "us-east-1",
        prefix: "sessions",
      };

      await expect(deleteSessionFromS3(config, "DXTR-123")).rejects.toThrow(
        "Access Denied",
      );
    });
  });
});
