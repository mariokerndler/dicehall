import { describe, expect, it } from "vitest";
import { getSocketTransports } from "../lib/socket";

describe("getSocketTransports", () => {
  it("defaults to polling for hosts that do not support incoming WebSockets", () => {
    expect(getSocketTransports()).toEqual(["polling"]);
  });

  it("allows an explicit comma-separated transport list", () => {
    expect(getSocketTransports("polling,websocket")).toEqual(["polling", "websocket"]);
  });

  it("ignores unsupported or empty transport names", () => {
    expect(getSocketTransports(" polling, nope, , websocket ")).toEqual(["polling", "websocket"]);
  });
});
