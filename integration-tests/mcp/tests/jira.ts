import { LocalMcpClient } from "../utils/clients.js";
import type { McpClient, ToolDefinition, InitResult } from "../utils/types.js";

export async function testJira(): Promise<boolean> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Testing: JIRA MCP Server (Local)`);
  console.log(`Command: mcp-atlassian`);
  console.log(`${"=".repeat(60)}`);

  const jiraUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  if (!jiraUrl || !email || !apiToken) {
    console.error(`\n  Missing environment variables:`);
    if (!jiraUrl) console.error(`    - JIRA_BASE_URL`);
    if (!email) console.error(`    - JIRA_EMAIL`);
    if (!apiToken) console.error(`    - JIRA_API_TOKEN`);
    return false;
  }

  const client = new LocalMcpClient({
    command: "mcp-atlassian",
    env: {
      JIRA_URL: jiraUrl,
      JIRA_USERNAME: email,
      JIRA_API_TOKEN: apiToken,
    },
    installHint: "pipx install mcp-atlassian",
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

    await testJiraTools(client, tools);

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

async function testJiraTools(
  client: McpClient,
  tools: ToolDefinition[]
): Promise<void> {
  const myselfTool = tools.find(
    (t) =>
      t.name === "jira_get_myself" ||
      t.name === "jira_myself" ||
      t.name === "get_myself" ||
      t.name === "whoami"
  );

  if (myselfTool) {
    console.log(`\n  Testing: ${myselfTool.name}`);
    try {
      const result = await client.callTool(myselfTool.name, {});
      console.log(`  Result:`, JSON.stringify(result, null, 2).slice(0, 500));
    } catch (err) {
      console.log(
        `  Tool test failed: ${err instanceof Error ? err.message : err}`
      );
    }
  }

  // Test reading a specific issue if configured
  const issueKey = process.env.TEST_JIRA_ISSUE;
  if (issueKey) {
    const issueTool = tools.find(
      (t) =>
        t.name === "jira_get_issue" ||
        t.name === "get_issue" ||
        t.name === "jira_issue"
    );

    if (issueTool) {
      console.log(`\n  Testing: ${issueTool.name} (${issueKey})`);
      try {
        const result = await client.callTool(issueTool.name, {
          issue_key: issueKey,
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
      console.log(`\n  Skipping issue test: no get_issue tool found`);
    }
  }
}
