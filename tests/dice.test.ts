import { describe, expect, it } from "vitest";
import {
  calculateTotal,
  createRoll,
  formatRollExpression,
  formatRollRequestExpression,
  rollDice,
  rollDiceTerms,
  validateRollRequest,
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

  it("formats and rolls multiple different dice terms", () => {
    const request = {
      terms: [
        { quantity: 1, sides: 4 },
        { quantity: 1, sides: 8 }
      ],
      modifier: 0
    };

    expect(formatRollRequestExpression(request)).toBe("1d4 + 1d8");

    const termResults = rollDiceTerms(request.terms);
    expect(termResults).toHaveLength(2);
    expect(termResults[0].results).toHaveLength(1);
    expect(termResults[0].results[0]).toBeGreaterThanOrEqual(1);
    expect(termResults[0].results[0]).toBeLessThanOrEqual(4);
    expect(termResults[1].results[0]).toBeGreaterThanOrEqual(1);
    expect(termResults[1].results[0]).toBeLessThanOrEqual(8);
  });

  it("creates a mixed dice roll with grouped individual results", () => {
    const roll = createRoll({
      playerId: "p1",
      playerName: "Alice",
      diceColor: "#d79b4a",
      terms: [
        { quantity: 1, sides: 4 },
        { quantity: 1, sides: 8 }
      ],
      modifier: 2
    });

    expect(roll.expression).toBe("1d4 + 1d8 + 2");
    expect(roll.terms).toHaveLength(2);
    expect(roll.results).toHaveLength(2);
    expect(roll.total).toBe(roll.results[0] + roll.results[1] + 2);
  });

  it("rejects unsupported dice, empty quantities, and unsafe modifiers", () => {
    expect(validateDiceRequest({ quantity: 1, sides: 13, modifier: 0 }).ok).toBe(false);
    expect(validateDiceRequest({ quantity: 0, sides: 20, modifier: 0 }).ok).toBe(false);
    expect(validateDiceRequest({ quantity: 1, sides: 20, modifier: 1000 }).ok).toBe(false);
    expect(validateRollRequest({ terms: [], modifier: 0 }).ok).toBe(false);
    expect(validateRollRequest({ terms: [{ quantity: 1, sides: 20 }], modifier: 1000 }).ok).toBe(
      false
    );
  });
});
