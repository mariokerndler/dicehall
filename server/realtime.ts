import { randomUUID } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import { createClientAddressResolver } from "../lib/client-address";
import { Server, type Socket } from "socket.io";
import { createRoll, validateRollRequest, type DiceTerm, type RollVisibility } from "../lib/dice";
import {
  addOrReconnectPlayer,
  addPrivateRoll,
  addRoll,
  cleanUsername,
  clearRolls,
  createLobby,
  extendLobbySession,
  generateLobbyCode,
  isValidLobbyCode,
  LOBBY_SESSION_DURATION_MS,
  markPlayerDisconnected,
  normalizeLobbyCode,
  removePlayer,
  toLobbyState,
  type Lobby,
  type LobbyPlayer,
  type Player
} from "../lib/lobby";
import { isAllowedSocketOrigin, parseAllowedOrigins } from "../lib/origin";
import { FixedWindowRateLimiter, type RateLimitRule } from "../lib/rate-limit";
import { createSessionToken, hashSessionToken, verifySessionToken } from "../lib/security";

type Ack<T = unknown> = (response: { ok: true; data: T } | { ok: false; error: string; retryable?: boolean }) => void;

type CreateLobbyPayload = {
  username: string;
};

type JoinLobbyPayload = CreateLobbyPayload & {
  code: string;
  playerId?: string;
  sessionToken?: string;
  resumeOnly?: boolean;
};

type RollPayload = {
  code: string;
  terms: DiceTerm[];
  modifier: number;
  visibility?: RollVisibility;
};

type PlayerSessionResponse = {
  state: ReturnType<typeof toLobbyState>;
  player: Player;
  sessionToken: string;
};

type SocketLobbyPlayerResult =
  | { ok: true; lobby: Lobby; player: LobbyPlayer }
  | { ok: false; error: string };

export const SECURITY_LIMITS = {
  maxActiveLobbies: 500,
  maxPlayersPerLobby: 12,
  lobbySessionDurationMs: LOBBY_SESSION_DURATION_MS,
  disconnectedPlayerTtlMs: 30 * 60 * 1000,
  pruneIntervalMs: 5 * 60 * 1000,
  createLobbyRate: { limit: 5, windowMs: 60 * 1000 },
  joinLobbyRate: { limit: 60, windowMs: 60 * 1000 },
  rollRate: { limit: 30, windowMs: 60 * 1000 },
  hostActionRate: { limit: 20, windowMs: 60 * 1000 },
  connectionRate: { limit: 60, windowMs: 60 * 1000 },
  requestRate: { limit: 600, windowMs: 60 * 1000 },
  maxConnectionsPerAddress: 48,
  maxConnections: 6000
} as const;

const lobbies = new Map<string, Lobby>();
const rollLogVersions = new WeakMap<Lobby, number>();
// shortcut: limits apply to one server process; use a shared limiter before running multiple instances.
const rateLimiter = new FixedWindowRateLimiter();
let realtimeServer: Server | undefined;

const pruneInterval = setInterval(() => {
  pruneExpiredLobbies();
  rateLimiter.prune();
}, SECURITY_LIMITS.pruneIntervalMs);

pruneInterval.unref?.();

function emitLobbyState(io: Server, lobby: Lobby) {
  io.to(lobby.code).emit("lobby:state", toLobbyState(lobby));
  for (const player of lobby.players) {
    io.to(playerRoom(lobby.code, player.id)).emit("lobby:state", toLobbyState(lobby, player.id));
  }
}

function getLobby(code: string): Lobby | undefined {
  const lobby = lobbies.get(normalizeLobbyCode(code));
  if (lobby && Date.now() >= lobby.expiresAt) {
    closeLobby(lobby, "expired");
    return undefined;
  }
  return lobby;
}

function closeLobby(lobby: Lobby, reason: "expired" | "closed") {
  realtimeServer?.to(lobby.code).emit("lobby:closed", { code: lobby.code, reason });
  lobbies.delete(lobby.code);
  const subscribers = realtimeServer?.sockets.adapter.rooms.get(lobby.code);
  for (const socketId of [...(subscribers ?? [])]) {
    const socket = realtimeServer?.sockets.sockets.get(socketId);
    if (socket) {
      unbindSocketFromPlayer(socket);
    }
  }
}

function getPlayer(lobby: Lobby, playerId: string) {
  return lobby.players.find((player) => player.id === playerId);
}

function requireHost(lobby: Lobby, playerId: string): string | null {
  return lobby.hostId === playerId ? null : "Only the DM can use that control.";
}

function playerRoom(code: string, playerId: string): string {
  return `${code}:player:${playerId}`;
}

function publicPlayer(lobby: Lobby, playerId: string): Player {
  const player = toLobbyState(lobby, playerId).players.find((candidate) => candidate.id === playerId);

  if (!player) {
    throw new Error("Expected player to exist in lobby state.");
  }

  return player;
}

function playerSessionResponse(lobby: Lobby, playerId: string, sessionToken: string): PlayerSessionResponse {
  return {
    state: toLobbyState(lobby, playerId),
    player: publicPlayer(lobby, playerId),
    sessionToken
  };
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isAllowed(
  socket: Socket,
  eventName: string,
  rule: RateLimitRule,
  ack?: (response: { ok: false; error: string; retryable?: boolean }) => void
): boolean {
  const playerId = readString(socket.data.playerId);
  const usePlayerLimit = eventName === "roll:start" || eventName.startsWith("host:");
  const identity = usePlayerLimit && playerId
    ? `player:${playerId}`
    : `address:${socket.data.clientAddress}`;
  const key = `${identity}:${eventName}`;

  if (rateLimiter.check(key, rule)) {
    return true;
  }

  ack?.({ ok: false, error: "Too many requests. Try again soon.", retryable: true });
  return false;
}

function unbindSocketFromPlayer(socket: Socket) {
  const code = readString(socket.data.lobbyCode);
  const playerId = readString(socket.data.playerId);
  delete socket.data.lobbyCode;
  delete socket.data.playerId;

  if (!code || !playerId) {
    return;
  }

  socket.leave(code);
  socket.leave(playerRoom(code, playerId));
  const lobby = lobbies.get(code);
  const io = socket.nsp.server;

  if (lobby && !socket.nsp.adapter.rooms.get(playerRoom(code, playerId))?.size) {
    markPlayerDisconnected(lobby, playerId);
    emitLobbyState(io, lobby);
  }
}

function bindSocketToPlayer(socket: Socket, lobby: Lobby, playerId: string) {
  const previousCode = readString(socket.data.lobbyCode);
  const previousPlayerId = readString(socket.data.playerId);

  if (previousCode && (previousCode !== lobby.code || previousPlayerId !== playerId)) {
    unbindSocketFromPlayer(socket);
  }

  socket.join(lobby.code);
  socket.join(playerRoom(lobby.code, playerId));
  socket.data.lobbyCode = lobby.code;
  socket.data.playerId = playerId;
}

function getSocketLobbyPlayer(socket: Socket, code: string): SocketLobbyPlayerResult {
  const normalizedCode = normalizeLobbyCode(code);
  const playerId = readString(socket.data.playerId);
  const lobbyCode = readString(socket.data.lobbyCode);

  if (!playerId || lobbyCode !== normalizedCode) {
    return { ok: false, error: "Join the lobby before using that control." };
  }

  const lobby = getLobby(normalizedCode);

  if (!lobby) {
    return { ok: false, error: "Lobby no longer exists." };
  }

  const player = getPlayer(lobby, playerId);

  if (!player) {
    return { ok: false, error: "Join the lobby before using that control." };
  }

  return { ok: true, lobby, player };
}

export function pruneExpiredLobbies(now = Date.now()): void {
  for (const lobby of lobbies.values()) {
    if (now >= lobby.expiresAt || !getPlayer(lobby, lobby.hostId)) {
      closeLobby(lobby, now >= lobby.expiresAt ? "expired" : "closed");
      continue;
    }

    lobby.players = lobby.players.filter((player) => {
      if (player.connected || player.isHost || !player.disconnectedAt) {
        return true;
      }

      return now - player.disconnectedAt <= SECURITY_LIMITS.disconnectedPlayerTtlMs;
    });
  }
}

export function __resetRealtimeStateForTests(): void {
  lobbies.clear();
  rateLimiter.clear();
}

export function __setRealtimeLobbyForTests(lobby: Lobby): void {
  lobbies.set(lobby.code, lobby);
}

export function __getRealtimeLobbyCountForTests(): number {
  return lobbies.size;
}

export function __getRealtimeLobbyForTests(code: string): Lobby | undefined {
  return lobbies.get(normalizeLobbyCode(code));
}

export function __getRealtimeLobbyStateForTests(code: string, viewerId?: string): ReturnType<typeof toLobbyState> | undefined {
  const lobby = lobbies.get(normalizeLobbyCode(code));
  return lobby ? toLobbyState(lobby, viewerId) : undefined;
}

export function attachRealtimeServer(httpServer: HttpServer, getClientAddress = createClientAddressResolver()) {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        const allowedOrigins = parseAllowedOrigins();
        callback(null, !origin || isAllowedSocketOrigin({ origin, allowedOrigins }));
      }
    },
    allowRequest: (req, callback) => {
      const allowedOrigins = parseAllowedOrigins();
      const allowed = isAllowedSocketOrigin({
        origin: req.headers.origin,
        host: req.headers.host,
        allowedOrigins
      });

      callback(null, allowed);
    }
  });
  realtimeServer = io;
  const connectionsByAddress = new Map<string, number>();
  let connectionCount = 0;

  io.use((socket, next) => {
    const address = getClientAddress(socket.request);
    socket.data.clientAddress = address;
    const connections = connectionsByAddress.get(address) ?? 0;
    if (connectionCount >= SECURITY_LIMITS.maxConnections ||
        connections >= SECURITY_LIMITS.maxConnectionsPerAddress ||
        !rateLimiter.check(`address:${address}:connect`, SECURITY_LIMITS.connectionRate)) {
      next(new Error("Too many connections. Try again soon."));
      return;
    }
    // Reserve admission before Socket.IO finishes connecting, including transports that close early.
    connectionsByAddress.set(address, connections + 1);
    connectionCount += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      const remaining = (connectionsByAddress.get(address) ?? 0) - 1;
      if (remaining > 0) connectionsByAddress.set(address, remaining);
      else connectionsByAddress.delete(address);
      connectionCount -= 1;
      socket.conn.off("close", release);
      socket.off("disconnect", release);
    };
    socket.conn.once("close", release);
    socket.once("disconnect", release);
    next();
  });

  io.on("connection", (socket) => {
    socket.use((packet, next) => {
      if (packet.length > 3 || (packet.length === 3 && typeof packet[2] !== "function")) {
        socket.disconnect(true);
        return;
      }
      if (!rateLimiter.check(`address:${socket.data.clientAddress}:requests`, SECURITY_LIMITS.requestRate)) {
        const ack = packet[2] as Ack | undefined;
        ack?.({ ok: false, error: "Too many requests. Try again soon.", retryable: true });
        return;
      }
      next();
    });

    socket.on("lobby:create", (payload: CreateLobbyPayload, ack?: Ack<PlayerSessionResponse>) => {
      if (!isAllowed(socket, "lobby:create", SECURITY_LIMITS.createLobbyRate, ack)) {
        return;
      }

      pruneExpiredLobbies();
      const username = cleanUsername(readString(payload?.username));

      if (!username) {
        ack?.({ ok: false, error: "Choose a username before creating a lobby." });
        return;
      }

      if (lobbies.size >= SECURITY_LIMITS.maxActiveLobbies) {
        ack?.({ ok: false, error: "Dicehall is busy. Try again soon." });
        return;
      }

      const code = generateLobbyCode(new Set(lobbies.keys()));
      const playerId = randomUUID();
      const sessionToken = createSessionToken();
      const lobby = createLobby(code, {
        id: playerId,
        username,
        sessionTokenHash: hashSessionToken(sessionToken)
      });

      lobbies.set(code, lobby);
      bindSocketToPlayer(socket, lobby, playerId);
      ack?.({ ok: true, data: playerSessionResponse(lobby, playerId, sessionToken) });
      emitLobbyState(io, lobby);
    });

    socket.on("lobby:join", (payload: JoinLobbyPayload, ack?: Ack<PlayerSessionResponse>) => {
      if (!isAllowed(socket, "lobby:join", SECURITY_LIMITS.joinLobbyRate, ack)) {
        return;
      }

      pruneExpiredLobbies();
      const code = normalizeLobbyCode(readString(payload?.code));
      const username = cleanUsername(readString(payload?.username));

      if (!isValidLobbyCode(code)) {
        ack?.({ ok: false, error: "Enter a valid six-character lobby code." });
        return;
      }

      if (!username) {
        ack?.({ ok: false, error: "Enter a username before joining." });
        return;
      }

      const lobby = getLobby(code);

      if (!lobby) {
        ack?.({ ok: false, error: "No lobby was found for that code." });
        return;
      }

      const requestedPlayerId = readString(payload?.playerId);
      const existingPlayer = requestedPlayerId ? getPlayer(lobby, requestedPlayerId) : undefined;
      const canReconnect = existingPlayer
        ? verifySessionToken(readString(payload?.sessionToken), existingPlayer.sessionTokenHash)
        : false;
      const isNewPlayer = !canReconnect;

      if (payload?.resumeOnly && !canReconnect) {
        ack?.({ ok: false, error: "Your lobby session could not be restored. Join the lobby again." });
        return;
      }

      if (isNewPlayer && lobby.players.length >= SECURITY_LIMITS.maxPlayersPerLobby) {
        ack?.({ ok: false, error: "That lobby is full." });
        return;
      }

      const playerId = canReconnect && existingPlayer ? existingPlayer.id : randomUUID();
      // Retain authenticated credentials so a lost acknowledgement can be retried safely.
      const sessionToken = canReconnect ? readString(payload?.sessionToken) : createSessionToken();
      const player = addOrReconnectPlayer(lobby, {
        id: playerId,
        username,
        sessionTokenHash: hashSessionToken(sessionToken)
      });

      bindSocketToPlayer(socket, lobby, player.id);
      ack?.({
        ok: true,
        data: playerSessionResponse(lobby, player.id, sessionToken)
      });
      emitLobbyState(io, lobby);
    });

    socket.on("lobby:leave", (_payload: unknown, ack?: Ack) => {
      unbindSocketFromPlayer(socket);
      ack?.({ ok: true, data: null });
    });

    socket.on("roll:start", (payload: RollPayload, ack?: Ack) => {
      if (!isAllowed(socket, "roll:start", SECURITY_LIMITS.rollRate, ack)) {
        return;
      }

      const current = getSocketLobbyPlayer(socket, readString(payload?.code));

      if (!current.ok) {
        ack?.({ ok: false, error: current.error });
        return;
      }

      const validation = validateRollRequest({
        terms: payload?.terms,
        modifier: payload?.modifier
      });

      if (!validation.ok) {
        ack?.({ ok: false, error: validation.error });
        return;
      }

      const roll = createRoll({
        playerId: current.player.id,
        playerName: current.player.username,
        diceColor: current.player.diceColor,
        terms: validation.terms,
        modifier: validation.modifier,
        visibility: payload?.visibility === "dm" ? "dm" : "public"
      });

      const privateTargetRooms =
        roll.playerId === current.lobby.hostId
          ? [playerRoom(current.lobby.code, current.lobby.hostId)]
          : [playerRoom(current.lobby.code, current.lobby.hostId), playerRoom(current.lobby.code, roll.playerId)];
      const targetRooms = roll.visibility === "dm" ? privateTargetRooms : [current.lobby.code];
      extendLobbySession(current.lobby);

      let target = io.to(targetRooms[0]);
      for (const room of targetRooms.slice(1)) {
        target = target.to(room);
      }

      target.emit("roll:start", {
        code: current.lobby.code,
        id: roll.id,
        playerName: roll.playerName,
        diceColor: roll.diceColor,
        expression: roll.expression,
        visibility: roll.visibility
      });

      ack?.({ ok: true, data: { rollId: roll.id } });

      const logVersion = rollLogVersions.get(current.lobby);
      setTimeout(() => {
        const latestLobby = getLobby(current.lobby.code);

        if (latestLobby !== current.lobby || rollLogVersions.get(latestLobby) !== logVersion) {
          return;
        }

        if (roll.visibility === "dm") {
          addPrivateRoll(latestLobby, roll);
        } else {
          addRoll(latestLobby, roll);
        }

        let commitTarget = io.to(targetRooms[0]);
        for (const room of targetRooms.slice(1)) {
          commitTarget = commitTarget.to(room);
        }

        commitTarget.emit("roll:committed", { ...roll, code: current.lobby.code });
        emitLobbyState(io, latestLobby);
      }, 900);
    });

    socket.on("host:clearLog", (payload: { code: string }, ack?: Ack) => {
      if (!isAllowed(socket, "host:clearLog", SECURITY_LIMITS.hostActionRate, ack)) {
        return;
      }

      const current = getSocketLobbyPlayer(socket, readString(payload?.code));

      if (!current.ok) {
        ack?.({ ok: false, error: current.error });
        return;
      }

      const hostError = requireHost(current.lobby, current.player.id);

      if (hostError) {
        ack?.({ ok: false, error: hostError });
        return;
      }

      rollLogVersions.set(current.lobby, (rollLogVersions.get(current.lobby) ?? 0) + 1);
      clearRolls(current.lobby);
      io.to(current.lobby.code).emit("rolls:cleared", { code: current.lobby.code });
      ack?.({ ok: true, data: toLobbyState(current.lobby, current.player.id) });
      emitLobbyState(io, current.lobby);
    });

    socket.on("host:renewSession", (payload: { code: string }, ack?: Ack<ReturnType<typeof toLobbyState>>) => {
      if (!isAllowed(socket, "host:renewSession", SECURITY_LIMITS.hostActionRate, ack)) {
        return;
      }

      const current = getSocketLobbyPlayer(socket, readString(payload?.code));

      if (!current.ok) {
        ack?.({ ok: false, error: current.error });
        return;
      }

      const hostError = requireHost(current.lobby, current.player.id);

      if (hostError) {
        ack?.({ ok: false, error: hostError });
        return;
      }

      extendLobbySession(current.lobby);
      ack?.({ ok: true, data: toLobbyState(current.lobby, current.player.id) });
      emitLobbyState(io, current.lobby);
    });

    socket.on("host:removePlayer", (payload: { code: string; playerId: string }, ack?: Ack) => {
      if (!isAllowed(socket, "host:removePlayer", SECURITY_LIMITS.hostActionRate, ack)) {
        return;
      }

      const current = getSocketLobbyPlayer(socket, readString(payload?.code));

      if (!current.ok) {
        ack?.({ ok: false, error: current.error });
        return;
      }

      const hostError = requireHost(current.lobby, current.player.id);

      if (hostError) {
        ack?.({ ok: false, error: hostError });
        return;
      }

      const removed = removePlayer(current.lobby, readString(payload?.playerId));

      if (!removed) {
        ack?.({ ok: false, error: "That player could not be removed." });
        return;
      }

      const room = playerRoom(current.lobby.code, removed.id);
      io.to(room).emit("player:removed", { code: current.lobby.code, playerId: removed.id });
      for (const socketId of [...(io.sockets.adapter.rooms.get(room) ?? [])]) {
        const removedSocket = io.sockets.sockets.get(socketId);
        if (removedSocket) {
          unbindSocketFromPlayer(removedSocket);
        }
      }
      ack?.({ ok: true, data: toLobbyState(current.lobby, current.player.id) });
      emitLobbyState(io, current.lobby);
    });

    socket.on("disconnect", () => {
      unbindSocketFromPlayer(socket);
    });
  });

  return io;
}
