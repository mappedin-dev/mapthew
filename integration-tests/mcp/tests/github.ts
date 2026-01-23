import { RemoteMcpClient } from "../utils/clients.js";
import type { McpClient, ToolDefinition, InitResult } from "../utils/types.js";

const GITHUB_MCP_REMOTE_URL = "https://api.githubcopilot.com/mcp/";

export async function testGitHub(): Promise<boolean> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Testing: GitHub MCP Server (Remote)`);
  console.log(`URL: ${GITHUB_MCP_REMOTE_URL}`);
  console.log(`${"=".repeat(60)}`);

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error(`\n  Missing environment variable: GITHUB_TOKEN`);
    return false;
  }

  const client = new RemoteMcpClient(GITHUB_MCP_REMOTE_URL, token);

  try {
    console.log(`\n  Connecting...`);
    const initResponse = await client.initialize();
    if (initResponse.error) {
      throw new Error(initResponse.error.message);
    }
    console.log(`  Connected`);

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

    await testGitHubTools(client, tools);

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

async function testGitHubTools(
  client: McpClient,
  tools: ToolDefinition[]
): Promise<void> {
  const searchTool = tools.find(
    (t) =>
      t.name === "search_repositories" ||
      t.name === "list_user_repositories" ||
      t.name === "get_me"
  );

  if (searchTool) {
    console.log(`\n  Testing: ${searchTool.name}`);
    try {
      if (searchTool.name === "search_repositories") {
        const result = await client.callTool("search_repositories", {
          query: "user:@me",
          page: 1,
          perPage: 5,
        });
        console.log(`  Result:`, JSON.stringify(result, null, 2).slice(0, 500));
      } else if (searchTool.name === "get_me") {
        const result = await client.callTool("get_me", {});
        console.log(`  Result:`, JSON.stringify(result, null, 2).slice(0, 500));
      }
    } catch (err) {
      console.log(
        `  Tool test failed: ${err instanceof Error ? err.message : err}`
      );
    }
  }

  // Test reading a specific repository if configured
  const repoConfig = process.env.TEST_GITHUB_REPO;
  if (repoConfig) {
    const hasSearchRepos = tools.some((t) => t.name === "search_repositories");

    if (hasSearchRepos) {
      console.log(`\n  Testing: search_repositories (repo:${repoConfig})`);
      try {
        const result = await client.callTool("search_repositories", {
          query: `repo:${repoConfig}`,
          page: 1,
          perPage: 1,
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
      console.log(`\n  Skipping repo test: search_repositories not available`);
    }
  }
}
