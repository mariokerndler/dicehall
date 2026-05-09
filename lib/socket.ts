export type SocketTransport = "polling" | "websocket";

const DEFAULT_TRANSPORTS: SocketTransport[] = ["polling"];
const SUPPORTED_TRANSPORTS = new Set<SocketTransport>(["polling", "websocket"]);

export function getSocketTransports(value = process.env.NEXT_PUBLIC_SOCKET_TRANSPORTS): SocketTransport[] {
  const transports = value
    ?.split(",")
    .map((transport) => transport.trim().toLowerCase())
    .filter((transport): transport is SocketTransport => SUPPORTED_TRANSPORTS.has(transport as SocketTransport));

  return transports?.length ? transports : DEFAULT_TRANSPORTS;
}
