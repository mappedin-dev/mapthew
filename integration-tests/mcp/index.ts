import { loadEnv } from "./utils/env.js";
import { testGitHub } from "./tests/github.js";
import { testJira } from "./tests/jira.js";
import { testFigma } from "./tests/figma.js";

// Load environment variables
loadEnv();

type TestFn = () => Promise<boolean>;

const tests: Record<string, TestFn> = {
  github: testGitHub,
  jira: testJira,
  figma: testFigma,
};

const names: Record<string, string> = {
  github: "GitHub MCP Server (Remote)",
  jira: "JIRA MCP Server (Local)",
  figma: "Figma MCP Server (Local)",
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  console.log("MCP Integration Test");
  console.log("====================\n");

  let testsToRun: string[] = [];

  if (args.includes("--github")) {
    testsToRun = ["github"];
  } else if (args.includes("--jira")) {
    testsToRun = ["jira"];
  } else if (args.includes("--figma")) {
    testsToRun = ["figma"];
  } else if (args.length === 0) {
    testsToRun = Object.keys(tests);
  } else {
    console.log("Usage: index.ts [--github | --jira | --figma]");
    console.log("");
    console.log("Options:");
    console.log("  --github    Test GitHub MCP server (remote)");
    console.log(
      "  --jira      Test JIRA MCP server (local, requires mcp-atlassian)"
    );
    console.log(
      "  --figma     Test Figma MCP server (local, requires figma-developer-mcp)"
    );
    console.log("  (no args)   Test all MCP servers");
    process.exit(1);
  }

  const results: Record<string, boolean> = {};

  for (const testKey of testsToRun) {
    results[testKey] = await tests[testKey]();
  }

  // Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log("Summary");
  console.log(`${"=".repeat(60)}`);

  let allPassed = true;
  for (const [key, passed] of Object.entries(results)) {
    const status = passed ? "PASS" : "FAIL";
    const icon = passed ? "✓" : "✗";
    console.log(`  ${icon} ${names[key]}: ${status}`);
    if (!passed) allPassed = false;
  }

  console.log("");
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
