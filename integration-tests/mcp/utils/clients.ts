import { spawn, ChildProcess } from "child_process";
import * as readline from "readline";
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  ToolDefinition,
  McpClient,
} from "./types.js";

const TIMEOUT_MS = 15000;

// =============================================================================
// Remote MCP Client (HTTP + SSE) - for GitHub
// =============================================================================

export class RemoteMcpClient implements McpClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private messageId = 1;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Accept: "application/json, text/event-stream",
    };
  }

  private parseSSEResponse(text: string): JsonRpcResponse {
    const lines = text.split("\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const jsonStr = line.slice(6);
        try {
          return JSON.parse(jsonStr) as JsonRpcResponse;
        } catch {
          // Continue looking for valid JSON
        }
      }
    }
    throw new Error(`Could not parse SSE response: ${text.slice(0, 200)}`);
  }

  private async request(
    method: string,
    params?: unknown
  ): Promise<JsonRpcResponse> {
    const id = this.messageId++;
    const body: JsonRpcRequest = {
      jsonrpc: "2.0",
      method,
      params,
      id,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const text = await response.text();

      if (text.includes("event:") || text.includes("data:")) {
        return this.parseSSEResponse(text);
      }

      return JSON.parse(text) as JsonRpcResponse;
    } finally {
      clearTimeout(timeout);
    }
  }

  async initialize(): Promise<JsonRpcResponse> {
    return this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "mcp-test-client", version: "1.0.0" },
    });
  }

  async listTools(): Promise<ToolDefinition[]> {
    const response = await this.request("tools/list");
    if (response.error) {
      throw new Error(response.error.message);
    }
    const result = response.result as { tools: ToolDefinition[] };
    return result.tools || [];
  }

  async callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const response = await this.request("tools/call", {
      name,
      arguments: args,
    });
    if (response.error) {
      throw new Error(response.error.message);
    }
    return response.result;
  }

  close(): void {
    // No-op for HTTP client
  }
}

// =============================================================================
// Local MCP Client (stdio)
// =============================================================================

export interface LocalMcpConfig {
  command: string;
  args?: string[];
  env: Record<string, string | undefined>;
  installHint?: string;
}

export class LocalMcpClient implements McpClient {
  private proc: ChildProcess | null = null;
  private rl: readline.Interface | null = null;
  private messageId = 1;
  private pendingRequests = new Map<
    number,
    { resolve: (value: JsonRpcResponse) => void; reject: (err: Error) => void }
  >();
  private config: LocalMcpConfig;

  constructor(config: LocalMcpConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = this.config.args ?? [];

      this.proc = spawn(this.config.command, args, {
        env: { ...process.env, ...this.config.env },
        stdio: ["pipe", "pipe", "pipe"],
      });

      this.proc.on("error", (err) => {
        if (err.message.includes("ENOENT")) {
          const hint = this.config.installHint
            ? `\n         Install with: ${this.config.installHint}`
            : "";
          reject(
            new Error(`Command '${this.config.command}' not found.${hint}`)
          );
        } else {
          reject(err);
        }
      });

      this.proc.stderr?.on("data", (data) => {
        // Print stderr output without prefix to preserve formatting (e.g., FastMCP banner)
        const text = data.toString().trimEnd();
        if (text) {
          console.error(text);
        }
      });

      this.rl = readline.createInterface({
        input: this.proc.stdout!,
        crlfDelay: Infinity,
      });

      this.rl.on("line", (line) => {
        try {
          const msg = JSON.parse(line) as JsonRpcResponse;
          if (msg.id !== undefined && msg.id !== null) {
            const pending = this.pendingRequests.get(msg.id);
            if (pending) {
              this.pendingRequests.delete(msg.id);
              pending.resolve(msg);
            }
          }
        } catch {
          // Ignore non-JSON lines
        }
      });

      setTimeout(resolve, 100);
    });
  }

  private send(request: JsonRpcRequest): void {
    if (!this.proc?.stdin) {
      throw new Error("Not connected");
    }
    this.proc.stdin.write(JSON.stringify(request) + "\n");
  }

  private async request(
    method: string,
    params?: unknown
  ): Promise<JsonRpcResponse> {
    const id = this.messageId++;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      method,
      params,
      id,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(
          new Error(`Request '${method}' timed out after ${TIMEOUT_MS}ms`)
        );
      }, TIMEOUT_MS);

      this.pendingRequests.set(id, {
        resolve: (response) => {
          clearTimeout(timeout);
          resolve(response);
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
      });

      this.send(request);
    });
  }

  private notify(method: string, params?: unknown): void {
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      method,
      params,
    };
    this.send(request);
  }

  async initialize(): Promise<JsonRpcResponse> {
    const response = await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "mcp-test-client", version: "1.0.0" },
    });
    this.notify("notifications/initialized");
    return response;
  }

  async listTools(): Promise<ToolDefinition[]> {
    const response = await this.request("tools/list");
    if (response.error) {
      throw new Error(response.error.message);
    }
    const result = response.result as { tools: ToolDefinition[] };
    return result.tools || [];
  }

  async callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const response = await this.request("tools/call", {
      name,
      arguments: args,
    });
    if (response.error) {
      throw new Error(response.error.message);
    }
    return response.result;
  }

  close(): void {
    this.rl?.close();
    this.proc?.kill();
  }
}
