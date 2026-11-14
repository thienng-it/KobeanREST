use serde_json::Value;
use tauri::AppHandle;

pub use kobean_core::mcp_server::McpManifestResult;

#[tauri::command]
pub fn export_mcp_manifest(_app: AppHandle) -> Result<McpManifestResult, String> {
    kobean_core::mcp_server::export_mcp_manifest()
}

#[tauri::command]
pub fn execute_mcp_tool_call(
    app: AppHandle,
    tool_name: String,
    arguments: String,
) -> Result<Value, String> {
    let dir = crate::persistence::data_dir(&app)?;
    kobean_core::mcp_server::execute_mcp_tool_call(&dir, tool_name, arguments)
}
