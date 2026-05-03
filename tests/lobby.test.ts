import { describe, expect, it } from "vitest";
import {
  PLAYER_COLORS,
  addOrReconnectPlayer,
  assignAvailablePlayerColor,
  createLobby
} from "../lib/lobby";

describe("lobby player colors", () => {
  it("assigns the first unused player color", () => {
    const lobby = createLobby("ABC123", {
      id: "dm",
      username: "DM"
    });

    const player = addOrReconnectPlayer(lobby, {
      id: "alice",
      username: "Alice"
    });

    expect(lobby.players[0].diceColor).toBe(PLAYER_COLORS[0]);
    expect(player.diceColor).toBe(PLAYER_COLORS[1]);
  });

  it("preserves a reconnecting player's assigned color", () => {
    const lobby = createLobby("ABC123", {
      id: "dm",
      username: "DM"
    });
    const firstJoin = addOrReconnectPlayer(lobby, {
      id: "alice",
      username: "Alice"
    });

    const reconnect = addOrReconnectPlayer(lobby, {
      id: "alice",
      username: "Alice Again"
    });

    expect(reconnect.diceColor).toBe(firstJoin.diceColor);
  });

  it("reuses a removed player's color for a later player", () => {
    const lobby = createLobby("ABC123", {
      id: "dm",
      username: "DM"
    });
    const alice = addOrReconnectPlayer(lobby, {
      id: "alice",
      username: "Alice"
    });

    lobby.players = lobby.players.filter((player) => player.id !== "alice");

    expect(assignAvailablePlayerColor(lobby.players)).toBe(alice.diceColor);
  });
});
