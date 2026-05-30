import { describe, expect, it } from "vitest";
import { shouldHandleLobbyClosedEvent } from "../lib/lobby-events";

describe("lobby close events", () => {
  it("handles close events for the current lobby", () => {
    expect(shouldHandleLobbyClosedEvent("ABC123", "ABC123")).toBe(true);
  });

  it("ignores stale close events from a previous lobby", () => {
    expect(shouldHandleLobbyClosedEvent("NEW123", "OLD123")).toBe(false);
  });
});
