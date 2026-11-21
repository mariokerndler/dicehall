export type Session = {
  playerId: string;
  sessionToken: string;
  username: string;
  diceColor: string;
  lobbyCode: string;
};

const SESSION_KEY = "dicehall-session";
const EMPTY_SESSION: Session = {
  playerId: "",
  sessionToken: "",
  username: "",
  diceColor: "#d79b4a",
  lobbyCode: ""
};

export function getInitialSession(): Session {
  try {
    const stored: unknown = JSON.parse(window.sessionStorage.getItem(SESSION_KEY) ?? "null");
    if (stored && typeof stored === "object" && !Array.isArray(stored)) {
      const parsed = stored as Record<string, unknown>;
      return {
        playerId: typeof parsed.playerId === "string" ? parsed.playerId : "",
        sessionToken: typeof parsed.sessionToken === "string" ? parsed.sessionToken : "",
        username: typeof parsed.username === "string" ? parsed.username : "",
        diceColor: typeof parsed.diceColor === "string" && /^#[0-9a-f]{6}$/i.test(parsed.diceColor)
          ? parsed.diceColor : EMPTY_SESSION.diceColor,
        lobbyCode: typeof parsed.lobbyCode === "string" ? parsed.lobbyCode : ""
      };
    }
  } catch {
    // Storage may be blocked or contain an invalid session; keep the current tab usable.
  }
  return { ...EMPTY_SESSION };
}

export function saveSession(session: Session) {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // shortcut: session stays in memory when storage is blocked; refresh requires joining again.
  }
}
