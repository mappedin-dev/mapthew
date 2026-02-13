import { Router } from "express";
import { secretsManager } from "../../config.js";

const router: Router = Router();

// Helper to create JIRA auth header
async function getJiraAuth(): Promise<string> {
  const { jiraEmail, jiraApiToken } = await secretsManager.getMany([
    "jiraEmail", "jiraApiToken",
  ]);
  return Buffer.from(`${jiraEmail || ""}:${jiraApiToken || ""}`).toString("base64");
}

// ============================================
// JIRA Search Endpoints
// ============================================

// GET /api/search/jira/boards - Search JIRA boards and spaces
router.get("/jira/boards", async (req, res) => {
  try {
    const query = (req.query.q as string) || "";

    const { jiraBaseUrl, jiraEmail, jiraApiToken } = await secretsManager.getMany([
      "jiraBaseUrl", "jiraEmail", "jiraApiToken",
    ]);

    if (!jiraBaseUrl || !jiraEmail || !jiraApiToken) {
      res.status(503).json({ error: "JIRA credentials not configured" });
      return;
    }

    const jiraAuth = await getJiraAuth();

    // Fetch both boards and spaces in parallel
    const boardsUrl = new URL(`${jiraBaseUrl}/rest/agile/1.0/board`);
    if (query) {
      boardsUrl.searchParams.set("name", query);
    }
    boardsUrl.searchParams.set("maxResults", "20");

    // Fetch boards
    const boardsPromise = fetch(boardsUrl.toString(), {
      headers: {
        Authorization: `Basic ${jiraAuth}`,
        Accept: "application/json",
      },
    });

    // Fetch projects (spaces) - projects are the closest equivalent to "spaces" in JIRA
    const projectsUrl = new URL(`${jiraBaseUrl}/rest/api/3/project/search`);
    if (query) {
      projectsUrl.searchParams.set("query", query);
    }
    projectsUrl.searchParams.set("maxResults", "20");

    const projectsPromise = fetch(projectsUrl.toString(), {
      headers: {
        Authorization: `Basic ${jiraAuth}`,
        Accept: "application/json",
      },
    });

    const [boardsResponse, projectsResponse] = await Promise.all([
      boardsPromise,
      projectsPromise,
    ]);

    const results: Array<{ id: string; label: string }> = [];

    // Process boards
    if (boardsResponse.ok) {
      const boardsData = (await boardsResponse.json()) as {
        values: Array<{ id: number; name: string }>;
      };
      boardsData.values.forEach((board) => {
        results.push({
          id: `board:${board.id}`,
          label: `${board.name} (Board)`,
        });
      });
    } else {
      console.error("JIRA boards search error:", await boardsResponse.text());
    }

    // Process projects/spaces
    if (projectsResponse.ok) {
      const projectsData = (await projectsResponse.json()) as {
        values: Array<{ key: string; name: string }>;
      };
      projectsData.values.forEach((project) => {
        results.push({
          id: `project:${project.key}`,
          label: `${project.name} (${project.key})`,
        });
      });
    } else {
      console.error(
        "JIRA projects search error:",
        await projectsResponse.text()
      );
    }

    // Sort alphabetically by label
    results.sort((a, b) => a.label.localeCompare(b.label));

    res.json(results.slice(0, 20));
  } catch (error) {
    console.error("Error searching JIRA boards/spaces:", error);
    res.status(500).json({ error: "Failed to search JIRA boards/spaces" });
  }
});

// GET /api/search/jira/issues - Search JIRA issues (requires board/space)
router.get("/jira/issues", async (req, res) => {
  try {
    const query = (req.query.q as string) || "";
    const boardId = req.query.board as string | undefined;

    const { jiraBaseUrl, jiraEmail, jiraApiToken } = await secretsManager.getMany([
      "jiraBaseUrl", "jiraEmail", "jiraApiToken",
    ]);

    if (!jiraBaseUrl || !jiraEmail || !jiraApiToken) {
      res.status(503).json({ error: "JIRA credentials not configured" });
      return;
    }

    if (!boardId) {
      res.status(400).json({ error: "board parameter is required" });
      return;
    }

    const jiraAuth = await getJiraAuth();

    // Parse the board ID to determine type (board:123 or project:KEY)
    const [type, id] = boardId.split(":");
    let projectKey: string | null = null;

    if (type === "project") {
      // Direct project key
      projectKey = id;
    } else if (type === "board") {
      // Need to fetch the board to get its project
      const boardResponse = await fetch(
        `${jiraBaseUrl}/rest/agile/1.0/board/${id}`,
        {
          headers: {
            Authorization: `Basic ${jiraAuth}`,
            Accept: "application/json",
          },
        }
      );

      if (boardResponse.ok) {
        const boardData = (await boardResponse.json()) as {
          location?: { projectKey?: string };
        };
        projectKey = boardData.location?.projectKey || null;
      }
    }

    // Build JQL query - must have at least a project to search
    if (!projectKey) {
      res.status(400).json({
        error:
          "Could not determine project from board. Please try a different board or use a project directly.",
      });
      return;
    }

    let jql = `project = "${projectKey}"`;
    if (query) {
      const searchFilter = `(key ~ "${query}" OR summary ~ "${query}")`;
      jql = `${jql} AND ${searchFilter}`;
    }

    // Add ordering to JQL query
    jql = `${jql} ORDER BY updated DESC`;

    const url = new URL(`${jiraBaseUrl}/rest/api/3/search/jql`);
    url.searchParams.set("jql", jql);
    url.searchParams.set("maxResults", "20");
    url.searchParams.set("fields", "key,summary");

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Basic ${jiraAuth}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("JIRA issues search error:", errorText);
      res.status(response.status).json({
        error: `Failed to search JIRA issues: ${response.status} ${response.statusText}`,
      });
      return;
    }

    const data = (await response.json()) as {
      issues: Array<{ key: string; fields: { summary: string } }>;
    };

    const results = data.issues.map((issue) => ({
      id: issue.key,
      label: `${issue.key}: ${issue.fields.summary}`,
    }));

    res.json(results);
  } catch (error) {
    console.error("Error searching JIRA issues:", error);
    res.status(500).json({ error: "Failed to search JIRA issues" });
  }
});

// ============================================
// GitHub Search Endpoints
// ============================================

// GET /api/search/github/repos - Search GitHub repos user has access to
router.get("/github/repos", async (req, res) => {
  try {
    const query = (req.query.q as string)?.toLowerCase() || "";

    const githubToken = await secretsManager.get("githubToken");
    if (!githubToken) {
      res.status(503).json({ error: "GitHub token not configured" });
      return;
    }

    // Use /user/repos to get only repos the authenticated user has access to
    const url = new URL("https://api.github.com/user/repos");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("sort", "updated");
    url.searchParams.set("direction", "desc");

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GitHub repos search error:", errorText);
      res
        .status(response.status)
        .json({ error: "Failed to search GitHub repos" });
      return;
    }

    const data = (await response.json()) as Array<{
      full_name: string;
      owner: { login: string };
      name: string;
    }>;

    // Filter by query if provided
    let repos = data;
    if (query) {
      repos = data.filter((repo) =>
        repo.full_name.toLowerCase().includes(query)
      );
    }

    const results = repos.slice(0, 20).map((repo) => ({
      owner: repo.owner.login,
      repo: repo.name,
      label: repo.full_name,
    }));

    res.json(results);
  } catch (error) {
    console.error("Error searching GitHub repos:", error);
    res.status(500).json({ error: "Failed to search GitHub repos" });
  }
});

// GET /api/search/github/branches - Search GitHub branches
router.get("/github/branches", async (req, res) => {
  try {
    const owner = req.query.owner as string;
    const repo = req.query.repo as string;
    const query = (req.query.q as string) || "";

    if (!owner || !repo) {
      res.status(400).json({ error: "owner and repo are required" });
      return;
    }

    const githubToken = await secretsManager.get("githubToken");
    if (!githubToken) {
      res.status(503).json({ error: "GitHub token not configured" });
      return;
    }

    const url = new URL(
      `https://api.github.com/repos/${owner}/${repo}/branches`
    );
    url.searchParams.set("per_page", "100");

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GitHub branches search error:", errorText);
      res
        .status(response.status)
        .json({ error: "Failed to search GitHub branches" });
      return;
    }

    const data = (await response.json()) as Array<{ name: string }>;

    // Filter by query if provided
    let branches = data;
    if (query) {
      const lowerQuery = query.toLowerCase();
      branches = data.filter((branch) =>
        branch.name.toLowerCase().includes(lowerQuery)
      );
    }

    const results = branches.slice(0, 20).map((branch) => ({
      id: branch.name,
      label: branch.name,
    }));

    res.json(results);
  } catch (error) {
    console.error("Error searching GitHub branches:", error);
    res.status(500).json({ error: "Failed to search GitHub branches" });
  }
});

// GET /api/search/github/pulls - Search GitHub pull requests
router.get("/github/pulls", async (req, res) => {
  try {
    const owner = req.query.owner as string;
    const repo = req.query.repo as string;
    const query = (req.query.q as string) || "";

    if (!owner || !repo) {
      res.status(400).json({ error: "owner and repo are required" });
      return;
    }

    const githubToken = await secretsManager.get("githubToken");
    if (!githubToken) {
      res.status(503).json({ error: "GitHub token not configured" });
      return;
    }

    const url = new URL(`https://api.github.com/repos/${owner}/${repo}/pulls`);
    url.searchParams.set("state", "open");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("sort", "updated");
    url.searchParams.set("direction", "desc");

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GitHub pulls search error:", errorText);
      res
        .status(response.status)
        .json({ error: "Failed to search GitHub PRs" });
      return;
    }

    const data = (await response.json()) as Array<{
      number: number;
      title: string;
    }>;

    // Filter by query if provided
    let pulls = data;
    if (query) {
      const lowerQuery = query.toLowerCase();
      pulls = data.filter(
        (pr) =>
          pr.title.toLowerCase().includes(lowerQuery) ||
          String(pr.number).includes(query)
      );
    }

    const results = pulls.slice(0, 20).map((pr) => ({
      id: String(pr.number),
      label: `#${pr.number}: ${pr.title}`,
    }));

    res.json(results);
  } catch (error) {
    console.error("Error searching GitHub PRs:", error);
    res.status(500).json({ error: "Failed to search GitHub PRs" });
  }
});

// GET /api/search/github/issues - Search GitHub issues
router.get("/github/issues", async (req, res) => {
  try {
    const owner = req.query.owner as string;
    const repo = req.query.repo as string;
    const query = (req.query.q as string) || "";

    if (!owner || !repo) {
      res.status(400).json({ error: "owner and repo are required" });
      return;
    }

    const githubToken = await secretsManager.get("githubToken");
    if (!githubToken) {
      res.status(503).json({ error: "GitHub token not configured" });
      return;
    }

    const url = new URL(`https://api.github.com/repos/${owner}/${repo}/issues`);
    url.searchParams.set("state", "open");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("sort", "updated");
    url.searchParams.set("direction", "desc");

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GitHub issues search error:", errorText);
      res
        .status(response.status)
        .json({ error: "Failed to search GitHub issues" });
      return;
    }

    const data = (await response.json()) as Array<{
      number: number;
      title: string;
      pull_request?: unknown;
    }>;

    // Filter out pull requests (GitHub API returns both issues and PRs from /issues endpoint)
    let issues = data.filter((issue) => !issue.pull_request);

    // Filter by query if provided
    if (query) {
      const lowerQuery = query.toLowerCase();
      issues = issues.filter(
        (issue) =>
          issue.title.toLowerCase().includes(lowerQuery) ||
          String(issue.number).includes(query)
      );
    }

    const results = issues.slice(0, 20).map((issue) => ({
      id: String(issue.number),
      label: `#${issue.number}: ${issue.title}`,
    }));

    res.json(results);
  } catch (error) {
    console.error("Error searching GitHub issues:", error);
    res.status(500).json({ error: "Failed to search GitHub issues" });
  }
});

export default router;
