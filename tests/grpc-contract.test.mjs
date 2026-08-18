import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const hasFile = (path) => existsSync(new URL(path, root));

test("types.ts supports GRPC method and gRPC models", () => {
  assert.equal(hasFile("src/renderer/src/types.ts"), true);
  const types = read("src/renderer/src/types.ts");

  assert.match(types, /"GRPC"/);
  assert.match(types, /export type GrpcRpcType/);
  assert.match(types, /export interface GrpcMethodDefinition/);
  assert.match(types, /export interface GrpcServiceDefinition/);
  assert.match(types, /export interface GrpcProtoSchema/);
  assert.match(types, /export interface GrpcCallResult/);
});

test("proto-parser.ts parses Proto3 definitions and generates sample messages", () => {
  assert.equal(hasFile("src/renderer/src/services/proto-parser.ts"), true);
  const parser = read("src/renderer/src/services/proto-parser.ts");

  assert.match(parser, /export function parseProtoSchema/);
  assert.match(parser, /export function generateSampleMessageJson/);
  assert.match(parser, /SAMPLE_PROTO_DEFINITIONS/);
});

test("grpc-client.ts manages gRPC calls and status codes", () => {
  assert.equal(hasFile("src/renderer/src/services/grpc-client.ts"), true);
  const client = read("src/renderer/src/services/grpc-client.ts");

  assert.match(client, /export async function executeGrpcCall/);
  assert.match(client, /GRPC_STATUS_MAP/);
  assert.match(client, /X-Grpc-Web/);
});

test("GrpcPanel.tsx renders interactive gRPC service, method, payload and response panels", () => {
  assert.equal(hasFile("src/renderer/src/components/GrpcPanel.tsx"), true);
  const panel = read("src/renderer/src/components/GrpcPanel.tsx");

  assert.match(panel, /export function GrpcPanel/);
  assert.match(panel, /handleInvokeRpc/);
  assert.match(panel, /handleGeneratePayload/);
  assert.match(panel, /selectedService/);
  assert.match(panel, /selectedMethod/);
});

test("MethodSelector and styles.css include GRPC method and badges", () => {
  const methodSelector = read("src/renderer/src/components/MethodSelector.tsx");
  const styles = read("src/renderer/src/styles.css");

  assert.match(methodSelector, /"GRPC"/);
  assert.match(styles, /\.method-grpc/);
});

test("ApiToolsModal.tsx supports creating and generating gRPC mock servers", () => {
  assert.equal(hasFile("src/renderer/src/components/ApiToolsModal.tsx"), true);
  const modal = read("src/renderer/src/components/ApiToolsModal.tsx");

  assert.match(modal, /Local Mock Server/);
  assert.match(modal, /handleGenerateFromProto/);
  assert.match(modal, /showProtoGenerator/);
  assert.match(modal, /application\/grpc-web\+proto/);
  assert.match(modal, /GRPC/);
});

test("mock_server.rs matches gRPC RPC paths and sets gRPC response headers", () => {
  assert.equal(hasFile("src-tauri/src/mock_server.rs"), true);
  const server = read("src-tauri/src/mock_server.rs");

  assert.match(server, /GRPC/);
  assert.match(server, /grpc-status/);
  assert.match(server, /grpc-message/);
});

test("mock-templates.ts provides multi-category starter templates for REST and gRPC", () => {
  assert.equal(hasFile("src/renderer/src/services/mock-templates.ts"), true);
  const tpl = read("src/renderer/src/services/mock-templates.ts");

  assert.match(tpl, /MOCK_SERVER_TEMPLATES/);
  assert.match(tpl, /ecommerce-rest/);
  assert.match(tpl, /ai-llm-rest/);
  assert.match(tpl, /grpc-greeter/);
  assert.match(tpl, /createRoutesFromTemplate/);
});
