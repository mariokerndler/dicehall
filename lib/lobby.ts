import type { Roll } from "./dice";

export type Player = {
  id: string;
  username: string;
  diceColor: string;
  isHost: boolean;
  connected: boolean;
  joinedAt: number;
};

export type Lobby = {
  code: string;
  hostId: string;
  players: Player[];
  rolls: Roll[];
  createdAt: number;
  updatedAt: number;
};

export type LobbyState = {
  code: string;
  hostId: string;
  players: Player[];
  rolls: Roll[];
};

const CODE_PATTERN = /^[A-Z0-9]{6}$/;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_LOG_LENGTH = 100;

export const PLAYER_COLORS = [
  "#d79b4a",
  "#2dd4bf",
  "#7aa2ff",
  "#ef5f6c",
  "#a78bfa",
  "#f7c948",
  "#fb7185",
  "#38bdf8",
  "#84cc16",
  "#f97316"
] as const;

export function normalizeLobbyCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidLobbyCode(code: string): boolean {
  return CODE_PATTERN.test(normalizeLobbyCode(code));
}

export function generateLobbyCode(existingCodes: Set<string>): string {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const code = Array.from({ length: 6 }, () =>
      CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
    ).join("");

    if (!existingCodes.has(code)) {
      return code;
    }
  }

  throw new Error("Could not generate a unique lobby code.");
}

export function cleanUsername(username: string): string {
  return username.trim().replace(/\s+/g, " ").slice(0, 24);
}

export function withDuplicateUsernameSuffix(players: Player[], username: string, playerId: string): string {
  const baseName = cleanUsername(username);
  const taken = new Set(
    players
      .filter((player) => player.id !== playerId)
      .map((player) => player.username.toLowerCase())
  );

  if (!taken.has(baseName.toLowerCase())) {
    return baseName;
  }

  for (let suffix = 2; suffix < 100; suffix += 1) {
    const candidate = `${baseName} ${suffix}`;

    if (!taken.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  return `${baseName} ${Date.now().toString().slice(-4)}`;
}

export function assignAvailablePlayerColor(players: Player[]): string {
  const usedColors = new Set(players.map((player) => player.diceColor.toLowerCase()));
  const available = PLAYER_COLORS.find((color) => !usedColors.has(color.toLowerCase()));

  if (available) {
    return available;
  }

  return PLAYER_COLORS[players.length % PLAYER_COLORS.length];
}

export function createLobby(
  code: string,
  host: Omit<Player, "diceColor" | "isHost" | "connected" | "joinedAt">
): Lobby {
  const now = Date.now();

  return {
    code,
    hostId: host.id,
    players: [
      {
        ...host,
        diceColor: PLAYER_COLORS[0],
        isHost: true,
        connected: true,
        joinedAt: now
      }
    ],
    rolls: [],
    createdAt: now,
    updatedAt: now
  };
}

export function addOrReconnectPlayer(
  lobby: Lobby,
  player: Omit<Player, "diceColor" | "isHost" | "connected" | "joinedAt">
): Player {
  const existing = lobby.players.find((candidate) => candidate.id === player.id);
  const username = withDuplicateUsernameSuffix(lobby.players, player.username, player.id);

  if (existing) {
    existing.username = username;
    existing.connected = true;
    lobby.updatedAt = Date.now();
    return existing;
  }

  const newPlayer: Player = {
    ...player,
    username,
    diceColor: assignAvailablePlayerColor(lobby.players),
    isHost: false,
    connected: true,
    joinedAt: Date.now()
  };

  lobby.players.push(newPlayer);
  lobby.updatedAt = Date.now();
  return newPlayer;
}

export function markPlayerDisconnected(lobby: Lobby, playerId: string): void {
  const player = lobby.players.find((candidate) => candidate.id === playerId);

  if (player) {
    player.connected = false;
    lobby.updatedAt = Date.now();
  }
}

export function removePlayer(lobby: Lobby, playerId: string): Player | undefined {
  if (playerId === lobby.hostId) {
    return undefined;
  }

  const player = lobby.players.find((candidate) => candidate.id === playerId);
  lobby.players = lobby.players.filter((candidate) => candidate.id !== playerId);
  lobby.updatedAt = Date.now();
  return player;
}

export function addRoll(lobby: Lobby, roll: Roll): void {
  lobby.rolls = [roll, ...lobby.rolls].slice(0, MAX_LOG_LENGTH);
  lobby.updatedAt = Date.now();
}

export function clearRolls(lobby: Lobby): void {
  lobby.rolls = [];
  lobby.updatedAt = Date.now();
}

export function toLobbyState(lobby: Lobby): LobbyState {
  return {
    code: lobby.code,
    hostId: lobby.hostId,
    players: lobby.players,
    rolls: lobby.rolls
  };
}
