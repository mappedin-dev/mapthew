import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { extractTextFromAdf, extractInstructionFromAdf } from "./adf.js";
import { setBotName } from "./utils.js";
import type { AdfNode } from "./types.js";

describe("extractTextFromAdf", () => {
  it("extracts text from simple ADF document", () => {
    const adf: AdfNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "hello world" },
          ],
        },
      ],
    };
    expect(extractTextFromAdf(adf)).toBe("hello world");
  });

  it("extracts text from mention nodes", () => {
    const adf: AdfNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "mention",
              attrs: { id: "user-123", text: "@mapthew" },
            },
            { type: "text", text: " do something" },
          ],
        },
      ],
    };
    expect(extractTextFromAdf(adf)).toBe("@mapthew do something");
  });

  it("returns empty string for empty ADF", () => {
    const adf: AdfNode = { type: "doc" };
    expect(extractTextFromAdf(adf)).toBe("");
  });

  it("handles nested content across multiple paragraphs", () => {
    const adf: AdfNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "first " }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "second" }],
        },
      ],
    };
    expect(extractTextFromAdf(adf)).toBe("first second");
  });
});

describe("extractInstructionFromAdf", () => {
  beforeEach(() => {
    setBotName("mapthew");
  });

  afterEach(() => {
    setBotName("mapthew");
  });

  it("extracts instruction from ADF with rich mention", () => {
    const adfBody: AdfNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "mention",
              attrs: { id: "557058:abc123", text: "@mapthew" },
            },
            { type: "text", text: " implement authentication" },
          ],
        },
      ],
    };
    expect(extractInstructionFromAdf(adfBody)).toBe("implement authentication");
  });

  it("returns null for ADF without bot mention", () => {
    const adfBody: AdfNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "just a regular comment" },
          ],
        },
      ],
    };
    expect(extractInstructionFromAdf(adfBody)).toBeNull();
  });

  it("extracts instruction from ADF with mention of another user and the bot", () => {
    const adfBody: AdfNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "mention",
              attrs: { id: "other-user", text: "@someone" },
            },
            { type: "text", text: " hey, " },
            {
              type: "mention",
              attrs: { id: "557058:abc123", text: "@mapthew" },
            },
            { type: "text", text: " fix the login bug" },
          ],
        },
      ],
    };
    expect(extractInstructionFromAdf(adfBody)).toBe("fix the login bug");
  });

  it("extracts instruction from ADF with display name containing bot name (e.g., 'Mapthew Bot')", () => {
    const adfBody: AdfNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "mention",
              attrs: { id: "557058:abc123", text: "@Mapthew Bot" },
            },
            { type: "text", text: " implement authentication" },
          ],
        },
      ],
    };
    expect(extractInstructionFromAdf(adfBody)).toBe("implement authentication");
  });

  it("extracts instruction from ADF with capitalized display name", () => {
    const adfBody: AdfNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "mention",
              attrs: { id: "557058:abc123", text: "@Mapthew" },
            },
            { type: "text", text: " deploy the fix" },
          ],
        },
      ],
    };
    expect(extractInstructionFromAdf(adfBody)).toBe("deploy the fix");
  });

  it("extracts instruction from ADF plain text @mention (no rich mention node)", () => {
    const adfBody: AdfNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "@mapthew do the thing" },
          ],
        },
      ],
    };
    expect(extractInstructionFromAdf(adfBody)).toBe("do the thing");
  });

  it("returns null for ADF mention of unrelated user", () => {
    const adfBody: AdfNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "mention",
              attrs: { id: "other-user", text: "@someone-else" },
            },
            { type: "text", text: " please review" },
          ],
        },
      ],
    };
    expect(extractInstructionFromAdf(adfBody)).toBeNull();
  });
});
