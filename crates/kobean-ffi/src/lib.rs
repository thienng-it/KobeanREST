use std::collections::HashMap;
use std::path::Path;
use std::sync::OnceLock;

use kobean_core::domain::{auth, importer, path_variables, request_prep, variables};
use kobean_core::http_client::ExecuteHttpRequest;
use kobean_core::mock_server::{
    clear_mock_request_log, get_mock_request_log, get_mock_routes, get_mock_server_status,
    set_mock_routes, start_local_mock_server, stop_local_mock_server, MockRoute, MockServerState,
};
use kobean_core::secrets::StoreSecretInput;
use kobean_core::{local_only, mcp_server, persistence, secrets, spec_generator};
use serde::Deserialize;

uniffi::setup_scaffolding!();

static TOKIO_RUNTIME: OnceLock<Result<tokio::runtime::Runtime, String>> = OnceLock::new();

fn runtime() -> Result<&'static tokio::runtime::Runtime, KobeanFfiError> {
    TOKIO_RUNTIME
        .get_or_init(|| {
            tokio::runtime::Builder::new_multi_thread()
                .enable_all()
                .build()
                .map_err(|e| format!("failed to create tokio runtime: {e}"))
        })
        .as_ref()
        .map_err(|msg| KobeanFfiError::Message {
            message: msg.clone(),
        })
}

#[derive(Debug, thiserror::Error, uniffi::Error)]
pub enum KobeanFfiError {
    #[error("{message}")]
    Message { message: String },
}

fn map_err(message: String) -> KobeanFfiError {
    KobeanFfiError::Message { message }
}

fn to_json<T: serde::Serialize>(value: &T) -> Result<String, KobeanFfiError> {
    serde_json::to_string(value).map_err(|e| KobeanFfiError::Message {
        message: format!("failed to serialize JSON: {e}"),
    })
}

fn from_json<T: serde::de::DeserializeOwned>(json: &str) -> Result<T, KobeanFfiError> {
    serde_json::from_str(json).map_err(|e| KobeanFfiError::Message {
        message: format!("failed to parse JSON: {e}"),
    })
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiAppContract {
    pub launch_model: String,
    pub account_system: String,
    pub offline_ready: bool,
    pub update_checks: String,
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiLocalStorageStatus {
    pub database: String,
    pub secret_storage: String,
    pub export_policy: String,
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiPersistenceStatus {
    pub database_path: String,
    pub migrated: bool,
}

// ── App Contract & Local-Only Metadata ──────────────────────────────────────

#[uniffi::export]
pub fn ffi_app_contract() -> FfiAppContract {
    let contract = local_only::app_contract();
    FfiAppContract {
        launch_model: contract.launch_model.to_string(),
        account_system: contract.account_system.to_string(),
        offline_ready: contract.offline_ready,
        update_checks: contract.update_checks.to_string(),
    }
}

#[uniffi::export]
pub fn ffi_local_storage_status() -> FfiLocalStorageStatus {
    let status = local_only::local_storage_status();
    FfiLocalStorageStatus {
        database: status.database.to_string(),
        secret_storage: status.secret_storage.to_string(),
        export_policy: status.export_policy.to_string(),
    }
}

#[uniffi::export]
pub fn ffi_request_auth_modes() -> Vec<String> {
    local_only::request_auth_modes()
        .into_iter()
        .map(str::to_string)
        .collect()
}

// ── Persistence & Workspace Commands ────────────────────────────────────────

#[uniffi::export]
pub fn ffi_initialize_persistence(
    data_dir: String,
) -> Result<FfiPersistenceStatus, KobeanFfiError> {
    let status = persistence::initialize_persistence(Path::new(&data_dir)).map_err(map_err)?;
    Ok(FfiPersistenceStatus {
        database_path: status.database_path,
        migrated: status.migrated,
    })
}

#[uniffi::export]
pub fn load_workspace_json(data_dir: String) -> Result<String, KobeanFfiError> {
    let workspace = persistence::load_workspace(Path::new(&data_dir)).map_err(map_err)?;
    to_json(&workspace)
}

#[uniffi::export]
pub fn list_workspaces_json(data_dir: String) -> Result<String, KobeanFfiError> {
    let list = persistence::list_workspaces(Path::new(&data_dir)).map_err(map_err)?;
    to_json(&list)
}

#[uniffi::export]
pub fn load_workspace_by_id_json(
    data_dir: String,
    workspace_id: String,
) -> Result<String, KobeanFfiError> {
    let workspace =
        persistence::load_workspace_by_id(Path::new(&data_dir), workspace_id).map_err(map_err)?;
    to_json(&workspace)
}

#[uniffi::export]
pub fn switch_workspace_json(
    data_dir: String,
    workspace_id: String,
) -> Result<String, KobeanFfiError> {
    let workspace =
        persistence::switch_workspace(Path::new(&data_dir), workspace_id).map_err(map_err)?;
    to_json(&workspace)
}

#[uniffi::export]
pub fn create_workspace(data_dir: String, name: String) -> Result<String, KobeanFfiError> {
    persistence::create_workspace(Path::new(&data_dir), name).map_err(map_err)
}

#[uniffi::export]
pub fn rename_workspace(
    data_dir: String,
    workspace_id: String,
    name: String,
) -> Result<(), KobeanFfiError> {
    persistence::rename_workspace(Path::new(&data_dir), workspace_id, name).map_err(map_err)
}

#[uniffi::export]
pub fn delete_workspace(data_dir: String, workspace_id: String) -> Result<(), KobeanFfiError> {
    persistence::delete_workspace(Path::new(&data_dir), workspace_id).map_err(map_err)
}

#[uniffi::export]
pub fn create_collection(
    data_dir: String,
    name: String,
    workspace_id: Option<String>,
) -> Result<String, KobeanFfiError> {
    persistence::create_collection(Path::new(&data_dir), name, workspace_id).map_err(map_err)
}

#[uniffi::export]
pub fn update_collection(
    data_dir: String,
    collection_id: String,
    name: String,
) -> Result<(), KobeanFfiError> {
    persistence::update_collection(Path::new(&data_dir), collection_id, name).map_err(map_err)
}

#[uniffi::export]
pub fn delete_collection(data_dir: String, collection_id: String) -> Result<(), KobeanFfiError> {
    persistence::delete_collection(Path::new(&data_dir), collection_id).map_err(map_err)
}

#[uniffi::export]
pub fn update_collection_default_environment(
    data_dir: String,
    collection_id: String,
    default_environment: Option<String>,
) -> Result<(), KobeanFfiError> {
    persistence::update_collection_default_environment(
        Path::new(&data_dir),
        collection_id,
        default_environment,
    )
    .map_err(map_err)
}

#[uniffi::export]
pub fn save_collection_auth(
    data_dir: String,
    collection_id: String,
    auth_mode: String,
    auth_config_json: String,
) -> Result<(), KobeanFfiError> {
    let auth_config: serde_json::Value = from_json(&auth_config_json)?;
    persistence::save_collection_auth(
        Path::new(&data_dir),
        collection_id,
        auth_mode,
        auth_config,
    )
    .map_err(map_err)
}

#[uniffi::export]
pub fn save_collection_description(
    data_dir: String,
    collection_id: String,
    description: String,
) -> Result<(), KobeanFfiError> {
    persistence::save_collection_description(Path::new(&data_dir), collection_id, description)
        .map_err(map_err)
}

#[uniffi::export]
pub fn create_folder(
    data_dir: String,
    name: String,
    collection_id: Option<String>,
    parent_id: Option<String>,
) -> Result<String, KobeanFfiError> {
    let folder =
        persistence::create_folder(Path::new(&data_dir), name, collection_id, parent_id)
            .map_err(map_err)?;
    to_json(&folder)
}

#[uniffi::export]
pub fn update_folder(
    data_dir: String,
    folder_id: String,
    name: String,
) -> Result<(), KobeanFfiError> {
    persistence::update_folder(Path::new(&data_dir), folder_id, name).map_err(map_err)
}

#[uniffi::export]
pub fn move_folder(
    data_dir: String,
    folder_id: String,
    parent_id: Option<String>,
    collection_id: Option<String>,
) -> Result<(), KobeanFfiError> {
    persistence::move_folder(Path::new(&data_dir), folder_id, parent_id, collection_id)
        .map_err(map_err)
}

#[uniffi::export]
pub fn delete_folder(data_dir: String, folder_id: String) -> Result<(), KobeanFfiError> {
    persistence::delete_folder(Path::new(&data_dir), folder_id).map_err(map_err)
}

#[uniffi::export]
pub fn save_folder_auth(
    data_dir: String,
    folder_id: String,
    auth_mode: String,
    auth_config_json: String,
) -> Result<(), KobeanFfiError> {
    let auth_config: serde_json::Value = from_json(&auth_config_json)?;
    persistence::save_folder_auth(Path::new(&data_dir), folder_id, auth_mode, auth_config)
        .map_err(map_err)
}

#[uniffi::export]
pub fn save_folder_description(
    data_dir: String,
    folder_id: String,
    description: String,
) -> Result<(), KobeanFfiError> {
    persistence::save_folder_description(Path::new(&data_dir), folder_id, description)
        .map_err(map_err)
}

#[uniffi::export]
pub fn create_request(data_dir: String, folder_id: String) -> Result<String, KobeanFfiError> {
    let req = persistence::create_request(Path::new(&data_dir), folder_id).map_err(map_err)?;
    to_json(&req)
}

#[uniffi::export]
pub fn save_request_json(data_dir: String, request_json: String) -> Result<(), KobeanFfiError> {
    let req: persistence::SavedRequest = from_json(&request_json)?;
    persistence::save_request(Path::new(&data_dir), req).map_err(map_err)
}

#[uniffi::export]
pub fn delete_request(data_dir: String, request_id: String) -> Result<(), KobeanFfiError> {
    persistence::delete_request(Path::new(&data_dir), request_id).map_err(map_err)
}

#[uniffi::export]
pub fn reorder_items(
    data_dir: String,
    item_type: String,
    ids: Vec<String>,
) -> Result<(), KobeanFfiError> {
    persistence::reorder_items(Path::new(&data_dir), item_type, ids).map_err(map_err)
}

#[uniffi::export]
pub fn create_environment(data_dir: String, name: String) -> Result<String, KobeanFfiError> {
    let env = persistence::create_environment(Path::new(&data_dir), name).map_err(map_err)?;
    to_json(&env)
}

#[uniffi::export]
pub fn rename_environment(
    data_dir: String,
    old_name: String,
    new_name: String,
) -> Result<(), KobeanFfiError> {
    persistence::rename_environment(Path::new(&data_dir), old_name, new_name).map_err(map_err)
}

#[uniffi::export]
pub fn delete_environment(data_dir: String, name: String) -> Result<(), KobeanFfiError> {
    persistence::delete_environment(Path::new(&data_dir), name).map_err(map_err)
}

#[uniffi::export]
pub fn set_active_environment(data_dir: String, name: String) -> Result<(), KobeanFfiError> {
    persistence::set_active_environment(Path::new(&data_dir), name).map_err(map_err)
}

#[uniffi::export]
pub fn save_variable(
    data_dir: String,
    environment_name: String,
    key: String,
    value: String,
    masked: Option<bool>,
) -> Result<(), KobeanFfiError> {
    persistence::save_variable(Path::new(&data_dir), environment_name, key, value, masked)
        .map_err(map_err)
}

#[uniffi::export]
pub fn save_secret_variable(
    data_dir: String,
    environment_name: String,
    key: String,
    secret_ref: String,
) -> Result<(), KobeanFfiError> {
    persistence::save_secret_variable(Path::new(&data_dir), environment_name, key, secret_ref)
        .map_err(map_err)
}

#[uniffi::export]
pub fn delete_variable(
    data_dir: String,
    environment_name: String,
    key: String,
) -> Result<(), KobeanFfiError> {
    persistence::delete_variable(Path::new(&data_dir), environment_name, key).map_err(map_err)
}

#[uniffi::export]
pub fn get_scoped_variables_json(
    data_dir: String,
    entity_id: String,
    entity_type: String,
) -> Result<String, KobeanFfiError> {
    let vars = persistence::get_scoped_variables(Path::new(&data_dir), entity_id, entity_type)
        .map_err(map_err)?;
    to_json(&vars)
}

#[uniffi::export]
pub fn save_scoped_variable(
    data_dir: String,
    entity_id: String,
    entity_type: String,
    key: String,
    value: String,
) -> Result<(), KobeanFfiError> {
    persistence::save_scoped_variable(
        Path::new(&data_dir),
        entity_id,
        entity_type,
        key,
        value,
    )
    .map_err(map_err)
}

#[uniffi::export]
pub fn save_scoped_secret_variable(
    data_dir: String,
    entity_id: String,
    entity_type: String,
    key: String,
    secret_ref: String,
) -> Result<(), KobeanFfiError> {
    persistence::save_scoped_secret_variable(
        Path::new(&data_dir),
        entity_id,
        entity_type,
        key,
        secret_ref,
    )
    .map_err(map_err)
}

#[uniffi::export]
pub fn delete_scoped_variable(
    data_dir: String,
    entity_id: String,
    entity_type: String,
    key: String,
) -> Result<(), KobeanFfiError> {
    persistence::delete_scoped_variable(Path::new(&data_dir), entity_id, entity_type, key)
        .map_err(map_err)
}

#[uniffi::export]
pub fn get_scripts_json(
    data_dir: String,
    entity_id: String,
    entity_type: String,
) -> Result<String, KobeanFfiError> {
    let scripts = persistence::get_scripts(Path::new(&data_dir), entity_id, entity_type)
        .map_err(map_err)?;
    to_json(&scripts)
}

#[uniffi::export]
pub fn get_all_scripts_json(data_dir: String) -> Result<String, KobeanFfiError> {
    let scripts = persistence::get_all_scripts(Path::new(&data_dir)).map_err(map_err)?;
    to_json(&scripts)
}

#[uniffi::export]
pub fn save_script(
    data_dir: String,
    entity_id: String,
    entity_type: String,
    script_type: String,
    content: String,
) -> Result<(), KobeanFfiError> {
    persistence::save_script(
        Path::new(&data_dir),
        entity_id,
        entity_type,
        script_type,
        content,
    )
    .map_err(map_err)
}

#[uniffi::export]
pub fn delete_script(data_dir: String, script_id: String) -> Result<(), KobeanFfiError> {
    persistence::delete_script(Path::new(&data_dir), script_id).map_err(map_err)
}

#[uniffi::export]
pub fn record_request_history_json(
    data_dir: String,
    entry_json: String,
) -> Result<(), KobeanFfiError> {
    let entry: persistence::RequestHistoryEntry = from_json(&entry_json)?;
    persistence::record_request_history(Path::new(&data_dir), entry).map_err(map_err)
}

#[uniffi::export]
pub fn load_request_history_json(data_dir: String) -> Result<String, KobeanFfiError> {
    let history = persistence::load_request_history(Path::new(&data_dir)).map_err(map_err)?;
    to_json(&history)
}

#[uniffi::export]
pub fn load_history_response_json(data_dir: String, id: i64) -> Result<String, KobeanFfiError> {
    let payload = persistence::load_history_response(Path::new(&data_dir), id).map_err(map_err)?;
    to_json(&payload)
}

#[uniffi::export]
pub fn clear_request_history(data_dir: String) -> Result<(), KobeanFfiError> {
    persistence::clear_request_history(Path::new(&data_dir)).map_err(map_err)
}

#[uniffi::export]
pub fn load_app_settings_json(data_dir: String) -> Result<String, KobeanFfiError> {
    let settings = persistence::load_app_settings(Path::new(&data_dir)).map_err(map_err)?;
    to_json(&settings)
}

#[uniffi::export]
pub fn save_app_settings_json(
    data_dir: String,
    settings_json: String,
) -> Result<(), KobeanFfiError> {
    let settings: persistence::AppSettings = from_json(&settings_json)?;
    persistence::save_app_settings(Path::new(&data_dir), settings).map_err(map_err)
}

#[uniffi::export]
pub fn load_collection_runs_json(
    data_dir: String,
    scope_id: String,
) -> Result<String, KobeanFfiError> {
    let runs =
        persistence::load_collection_runs(Path::new(&data_dir), scope_id).map_err(map_err)?;
    to_json(&runs)
}

#[uniffi::export]
pub fn load_collection_run_details_json(
    data_dir: String,
    run_id: String,
) -> Result<String, KobeanFfiError> {
    let details =
        persistence::load_collection_run_details(Path::new(&data_dir), run_id).map_err(map_err)?;
    to_json(&details)
}

#[uniffi::export]
pub fn export_workspace_data(data_dir: String) -> Result<String, KobeanFfiError> {
    persistence::export_workspace_data(Path::new(&data_dir)).map_err(map_err)
}

#[uniffi::export]
pub fn import_workspace_data(data_dir: String, json: String) -> Result<(), KobeanFfiError> {
    persistence::import_workspace_data(Path::new(&data_dir), json).map_err(map_err)
}

// ── Secrets ─────────────────────────────────────────────────────────────────

#[uniffi::export]
pub fn secret_ref(scope: String, key: String) -> String {
    secrets::secret_ref(&scope, &key)
}

#[uniffi::export]
pub fn store_secret(scope: String, key: String, value: String) -> Result<String, KobeanFfiError> {
    let secret = secrets::store_secret(StoreSecretInput { scope, key, value }).map_err(map_err)?;
    Ok(secret.ref_id)
}

#[uniffi::export]
pub fn resolve_secrets(ref_ids: Vec<String>) -> Result<HashMap<String, String>, KobeanFfiError> {
    secrets::resolve_secrets(ref_ids).map_err(map_err)
}

#[uniffi::export]
pub fn delete_secret(ref_id: String) -> Result<(), KobeanFfiError> {
    secrets::delete_secret(ref_id).map_err(map_err)
}

// ── HTTP Client ─────────────────────────────────────────────────────────────

#[uniffi::export]
pub fn execute_http_request_json(request_json: String) -> Result<String, KobeanFfiError> {
    let input: ExecuteHttpRequest = from_json(&request_json)?;
    let rt = runtime()?;
    let response = rt
        .block_on(kobean_core::http_client::execute_http_request(input))
        .map_err(map_err)?;
    to_json(&response)
}

// ── OpenAPI & MCP ───────────────────────────────────────────────────────────

#[uniffi::export]
pub fn export_openapi_30_spec_json(
    data_dir: String,
    collection_id: Option<String>,
    collection_name: Option<String>,
) -> Result<String, KobeanFfiError> {
    let result = spec_generator::export_openapi_30_spec(
        Path::new(&data_dir),
        collection_id,
        collection_name,
    )
    .map_err(map_err)?;
    to_json(&result)
}

#[uniffi::export]
pub fn import_openapi_30_spec_json(
    data_dir: String,
    openapi_content: String,
) -> Result<String, KobeanFfiError> {
    let result = spec_generator::import_openapi_30_spec(Path::new(&data_dir), openapi_content)
        .map_err(map_err)?;
    to_json(&result)
}

#[uniffi::export]
pub fn export_mcp_manifest_json() -> Result<String, KobeanFfiError> {
    let result = mcp_server::export_mcp_manifest().map_err(map_err)?;
    to_json(&result)
}

#[uniffi::export]
pub fn execute_mcp_tool_call_json(
    data_dir: String,
    tool_name: String,
    arguments: String,
) -> Result<String, KobeanFfiError> {
    let result =
        mcp_server::execute_mcp_tool_call(Path::new(&data_dir), tool_name, arguments)
            .map_err(map_err)?;
    to_json(&result)
}

// ── Mock Server ─────────────────────────────────────────────────────────────

#[derive(uniffi::Object)]
pub struct FfiMockServer {
    state: MockServerState,
}

impl Default for FfiMockServer {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for FfiMockServer {
    fn drop(&mut self) {
        let _ = stop_local_mock_server(&self.state);
    }
}

#[uniffi::export]
impl FfiMockServer {
    #[uniffi::constructor]
    pub fn new() -> Self {
        Self {
            state: MockServerState::default(),
        }
    }

    pub fn start(
        &self,
        port: u16,
        active_collection_id: Option<String>,
    ) -> Result<u16, KobeanFfiError> {
        start_local_mock_server(&self.state, port, active_collection_id).map_err(map_err)
    }

    pub fn stop(&self) -> Result<(), KobeanFfiError> {
        stop_local_mock_server(&self.state).map_err(map_err)
    }

    pub fn status_json(&self) -> Result<String, KobeanFfiError> {
        let status = get_mock_server_status(&self.state).map_err(map_err)?;
        to_json(&status)
    }

    pub fn set_routes_json(&self, routes_json: String) -> Result<(), KobeanFfiError> {
        let routes: Vec<MockRoute> = from_json(&routes_json)?;
        set_mock_routes(&self.state, routes).map_err(map_err)
    }

    pub fn get_routes_json(&self) -> Result<String, KobeanFfiError> {
        let routes = get_mock_routes(&self.state).map_err(map_err)?;
        to_json(&routes)
    }

    pub fn get_request_log_json(&self) -> Result<String, KobeanFfiError> {
        let logs = get_mock_request_log(&self.state).map_err(map_err)?;
        to_json(&logs)
    }

    pub fn clear_request_log(&self) -> Result<(), KobeanFfiError> {
        clear_mock_request_log(&self.state).map_err(map_err)
    }
}

// ── Domain Helpers & Functions ──────────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FfiEnvironmentVariable {
    key: String,
    value: String,
    #[serde(default)]
    secret: bool,
    #[serde(default)]
    secret_ref: Option<String>,
    #[serde(default)]
    masked: bool,
}

#[derive(Deserialize)]
struct FfiEnvironmentSummary {
    name: String,
    #[serde(default)]
    variables: Vec<FfiEnvironmentVariable>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FfiWorkspaceSummary {
    id: String,
    name: String,
    #[serde(default)]
    active_environment: String,
    #[serde(default)]
    environments: Vec<FfiEnvironmentSummary>,
    #[serde(default)]
    folders: Vec<persistence::FolderSummary>,
    #[serde(default)]
    requests: Vec<persistence::SavedRequest>,
    #[serde(default)]
    collections: Option<Vec<persistence::CollectionSummary>>,
}

impl From<FfiWorkspaceSummary> for persistence::WorkspaceSummary {
    fn from(w: FfiWorkspaceSummary) -> Self {
        Self {
            id: w.id,
            name: w.name,
            active_environment: w.active_environment,
            environments: w
                .environments
                .into_iter()
                .map(|e| persistence::EnvironmentSummary {
                    name: e.name,
                    variables: e
                        .variables
                        .into_iter()
                        .map(|v| persistence::EnvironmentVariable {
                            key: v.key,
                            value: v.value,
                            secret: v.secret,
                            secret_ref: v.secret_ref,
                            masked: v.masked,
                        })
                        .collect(),
                })
                .collect(),
            folders: w.folders,
            requests: w.requests,
            collections: w.collections,
        }
    }
}

fn parse_auth_config_json(auth_config_json: &str) -> Result<auth::AuthConfig, KobeanFfiError> {
    if auth_config_json.trim().is_empty() {
        Ok(auth::AuthConfig::default())
    } else {
        from_json(auth_config_json)
    }
}

#[uniffi::export]
pub fn prepare_http_request_json(
    request_json: String,
    workspace_json: String,
    variable_map_json: String,
    custom_method: Option<String>,
) -> Result<String, KobeanFfiError> {
    let request: persistence::SavedRequest = from_json(&request_json)?;
    let workspace: persistence::WorkspaceSummary =
        from_json::<FfiWorkspaceSummary>(&workspace_json)?.into();
    let variable_map: HashMap<String, String> = from_json(&variable_map_json)?;
    let prepared = request_prep::prepare_http_request(
        &request,
        &workspace,
        &variable_map,
        custom_method.as_deref(),
    )
    .map_err(|e| map_err(e.to_string()))?;
    to_json(&prepared)
}

#[uniffi::export]
pub fn build_scoped_variable_map_json(
    workspace_json: String,
    collection_id: Option<String>,
    folder_id: Option<String>,
    request_id: Option<String>,
    request_json: Option<String>,
) -> Result<String, KobeanFfiError> {
    let workspace: persistence::WorkspaceSummary =
        from_json::<FfiWorkspaceSummary>(&workspace_json)?.into();
    let request: Option<persistence::SavedRequest> = request_json
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .map(from_json)
        .transpose()?;
    let scope = variables::VariableScope {
        collection_id: collection_id.as_deref(),
        folder_id: folder_id.as_deref(),
        request_id: request_id.as_deref(),
        request: request.as_ref(),
    };
    let map = variables::build_scoped_variable_map(&workspace, &scope);
    to_json(&map)
}

#[uniffi::export]
pub fn extract_path_variables(url: String) -> Vec<String> {
    path_variables::extract_path_variables_from_url(&url)
}

#[uniffi::export]
pub fn sync_path_variables_json(
    url: String,
    existing_json: Option<String>,
) -> Result<String, KobeanFfiError> {
    let existing: Option<Vec<persistence::PathVariableEntry>> = existing_json
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .map(from_json)
        .transpose()?;
    let synced = path_variables::sync_path_variables_with_url(&url, existing.as_deref());
    to_json(&synced)
}

#[uniffi::export]
pub fn detect_import_format(content: String) -> String {
    importer::detect_import_format(&content)
        .as_str()
        .to_string()
}

#[uniffi::export]
pub fn parse_curl_command_json(raw: String) -> Result<String, KobeanFfiError> {
    let result = importer::parse_curl_command(&raw);
    to_json(&result)
}

#[uniffi::export]
pub fn parse_universal_import_json(
    content: String,
    default_workspace_name: Option<String>,
) -> Result<String, KobeanFfiError> {
    let result = importer::parse_universal_import(&content, default_workspace_name.as_deref())
        .map_err(map_err)?;
    to_json(&result)
}

#[uniffi::export]
pub fn redact_auth_from_url(
    url: String,
    auth_mode: String,
    auth_config_json: String,
) -> Result<String, KobeanFfiError> {
    let config = parse_auth_config_json(&auth_config_json)?;
    Ok(auth::redact_auth_from_url(&url, &auth_mode, &config))
}

#[uniffi::export]
pub fn redact_auth_headers_json(
    headers_json: String,
    auth_mode: String,
    auth_config_json: String,
) -> Result<String, KobeanFfiError> {
    let headers: Vec<persistence::HeaderEntry> = from_json(&headers_json)?;
    let config = parse_auth_config_json(&auth_config_json)?;
    let redacted = auth::redact_auth_headers(&headers, &auth_mode, &config);
    to_json(&redacted)
}
