import { randomUUID } from "node:crypto";
import { mkdir, appendFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Express, Request, Response } from "express";
import express from "express";
import { normalizeFeedbackPayload, type StoredFeedback } from "../lib/feedback";
import { FixedWindowRateLimiter } from "../lib/rate-limit";

const FEEDBACK_RATE_LIMIT = { limit: 5, windowMs: 60 * 1000 };
const DEFAULT_FEEDBACK_FILE = join(process.cwd(), "data", "feedback.jsonl");
const GENERIC_ERROR = "Invalid feedback submission.";

type FeedbackRouteOptions = {
  feedbackFile?: string;
};

const feedbackRateLimiter = new FixedWindowRateLimiter();

function getFeedbackFile(options?: FeedbackRouteOptions): string {
  return options?.feedbackFile || process.env.DICEHALL_FEEDBACK_FILE || DEFAULT_FEEDBACK_FILE;
}

function clientRateLimitKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

async function appendFeedback(feedbackFile: string, feedback: StoredFeedback): Promise<void> {
  await mkdir(dirname(feedbackFile), { recursive: true });
  await appendFile(feedbackFile, `${JSON.stringify(feedback)}\n`, "utf8");
}

export function __resetFeedbackRateLimitForTests(): void {
  feedbackRateLimiter.clear();
}

export function attachFeedbackRoutes(app: Express, options?: FeedbackRouteOptions): void {
  app.post(
    "/api/feedback",
    express.json({ limit: "8kb" }),
    async (req: Request, res: Response) => {
      feedbackRateLimiter.prune();
      if (!feedbackRateLimiter.check(clientRateLimitKey(req), FEEDBACK_RATE_LIMIT)) {
        res.status(429).json({ ok: false, error: "Too many requests. Try again soon." });
        return;
      }

      const validation = normalizeFeedbackPayload(req.body);

      if (!validation.ok) {
        res.status(400).json({ ok: false, error: GENERIC_ERROR });
        return;
      }

      const storedFeedback: StoredFeedback = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        ...validation.data
      };

      try {
        await appendFeedback(getFeedbackFile(options), storedFeedback);
        res.status(201).json({ ok: true });
      } catch {
        res.status(500).json({ ok: false, error: "Could not save feedback." });
      }
    }
  );

  app.use("/api/feedback", (error: unknown, _req: Request, res: Response, next: (error?: unknown) => void) => {
    if (error instanceof SyntaxError) {
      res.status(400).json({ ok: false, error: GENERIC_ERROR });
      return;
    }

    next(error);
  });
}
