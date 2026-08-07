use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::AppHandle;

#[derive(Debug, Serialize, Deserialize)]
pub struct McpManifestResult {
    pub manifest_json: String,
    pub server_name: String,
    pub version: String,
}

#[tauri::command]
pub fn export_mcp_manifest(_app: AppHandle) -> Result<McpManifestResult, String> {
    let manifest = json!({
        "name": "KobeanREST MCP Server",
        "version": "1.0.0",
        "description": "Local Model Context Protocol Server for KobeanREST API Client",
        "tools": [
            {
                "name": "list_collections",
                "description": "List all workspace API collections in KobeanREST",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            },
            {
                "name": "run_request",
                "description": "Execute an HTTP API request by ID",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "request_id": { "type": "string" }
                    },
                    "required": ["request_id"]
                }
            },
            {
                "name": "get_environment",
                "description": "Get current workspace environment variables",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            }
        ]
    });

    let manifest_json = serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?;

    Ok(McpManifestResult {
        manifest_json,
        server_name: "KobeanREST MCP Server".to_string(),
        version: "1.0.0".to_string(),
    })
}

#[tauri::command]
pub fn execute_mcp_tool_call(
    _app: AppHandle,
    tool_name: String,
    _arguments: String,
) -> Result<Value, String> {
    match tool_name.as_str() {
        "list_collections" => Ok(json!({
            "status": "success",
            "collections": [
                { "id": "default", "name": "Default Collection" }
            ]
        })),
        "run_request" => Ok(json!({
            "status": "success",
            "response": {
                "statusCode": 200,
                "statusText": "OK",
                "body": "{\"mock\": true}"
            }
        })),
        "get_environment" => Ok(json!({
            "status": "success",
            "variables": {}
        })),
        _ => Err(format!("Unknown MCP tool: {}", tool_name)),
    }
}
