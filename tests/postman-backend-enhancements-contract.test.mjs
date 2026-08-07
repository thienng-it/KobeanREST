import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Postman Backend Enhancements & MCP Capabilities Contract Tests", () => {
  it("verifies Rust backend modules (mock_server, spec_generator, mcp_server) are registered", () => {
    const libRsPath = path.join(process.cwd(), "src-tauri/src/lib.rs");
    const content = fs.readFileSync(libRsPath, "utf-8");

    assert.ok(content.includes("mod mock_server;"), "lib.rs must register mock_server module");
    assert.ok(content.includes("mod spec_generator;"), "lib.rs must register spec_generator module");
    assert.ok(content.includes("mod mcp_server;"), "lib.rs must register mcp_server module");
    assert.ok(content.includes("start_local_mock_server"), "lib.rs must register start_local_mock_server handler");
    assert.ok(content.includes("export_openapi_30_spec"), "lib.rs must register export_openapi_30_spec handler");
    assert.ok(content.includes("export_mcp_manifest"), "lib.rs must register export_mcp_manifest handler");
  });

  it("verifies frontend local-store IPC wrappers exist", () => {
    const localStorePath = path.join(process.cwd(), "src/renderer/src/services/local-store.ts");
    const content = fs.readFileSync(localStorePath, "utf-8");

    assert.ok(content.includes("export async function startLocalMockServer"), "local-store.ts must export startLocalMockServer");
    assert.ok(content.includes("export async function exportOpenApiSpec"), "local-store.ts must export exportOpenApiSpec");
    assert.ok(content.includes("export async function exportMcpManifest"), "local-store.ts must export exportMcpManifest");
  });

  it("verifies ApiToolsModal renders Mock Server, OpenAPI, and MCP tabs", () => {
    const modalPath = path.join(process.cwd(), "src/renderer/src/components/ApiToolsModal.tsx");
    const content = fs.readFileSync(modalPath, "utf-8");

    assert.ok(content.includes("LocalMockServerView"), "ApiToolsModal must contain LocalMockServerView component");
    assert.ok(content.includes("OpenApiEngineView"), "ApiToolsModal must contain OpenApiEngineView component");
    assert.ok(content.includes("McpServerView"), "ApiToolsModal must contain McpServerView component");
    assert.ok(content.includes('id: "mock"'), "ApiToolsModal tabs must include mock server tab");
    assert.ok(content.includes('id: "openapi"'), "ApiToolsModal tabs must include openapi tab");
    assert.ok(content.includes('id: "mcp"'), "ApiToolsModal tabs must include mcp tab");
  });
});
