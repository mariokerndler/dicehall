import { createServer, type Server as HttpServer } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { io as createClient, type Socket as ClientSocket } from "socket.io-client";
import { addOrReconnectPlayer, createLobby, type LobbyState, type Player } from "../lib/lobby";
import {
  attachRealtimeServer,
  pruneExpiredLobbies,
  SECURITY_LIMITS,
  __getRealtimeLobbyForTests,
  __getRealtimeLobbyCountForTests,
  __getRealtimeLobbyStateForTests,
  __resetRealtimeStateForTests,
  __setRealtimeLobbyForTests
} from "../server/realtime";

type Ack<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

type TestServer = {
  httpServer: HttpServer;
  io: ReturnType<typeof attachRealtimeServer>;
  url: string;
  close: () => Promise<void>;
};

const clients: ClientSocket[] = [];

async function startTestServer(): Promise<TestServer> {
  const httpServer = createServer();
  const io = attachRealtimeServer(httpServer);

  await new Promise<void>((resolve) => {
    httpServer.listen(0, "127.0.0.1", resolve);
  });

  const address = httpServer.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected an assigned TCP port.");
  }

  return {
    httpServer,
    io,
    url: `http://127.0.0.1:${address.port}`,
    close: async () => {
      io.close();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  };
}

async function connectClient(url: string, extraHeaders?: Record<string, string>): Promise<ClientSocket> {
  const socket = createClient(url, {
    path: "/socket.io",
    transports: ["polling"],
    forceNew: true,
    extraHeaders
  });
  clients.push(socket);

  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });

  return socket;
}

function emitAck<T>(socket: ClientSocket, event: string, payload: unknown): Promise<Ack<T>> {
  return new Promise((resolve, reject) => {
    socket.timeout(2000).emit(event, payload, (error: Error | null, response: Ack<T>) => {
      if (error) reject(error);
      else resolve(response);
    });
  });
}

type PlayerSession = { state: LobbyState; player: Player; sessionToken: string };

async function createSession(socket: ClientSocket): Promise<PlayerSession> {
  const response = await emitAck<PlayerSession>(socket, "lobby:create", { username: "DM" });
  if (!response.ok) throw new Error(response.error);
  return response.data;
}

async function joinSession(socket: ClientSocket, code: string, session?: PlayerSession): Promise<PlayerSession> {
  const response = await emitAck<PlayerSession>(socket, "lobby:join", {
    code,
    username: session?.player.username ?? "Alice",
    playerId: session?.player.id,
    sessionToken: session?.sessionToken,
    resumeOnly: Boolean(session)
  });
  if (!response.ok) throw new Error(response.error);
  return response.data;
}

function onceSocketEvent<T>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => {
    socket.once(event, resolve);
  });
}

function testCode(index: number): string {
  return `T${index.toString(36).padStart(5, "0").toUpperCase()}`;
}

describe("realtime security", () => {
  let server: TestServer;

  beforeEach(async () => {
    __resetRealtimeStateForTests();
    server = await startTestServer();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    for (const client of clients.splice(0)) {
      client.disconnect();
    }
    await server?.close();
    __resetRealtimeStateForTests();
  });

  it.each([
    "lobby:create", "lobby:join", "lobby:leave", "roll:start",
    "host:clearLog", "host:renewSession", "host:removePlayer"
  ])("rejects malformed acknowledgement arguments on %s without crashing", async (event) => {
    const attacker = await connectClient(server.url);
    const disconnected = onceSocketEvent(attacker, "disconnect");
    attacker.emit(event, {}, "not-a-callback");
    await disconnected;
    expect(__getRealtimeLobbyCountForTests()).toBe(0);
    const valid = await connectClient(server.url);
    expect((await createSession(valid)).player.isHost).toBe(true);
  });

  it.each([null, false, {}, []])("rejects other non-function callbacks (%#)", async (callback) => {
    const attacker = await connectClient(server.url);
    const disconnected = onceSocketEvent(attacker, "disconnect");
    attacker.emit("lobby:leave", {}, callback);
    await disconnected;
    const valid = await connectClient(server.url);
    expect((await createSession(valid)).player.isHost).toBe(true);
  });

  it("rejects extra arguments even when the packet ends in a valid callback", async () => {
    const attacker = await connectClient(server.url);
    const disconnected = onceSocketEvent(attacker, "disconnect");
    attacker.emit("lobby:create", { username: "DM" }, "not-a-callback", () => {});
    await disconnected;
    expect(__getRealtimeLobbyCountForTests()).toBe(0);
  });

  it("allows requests without an acknowledgement callback", async () => {
    const dm = await connectClient(server.url);
    dm.emit("lobby:leave", {});
    expect((await createSession(dm)).player.isHost).toBe(true);
  });

  it("keeps create limits across connections and separates different client addresses", async () => {
    const first = await connectClient(server.url, { "x-forwarded-for": "203.0.113.10" });
    for (let index = 0; index < SECURITY_LIMITS.createLobbyRate.limit; index++) {
      await createSession(first);
    }
    const reconnected = await connectClient(server.url, { "x-forwarded-for": "203.0.113.10" });
    const denied = await emitAck(reconnected, "lobby:create", { username: "DM" });
    expect(denied).toMatchObject({ ok: false, error: "Too many requests. Try again soon." });
    const otherAddress = await connectClient(server.url, { "x-forwarded-for": "203.0.113.11" });
    expect((await createSession(otherAddress)).player.isHost).toBe(true);
  });

  it("cannot reset address limits by prepending forged forwarded addresses", async () => {
    for (let index = 0; index < SECURITY_LIMITS.createLobbyRate.limit; index++) {
      const socket = await connectClient(server.url, {
        "x-forwarded-for": `198.51.100.${index + 1}, 203.0.113.10`
      });
      await createSession(socket);
    }
    const attacker = await connectClient(server.url, {
      "x-forwarded-for": "198.51.100.99, 203.0.113.10"
    });
    expect((await emitAck(attacker, "lobby:create", { username: "DM" })).ok).toBe(false);
  });

  it.each(["roll:start", "host:renewSession"])("shares the %s limit across a player's connections", async (event) => {
    const first = await connectClient(server.url);
    const created = await createSession(first);
    const second = await connectClient(server.url);
    await joinSession(second, created.state.code, created);
    const limit = event === "roll:start" ? SECURITY_LIMITS.rollRate.limit : SECURITY_LIMITS.hostActionRate.limit;
    for (let index = 0; index < limit; index++) {
      const response = await emitAck(first, event, { code: created.state.code, terms: [], modifier: 0 });
      if (!response.ok) expect(response.error).not.toBe("Too many requests. Try again soon.");
    }
    expect(await emitAck(second, event, { code: created.state.code, terms: [], modifier: 0 }))
      .toMatchObject({ ok: false, error: "Too many requests. Try again soon." });
  });

  it("caps concurrent connections per address and releases disconnected slots", async () => {
    const outcomes = await Promise.allSettled(Array.from({ length: SECURITY_LIMITS.maxConnectionsPerAddress + 1 }, () =>
      connectClient(server.url)
    ));
    const opened = outcomes.flatMap(outcome => outcome.status === "fulfilled" ? [outcome.value] : []);
    const rejected = outcomes.filter(outcome => outcome.status === "rejected");
    expect(opened).toHaveLength(SECURITY_LIMITS.maxConnectionsPerAddress);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toContain("Too many connections");
    opened[0].disconnect();
    await vi.waitFor(() => expect(server.io.sockets.sockets.size).toBe(SECURITY_LIMITS.maxConnectionsPerAddress - 1));
    const replacement = await connectClient(server.url);
    expect(replacement.connected).toBe(true);
  }, 15_000);

  it("shares the overall request budget across connections", async () => {
    const first = await connectClient(server.url);
    const second = await connectClient(server.url);
    const replies = await Promise.all(Array.from({ length: SECURITY_LIMITS.requestRate.limit }, (_, index) =>
      emitAck(index % 2 ? first : second, "lobby:leave", {})
    ));
    expect(replies.every(response => response.ok)).toBe(true);
    expect(await emitAck(second, "lobby:leave", {}))
      .toMatchObject({ ok: false, error: "Too many requests. Try again soon." });
  });

  it.each(["roll:start", "host:renewSession", "host:clearLog", "host:removePlayer", "lobby:join"])(
    "rejects %s at the session deadline without waiting for cleanup",
    async (event) => {
      const dm = await connectClient(server.url);
      const created = await createSession(dm);
      const code = created.state.code;
      const player = await connectClient(server.url);
      const joined = await joinSession(player, code);
      const lobby = __getRealtimeLobbyForTests(code)!;
      const deadline = Date.now();
      lobby.expiresAt = deadline;
      vi.spyOn(Date, "now").mockReturnValue(deadline);
      const closures = [dm, player].map(socket => onceSocketEvent(socket, "lobby:closed"));

      const result = await emitAck(dm, event, {
        code, username: "Late player", playerId: joined.player.id,
        terms: [{ quantity: 1, sides: 20 }], modifier: 0
      });

      expect(result.ok).toBe(false);
      for (const closed of closures) {
        await expect(closed).resolves.toEqual({ code, reason: "expired" });
      }
      expect(__getRealtimeLobbyForTests(code)).toBeUndefined();
      expect(lobby.expiresAt).toBe(deadline);
      expect(lobby.players).toHaveLength(2);
      expect(lobby.rolls).toHaveLength(0);
      for (const socket of [dm, player]) {
        const bound = server.io.sockets.sockets.get(socket.id!)!;
        expect([...bound.rooms]).toEqual([socket.id]);
        expect(bound.data.playerId).toBeUndefined();
      }
    }
  );

  it("accepts a roll just before the deadline and renews the session", async () => {
    const dm = await connectClient(server.url);
    const created = await createSession(dm);
    const code = created.state.code;
    const lobby = __getRealtimeLobbyForTests(code)!;
    const deadline = Date.now() + 1000;
    lobby.expiresAt = deadline;
    vi.spyOn(Date, "now").mockReturnValue(deadline - 1);

    const result = await emitAck(dm, "roll:start", {
      code, terms: [{ quantity: 1, sides: 20 }], modifier: 0
    });

    expect(result.ok).toBe(true);
    expect(lobby.expiresAt).toBe(deadline - 1 + SECURITY_LIMITS.lobbySessionDurationMs);
  });

  it("prunes sessions at the exact deadline", async () => {
    const dm = await connectClient(server.url);
    const created = await createSession(dm);
    const closed = onceSocketEvent(dm, "lobby:closed");
    pruneExpiredLobbies(created.state.expiresAt);
    await expect(closed).resolves.toEqual({ code: created.state.code, reason: "expired" });
    expect(__getRealtimeLobbyForTests(created.state.code)).toBeUndefined();
  });

  it("does not commit a delayed roll to a lobby that has since expired", async () => {
    const dm = await connectClient(server.url);
    const created = await createSession(dm);
    const code = created.state.code;
    const lobby = __getRealtimeLobbyForTests(code)!;
    const committed = vi.fn();
    dm.on("roll:committed", committed);
    const closed = onceSocketEvent(dm, "lobby:closed");
    await emitAck(dm, "roll:start", { code, terms: [{ quantity: 1, sides: 20 }], modifier: 0 });
    lobby.expiresAt = Date.now() - 1;

    await expect(closed).resolves.toEqual({ code, reason: "expired" });
    expect(committed).not.toHaveBeenCalled();
    expect(lobby.rolls).toHaveLength(0);
  });

  it("clears pending public and private rolls while allowing subsequent rolls", async () => {
    const dm = await connectClient(server.url);
    const created = await createSession(dm);
    const code = created.state.code;
    const player = await connectClient(server.url);
    await joinSession(player, code);
    const dmCommits = vi.fn();
    const playerCommits = vi.fn();
    dm.on("roll:committed", dmCommits);
    player.on("roll:committed", playerCommits);
    for (const visibility of ["public", "dm"]) {
      expect((await emitAck(dm, "roll:start", {
        code, terms: [{ quantity: 1, sides: 20 }], modifier: 0, visibility
      })).ok).toBe(true);
    }
    const notifications = [dm, player].map(socket => onceSocketEvent(socket, "rolls:cleared"));
    expect((await emitAck(dm, "host:clearLog", { code })).ok).toBe(true);
    for (const notification of notifications) {
      await expect(notification).resolves.toEqual({ code });
    }
    const committed = onceSocketEvent<{ id: string }>(dm, "roll:committed");
    const next = await emitAck<{ rollId: string }>(dm, "roll:start", {
      code, terms: [{ quantity: 1, sides: 6 }], modifier: 3
    });
    if (!next.ok) throw new Error(next.error);

    expect((await committed).id).toBe(next.data.rollId);
    await vi.waitFor(() => expect(playerCommits).toHaveBeenCalledTimes(1));
    expect(dmCommits).toHaveBeenCalledTimes(1);
    expect(playerCommits.mock.calls[0][0].id).toBe(next.data.rollId);
    const lobby = __getRealtimeLobbyForTests(code)!;
    expect(lobby.rolls.map(roll => roll.id)).toEqual([next.data.rollId]);
    expect(lobby.privateRolls).toHaveLength(0);
  });

  it("clearing one lobby does not cancel another lobby's pending roll", async () => {
    const first = await connectClient(server.url);
    const firstSession = await createSession(first);
    const second = await connectClient(server.url);
    const secondSession = await createSession(second);
    const committed = onceSocketEvent<{ id: string }>(second, "roll:committed");
    const roll = await emitAck<{ rollId: string }>(second, "roll:start", {
      code: secondSession.state.code, terms: [{ quantity: 1, sides: 20 }], modifier: 0
    });
    if (!roll.ok) throw new Error(roll.error);
    await emitAck(first, "host:clearLog", { code: firstSession.state.code });
    expect((await committed).id).toBe(roll.data.rollId);
    expect(__getRealtimeLobbyForTests(secondSession.state.code)!.rolls).toHaveLength(1);
  });

  it("keeps a renewed lobby and its DM identity after a long DM absence", async () => {
    const dm = await connectClient(server.url);
    const created = await createSession(dm);
    const code = created.state.code;
    const player = await connectClient(server.url);
    await joinSession(player, code);
    expect((await emitAck(dm, "lobby:leave", {})).ok).toBe(true);
    const lobby = __getRealtimeLobbyForTests(code)!;
    lobby.players[0].disconnectedAt = Date.now() - SECURITY_LIMITS.disconnectedPlayerTtlMs - 1;
    lobby.expiresAt = Date.now() + 1000;

    expect((await emitAck(player, "roll:start", {
      code, terms: [{ quantity: 1, sides: 20 }], modifier: 0
    })).ok).toBe(true);
    pruneExpiredLobbies();

    expect(__getRealtimeLobbyForTests(code)).toBe(lobby);
    expect(lobby.players[0].id).toBe(created.player.id);
    expect(lobby.expiresAt).toBeGreaterThan(Date.now() + 59 * 60 * 1000);
    const resumed = await joinSession(dm, code, created);
    expect(resumed.player.isHost).toBe(true);
  });

  it("restores the same identity after reconnecting and permits rolls", async () => {
    const dm = await connectClient(server.url);
    const created = await createSession(dm);
    dm.disconnect();
    await vi.waitFor(() => expect(__getRealtimeLobbyForTests(created.state.code)!.players[0].connected).toBe(false));
    const reconnected = await connectClient(server.url);
    const resumed = await joinSession(reconnected, created.state.code, created);

    expect(resumed.player.id).toBe(created.player.id);
    expect(resumed.player.diceColor).toBe(created.player.diceColor);
    expect(resumed.state.players).toHaveLength(1);
    expect(resumed.sessionToken).toBe(created.sessionToken);
    // Retrying with credentials from before a lost response must also succeed.
    expect((await joinSession(reconnected, created.state.code, created)).player.id).toBe(created.player.id);
    expect((await emitAck(reconnected, "roll:start", {
      code: created.state.code, terms: [{ quantity: 1, sides: 20 }], modifier: 0
    })).ok).toBe(true);
  });

  it("rejects invalid resume credentials without adding or binding a player", async () => {
    const dm = await connectClient(server.url);
    const created = await createSession(dm);
    const stranger = await connectClient(server.url);
    for (const credentials of [
      {},
      { playerId: created.player.id, sessionToken: "wrong" },
      { playerId: "missing-player", sessionToken: created.sessionToken }
    ]) {
      const result = await emitAck(stranger, "lobby:join", {
        code: created.state.code, username: "Alice", resumeOnly: true, ...credentials
      });
      expect(result.ok).toBe(false);
    }
    expect(__getRealtimeLobbyForTests(created.state.code)!.players).toHaveLength(1);
    expect(server.io.sockets.sockets.get(stranger.id!)!.data.playerId).toBeUndefined();
  });

  it("leaves both rooms, retains identity, and receives no subsequent roll or state", async () => {
    const dm = await connectClient(server.url);
    const created = await createSession(dm);
    const code = created.state.code;
    const player = await connectClient(server.url);
    const joined = await joinSession(player, code);
    expect((await emitAck(player, "lobby:leave", { playerId: created.player.id })).ok).toBe(true);
    const bound = server.io.sockets.sockets.get(player.id!)!;
    expect([...bound.rooms]).toEqual([player.id]);
    expect(bound.data.playerId).toBeUndefined();
    const lobby = __getRealtimeLobbyForTests(code)!;
    expect(lobby.players.find(p => p.id === joined.player.id)?.connected).toBe(false);
    expect(lobby.players[0].connected).toBe(true);
    const received = vi.fn();
    player.on("lobby:state", received);
    player.on("roll:start", received);
    player.on("roll:committed", received);
    const committed = onceSocketEvent(dm, "roll:committed");
    await emitAck(dm, "roll:start", { code, terms: [{ quantity: 1, sides: 20 }], modifier: 0 });
    await committed;
    expect(received).not.toHaveBeenCalled();
    expect((await joinSession(player, code, joined)).player.id).toBe(joined.player.id);
  });

  it("updates old lobby presence when the same connection switches lobbies", async () => {
    const dm = await connectClient(server.url);
    const first = await createSession(dm);
    const second = await createSession(dm);
    const oldLobby = __getRealtimeLobbyForTests(first.state.code)!;
    expect(oldLobby.players[0].connected).toBe(false);
    expect(oldLobby.players[0].disconnectedAt).toEqual(expect.any(Number));
    const bound = server.io.sockets.sockets.get(dm.id!)!;
    expect(bound.rooms.has(first.state.code)).toBe(false);
    expect(bound.rooms.has(`${first.state.code}:player:${first.player.id}`)).toBe(false);
    expect(bound.rooms.has(second.state.code)).toBe(true);
  });

  it("keeps a player online until their last connection leaves or disconnects", async () => {
    const dm = await connectClient(server.url);
    const created = await createSession(dm);
    const first = await connectClient(server.url);
    const joined = await joinSession(first, created.state.code);
    const second = await connectClient(server.url);
    await joinSession(second, created.state.code, joined);
    await emitAck(first, "lobby:leave", {});
    const player = __getRealtimeLobbyForTests(created.state.code)!.players.find(p => p.id === joined.player.id)!;
    expect(player.connected).toBe(true);
    expect(player.disconnectedAt).toBeUndefined();
    second.disconnect();
    await vi.waitFor(() => expect(player.connected).toBe(false));
    expect(player.disconnectedAt).toEqual(expect.any(Number));
  });

  it("removes all connections for a player before broadcasting state", async () => {
    const dm = await connectClient(server.url);
    const created = await createSession(dm);
    const code = created.state.code;
    const first = await connectClient(server.url);
    const joined = await joinSession(first, code);
    const second = await connectClient(server.url);
    await joinSession(second, code, joined);
    const notifications = [first, second].map(socket => onceSocketEvent(socket, "player:removed"));
    const received = vi.fn();
    for (const socket of [first, second]) {
      let removed = false;
      socket.once("player:removed", () => { removed = true; });
      for (const event of ["lobby:state", "roll:start", "roll:committed"]) {
        socket.on(event, (...args) => { if (removed) received(...args); });
      }
    }
    expect((await emitAck(dm, "host:removePlayer", { code, playerId: joined.player.id })).ok).toBe(true);
    for (const notification of notifications) {
      await expect(notification).resolves.toEqual({ code, playerId: joined.player.id });
    }
    for (const socket of [first, second]) {
      const bound = server.io.sockets.sockets.get(socket.id!)!;
      expect([...bound.rooms]).toEqual([socket.id]);
      expect(bound.data.playerId).toBeUndefined();
      expect((await emitAck(socket, "roll:start", {
        code, terms: [{ quantity: 1, sides: 20 }], modifier: 0
      })).ok).toBe(false);
    }
    const committed = onceSocketEvent(dm, "roll:committed");
    await emitAck(dm, "roll:start", { code, terms: [{ quantity: 1, sides: 20 }], modifier: 0 });
    await committed;
    expect(received).not.toHaveBeenCalled();
    const invalidResume = await emitAck(first, "lobby:join", {
      code, username: "Alice", playerId: joined.player.id, sessionToken: joined.sessionToken, resumeOnly: true
    });
    expect(invalidResume.ok).toBe(false);
    expect((await joinSession(first, code)).player.id).not.toBe(joined.player.id);
  });

  it("rejects malformed socket dice requests and remains usable", async () => {
    const dm = await connectClient(server.url);
    const created = await createSession(dm);
    const code = created.state.code;
    for (const request of [
      { terms: [null], modifier: 0 },
      { terms: [[]], modifier: 0 },
      { terms: [{ quantity: 1 }], modifier: 0 },
      { terms: [{ quantity: {}, sides: 20 }], modifier: 0 },
      { terms: [{ quantity: 1, sides: 20 }], modifier: null }
    ]) {
      expect((await emitAck(dm, "roll:start", { code, ...request })).ok).toBe(false);
    }
    expect((await emitAck(dm, "roll:start", {
      code, terms: [{ quantity: 1, sides: 20 }], modifier: -2, visibility: "dm"
    })).ok).toBe(true);
  });

  it("creates lobbies with server-issued player IDs and private session tokens", async () => {
    const dm = await connectClient(server.url);
    const response = await emitAck<{
      sessionToken: string;
      player: { id: string; username: string; sessionTokenHash?: string };
      state: { code: string; players: Array<{ id: string; sessionTokenHash?: string }> };
    }>(dm, "lobby:create", { username: "DM" });

    expect(response.ok).toBe(true);
    if (!response.ok) {
      return;
    }

    expect(response.data.player.id).toEqual(expect.any(String));
    expect(response.data.sessionToken).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect(response.data.player.sessionTokenHash).toBeUndefined();
    expect(response.data.state.players[0].sessionTokenHash).toBeUndefined();
  });

  it("does not reconnect an existing player when the session token is wrong", async () => {
    const dm = await connectClient(server.url);
    const create = await emitAck<{
      state: { code: string };
    }>(dm, "lobby:create", { username: "DM" });
    expect(create.ok).toBe(true);
    if (!create.ok) {
      return;
    }

    const alice = await connectClient(server.url);
    const firstJoin = await emitAck<{
      sessionToken: string;
      player: { id: string };
    }>(alice, "lobby:join", {
      code: create.data.state.code,
      username: "Alice"
    });
    expect(firstJoin.ok).toBe(true);
    if (!firstJoin.ok) {
      return;
    }

    const attacker = await connectClient(server.url);
    const impersonation = await emitAck<{
      player: { id: string };
    }>(attacker, "lobby:join", {
      code: create.data.state.code,
      username: "Mallory",
      playerId: firstJoin.data.player.id,
      sessionToken: "wrong-token"
    });

    expect(impersonation.ok).toBe(true);
    if (!impersonation.ok) {
      return;
    }
    expect(impersonation.data.player.id).not.toBe(firstJoin.data.player.id);
  });

  it("rejects host actions from non-host sockets even when they send the host ID", async () => {
    const dm = await connectClient(server.url);
    const create = await emitAck<{
      player: { id: string };
      state: { code: string };
    }>(dm, "lobby:create", { username: "DM" });
    expect(create.ok).toBe(true);
    if (!create.ok) {
      return;
    }

    const player = await connectClient(server.url);
    const join = await emitAck(player, "lobby:join", {
      code: create.data.state.code,
      username: "Alice"
    });
    expect(join.ok).toBe(true);

    const clear = await emitAck(player, "host:clearLog", {
      code: create.data.state.code,
      playerId: create.data.player.id
    });
    expect(clear.ok).toBe(false);

    const remove = await emitAck(player, "host:removePlayer", {
      code: create.data.state.code,
      hostId: create.data.player.id,
      playerId: create.data.player.id
    });
    expect(remove.ok).toBe(false);
  });

  it("allows host actions only from the host socket identity", async () => {
    const dm = await connectClient(server.url);
    const create = await emitAck<{
      state: { code: string };
    }>(dm, "lobby:create", { username: "DM" });
    expect(create.ok).toBe(true);
    if (!create.ok) {
      return;
    }

    const player = await connectClient(server.url);
    const join = await emitAck<{
      player: { id: string };
    }>(player, "lobby:join", {
      code: create.data.state.code,
      username: "Alice"
    });
    expect(join.ok).toBe(true);
    if (!join.ok) {
      return;
    }

    const clear = await emitAck(dm, "host:clearLog", {
      code: create.data.state.code
    });
    expect(clear.ok).toBe(true);

    const remove = await emitAck(dm, "host:removePlayer", {
      code: create.data.state.code,
      playerId: join.data.player.id
    });
    expect(remove.ok).toBe(true);
  });

  it("rolls as the socket-bound player even if the client sends another player ID", async () => {
    const dm = await connectClient(server.url);
    const create = await emitAck<{
      state: { code: string };
    }>(dm, "lobby:create", { username: "DM" });
    expect(create.ok).toBe(true);
    if (!create.ok) {
      return;
    }

    const alice = await connectClient(server.url);
    const aliceJoin = await emitAck<{
      player: { id: string };
    }>(alice, "lobby:join", {
      code: create.data.state.code,
      username: "Alice"
    });
    expect(aliceJoin.ok).toBe(true);
    if (!aliceJoin.ok) {
      return;
    }

    const mallory = await connectClient(server.url);
    const malloryJoin = await emitAck<{
      player: { id: string };
    }>(mallory, "lobby:join", {
      code: create.data.state.code,
      username: "Mallory"
    });
    expect(malloryJoin.ok).toBe(true);
    if (!malloryJoin.ok) {
      return;
    }

    const committed = onceSocketEvent<{ playerId: string }>(mallory, "roll:committed");
    const roll = await emitAck(mallory, "roll:start", {
      code: create.data.state.code,
      playerId: aliceJoin.data.player.id,
      terms: [{ quantity: 1, sides: 20 }],
      modifier: 0
    });

    expect(roll.ok).toBe(true);
    expect((await committed).playerId).toBe(malloryJoin.data.player.id);
  });

  it("limits the number of players in a lobby", async () => {
    const dm = await connectClient(server.url);
    const create = await emitAck<{
      state: { code: string };
    }>(dm, "lobby:create", { username: "DM" });
    expect(create.ok).toBe(true);
    if (!create.ok) {
      return;
    }

    for (let index = 1; index < 12; index += 1) {
      const player = await connectClient(server.url);
      const join = await emitAck(player, "lobby:join", {
        code: create.data.state.code,
        username: `Player ${index}`
      });
      expect(join.ok).toBe(true);
    }

    const extraPlayer = await connectClient(server.url);
    const fullJoin = await emitAck(extraPlayer, "lobby:join", {
      code: create.data.state.code,
      username: "Player 13"
    });

    expect(fullJoin.ok).toBe(false);
  });

  it("prunes idle lobbies and stale disconnected players", () => {
    const now = 1_000_000;
    const idleLobby = createLobby("IDLE01", {
      id: "idle-host",
      username: "Idle DM",
      sessionTokenHash: "hash"
    });
    idleLobby.expiresAt = now - 1;
    __setRealtimeLobbyForTests(idleLobby);

    const activeLobby = createLobby("LIVE01", {
      id: "live-host",
      username: "Live DM",
      sessionTokenHash: "hash"
    });
    addOrReconnectPlayer(activeLobby, {
      id: "stale-player",
      username: "Stale",
      sessionTokenHash: "hash"
    });
    activeLobby.players[1].connected = false;
    activeLobby.players[1].disconnectedAt = now - SECURITY_LIMITS.disconnectedPlayerTtlMs - 1;
    activeLobby.updatedAt = now;
    __setRealtimeLobbyForTests(activeLobby);

    pruneExpiredLobbies(now);

    expect(__getRealtimeLobbyStateForTests("IDLE01")).toBeUndefined();
    expect(__getRealtimeLobbyStateForTests("LIVE01")?.players).toHaveLength(1);
  });

  it("creates lobbies with a 60 minute session expiry", async () => {
    const dm = await connectClient(server.url);
    const beforeCreate = Date.now();
    const response = await emitAck<{
      state: { expiresAt: number };
    }>(dm, "lobby:create", { username: "DM" });
    const afterCreate = Date.now();

    expect(response.ok).toBe(true);
    if (!response.ok) {
      return;
    }

    expect(response.data.state.expiresAt).toBeGreaterThanOrEqual(beforeCreate + SECURITY_LIMITS.lobbySessionDurationMs);
    expect(response.data.state.expiresAt).toBeLessThanOrEqual(afterCreate + SECURITY_LIMITS.lobbySessionDurationMs);
  });

  it("does not extend the lobby session when players join", async () => {
    const dm = await connectClient(server.url);
    const create = await emitAck<{
      state: { code: string; expiresAt: number };
    }>(dm, "lobby:create", { username: "DM" });
    expect(create.ok).toBe(true);
    if (!create.ok) {
      return;
    }

    const player = await connectClient(server.url);
    const join = await emitAck<{
      state: { expiresAt: number };
    }>(player, "lobby:join", {
      code: create.data.state.code,
      username: "Alice"
    });

    expect(join.ok).toBe(true);
    if (!join.ok) {
      return;
    }
    expect(join.data.state.expiresAt).toBe(create.data.state.expiresAt);
  });

  it("extends the lobby session when a player rolls dice", async () => {
    const dm = await connectClient(server.url);
    const create = await emitAck<{
      state: { code: string; expiresAt: number };
    }>(dm, "lobby:create", { username: "DM" });
    expect(create.ok).toBe(true);
    if (!create.ok) {
      return;
    }

    const state = __getRealtimeLobbyStateForTests(create.data.state.code);
    expect(state).toBeDefined();
    const nearExpiry = Date.now() + 5 * 60 * 1000;
    const lobby = __getRealtimeLobbyForTests(create.data.state.code);
    expect(lobby).toBeDefined();
    if (!lobby) {
      return;
    }
    lobby.expiresAt = nearExpiry;

    const roll = await emitAck(dm, "roll:start", {
      code: create.data.state.code,
      terms: [{ quantity: 1, sides: 20 }],
      modifier: 0
    });

    expect(roll.ok).toBe(true);
    expect(__getRealtimeLobbyStateForTests(create.data.state.code)?.expiresAt).toBeGreaterThan(nearExpiry);
  });

  it("allows only the host to renew the lobby session", async () => {
    const dm = await connectClient(server.url);
    const create = await emitAck<{
      state: { code: string; expiresAt: number };
    }>(dm, "lobby:create", { username: "DM" });
    expect(create.ok).toBe(true);
    if (!create.ok) {
      return;
    }

    const player = await connectClient(server.url);
    const join = await emitAck(player, "lobby:join", {
      code: create.data.state.code,
      username: "Alice"
    });
    expect(join.ok).toBe(true);

    const lobby = __getRealtimeLobbyForTests(create.data.state.code);
    expect(lobby).toBeDefined();
    if (!lobby) {
      return;
    }
    const nearExpiry = Date.now() + 5 * 60 * 1000;
    lobby.expiresAt = nearExpiry;

    const denied = await emitAck(player, "host:renewSession", {
      code: create.data.state.code
    });
    expect(denied.ok).toBe(false);

    const renewed = await emitAck<{ expiresAt: number }>(dm, "host:renewSession", {
      code: create.data.state.code
    });
    expect(renewed.ok).toBe(true);
    if (!renewed.ok) {
      return;
    }
    expect(renewed.data.expiresAt).toBeGreaterThan(nearExpiry);
  });

  it("notifies connected players when an expired lobby closes", async () => {
    const dm = await connectClient(server.url);
    const create = await emitAck<{
      state: { code: string };
    }>(dm, "lobby:create", { username: "DM" });
    expect(create.ok).toBe(true);
    if (!create.ok) {
      return;
    }

    const closed = onceSocketEvent<{ code: string; reason: string }>(dm, "lobby:closed");
    const lobby = __getRealtimeLobbyForTests(create.data.state.code);
    expect(lobby).toBeDefined();
    if (!lobby) {
      return;
    }
    lobby.expiresAt = Date.now() - 1;

    pruneExpiredLobbies(Date.now());

    await expect(closed).resolves.toEqual({ code: create.data.state.code, reason: "expired" });
    expect(__getRealtimeLobbyStateForTests(create.data.state.code)).toBeUndefined();
    const bound = server.io.sockets.sockets.get(dm.id!)!;
    expect([...bound.rooms]).toEqual([dm.id]);
    expect(bound.data.playerId).toBeUndefined();
  });

  it("notifies and unsubscribes players if a lobby has lost its host record", async () => {
    const dm = await connectClient(server.url);
    const created = await createSession(dm);
    const code = created.state.code;
    const lobby = __getRealtimeLobbyForTests(code)!;
    lobby.players = [];
    const closed = onceSocketEvent(dm, "lobby:closed");
    pruneExpiredLobbies();
    await expect(closed).resolves.toEqual({ code, reason: "closed" });
    expect(__getRealtimeLobbyForTests(code)).toBeUndefined();
    const bound = server.io.sockets.sockets.get(dm.id!)!;
    expect([...bound.rooms]).toEqual([dm.id]);
    expect(bound.data.playerId).toBeUndefined();
  });

  it("rejects lobby creation when the active lobby limit is reached", async () => {
    for (let index = 0; index < SECURITY_LIMITS.maxActiveLobbies; index += 1) {
      __setRealtimeLobbyForTests(
        createLobby(testCode(index), {
          id: `host-${index}`,
          username: `DM ${index}`,
          sessionTokenHash: "hash"
        })
      );
    }
    expect(__getRealtimeLobbyCountForTests()).toBe(SECURITY_LIMITS.maxActiveLobbies);

    const dm = await connectClient(server.url);
    const response = await emitAck(dm, "lobby:create", { username: "Overflow DM" });

    expect(response.ok).toBe(false);
  });
});
