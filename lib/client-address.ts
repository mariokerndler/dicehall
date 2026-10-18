import type { IncomingMessage } from "node:http";
import { isIP } from "node:net";
import proxyaddr from "proxy-addr";

export function parseTrustedProxies(value = process.env.DICEHALL_TRUSTED_PROXIES ?? "loopback"): string[] {
  return value.split(",").map((address) => address.trim()).filter(Boolean);
}

export function createClientAddressResolver(trustedProxies = parseTrustedProxies()) {
  const trust = proxyaddr.compile(trustedProxies);
  return (request: IncomingMessage): string => {
    const forwarded = proxyaddr(request, trust);
    const address = isIP(forwarded) ? forwarded : request.socket.remoteAddress ?? "unknown";
    return address.startsWith("::ffff:") && isIP(address.slice(7)) === 4 ? address.slice(7) : address;
  };
}
