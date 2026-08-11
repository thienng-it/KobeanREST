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
            },
            {
                "name": "list_workspaces",
                "description": "List all available workspaces in KobeanREST",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            },
            {
                "name": "get_request_history",
                "description": "Get the history of recently executed requests",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            },
            {
                "name": "search_collections",
                "description": "Search for collections by name",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": { "type": "string" }
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "search_folders",
                "description": "Search for folders by name",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": { "type": "string" }
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "search_requests",
                "description": "Search for API requests by name or URL",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": { "type": "string" }
                    },
                    "required": ["query"]
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
    app: AppHandle,
    tool_name: String,
    arguments: String,
) -> Result<Value, String> {
    match tool_name.as_str() {
        "list_collections" => {
            let workspace = crate::persistence::load_workspace(app.clone())
                .map_err(|e| format!("Failed to load workspace: {e}"))?;
            Ok(json!({
                "status": "success",
                "collections": workspace.collections.unwrap_or_default()
            }))
        },
        "run_request" => {
            let args: Value = serde_json::from_str(&arguments)
                .map_err(|e| format!("Invalid arguments: {e}"))?;
            let request_id = args.get("request_id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing request_id".to_string())?;

            let workspace = crate::persistence::load_workspace(app.clone())
                .map_err(|e| format!("Failed to load workspace: {e}"))?;
            
            let request = workspace.requests.into_iter().find(|r| r.id == request_id);
            if let Some(req) = request {
                Ok(json!({
                    "status": "success",
                    "request": req
                }))
            } else {
                Err(format!("Request with ID {} not found", request_id))
            }
        },
        "get_environment" => {
            let workspace = crate::persistence::load_workspace(app.clone())
                .map_err(|e| format!("Failed to load workspace: {e}"))?;
            Ok(json!({
                "status": "success",
                "active_environment": workspace.active_environment,
                "environments": workspace.environments
            }))
        },
        "list_workspaces" => {
            let workspaces = crate::persistence::list_workspaces(app.clone())
                .map_err(|e| format!("Failed to list workspaces: {e}"))?;
            Ok(json!({
                "status": "success",
                "workspaces": workspaces
            }))
        },
        "get_request_history" => {
            let history = crate::persistence::load_request_history(app.clone())
                .map_err(|e| format!("Failed to load history: {e}"))?;
            Ok(json!({
                "status": "success",
                "history": history
            }))
        },
        "search_collections" => {
            let args: Value = serde_json::from_str(&arguments).map_err(|e| format!("Invalid arguments: {e}"))?;
            let query = args.get("query").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
            let terms: Vec<&str> = query.split_whitespace().collect();
            let workspace = crate::persistence::load_workspace(app.clone())
                .map_err(|e| format!("Failed to load workspace: {e}"))?;
            let mut results = Vec::new();
            if let Some(collections) = workspace.collections {
                for c in collections {
                    let name_lower = c.name.to_lowercase();
                    if terms.is_empty() || terms.iter().any(|t| name_lower.contains(t)) {
                        results.push(c);
                    }
                }
            }
            Ok(json!({ "status": "success", "results": results }))
        },
        "search_folders" => {
            let args: Value = serde_json::from_str(&arguments).map_err(|e| format!("Invalid arguments: {e}"))?;
            let query = args.get("query").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
            let terms: Vec<&str> = query.split_whitespace().collect();
            let workspace = crate::persistence::load_workspace(app.clone())
                .map_err(|e| format!("Failed to load workspace: {e}"))?;
            let results: Vec<_> = workspace.folders.into_iter()
                .filter(|f| {
                    let name_lower = f.name.to_lowercase();
                    terms.is_empty() || terms.iter().any(|t| name_lower.contains(t))
                })
                .collect();
            Ok(json!({ "status": "success", "results": results }))
        },
        "search_requests" => {
            let args: Value = serde_json::from_str(&arguments).map_err(|e| format!("Invalid arguments: {e}"))?;
            let query = args.get("query").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
            let terms: Vec<&str> = query.split_whitespace().collect();
            let workspace = crate::persistence::load_workspace(app.clone())
                .map_err(|e| format!("Failed to load workspace: {e}"))?;
            let results: Vec<_> = workspace.requests.into_iter()
                .filter(|r| {
                    let name_lower = r.name.to_lowercase();
                    let url_lower = r.url.to_lowercase();
                    terms.is_empty() || terms.iter().any(|t| name_lower.contains(t) || url_lower.contains(t))
                })
                .map(|r| {
                    json!({
                        "id": r.id,
                        "name": r.name,
                        "method": r.method,
                        "url": r.url,
                        "folder_id": r.folder_id
                    })
                })
                .collect();
            Ok(json!({ "status": "success", "results": results }))
        },
        _ => Err(format!("Unknown MCP tool: {}", tool_name)),
    }
}
