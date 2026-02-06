import { LocalMcpClient } from "../utils/clients.js";
import type { McpClient, ToolDefinition, InitResult } from "../utils/types.js";

export async function testFigma(): Promise<boolean> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Testing: Figma MCP Server (Local)`);
  console.log(`Command: figma-developer-mcp`);
  console.log(`${"=".repeat(60)}`);

  const apiKey = process.env.FIGMA_API_KEY;

  if (!apiKey) {
    console.error(`\n  Missing environment variable: FIGMA_API_KEY`);
    return false;
  }

  const client = new LocalMcpClient({
    command: "figma-developer-mcp",
    args: ["--stdio"],
    env: {
      FIGMA_API_KEY: apiKey,
    },
    installHint: "npm install -g figma-developer-mcp",
  });

  try {
    console.log(`\n  Connecting...`);
    await client.connect();
    console.log(`  Connected`);

    console.log(`  Initializing...`);
    const initResponse = await client.initialize();
    if (initResponse.error) {
      throw new Error(initResponse.error.message);
    }

    const initResult = initResponse.result as InitResult;
    console.log(`  Protocol: ${initResult.protocolVersion || "unknown"}`);
    if (initResult.serverInfo) {
      console.log(
        `  Server: ${initResult.serverInfo.name} v${initResult.serverInfo.version}`
      );
    }

    console.log(`\n  Fetching available tools...`);
    const tools = await client.listTools();
    console.log(`  Tools available: ${tools.length}`);
    tools.slice(0, 10).forEach((tool) => {
      console.log(`    - ${tool.name}`);
    });
    if (tools.length > 10) {
      console.log(`    ... and ${tools.length - 10} more`);
    }

    await testFigmaTools(client, tools);

    console.log(`\n  Status: SUCCESS`);
    return true;
  } catch (error) {
    console.error(`\n  Status: FAILED`);
    console.error(`  Error: ${error instanceof Error ? error.message : error}`);
    return false;
  } finally {
    client.close();
  }
}

async function testFigmaTools(
  client: McpClient,
  tools: ToolDefinition[]
): Promise<void> {
  // Test reading a specific file if configured
  const fileKey = process.env.TEST_FIGMA_FILE;
  if (fileKey) {
    const fileTool = tools.find(
      (t) =>
        t.name === "get_figma_data" ||
        t.name === "get_file" ||
        t.name === "figma_get_file"
    );

    if (fileTool) {
      console.log(`\n  Testing: ${fileTool.name} (${fileKey})`);
      try {
        const result = await client.callTool(fileTool.name, {
          fileKey,
        });
        const json = JSON.stringify(result, null, 2);
        console.log(`  Result:`, json.slice(0, 800));
        if (json.length > 800) console.log(`  ... (truncated)`);
      } catch (err) {
        console.log(
          `  Tool test failed: ${err instanceof Error ? err.message : err}`
        );
      }
    } else {
      console.log(`\n  Skipping file test: no get file tool found`);
    }
  }
}
