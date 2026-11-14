use std::path::PathBuf;

use tauri::{AppHandle, Manager};

pub use kobean_core::persistence::{
    AppSettings, CollectionRunSummary, EnvironmentSummary, FolderSummary, HistoryEntry,
    HistoryResponsePayload, PersistenceStatus, RequestHistoryEntry, SavedRequest, ScopedVariable,
    Script, WorkspaceListItem, WorkspaceSummary,
};

pub fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map_err(|error| format!("failed to resolve local data directory: {error}"))
}

pub fn ensure_database(app: &AppHandle) -> Result<PersistenceStatus, String> {
    kobean_core::persistence::ensure_database(&data_dir(app)?)
}

#[tauri::command]
pub fn create_workspace(app: AppHandle, name: String) -> Result<String, String> {
    kobean_core::persistence::create_workspace(&data_dir(&app)?, name)
}

#[tauri::command]
pub fn create_collection(
    app: AppHandle,
    name: String,
    workspace_id: Option<String>,
) -> Result<String, String> {
    kobean_core::persistence::create_collection(&data_dir(&app)?, name, workspace_id)
}

#[tauri::command]
pub fn initialize_persistence(app: AppHandle) -> Result<PersistenceStatus, String> {
    kobean_core::persistence::initialize_persistence(&data_dir(&app)?)
}

#[tauri::command]
pub fn load_workspace(app: AppHandle) -> Result<WorkspaceSummary, String> {
    kobean_core::persistence::load_workspace(&data_dir(&app)?)
}

#[tauri::command]
pub fn list_workspaces(app: AppHandle) -> Result<Vec<WorkspaceListItem>, String> {
    kobean_core::persistence::list_workspaces(&data_dir(&app)?)
}

#[tauri::command]
pub fn rename_workspace(app: AppHandle, workspace_id: String, name: String) -> Result<(), String> {
    kobean_core::persistence::rename_workspace(&data_dir(&app)?, workspace_id, name)
}

#[tauri::command]
pub fn delete_workspace(app: AppHandle, workspace_id: String) -> Result<(), String> {
    kobean_core::persistence::delete_workspace(&data_dir(&app)?, workspace_id)
}

#[tauri::command]
pub fn switch_workspace(app: AppHandle, workspace_id: String) -> Result<WorkspaceSummary, String> {
    kobean_core::persistence::switch_workspace(&data_dir(&app)?, workspace_id)
}

#[tauri::command]
pub fn load_workspace_by_id(
    app: AppHandle,
    workspace_id: String,
) -> Result<WorkspaceSummary, String> {
    kobean_core::persistence::load_workspace_by_id(&data_dir(&app)?, workspace_id)
}

#[tauri::command]
pub fn record_request_history(app: AppHandle, entry: RequestHistoryEntry) -> Result<(), String> {
    kobean_core::persistence::record_request_history(&data_dir(&app)?, entry)
}

#[tauri::command]
pub fn load_request_history(app: AppHandle) -> Result<Vec<HistoryEntry>, String> {
    kobean_core::persistence::load_request_history(&data_dir(&app)?)
}

#[tauri::command]
pub fn clear_request_history(app: AppHandle) -> Result<(), String> {
    kobean_core::persistence::clear_request_history(&data_dir(&app)?)
}

#[tauri::command]
pub fn load_history_response(app: AppHandle, id: i64) -> Result<HistoryResponsePayload, String> {
    kobean_core::persistence::load_history_response(&data_dir(&app)?, id)
}

#[tauri::command]
pub fn load_collection_runs(
    app: AppHandle,
    scope_id: String,
) -> Result<Vec<CollectionRunSummary>, String> {
    kobean_core::persistence::load_collection_runs(&data_dir(&app)?, scope_id)
}

#[tauri::command]
pub fn load_collection_run_details(
    app: AppHandle,
    run_id: String,
) -> Result<Vec<HistoryEntry>, String> {
    kobean_core::persistence::load_collection_run_details(&data_dir(&app)?, run_id)
}

#[tauri::command]
pub fn load_app_settings(app: AppHandle) -> Result<AppSettings, String> {
    kobean_core::persistence::load_app_settings(&data_dir(&app)?)
}

#[tauri::command]
pub fn save_app_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    kobean_core::persistence::save_app_settings(&data_dir(&app)?, settings)
}

#[tauri::command]
pub fn export_workspace_data(app: AppHandle) -> Result<String, String> {
    kobean_core::persistence::export_workspace_data(&data_dir(&app)?)
}

#[tauri::command]
pub fn import_workspace_data(app: AppHandle, json: String) -> Result<(), String> {
    kobean_core::persistence::import_workspace_data(&data_dir(&app)?, json)
}

#[tauri::command]
pub fn reorder_items(app: AppHandle, item_type: String, ids: Vec<String>) -> Result<(), String> {
    kobean_core::persistence::reorder_items(&data_dir(&app)?, item_type, ids)
}

#[tauri::command]
pub fn save_request(app: AppHandle, request: SavedRequest) -> Result<(), String> {
    kobean_core::persistence::save_request(&data_dir(&app)?, request)
}

#[tauri::command]
pub fn delete_request(app: AppHandle, request_id: String) -> Result<(), String> {
    kobean_core::persistence::delete_request(&data_dir(&app)?, request_id)
}

#[tauri::command]
pub fn create_folder(
    app: AppHandle,
    name: String,
    collection_id: Option<String>,
    parent_id: Option<String>,
) -> Result<FolderSummary, String> {
    kobean_core::persistence::create_folder(&data_dir(&app)?, name, collection_id, parent_id)
}

#[tauri::command]
pub fn update_folder(app: AppHandle, folder_id: String, name: String) -> Result<(), String> {
    kobean_core::persistence::update_folder(&data_dir(&app)?, folder_id, name)
}

#[tauri::command]
pub fn move_folder(
    app: AppHandle,
    folder_id: String,
    parent_id: Option<String>,
    collection_id: Option<String>,
) -> Result<(), String> {
    kobean_core::persistence::move_folder(&data_dir(&app)?, folder_id, parent_id, collection_id)
}

#[tauri::command]
pub fn update_collection(
    app: AppHandle,
    collection_id: String,
    name: String,
) -> Result<(), String> {
    kobean_core::persistence::update_collection(&data_dir(&app)?, collection_id, name)
}

#[tauri::command]
pub fn update_collection_default_environment(
    app: AppHandle,
    collection_id: String,
    default_environment: Option<String>,
) -> Result<(), String> {
    kobean_core::persistence::update_collection_default_environment(
        &data_dir(&app)?,
        collection_id,
        default_environment,
    )
}

#[tauri::command]
pub fn delete_collection(app: AppHandle, collection_id: String) -> Result<(), String> {
    kobean_core::persistence::delete_collection(&data_dir(&app)?, collection_id)
}

#[tauri::command]
pub fn delete_folder(app: AppHandle, folder_id: String) -> Result<(), String> {
    kobean_core::persistence::delete_folder(&data_dir(&app)?, folder_id)
}

#[tauri::command]
pub fn create_request(app: AppHandle, folder_id: String) -> Result<SavedRequest, String> {
    kobean_core::persistence::create_request(&data_dir(&app)?, folder_id)
}

#[tauri::command]
pub fn create_environment(app: AppHandle, name: String) -> Result<EnvironmentSummary, String> {
    kobean_core::persistence::create_environment(&data_dir(&app)?, name)
}

#[tauri::command]
pub fn rename_environment(
    app: AppHandle,
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    kobean_core::persistence::rename_environment(&data_dir(&app)?, old_name, new_name)
}

#[tauri::command]
pub fn delete_environment(app: AppHandle, name: String) -> Result<(), String> {
    kobean_core::persistence::delete_environment(&data_dir(&app)?, name)
}

#[tauri::command]
pub fn set_active_environment(app: AppHandle, name: String) -> Result<(), String> {
    kobean_core::persistence::set_active_environment(&data_dir(&app)?, name)
}

#[tauri::command]
pub fn save_variable(
    app: AppHandle,
    environment_name: String,
    key: String,
    value: String,
    masked: Option<bool>,
) -> Result<(), String> {
    kobean_core::persistence::save_variable(&data_dir(&app)?, environment_name, key, value, masked)
}

#[tauri::command]
pub fn delete_variable(
    app: AppHandle,
    environment_name: String,
    key: String,
) -> Result<(), String> {
    kobean_core::persistence::delete_variable(&data_dir(&app)?, environment_name, key)
}

#[tauri::command]
pub fn save_secret_variable(
    app: AppHandle,
    environment_name: String,
    key: String,
    secret_ref: String,
) -> Result<(), String> {
    kobean_core::persistence::save_secret_variable(&data_dir(&app)?, environment_name, key, secret_ref)
}

#[tauri::command]
pub fn save_scoped_variable(
    app: AppHandle,
    entity_id: String,
    entity_type: String,
    key: String,
    value: String,
) -> Result<(), String> {
    kobean_core::persistence::save_scoped_variable(
        &data_dir(&app)?,
        entity_id,
        entity_type,
        key,
        value,
    )
}

#[tauri::command]
pub fn save_scoped_secret_variable(
    app: AppHandle,
    entity_id: String,
    entity_type: String,
    key: String,
    secret_ref: String,
) -> Result<(), String> {
    kobean_core::persistence::save_scoped_secret_variable(
        &data_dir(&app)?,
        entity_id,
        entity_type,
        key,
        secret_ref,
    )
}

#[tauri::command]
pub fn delete_scoped_variable(
    app: AppHandle,
    entity_id: String,
    entity_type: String,
    key: String,
) -> Result<(), String> {
    kobean_core::persistence::delete_scoped_variable(&data_dir(&app)?, entity_id, entity_type, key)
}

#[tauri::command]
pub fn get_scoped_variables(
    app: AppHandle,
    entity_id: String,
    entity_type: String,
) -> Result<Vec<ScopedVariable>, String> {
    kobean_core::persistence::get_scoped_variables(&data_dir(&app)?, entity_id, entity_type)
}

#[tauri::command]
pub fn get_scripts(
    app: AppHandle,
    entity_id: String,
    entity_type: String,
) -> Result<Vec<Script>, String> {
    kobean_core::persistence::get_scripts(&data_dir(&app)?, entity_id, entity_type)
}

#[tauri::command]
pub fn get_all_scripts(app: AppHandle) -> Result<Vec<Script>, String> {
    kobean_core::persistence::get_all_scripts(&data_dir(&app)?)
}

#[tauri::command]
pub fn save_script(
    app: AppHandle,
    entity_id: String,
    entity_type: String,
    script_type: String,
    content: String,
) -> Result<(), String> {
    kobean_core::persistence::save_script(
        &data_dir(&app)?,
        entity_id,
        entity_type,
        script_type,
        content,
    )
}

#[tauri::command]
pub fn delete_script(app: AppHandle, script_id: String) -> Result<(), String> {
    kobean_core::persistence::delete_script(&data_dir(&app)?, script_id)
}

#[tauri::command]
pub fn save_folder_auth(
    app: AppHandle,
    folder_id: String,
    auth_mode: String,
    auth_config: serde_json::Value,
) -> Result<(), String> {
    kobean_core::persistence::save_folder_auth(&data_dir(&app)?, folder_id, auth_mode, auth_config)
}

#[tauri::command]
pub fn save_collection_auth(
    app: AppHandle,
    collection_id: String,
    auth_mode: String,
    auth_config: serde_json::Value,
) -> Result<(), String> {
    kobean_core::persistence::save_collection_auth(
        &data_dir(&app)?,
        collection_id,
        auth_mode,
        auth_config,
    )
}

#[tauri::command]
pub fn save_folder_description(
    app: AppHandle,
    folder_id: String,
    description: String,
) -> Result<(), String> {
    kobean_core::persistence::save_folder_description(&data_dir(&app)?, folder_id, description)
}

#[tauri::command]
pub fn save_collection_description(
    app: AppHandle,
    collection_id: String,
    description: String,
) -> Result<(), String> {
    kobean_core::persistence::save_collection_description(
        &data_dir(&app)?,
        collection_id,
        description,
    )
}
