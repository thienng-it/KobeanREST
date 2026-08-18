import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const hasFile = (path) => existsSync(new URL(path, root));

test("types.ts supports WS and SOCKET.IO methods and connection types", () => {
  assert.equal(hasFile("src/renderer/src/types.ts"), true);
  const types = read("src/renderer/src/types.ts");

  assert.match(types, /"WS"/);
  assert.match(types, /"SOCKET\.IO"/);
  assert.match(types, /export type WsConnectionStatus/);
  assert.match(types, /export interface WsMessagePacket/);
  assert.match(types, /export interface WsConnectionConfig/);
});

test("WebSocketClient service is registered and manages WebSocket lifecycle", () => {
  assert.equal(hasFile("src/renderer/src/services/websocket-client.ts"), true);
  const wsClient = read("src/renderer/src/services/websocket-client.ts");

  assert.match(wsClient, /export class WebSocketClient/);
  assert.match(wsClient, /connect\(targetUrl:\s*string/);
  assert.match(wsClient, /send\(payload:\s*string\)/);
  assert.match(wsClient, /disconnect\(/);
  assert.match(wsClient, /binaryType\s*=\s*'arraybuffer'/);
});

test("SocketIOClient service is registered and supports wildcard events and acknowledgements", () => {
  assert.equal(hasFile("src/renderer/src/services/socketio-client.ts"), true);
  const sioClient = read("src/renderer/src/services/socketio-client.ts");

  assert.match(sioClient, /export class SocketIOClient/);
  assert.match(sioClient, /connect\(targetUrl:\s*string/);
  assert.match(sioClient, /emit\(eventName:\s*string/);
  assert.match(sioClient, /onAny\(/);
  assert.match(sioClient, /expectAck/);
});

test("WebSocketPanel component provides interactive connection and message streaming", () => {
  assert.equal(hasFile("src/renderer/src/components/WebSocketPanel.tsx"), true);
  const panel = read("src/renderer/src/components/WebSocketPanel.tsx");

  assert.match(panel, /export function WebSocketPanel/);
  assert.match(panel, /handleToggleConnection/);
  assert.match(panel, /handleSendMessage/);
  assert.match(panel, /handleExportStream/);
  assert.match(panel, /filteredPackets/);
});

test("MethodSelector and styles include WS and SOCKET.IO methods and styling", () => {
  const methodSelector = read("src/renderer/src/components/MethodSelector.tsx");
  const styles = read("src/renderer/src/styles.css");

  assert.match(methodSelector, /"WS"/);
  assert.match(methodSelector, /"SOCKET\.IO"/);
  assert.match(styles, /\.method-ws/);
  assert.match(styles, /\.method-socketio/);
});
