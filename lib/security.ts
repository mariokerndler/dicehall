import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export function verifySessionToken(token: string | undefined, expectedHash: string): boolean {
  if (!token) {
    return false;
  }

  const actual = Buffer.from(hashSessionToken(token));
  const expected = Buffer.from(expectedHash);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
