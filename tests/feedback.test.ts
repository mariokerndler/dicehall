import { describe, expect, it } from "vitest";
import { normalizeFeedbackPayload, MAX_FEEDBACK_MESSAGE_LENGTH } from "../lib/feedback";

describe("feedback payload validation", () => {
  it("accepts bug reports and trims message fields", () => {
    const result = normalizeFeedbackPayload({
      type: "bug",
      message: "  The roll log stopped updating.  ",
      pageContext: "  lobby  "
    });

    expect(result).toEqual({
      ok: true,
      data: {
        type: "bug",
        message: "The roll log stopped updating.",
        pageContext: "lobby"
      }
    });
  });

  it("accepts feature requests", () => {
    const result = normalizeFeedbackPayload({
      type: "feature",
      message: "Please add advantage rolls."
    });

    expect(result).toEqual({
      ok: true,
      data: {
        type: "feature",
        message: "Please add advantage rolls."
      }
    });
  });

  it("rejects empty, unknown, and oversized submissions", () => {
    expect(normalizeFeedbackPayload({ type: "bug", message: "   " }).ok).toBe(false);
    expect(normalizeFeedbackPayload({ type: "question", message: "Hello" }).ok).toBe(false);
    expect(
      normalizeFeedbackPayload({
        type: "bug",
        message: "x".repeat(MAX_FEEDBACK_MESSAGE_LENGTH + 1)
      }).ok
    ).toBe(false);
  });

  it("keeps only anonymous feedback fields", () => {
    const result = normalizeFeedbackPayload({
      type: "bug",
      message: "The dice animation froze.",
      pageContext: "home",
      username: "Alice",
      email: "alice@example.test",
      lobbyCode: "ABC123",
      playerId: "player-1",
      sessionToken: "secret"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data).toEqual({
      type: "bug",
      message: "The dice animation froze.",
      pageContext: "home"
    });
    expect(result.data).not.toHaveProperty("username");
    expect(result.data).not.toHaveProperty("email");
    expect(result.data).not.toHaveProperty("lobbyCode");
    expect(result.data).not.toHaveProperty("playerId");
    expect(result.data).not.toHaveProperty("sessionToken");
  });
});
