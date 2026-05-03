export const SUPPORTED_DICE = [4, 6, 8, 10, 12, 20, 100] as const;

export type DiceSides = (typeof SUPPORTED_DICE)[number];

export type DiceRequest = {
  quantity: number;
  sides: number;
  modifier: number;
};

export type DiceTerm = {
  quantity: number;
  sides: number;
};

export type ValidDiceTerm = {
  quantity: number;
  sides: DiceSides;
};

export type RollRequest = {
  terms: DiceTerm[];
  modifier: number;
};

export type RollTermResult = ValidDiceTerm & {
  results: number[];
};

export type Roll = {
  id: string;
  playerId: string;
  playerName: string;
  diceColor: string;
  quantity?: number;
  sides?: DiceSides;
  modifier: number;
  expression: string;
  terms: RollTermResult[];
  results: number[];
  total: number;
  timestamp: number;
};

export type RollInput = {
  playerId: string;
  playerName: string;
  diceColor: string;
  quantity?: number;
  sides?: number;
  terms?: DiceTerm[];
  modifier: number;
};

export type ValidationResult =
  | { ok: true; quantity: number; sides: DiceSides; modifier: number }
  | { ok: false; error: string };

export type RollValidationResult =
  | { ok: true; terms: ValidDiceTerm[]; modifier: number }
  | { ok: false; error: string };

const MAX_QUANTITY = 20;
const MAX_TERMS = 8;
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

export function validateRollRequest(request: RollRequest): RollValidationResult {
  const modifier = Number(request.modifier);

  if (!Number.isInteger(modifier) || modifier < MIN_MODIFIER || modifier > MAX_MODIFIER) {
    return { ok: false, error: `Modifier must be between ${MIN_MODIFIER} and ${MAX_MODIFIER}.` };
  }

  if (!Array.isArray(request.terms) || request.terms.length < 1 || request.terms.length > MAX_TERMS) {
    return { ok: false, error: `Choose between 1 and ${MAX_TERMS} dice groups.` };
  }

  const terms: ValidDiceTerm[] = [];
  const totalDice = request.terms.reduce((sum, term) => sum + Number(term.quantity), 0);

  if (!Number.isInteger(totalDice) || totalDice < 1 || totalDice > MAX_QUANTITY) {
    return { ok: false, error: `Choose between 1 and ${MAX_QUANTITY} total dice.` };
  }

  for (const term of request.terms) {
    const validation = validateDiceRequest({
      quantity: term.quantity,
      sides: term.sides,
      modifier: 0
    });

    if (!validation.ok) {
      return validation;
    }

    terms.push({
      quantity: validation.quantity,
      sides: validation.sides
    });
  }

  return { ok: true, terms, modifier };
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

export function rollDiceTerms(terms: DiceTerm[]): RollTermResult[] {
  const validation = validateRollRequest({ terms, modifier: 0 });

  if (!validation.ok) {
    throw new Error(validation.error);
  }

  return validation.terms.map((term) => ({
    ...term,
    results: rollDice(term.quantity, term.sides)
  }));
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

export function formatRollRequestExpression(request: RollRequest): string {
  const validation = validateRollRequest(request);

  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const diceText = validation.terms.map((term) => `${term.quantity}d${term.sides}`).join(" + ");

  if (validation.modifier > 0) {
    return `${diceText} + ${validation.modifier}`;
  }

  if (validation.modifier < 0) {
    return `${diceText} - ${Math.abs(validation.modifier)}`;
  }

  return diceText;
}

export function createRoll(input: RollInput): Roll {
  const request =
    input.terms && input.terms.length > 0
      ? { terms: input.terms, modifier: input.modifier }
      : {
          terms: [
            {
              quantity: input.quantity ?? 0,
              sides: input.sides ?? 0
            }
          ],
          modifier: input.modifier
        };
  const validation = validateRollRequest(request);

  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const terms = rollDiceTerms(validation.terms);
  const results = terms.flatMap((term) => term.results);
  const total = calculateTotal(results, validation.modifier);
  const firstTerm = validation.terms[0];

  return {
    id: crypto.randomUUID(),
    playerId: input.playerId,
    playerName: input.playerName,
    diceColor: input.diceColor,
    quantity: validation.terms.length === 1 ? firstTerm.quantity : undefined,
    sides: validation.terms.length === 1 ? firstTerm.sides : undefined,
    modifier: validation.modifier,
    expression: formatRollRequestExpression({
      terms: validation.terms,
      modifier: validation.modifier
    }),
    terms,
    results,
    total,
    timestamp: Date.now()
  };
}
