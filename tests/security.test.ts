import { describe, expect, it } from "vitest";
import { FixedWindowRateLimiter } from "../lib/rate-limit";
import { isAllowedSocketOrigin, parseAllowedOrigins } from "../lib/origin";
import { createSessionToken, hashSessionToken, verifySessionToken } from "../lib/security";

describe("session token helpers", () => {
  it("creates opaque tokens and verifies only their hashes", () => {
    const token = createSessionToken();
    const hash = hashSessionToken(token);

    expect(token).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect(hash).not.toBe(token);
    expect(verifySessionToken(token, hash)).toBe(true);
    expect(verifySessionToken("wrong-token", hash)).toBe(false);
  });
});

describe("FixedWindowRateLimiter", () => {
  it("allows requests up to the limit and rejects the next request in the window", () => {
    let now = 1_000;
    const limiter = new FixedWindowRateLimiter(() => now);

    expect(limiter.check("socket:create", { limit: 2, windowMs: 60_000 })).toBe(true);
    expect(limiter.check("socket:create", { limit: 2, windowMs: 60_000 })).toBe(true);
    expect(limiter.check("socket:create", { limit: 2, windowMs: 60_000 })).toBe(false);

    now += 60_001;
    expect(limiter.check("socket:create", { limit: 2, windowMs: 60_000 })).toBe(true);
  });
});

describe("Socket.IO origin allowlist", () => {
  it("allows missing origins for same-server and non-browser clients", () => {
    expect(isAllowedSocketOrigin({ origin: undefined, host: "dice.example" })).toBe(true);
  });

  it("allows same-origin browser requests by comparing Origin and Host", () => {
    expect(isAllowedSocketOrigin({ origin: "https://dice.example", host: "dice.example" })).toBe(true);
  });

  it("allows configured extra origins and rejects unrelated origins", () => {
    const allowedOrigins = parseAllowedOrigins("https://play.example, https://www.dice.example");

    expect(
      isAllowedSocketOrigin({
        origin: "https://play.example",
        host: "dice.example",
        allowedOrigins
      })
    ).toBe(true);
    expect(
      isAllowedSocketOrigin({
        origin: "https://evil.example",
        host: "dice.example",
        allowedOrigins
      })
    ).toBe(false);
  });
});
