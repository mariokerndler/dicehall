import { describe, expect, it } from "vitest";
import {
  calculateTotal,
  createRoll,
  formatRollExpression,
  rollDice,
  validateDiceRequest
} from "../lib/dice";

describe("dice logic", () => {
  it("rolls the requested quantity within the selected die bounds", () => {
    const results = rollDice(4, 8);

    expect(results).toHaveLength(4);
    expect(results.every((result) => result >= 1 && result <= 8)).toBe(true);
  });

  it("applies positive, negative, and zero modifiers to totals", () => {
    expect(calculateTotal([17], 3)).toBe(20);
    expect(calculateTotal([2, 5, 6], 0)).toBe(13);
    expect(calculateTotal([4, 4], -1)).toBe(7);
  });

  it("formats roll expressions with optional modifiers", () => {
    expect(formatRollExpression(1, 20, 3)).toBe("1d20 + 3");
    expect(formatRollExpression(3, 6, 0)).toBe("3d6");
    expect(formatRollExpression(2, 8, -1)).toBe("2d8 - 1");
  });

  it("creates a complete roll record", () => {
    const roll = createRoll({
      playerId: "p1",
      playerName: "Alice",
      diceColor: "#d79b4a",
      quantity: 1,
      sides: 20,
      modifier: 3
    });

    expect(roll.playerName).toBe("Alice");
    expect(roll.expression).toBe("1d20 + 3");
    expect(roll.results).toHaveLength(1);
    expect(roll.total).toBe(roll.results[0] + 3);
    expect(roll.timestamp).toEqual(expect.any(Number));
  });

  it("rejects unsupported dice, empty quantities, and unsafe modifiers", () => {
    expect(validateDiceRequest({ quantity: 1, sides: 13, modifier: 0 }).ok).toBe(false);
    expect(validateDiceRequest({ quantity: 0, sides: 20, modifier: 0 }).ok).toBe(false);
    expect(validateDiceRequest({ quantity: 1, sides: 20, modifier: 1000 }).ok).toBe(false);
  });
});
