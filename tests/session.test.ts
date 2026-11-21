import { afterEach, describe, expect, it, vi } from "vitest";
import { getInitialSession, saveSession } from "../lib/session";

afterEach(() => vi.unstubAllGlobals());

describe("browser session", () => {
  it("returns defaults during server rendering", () => {
    expect(getInitialSession().lobbyCode).toBe("");
  });

  it("keeps working when browser storage is blocked", () => {
    vi.stubGlobal("window", {
      get sessionStorage() { throw new Error("Storage denied"); }
    });
    const session = getInitialSession();
    expect(session.playerId).toBe("");
    expect(() => saveSession(session)).not.toThrow();
  });

  it.each(["{", "null", "[]", "42", '{"username":{},"playerId":23,"diceColor":"invalid"}'])(
    "recovers from invalid saved data: %s", (stored) => {
      vi.stubGlobal("window", { sessionStorage: { getItem: () => stored } });
      expect(getInitialSession()).toMatchObject({ playerId: "", username: "", diceColor: "#d79b4a" });
    }
  );

  it("round trips valid credentials using the existing storage key", () => {
    let stored = "";
    vi.stubGlobal("window", { sessionStorage: {
      getItem: (key: string) => key === "dicehall-session" ? stored : null,
      setItem: (key: string, value: string) => { if (key === "dicehall-session") stored = value; }
    } });
    const session = { ...getInitialSession(), playerId: "player", sessionToken: "token", lobbyCode: "ABC234" };
    saveSession(session);
    expect(getInitialSession()).toEqual(session);
  });
});
