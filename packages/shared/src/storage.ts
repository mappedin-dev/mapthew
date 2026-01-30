import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import { create as tarCreate, extract as tarExtract } from "tar";

/**
 * Configuration for S3 session storage
 */
export interface S3StorageConfig {
  bucket: string;
  region: string;
  prefix?: string;
  endpoint?: string; // For localstack/minio testing
}

/**
 * Get S3 storage configuration from environment variables
 * Returns null if S3 storage is not configured
 */
export function getS3Config(): S3StorageConfig | null {
  const bucket = process.env.S3_SESSIONS_BUCKET;
  const region = process.env.S3_SESSIONS_REGION || process.env.AWS_REGION;

  if (!bucket) {
    return null;
  }

  return {
    bucket,
    region: region || "us-east-1",
    prefix: process.env.S3_SESSIONS_PREFIX || "sessions",
    endpoint: process.env.S3_ENDPOINT, // For testing with localstack
  };
}

/**
 * Check if S3 storage is enabled
 */
export function isS3StorageEnabled(): boolean {
  return getS3Config() !== null;
}

/**
 * Create an S3 client with the given configuration
 */
export function createS3Client(config: S3StorageConfig): S3Client {
  return new S3Client({
    region: config.region,
    ...(config.endpoint && {
      endpoint: config.endpoint,
      forcePathStyle: true, // Required for localstack/minio
    }),
  });
}

/**
 * Get the S3 key for a session archive
 */
export function getSessionKey(config: S3StorageConfig, issueKey: string): string {
  const prefix = config.prefix || "sessions";
  return `${prefix}/${issueKey}.tar.gz`;
}

/**
 * Archive a Claude session (.claude directory) to S3
 *
 * @param config - S3 configuration
 * @param workDir - Path to the workspace containing .claude directory
 * @param issueKey - Issue key used as the archive identifier
 * @returns true if archive was successful, false if no session to archive
 */
export async function archiveSessionToS3(
  config: S3StorageConfig,
  workDir: string,
  issueKey: string,
): Promise<boolean> {
  const claudeDir = path.join(workDir, ".claude");

  // Check if .claude directory exists
  try {
    const stat = await fs.stat(claudeDir);
    if (!stat.isDirectory()) {
      console.log(`[S3] No .claude directory to archive for ${issueKey}`);
      return false;
    }
  } catch {
    console.log(`[S3] No .claude directory to archive for ${issueKey}`);
    return false;
  }

  // Create a temporary tar.gz file
  const tempArchivePath = path.join(workDir, `.session-${issueKey}.tar.gz`);

  try {
    // Create tar.gz archive of .claude directory
    await tarCreate(
      {
        gzip: true,
        file: tempArchivePath,
        cwd: workDir,
      },
      [".claude"],
    );

    // Read the archive file
    const archiveData = await fs.readFile(tempArchivePath);
    const archiveSize = archiveData.length;

    // Upload to S3
    const client = createS3Client(config);
    const key = getSessionKey(config, issueKey);

    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: archiveData,
        ContentType: "application/gzip",
        Metadata: {
          issueKey,
          archivedAt: new Date().toISOString(),
        },
      }),
    );

    console.log(
      `[S3] Archived session for ${issueKey} (${formatBytes(archiveSize)}) to s3://${config.bucket}/${key}`,
    );
    return true;
  } finally {
    // Clean up temporary archive file
    try {
      await fs.unlink(tempArchivePath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Check if a session archive exists in S3
 */
export async function sessionExistsInS3(
  config: S3StorageConfig,
  issueKey: string,
): Promise<boolean> {
  const client = createS3Client(config);
  const key = getSessionKey(config, issueKey);

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: config.bucket,
        Key: key,
      }),
    );
    return true;
  } catch (error: unknown) {
    const errorName = (error as { name?: string })?.name;
    if (errorName === "NotFound" || errorName === "NoSuchKey") {
      return false;
    }
    throw error;
  }
}

/**
 * Get metadata about a session archive in S3
 */
export async function getSessionMetadata(
  config: S3StorageConfig,
  issueKey: string,
): Promise<{ size: number; lastModified: Date } | null> {
  const client = createS3Client(config);
  const key = getSessionKey(config, issueKey);

  try {
    const response = await client.send(
      new HeadObjectCommand({
        Bucket: config.bucket,
        Key: key,
      }),
    );
    return {
      size: response.ContentLength || 0,
      lastModified: response.LastModified || new Date(),
    };
  } catch (error: unknown) {
    const errorName = (error as { name?: string })?.name;
    if (errorName === "NotFound" || errorName === "NoSuchKey") {
      return null;
    }
    throw error;
  }
}

/**
 * Restore a Claude session from S3 to the workspace
 *
 * @param config - S3 configuration
 * @param workDir - Path to the workspace to restore .claude directory to
 * @param issueKey - Issue key of the session to restore
 * @returns true if restore was successful, false if no archive exists
 */
export async function restoreSessionFromS3(
  config: S3StorageConfig,
  workDir: string,
  issueKey: string,
): Promise<boolean> {
  const client = createS3Client(config);
  const key = getSessionKey(config, issueKey);

  try {
    // Download from S3
    const response = await client.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
      }),
    );

    if (!response.Body) {
      console.log(`[S3] No session archive found for ${issueKey}`);
      return false;
    }

    // Ensure workspace directory exists
    await fs.mkdir(workDir, { recursive: true });

    // Create a temporary file for the archive
    const tempArchivePath = path.join(workDir, `.session-restore-${issueKey}.tar.gz`);

    try {
      // Write the S3 response to a temp file
      const bodyStream = response.Body as Readable;
      const writeStream = createWriteStream(tempArchivePath);

      await new Promise<void>((resolve, reject) => {
        bodyStream.pipe(writeStream);
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
        bodyStream.on("error", reject);
      });

      // Extract the archive
      await tarExtract({
        file: tempArchivePath,
        cwd: workDir,
      });

      const archiveSize = (await fs.stat(tempArchivePath)).size;
      console.log(
        `[S3] Restored session for ${issueKey} (${formatBytes(archiveSize)}) from s3://${config.bucket}/${key}`,
      );
      return true;
    } finally {
      // Clean up temporary archive file
      try {
        await fs.unlink(tempArchivePath);
      } catch {
        // Ignore cleanup errors
      }
    }
  } catch (error: unknown) {
    const errorName = (error as { name?: string })?.name;
    if (errorName === "NoSuchKey" || errorName === "NotFound") {
      console.log(`[S3] No session archive found for ${issueKey}`);
      return false;
    }
    throw error;
  }
}

/**
 * Delete a session archive from S3
 */
export async function deleteSessionFromS3(
  config: S3StorageConfig,
  issueKey: string,
): Promise<void> {
  const client = createS3Client(config);
  const key = getSessionKey(config, issueKey);

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: key,
      }),
    );
    console.log(`[S3] Deleted session archive for ${issueKey}`);
  } catch (error: unknown) {
    const errorName = (error as { name?: string })?.name;
    if (errorName === "NoSuchKey" || errorName === "NotFound") {
      // Already deleted, ignore
      return;
    }
    throw error;
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
