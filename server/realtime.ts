import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { createRoll, validateDiceRequest } from "../lib/dice";
import {
  addOrReconnectPlayer,
  addRoll,
  cleanUsername,
  clearRolls,
  createLobby,
  generateLobbyCode,
  isValidLobbyCode,
  markPlayerDisconnected,
  normalizeLobbyCode,
  removePlayer,
  toLobbyState,
  type Lobby
} from "../lib/lobby";

type Ack<T = unknown> = (response: { ok: true; data: T } | { ok: false; error: string }) => void;

type CreateLobbyPayload = {
  playerId: string;
  username: string;
};

type JoinLobbyPayload = CreateLobbyPayload & {
  code: string;
};

type RollPayload = {
  code: string;
  playerId: string;
  quantity: number;
  sides: number;
  modifier: number;
};

const lobbies = new Map<string, Lobby>();

function emitLobbyState(io: Server, lobby: Lobby) {
  io.to(lobby.code).emit("lobby:state", toLobbyState(lobby));
}

function getLobby(code: string): Lobby | undefined {
  return lobbies.get(normalizeLobbyCode(code));
}

function getPlayer(lobby: Lobby, playerId: string) {
  return lobby.players.find((player) => player.id === playerId);
}

function requireHost(lobby: Lobby, playerId: string): string | null {
  return lobby.hostId === playerId ? null : "Only the DM can use that control.";
}

export function attachRealtimeServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*"
    }
  });

  io.on("connection", (socket) => {
    socket.on("lobby:create", (payload: CreateLobbyPayload, ack?: Ack) => {
      const username = cleanUsername(payload.username);

      if (!payload.playerId || !username) {
        ack?.({ ok: false, error: "Choose a username before creating a lobby." });
        return;
      }

      const code = generateLobbyCode(new Set(lobbies.keys()));
      const lobby = createLobby(code, {
        id: payload.playerId,
        username
      });

      lobbies.set(code, lobby);
      socket.join(code);
      socket.data.lobbyCode = code;
      socket.data.playerId = payload.playerId;
      ack?.({ ok: true, data: toLobbyState(lobby) });
      emitLobbyState(io, lobby);
    });

    socket.on("lobby:join", (payload: JoinLobbyPayload, ack?: Ack) => {
      const code = normalizeLobbyCode(payload.code);
      const username = cleanUsername(payload.username);

      if (!isValidLobbyCode(code)) {
        ack?.({ ok: false, error: "Enter a valid six-character lobby code." });
        return;
      }

      if (!payload.playerId || !username) {
        ack?.({ ok: false, error: "Enter a username before joining." });
        return;
      }

      const lobby = lobbies.get(code);

      if (!lobby) {
        ack?.({ ok: false, error: "No lobby was found for that code." });
        return;
      }

      const player = addOrReconnectPlayer(lobby, {
        id: payload.playerId,
        username
      });

      socket.join(code);
      socket.data.lobbyCode = code;
      socket.data.playerId = payload.playerId;
      ack?.({ ok: true, data: { state: toLobbyState(lobby), player } });
      emitLobbyState(io, lobby);
    });

    socket.on("roll:start", (payload: RollPayload, ack?: Ack) => {
      const lobby = getLobby(payload.code);

      if (!lobby) {
        ack?.({ ok: false, error: "Lobby no longer exists." });
        return;
      }

      const player = getPlayer(lobby, payload.playerId);

      if (!player) {
        ack?.({ ok: false, error: "Join the lobby before rolling." });
        return;
      }

      const validation = validateDiceRequest(payload);

      if (!validation.ok) {
        ack?.({ ok: false, error: validation.error });
        return;
      }

      const roll = createRoll({
        playerId: player.id,
        playerName: player.username,
        diceColor: player.diceColor,
        quantity: validation.quantity,
        sides: validation.sides,
        modifier: validation.modifier
      });

      io.to(lobby.code).emit("roll:start", {
        id: roll.id,
        playerName: roll.playerName,
        diceColor: roll.diceColor,
        expression: roll.expression
      });

      ack?.({ ok: true, data: { rollId: roll.id } });

      setTimeout(() => {
        const latestLobby = lobbies.get(lobby.code);

        if (!latestLobby) {
          return;
        }

        addRoll(latestLobby, roll);
        io.to(latestLobby.code).emit("roll:committed", roll);
        emitLobbyState(io, latestLobby);
      }, 900);
    });

    socket.on("host:clearLog", (payload: { code: string; playerId: string }, ack?: Ack) => {
      const lobby = getLobby(payload.code);

      if (!lobby) {
        ack?.({ ok: false, error: "Lobby no longer exists." });
        return;
      }

      const hostError = requireHost(lobby, payload.playerId);

      if (hostError) {
        ack?.({ ok: false, error: hostError });
        return;
      }

      clearRolls(lobby);
      ack?.({ ok: true, data: toLobbyState(lobby) });
      emitLobbyState(io, lobby);
    });

    socket.on("host:removePlayer", (payload: { code: string; hostId: string; playerId: string }, ack?: Ack) => {
      const lobby = getLobby(payload.code);

      if (!lobby) {
        ack?.({ ok: false, error: "Lobby no longer exists." });
        return;
      }

      const hostError = requireHost(lobby, payload.hostId);

      if (hostError) {
        ack?.({ ok: false, error: hostError });
        return;
      }

      const removed = removePlayer(lobby, payload.playerId);

      if (!removed) {
        ack?.({ ok: false, error: "That player could not be removed." });
        return;
      }

      io.to(lobby.code).emit("player:removed", { playerId: payload.playerId });
      ack?.({ ok: true, data: toLobbyState(lobby) });
      emitLobbyState(io, lobby);
    });

    socket.on("disconnect", () => {
      const code = socket.data.lobbyCode;
      const playerId = socket.data.playerId;

      if (!code || !playerId) {
        return;
      }

      const lobby = lobbies.get(code);

      if (!lobby) {
        return;
      }

      markPlayerDisconnected(lobby, playerId);
      emitLobbyState(io, lobby);
    });
  });

  return io;
}
