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
            },
            {
              "name": "update_request",
              "description": "Update an existing API request's name, URL, method, headers, body, or query params",
              "inputSchema": {
                "type": "object",
                "properties": {
                  "request_id": { "type": "string", "description": "The ID of the request to update" },
                  "name": { "type": "string" },
                  "url": { "type": "string" },
                  "method": { "type": "string" },
                  "body": { "type": "string" },
                  "body_mime_type": { "type": "string" }
                },
                "required": ["request_id"]
              }
            },
            {
              "name": "save_request_script",
              "description": "Save a pre-request or post-request (test) script for a request, folder, or collection",
              "inputSchema": {
                "type": "object",
                "properties": {
                  "entity_id": { "type": "string", "description": "ID of the request, folder, or collection" },
                  "entity_type": { "type": "string", "enum": ["request", "folder", "collection"] },
                  "script_type": { "type": "string", "enum": ["pre_request", "post_request"] },
                  "content": { "type": "string", "description": "JavaScript code for the script" }
                },
                "required": ["entity_id", "entity_type", "script_type", "content"]
              }
            },
            {
              "name": "set_environment_variable",
              "description": "Set or update an environment variable in the active workspace environment",
              "inputSchema": {
                "type": "object",
                "properties": {
                  "environment_name": { "type": "string" },
                  "key": { "type": "string" },
                  "value": { "type": "string" }
                },
                "required": ["environment_name", "key", "value"]
              }
            },
            {
              "name": "create_new_request",
              "description": "Create a new blank API request in a specified folder",
              "inputSchema": {
                "type": "object",
                "properties": {
                  "folder_id": { "type": "string", "description": "The folder ID to create the request in" }
                },
                "required": ["folder_id"]
              }
            },
            {
              "name": "rename_folder",
              "description": "Rename a folder by its ID",
              "inputSchema": {
                "type": "object",
                "properties": {
                  "folder_id": { "type": "string" },
                  "name": { "type": "string" }
                },
                "required": ["folder_id", "name"]
              }
            },
            {
              "name": "rename_collection",
              "description": "Rename a collection by its ID",
              "inputSchema": {
                "type": "object",
                "properties": {
                  "collection_id": { "type": "string" },
                  "name": { "type": "string" }
                },
                "required": ["collection_id", "name"]
              }
            },
            {
              "name": "get_scripts",
              "description": "Get pre-request and post-request scripts for a request, folder, or collection",
              "inputSchema": {
                "type": "object",
                "properties": {
                  "entity_id": { "type": "string" },
                  "entity_type": { "type": "string", "enum": ["request", "folder", "collection"] }
                },
                "required": ["entity_id", "entity_type"]
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
        }
        "run_request" => {
            let args: Value =
                serde_json::from_str(&arguments).map_err(|e| format!("Invalid arguments: {e}"))?;
            let request_id = args
                .get("request_id")
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
        }
        "get_environment" => {
            let workspace = crate::persistence::load_workspace(app.clone())
                .map_err(|e| format!("Failed to load workspace: {e}"))?;
            Ok(json!({
                "status": "success",
                "active_environment": workspace.active_environment,
                "environments": workspace.environments
            }))
        }
        "list_workspaces" => {
            let workspaces = crate::persistence::list_workspaces(app.clone())
                .map_err(|e| format!("Failed to list workspaces: {e}"))?;
            Ok(json!({
                "status": "success",
                "workspaces": workspaces
            }))
        }
        "get_request_history" => {
            let history = crate::persistence::load_request_history(app.clone())
                .map_err(|e| format!("Failed to load history: {e}"))?;
            Ok(json!({
                "status": "success",
                "history": history
            }))
        }
        "search_collections" => {
            let args: Value =
                serde_json::from_str(&arguments).map_err(|e| format!("Invalid arguments: {e}"))?;
            let query = args
                .get("query")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_lowercase();
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
        }
        "search_folders" => {
            let args: Value =
                serde_json::from_str(&arguments).map_err(|e| format!("Invalid arguments: {e}"))?;
            let query = args
                .get("query")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_lowercase();
            let terms: Vec<&str> = query.split_whitespace().collect();
            let workspace = crate::persistence::load_workspace(app.clone())
                .map_err(|e| format!("Failed to load workspace: {e}"))?;
            let results: Vec<_> = workspace
                .folders
                .into_iter()
                .filter(|f| {
                    let name_lower = f.name.to_lowercase();
                    terms.is_empty() || terms.iter().any(|t| name_lower.contains(t))
                })
                .collect();
            Ok(json!({ "status": "success", "results": results }))
        }
        "search_requests" => {
            let args: Value =
                serde_json::from_str(&arguments).map_err(|e| format!("Invalid arguments: {e}"))?;
            let query = args
                .get("query")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_lowercase();
            let terms: Vec<&str> = query.split_whitespace().collect();
            let workspace = crate::persistence::load_workspace(app.clone())
                .map_err(|e| format!("Failed to load workspace: {e}"))?;
            let results: Vec<_> = workspace
                .requests
                .into_iter()
                .filter(|r| {
                    let name_lower = r.name.to_lowercase();
                    let url_lower = r.url.to_lowercase();
                    terms.is_empty()
                        || terms
                            .iter()
                            .any(|t| name_lower.contains(t) || url_lower.contains(t))
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
        }
        "update_request" => {
            let args: Value =
                serde_json::from_str(&arguments).map_err(|e| format!("Invalid arguments: {e}"))?;
            let request_id = args
                .get("request_id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing request_id".to_string())?;
            let mut workspace = crate::persistence::load_workspace(app.clone())
                .map_err(|e| format!("Failed to load workspace: {e}"))?;
            let request = workspace
                .requests
                .iter_mut()
                .find(|r| r.id == request_id)
                .ok_or_else(|| format!("Request {} not found", request_id))?;
            if let Some(name) = args.get("name").and_then(|v| v.as_str()) {
                request.name = name.to_string();
            }
            if let Some(url) = args.get("url").and_then(|v| v.as_str()) {
                request.url = url.to_string();
            }
            if let Some(method) = args.get("method").and_then(|v| v.as_str()) {
                request.method = method.to_string();
            }
            if let Some(body) = args.get("body").and_then(|v| v.as_str()) {
                request.body = body.to_string();
            }
            if let Some(mime) = args.get("body_mime_type").and_then(|v| v.as_str()) {
                request.body_mime_type = mime.to_string();
            }
            crate::persistence::save_request(app.clone(), request.clone())
                .map_err(|e| format!("Failed to save request: {e}"))?;
            Ok(json!({ "status": "success", "message": "Request updated", "id": request_id }))
        }
        "save_request_script" => {
            let args: Value =
                serde_json::from_str(&arguments).map_err(|e| format!("Invalid arguments: {e}"))?;
            let entity_id = args
                .get("entity_id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing entity_id".to_string())?;
            let entity_type = args
                .get("entity_type")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing entity_type".to_string())?;
            let script_type = args
                .get("script_type")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing script_type".to_string())?;
            let content = args
                .get("content")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing content".to_string())?;
            crate::persistence::save_script(
                app.clone(),
                entity_id.to_string(),
                entity_type.to_string(),
                script_type.to_string(),
                content.to_string(),
            )
            .map_err(|e| format!("Failed to save script: {e}"))?;
            Ok(json!({ "status": "success", "message": "Script saved" }))
        }
        "set_environment_variable" => {
            let args: Value =
                serde_json::from_str(&arguments).map_err(|e| format!("Invalid arguments: {e}"))?;
            let env_name = args
                .get("environment_name")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing environment_name".to_string())?;
            let key = args
                .get("key")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing key".to_string())?;
            let value = args
                .get("value")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing value".to_string())?;
            crate::persistence::save_variable(
                app.clone(),
                env_name.to_string(),
                key.to_string(),
                value.to_string(),
                None,
            )
            .map_err(|e| format!("Failed to save variable: {e}"))?;
            Ok(
                json!({ "status": "success", "message": format!("Set {}={} in {}", key, value, env_name) }),
            )
        }
        "create_new_request" => {
            let args: Value =
                serde_json::from_str(&arguments).map_err(|e| format!("Invalid arguments: {e}"))?;
            let folder_id = args
                .get("folder_id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing folder_id".to_string())?;
            let request = crate::persistence::create_request(app.clone(), folder_id.to_string())
                .map_err(|e| format!("Failed to create request: {e}"))?;
            Ok(json!({ "status": "success", "request": request }))
        }
        "rename_folder" => {
            let args: Value =
                serde_json::from_str(&arguments).map_err(|e| format!("Invalid arguments: {e}"))?;
            let folder_id = args
                .get("folder_id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing folder_id".to_string())?;
            let name = args
                .get("name")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing name".to_string())?;
            crate::persistence::update_folder(app.clone(), folder_id.to_string(), name.to_string())
                .map_err(|e| format!("Failed to rename folder: {e}"))?;
            Ok(json!({ "status": "success", "message": format!("Folder renamed to {}", name) }))
        }
        "rename_collection" => {
            let args: Value =
                serde_json::from_str(&arguments).map_err(|e| format!("Invalid arguments: {e}"))?;
            let collection_id = args
                .get("collection_id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing collection_id".to_string())?;
            let name = args
                .get("name")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing name".to_string())?;
            crate::persistence::update_collection(
                app.clone(),
                collection_id.to_string(),
                name.to_string(),
            )
            .map_err(|e| format!("Failed to rename collection: {e}"))?;
            Ok(json!({ "status": "success", "message": format!("Collection renamed to {}", name) }))
        }
        "get_scripts" => {
            let args: Value =
                serde_json::from_str(&arguments).map_err(|e| format!("Invalid arguments: {e}"))?;
            let entity_id = args
                .get("entity_id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing entity_id".to_string())?;
            let entity_type = args
                .get("entity_type")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing entity_type".to_string())?;
            let scripts = crate::persistence::get_scripts(
                app.clone(),
                entity_id.to_string(),
                entity_type.to_string(),
            )
            .map_err(|e| format!("Failed to get scripts: {e}"))?;
            Ok(json!({ "status": "success", "scripts": scripts }))
        }
        _ => Err(format!("Unknown MCP tool: {}", tool_name)),
    }
}
