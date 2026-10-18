import type { IncomingMessage } from "node:http";
import { describe, expect, it } from "vitest";
import { createClientAddressResolver, parseTrustedProxies } from "../lib/client-address";

function request(remoteAddress: string, forwardedFor?: string): IncomingMessage {
  return {
    socket: { remoteAddress },
    headers: { "x-forwarded-for": forwardedFor }
  } as unknown as IncomingMessage;
}

describe("trusted proxy client addresses", () => {
  it("parses explicit proxy ranges and supports disabling proxy trust", () => {
    expect(parseTrustedProxies("loopback, 10.1.2.3/32, ")).toEqual(["loopback", "10.1.2.3/32"]);
    expect(parseTrustedProxies("")).toEqual([]);
    expect(() => createClientAddressResolver(["not-an-address"])).toThrow();
  });

  it("ignores forwarded headers from an untrusted direct client", () => {
    const resolve = createClientAddressResolver(["loopback"]);
    expect(resolve(request("203.0.113.10", "198.51.100.20"))).toBe("203.0.113.10");
  });

  it("uses the nearest untrusted address behind explicitly trusted proxies", () => {
    const resolve = createClientAddressResolver(["loopback", "10.1.2.0/24"]);
    expect(resolve(request("10.1.2.3", "198.51.100.99, 203.0.113.10, 10.1.2.4"))).toBe("203.0.113.10");
  });

  it("accepts a client address from the loopback proxy", () => {
    const resolve = createClientAddressResolver(["loopback"]);
    expect(resolve(request("127.0.0.1", "203.0.113.10"))).toBe("203.0.113.10");
  });

  it("falls back for invalid forwarded addresses and normalizes mapped IPv4", () => {
    const resolve = createClientAddressResolver(["loopback"]);
    expect(resolve(request("127.0.0.1", "not-an-address"))).toBe("127.0.0.1");
    expect(resolve(request("::ffff:203.0.113.10"))).toBe("203.0.113.10");
  });
});
