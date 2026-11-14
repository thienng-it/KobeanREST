use serde_json::Value;
use tauri::AppHandle;

pub use kobean_core::spec_generator::OpenApiExportResult;

#[tauri::command]
pub fn export_openapi_30_spec(
    app: AppHandle,
    collection_id: Option<String>,
    collection_name: Option<String>,
) -> Result<OpenApiExportResult, String> {
    let dir = crate::persistence::data_dir(&app)?;
    kobean_core::spec_generator::export_openapi_30_spec(&dir, collection_id, collection_name)
}

#[tauri::command]
pub fn import_openapi_30_spec(app: AppHandle, openapi_content: String) -> Result<Value, String> {
    let dir = crate::persistence::data_dir(&app)?;
    kobean_core::spec_generator::import_openapi_30_spec(&dir, openapi_content)
}
