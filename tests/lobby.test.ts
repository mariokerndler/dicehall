import { describe, expect, it } from "vitest";
import {
  addPrivateRoll,
  PLAYER_COLORS,
  addOrReconnectPlayer,
  assignAvailablePlayerColor,
  createLobby,
  toLobbyState
} from "../lib/lobby";

const TEST_TOKEN_HASH = "test-token-hash";

describe("lobby player colors", () => {
  it("assigns the first unused player color", () => {
    const lobby = createLobby("ABC123", {
      id: "dm",
      username: "DM",
      sessionTokenHash: TEST_TOKEN_HASH
    });

    const player = addOrReconnectPlayer(lobby, {
      id: "alice",
      username: "Alice",
      sessionTokenHash: TEST_TOKEN_HASH
    });

    expect(lobby.players[0].diceColor).toBe(PLAYER_COLORS[0]);
    expect(player.diceColor).toBe(PLAYER_COLORS[1]);
  });

  it("preserves a reconnecting player's assigned color", () => {
    const lobby = createLobby("ABC123", {
      id: "dm",
      username: "DM",
      sessionTokenHash: TEST_TOKEN_HASH
    });
    const firstJoin = addOrReconnectPlayer(lobby, {
      id: "alice",
      username: "Alice",
      sessionTokenHash: TEST_TOKEN_HASH
    });

    const reconnect = addOrReconnectPlayer(lobby, {
      id: "alice",
      username: "Alice Again",
      sessionTokenHash: "rotated-token-hash"
    });

    expect(reconnect.diceColor).toBe(firstJoin.diceColor);
  });

  it("reuses a removed player's color for a later player", () => {
    const lobby = createLobby("ABC123", {
      id: "dm",
      username: "DM",
      sessionTokenHash: TEST_TOKEN_HASH
    });
    const alice = addOrReconnectPlayer(lobby, {
      id: "alice",
      username: "Alice",
      sessionTokenHash: TEST_TOKEN_HASH
    });

    lobby.players = lobby.players.filter((player) => player.id !== "alice");

    expect(assignAvailablePlayerColor(lobby.players)).toBe(alice.diceColor);
  });

  it("filters private rolls to the DM and the rolling player", () => {
    const lobby = createLobby("ABC123", {
      id: "dm",
      username: "DM",
      sessionTokenHash: TEST_TOKEN_HASH
    });
    addOrReconnectPlayer(lobby, {
      id: "alice",
      username: "Alice",
      sessionTokenHash: TEST_TOKEN_HASH
    });
    addOrReconnectPlayer(lobby, {
      id: "bob",
      username: "Bob",
      sessionTokenHash: TEST_TOKEN_HASH
    });

    addPrivateRoll(lobby, {
      id: "roll-1",
      playerId: "alice",
      playerName: "Alice",
      diceColor: "#2dd4bf",
      modifier: 0,
      expression: "1d20",
      terms: [{ quantity: 1, sides: 20, results: [12] }],
      results: [12],
      total: 12,
      timestamp: 1,
      visibility: "dm"
    });

    expect(toLobbyState(lobby, "dm").privateRolls).toHaveLength(1);
    expect(toLobbyState(lobby, "alice").privateRolls).toHaveLength(1);
    expect(toLobbyState(lobby, "bob").privateRolls).toHaveLength(0);
    expect(toLobbyState(lobby).privateRolls).toBeUndefined();
  });
});
