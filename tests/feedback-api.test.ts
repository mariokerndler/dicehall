import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attachFeedbackRoutes, __resetFeedbackRateLimitForTests } from "../server/feedback";

type TestServer = {
  url: string;
  close: () => Promise<void>;
};

let tempDir = "";

async function startServer(feedbackFile: string, trustedProxies: string[] = []): Promise<TestServer> {
  const app = express();
  app.set("trust proxy", trustedProxies);
  attachFeedbackRoutes(app, { feedbackFile });

  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected test server to listen on a TCP port.");
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  };
}

describe("feedback API", () => {
  beforeEach(async () => {
    __resetFeedbackRateLimitForTests();
    tempDir = await mkdtemp(join(tmpdir(), "dicehall-feedback-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    __resetFeedbackRateLimitForTests();
  });

  it("keeps separate feedback limits for clients behind a trusted proxy", async () => {
    const server = await startServer(join(tempDir, "feedback.jsonl"), ["loopback"]);
    try {
      for (let index = 1; index <= 6; index++) {
        const response = await fetch(`${server.url}/api/feedback`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${index}` },
          body: JSON.stringify({ type: "bug", message: "Test feedback" })
        });
        expect(response.status).toBe(201);
        await response.json();
      }
    } finally {
      await server.close();
    }
  });

  it.each([{ trustedProxies: [] }, { trustedProxies: ["loopback"] }])("does not let spoofed forwarded prefixes reset feedback limits (%#)", async ({ trustedProxies }) => {
    const server = await startServer(join(tempDir, "feedback.jsonl"), trustedProxies);
    try {
      for (let index = 1; index <= 6; index++) {
        const response = await fetch(`${server.url}/api/feedback`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${index}, 203.0.113.10` },
          body: JSON.stringify({ type: "bug", message: "Test feedback" })
        });
        expect(response.status).toBe(index <= 5 ? 201 : 429);
        await response.json();
      }
    } finally {
      await server.close();
    }
  });

  it("appends anonymous feedback as JSONL", async () => {
    const feedbackFile = join(tempDir, "feedback.jsonl");
    const server = await startServer(feedbackFile);

    try {
      const response = await fetch(`${server.url}/api/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": "test-agent" },
        body: JSON.stringify({
          type: "bug",
          message: "  Rolling stopped after refresh.  ",
          pageContext: "lobby",
          username: "Alice",
          lobbyCode: "ABC123"
        })
      });

      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toEqual({ ok: true });

      const lines = (await readFile(feedbackFile, "utf8")).trim().split("\n");
      expect(lines).toHaveLength(1);
      const stored = JSON.parse(lines[0]);

      expect(stored).toMatchObject({
        type: "bug",
        message: "Rolling stopped after refresh.",
        pageContext: "lobby"
      });
      expect(stored.id).toEqual(expect.any(String));
      expect(stored.createdAt).toEqual(expect.any(String));
      expect(stored).not.toHaveProperty("ip");
      expect(stored).not.toHaveProperty("userAgent");
      expect(stored).not.toHaveProperty("username");
      expect(stored).not.toHaveProperty("lobbyCode");
    } finally {
      await server.close();
    }
  });

  it("returns 400 for invalid JSON and invalid payloads", async () => {
    const feedbackFile = join(tempDir, "feedback.jsonl");
    const server = await startServer(feedbackFile);

    try {
      const malformed = await fetch(`${server.url}/api/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{"
      });
      expect(malformed.status).toBe(400);
      await expect(malformed.json()).resolves.toEqual({ ok: false, error: "Invalid feedback submission." });

      const invalid = await fetch(`${server.url}/api/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "bug", message: "" })
      });
      expect(invalid.status).toBe(400);
      await expect(invalid.json()).resolves.toEqual({ ok: false, error: "Invalid feedback submission." });
    } finally {
      await server.close();
    }
  });

  it("rate limits excessive submissions without exposing internals", async () => {
    const feedbackFile = join(tempDir, "feedback.jsonl");
    const server = await startServer(feedbackFile);

    try {
      const statuses: number[] = [];

      for (let index = 0; index < 6; index += 1) {
        const response = await fetch(`${server.url}/api/feedback`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "feature", message: `Request ${index}` })
        });
        statuses.push(response.status);
      }

      expect(statuses.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
      expect(statuses[5]).toBe(429);
    } finally {
      await server.close();
    }
  });
});
