export const SUPPORTED_DICE = [4, 6, 8, 10, 12, 20, 100] as const;

export type DiceSides = (typeof SUPPORTED_DICE)[number];

export type DiceRequest = {
  quantity: number;
  sides: number;
  modifier: number;
};

export type Roll = {
  id: string;
  playerId: string;
  playerName: string;
  diceColor: string;
  quantity: number;
  sides: DiceSides;
  modifier: number;
  expression: string;
  results: number[];
  total: number;
  timestamp: number;
};

export type RollInput = {
  playerId: string;
  playerName: string;
  diceColor: string;
  quantity: number;
  sides: number;
  modifier: number;
};

export type ValidationResult =
  | { ok: true; quantity: number; sides: DiceSides; modifier: number }
  | { ok: false; error: string };

const MAX_QUANTITY = 20;
const MIN_MODIFIER = -99;
const MAX_MODIFIER = 99;

export function isSupportedDie(sides: number): sides is DiceSides {
  return SUPPORTED_DICE.includes(sides as DiceSides);
}

export function validateDiceRequest(request: DiceRequest): ValidationResult {
  const quantity = Number(request.quantity);
  const sides = Number(request.sides);
  const modifier = Number(request.modifier);

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    return { ok: false, error: `Choose between 1 and ${MAX_QUANTITY} dice.` };
  }

  if (!Number.isInteger(sides) || !isSupportedDie(sides)) {
    return { ok: false, error: "Choose a supported die type." };
  }

  if (!Number.isInteger(modifier) || modifier < MIN_MODIFIER || modifier > MAX_MODIFIER) {
    return { ok: false, error: `Modifier must be between ${MIN_MODIFIER} and ${MAX_MODIFIER}.` };
  }

  return { ok: true, quantity, sides, modifier };
}

export function rollDice(quantity: number, sides: number): number[] {
  const validation = validateDiceRequest({ quantity, sides, modifier: 0 });

  if (!validation.ok) {
    throw new Error(validation.error);
  }

  return Array.from(
    { length: validation.quantity },
    () => Math.floor(Math.random() * validation.sides) + 1
  );
}

export function calculateTotal(results: number[], modifier: number): number {
  return results.reduce((sum, result) => sum + result, 0) + modifier;
}

export function formatRollExpression(quantity: number, sides: number, modifier = 0): string {
  const base = `${quantity}d${sides}`;

  if (modifier > 0) {
    return `${base} + ${modifier}`;
  }

  if (modifier < 0) {
    return `${base} - ${Math.abs(modifier)}`;
  }

  return base;
}

export function createRoll(input: RollInput): Roll {
  const validation = validateDiceRequest(input);

  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const results = rollDice(validation.quantity, validation.sides);
  const total = calculateTotal(results, validation.modifier);

  return {
    id: crypto.randomUUID(),
    playerId: input.playerId,
    playerName: input.playerName,
    diceColor: input.diceColor,
    quantity: validation.quantity,
    sides: validation.sides,
    modifier: validation.modifier,
    expression: formatRollExpression(validation.quantity, validation.sides, validation.modifier),
    results,
    total,
    timestamp: Date.now()
  };
}
