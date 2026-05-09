import { createServer, type Server as HttpServer } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { io as createClient, type Socket as ClientSocket } from "socket.io-client";
import { addOrReconnectPlayer, createLobby } from "../lib/lobby";
import {
  attachRealtimeServer,
  pruneExpiredLobbies,
  SECURITY_LIMITS,
  __getRealtimeLobbyCountForTests,
  __getRealtimeLobbyStateForTests,
  __resetRealtimeStateForTests,
  __setRealtimeLobbyForTests
} from "../server/realtime";

type Ack<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

type TestServer = {
  httpServer: HttpServer;
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
    url: `http://127.0.0.1:${address.port}`,
    close: async () => {
      io.close();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  };
}

async function connectClient(url: string): Promise<ClientSocket> {
  const socket = createClient(url, {
    path: "/socket.io",
    transports: ["polling"],
    forceNew: true
  });
  clients.push(socket);

  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });

  return socket;
}

function emitAck<T>(socket: ClientSocket, event: string, payload: unknown): Promise<Ack<T>> {
  return new Promise((resolve) => {
    socket.emit(event, payload, resolve);
  });
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
    for (const client of clients.splice(0)) {
      client.disconnect();
    }
    await server?.close();
    __resetRealtimeStateForTests();
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
    idleLobby.updatedAt = now - SECURITY_LIMITS.lobbyIdleTtlMs - 1;
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
