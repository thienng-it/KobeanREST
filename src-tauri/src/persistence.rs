use std::path::PathBuf;

use rusqlite::Connection;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

const INITIAL_MIGRATION: &str = include_str!("../migrations/001_initial.sql");
const REDACTED_SECRET_VALUE: &str = "[secret stored outside SQLite]";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistenceStatus {
    pub database_path: String,
    pub migrated: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub update_checks_enabled: bool,
    pub theme: String,
    pub export_redaction_enabled: bool,
    pub diagnostics_redaction_enabled: bool,
    pub offline_behavior: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HeaderEntry {
    pub key: String,
    pub value: String,
    pub enabled: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SavedRequest {
    pub id: String,
    pub name: String,
    pub method: String,
    pub url: String,
    pub folder_id: String,
    pub auth_mode: String,
    pub auth_config: String,
    pub headers: Vec<HeaderEntry>,
    pub query_params: String,
    pub body: String,
    pub body_mime_type: String,
    pub body_form: String,
    pub timeout_ms: i64,
    pub follow_redirects: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variables: Option<Vec<ScopedVariable>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentVariable {
    pub key: String,
    pub value: String,
    pub secret: bool,
    pub secret_ref: Option<String>,
    pub masked: bool,
}

/// A variable scoped to a collection, folder, or request entity.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScopedVariable {
    pub key: String,
    pub value: String,
    #[serde(default)]
    pub secret: bool,
    #[serde(default)]
    pub secret_ref: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct EnvironmentSummary {
    pub name: String,
    pub variables: Vec<EnvironmentVariable>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderSummary {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auth_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auth_config: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub collection_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variables: Option<Vec<ScopedVariable>>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionSummary {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auth_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auth_config: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variables: Option<Vec<ScopedVariable>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_environment: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceListItem {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSummary {
    pub id: String,
    pub name: String,
    pub active_environment: String,
    pub environments: Vec<EnvironmentSummary>,
    pub folders: Vec<FolderSummary>,
    pub requests: Vec<SavedRequest>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub collections: Option<Vec<CollectionSummary>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestHistoryEntry {
    pub request_id: String,
    #[serde(default)]
    pub workspace_id: Option<String>,
    pub method: String,
    pub url: String,
    pub status: u16,
    pub duration_ms: u128,
    pub size_bytes: usize,
    pub response_headers: Option<String>,
    pub response_body_text: Option<String>,
    pub response_body_base64: Option<String>,
    #[serde(default)]
    pub run_id: Option<String>,
    #[serde(default)]
    pub scope_id: Option<String>,
    #[serde(default)]
    pub scope_name: Option<String>,
    #[serde(default)]
    pub test_passed: Option<bool>,
    #[serde(default)]
    pub passed_tests: Option<i64>,
    #[serde(default)]
    pub failed_tests: Option<i64>,
    #[serde(default)]
    pub test_results: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Script {
    pub id: String,
    pub entity_id: String,
    pub entity_type: String,
    pub script_type: String,
    pub content: String,
    pub position: i64,
}

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("failed to resolve local data directory: {error}"))?;
    std::fs::create_dir_all(&app_data_dir)
        .map_err(|error| format!("failed to create local data directory: {error}"))?;
    Ok(app_data_dir.join("kobeanrest.sqlite"))
}

fn open_database(app: &AppHandle) -> Result<Connection, String> {
    let path = database_path(app)?;
    Connection::open(path).map_err(|error| format!("failed to open local database: {error}"))
}

pub fn ensure_database(app: &AppHandle) -> Result<PersistenceStatus, String> {
    let path = database_path(app)?;
    let mut connection = Connection::open(&path)
        .map_err(|error| format!("failed to open local database: {error}"))?;

    connection
        .execute_batch(INITIAL_MIGRATION)
        .map_err(|error| format!("failed to run local database migration: {error}"))?;

    ensure_secret_ref_column(&connection)?;
    ensure_masked_column(&connection)?;
    ensure_auth_config_column(&connection)?;
    ensure_folder_parent_id_column(&connection)?;
    ensure_scripts_table(&connection)?;
    ensure_folder_auth_columns(&connection)?;
    ensure_collection_auth_columns(&connection)?;
    ensure_scoped_variables_table(&connection)?;
    ensure_request_body_columns(&connection)?;
    ensure_request_query_params_column(&connection)?;
    ensure_request_history_response_columns(&connection)?;
    ensure_request_history_run_id_column(&connection)?;
    ensure_request_history_test_stats_columns(&connection)?;
    ensure_requests_fk_removed(&connection)?;
    ensure_collection_default_environment_column(&connection)?;
    seed_default_workspace(&mut connection)?;
    sync_request_workspace_ids(&connection)?;

    Ok(PersistenceStatus {
        database_path: path.to_string_lossy().to_string(),
        migrated: true,
    })
}

fn sync_request_workspace_ids(connection: &Connection) -> Result<(), String> {
    connection
        .execute(
            "UPDATE requests SET workspace_id = (
                SELECT collections.workspace_id FROM folders JOIN collections ON collections.id = folders.collection_id WHERE folders.id = requests.folder_id
            ) WHERE EXISTS (
                SELECT 1 FROM folders JOIN collections ON collections.id = folders.collection_id WHERE folders.id = requests.folder_id AND collections.workspace_id IS NOT requests.workspace_id
            )",
            [],
        )
        .map_err(|e| format!("failed to sync request workspace IDs: {e}"))?;
    Ok(())
}

fn ensure_collection_default_environment_column(connection: &Connection) -> Result<(), String> {
    let mut statement = connection
        .prepare("PRAGMA table_info(collections)")
        .map_err(|error| format!("failed to inspect collections table: {error}"))?;
    let columns = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| format!("failed to query collections table info: {error}"))?;

    let mut has_default_env = false;
    for column in columns {
        if column.map_err(|error| format!("failed to read collections column: {error}"))?
            == "default_environment"
        {
            has_default_env = true;
            break;
        }
    }

    if !has_default_env {
        connection
            .execute("ALTER TABLE collections ADD COLUMN default_environment TEXT", [])
            .map_err(|error| format!("failed to add collections.default_environment column: {error}"))?;
    }

    Ok(())
}

fn ensure_request_body_columns(connection: &Connection) -> Result<(), String> {
    let mut statement = connection
        .prepare("PRAGMA table_info(requests)")
        .map_err(|error| format!("failed to inspect requests table: {error}"))?;
    let columns = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| format!("failed to query requests table info: {error}"))?;

    let mut has_mime = false;
    let mut has_form = false;
    for column in columns {
        let col = column.map_err(|error| format!("failed to read requests column: {error}"))?;
        if col == "body_mime_type" {
            has_mime = true;
        } else if col == "body_form" {
            has_form = true;
        }
    }

    if !has_mime {
        connection
            .execute("ALTER TABLE requests ADD COLUMN body_mime_type TEXT NOT NULL DEFAULT 'text/plain'", [])
            .map_err(|error| format!("failed to add requests.body_mime_type column: {error}"))?;
    }
    if !has_form {
        connection
            .execute("ALTER TABLE requests ADD COLUMN body_form TEXT NOT NULL DEFAULT '[]'", [])
            .map_err(|error| format!("failed to add requests.body_form column: {error}"))?;
    }
    Ok(())
}

fn ensure_request_query_params_column(connection: &Connection) -> Result<(), String> {
    let mut statement = connection
        .prepare("PRAGMA table_info(requests)")
        .map_err(|error| format!("failed to inspect requests table: {error}"))?;
    let columns = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| format!("failed to query requests table info: {error}"))?;

    let mut has_query_params = false;
    for column in columns {
        let col = column.map_err(|error| format!("failed to read requests column: {error}"))?;
        if col == "query_params" {
            has_query_params = true;
        }
    }

    if !has_query_params {
        connection
            .execute("ALTER TABLE requests ADD COLUMN query_params TEXT NOT NULL DEFAULT '[]'", [])
            .map_err(|error| format!("failed to add requests.query_params column: {error}"))?;
    }
    Ok(())
}

fn ensure_request_history_response_columns(connection: &Connection) -> Result<(), String> {
    let mut statement = connection
        .prepare("PRAGMA table_info(request_history)")
        .map_err(|error| format!("failed to inspect request_history table: {error}"))?;
    let columns = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| format!("failed to query request_history table info: {error}"))?;

    let mut has_headers = false;
    let mut has_body_text = false;
    let mut has_body_base64 = false;
    for column in columns {
        let col = column.map_err(|error| format!("failed to read request_history column: {error}"))?;
        if col == "response_headers" {
            has_headers = true;
        } else if col == "response_body_text" {
            has_body_text = true;
        } else if col == "response_body_base64" {
            has_body_base64 = true;
        }
    }

    if !has_headers {
        connection
            .execute("ALTER TABLE request_history ADD COLUMN response_headers TEXT", [])
            .map_err(|error| format!("failed to add request_history.response_headers column: {error}"))?;
    }
    if !has_body_text {
        connection
            .execute("ALTER TABLE request_history ADD COLUMN response_body_text TEXT", [])
            .map_err(|error| format!("failed to add request_history.response_body_text column: {error}"))?;
    }
    if !has_body_base64 {
        connection
            .execute("ALTER TABLE request_history ADD COLUMN response_body_base64 TEXT", [])
            .map_err(|error| format!("failed to add request_history.response_body_base64 column: {error}"))?;
    }
    Ok(())
}

fn ensure_request_history_test_stats_columns(connection: &Connection) -> Result<(), String> {
    let mut statement = connection
        .prepare("PRAGMA table_info(request_history)")
        .map_err(|error| format!("failed to inspect request_history table: {error}"))?;
    let columns = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| format!("failed to query request_history table info: {error}"))?;

    let mut has_passed_tests = false;
    let mut has_failed_tests = false;
    let mut has_test_results = false;
    for column in columns {
        let col = column.map_err(|error| format!("failed to read request_history column: {error}"))?;
        if col == "passed_tests" {
            has_passed_tests = true;
        } else if col == "failed_tests" {
            has_failed_tests = true;
        } else if col == "test_results" {
            has_test_results = true;
        }
    }

    if !has_passed_tests {
        connection
            .execute("ALTER TABLE request_history ADD COLUMN passed_tests INTEGER", [])
            .map_err(|error| format!("failed to add request_history.passed_tests column: {error}"))?;
    }
    if !has_failed_tests {
        connection
            .execute("ALTER TABLE request_history ADD COLUMN failed_tests INTEGER", [])
            .map_err(|error| format!("failed to add request_history.failed_tests column: {error}"))?;
    }
    if !has_test_results {
        connection
            .execute("ALTER TABLE request_history ADD COLUMN test_results TEXT", [])
            .map_err(|error| format!("failed to add request_history.test_results column: {error}"))?;
    }
    Ok(())
}

fn ensure_request_history_run_id_column(connection: &Connection) -> Result<(), String> {
    let mut statement = connection
        .prepare("PRAGMA table_info(request_history)")
        .map_err(|error| format!("failed to inspect request_history table: {error}"))?;
    let columns = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| format!("failed to query request_history table info: {error}"))?;

    let mut has_run_id = false;
    let mut has_scope_id = false;
    let mut has_scope_name = false;
    let mut has_test_passed = false;
    for column in columns {
        let col = column.map_err(|error| format!("failed to read request_history column: {error}"))?;
        if col == "run_id" {
            has_run_id = true;
        } else if col == "scope_id" {
            has_scope_id = true;
        } else if col == "scope_name" {
            has_scope_name = true;
        } else if col == "test_passed" {
            has_test_passed = true;
        }
    }

    if !has_run_id {
        connection
            .execute("ALTER TABLE request_history ADD COLUMN run_id TEXT", [])
            .map_err(|error| format!("failed to add request_history.run_id column: {error}"))?;
    }
    if !has_scope_id {
        connection
            .execute("ALTER TABLE request_history ADD COLUMN scope_id TEXT", [])
            .map_err(|error| format!("failed to add request_history.scope_id column: {error}"))?;
    }
    if !has_scope_name {
        connection
            .execute("ALTER TABLE request_history ADD COLUMN scope_name TEXT", [])
            .map_err(|error| format!("failed to add request_history.scope_name column: {error}"))?;
    }
    if !has_test_passed {
        connection
            .execute("ALTER TABLE request_history ADD COLUMN test_passed INTEGER", [])
            .map_err(|error| format!("failed to add request_history.test_passed column: {error}"))?;
    }
    Ok(())
}

fn ensure_folder_parent_id_column(connection: &Connection) -> Result<(), String> {
    let mut statement = connection
        .prepare("PRAGMA table_info(folders)")
        .map_err(|error| format!("failed to inspect folders table: {error}"))?;
    let columns = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| format!("failed to query folders table info: {error}"))?;

    let mut has_parent_id = false;
    for column in columns {
        if column.map_err(|error| format!("failed to read folders column: {error}"))?
            == "parent_id"
        {
            has_parent_id = true;
            break;
        }
    }

    if !has_parent_id {
        connection
            .execute("ALTER TABLE folders ADD COLUMN parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE", [])
            .map_err(|error| format!("failed to add folders.parent_id column: {error}"))?;
    }

    connection
        .execute("CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id)", [])
        .map_err(|error| format!("failed to create folders.parent_id index: {error}"))?;

    Ok(())
}

fn ensure_scripts_table(connection: &Connection) -> Result<(), String> {
    let mut statement = connection
        .prepare("PRAGMA table_info(scripts)")
        .map_err(|error| format!("failed to inspect scripts table: {error}"))?;
    let columns = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| format!("failed to query scripts table info: {error}"))?;

    let mut exists = false;
    for column in columns {
        if column.map_err(|error| format!("failed to read scripts column: {error}"))? == "id" {
            exists = true;
            break;
        }
    }

    if !exists {
        connection
            .execute(
                "CREATE TABLE IF NOT EXISTS scripts (
                  id TEXT PRIMARY KEY,
                  entity_id TEXT NOT NULL,
                  entity_type TEXT NOT NULL, -- 'collection', 'folder', 'request'
                  script_type TEXT NOT NULL, -- 'pre', 'post'
                  content TEXT NOT NULL,
                  position INTEGER NOT NULL DEFAULT 0,
                  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )",
                [],
            )
            .map_err(|error| format!("failed to create scripts table: {error}"))?;
    }

    Ok(())
}

fn ensure_scoped_variables_table(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS scoped_variables (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              entity_id TEXT NOT NULL,
              entity_type TEXT NOT NULL,        -- 'collection' | 'folder' | 'request'
              variable_key TEXT NOT NULL,
              variable_value TEXT NOT NULL,
              secret_ref TEXT,
              secret INTEGER NOT NULL DEFAULT 0,
              position INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE (entity_id, variable_key)
            );
            CREATE INDEX IF NOT EXISTS idx_scoped_variables_entity
              ON scoped_variables(entity_id, entity_type);",
        )
        .map_err(|error| format!("failed to create scoped_variables table: {error}"))?;

    Ok(())
}

#[tauri::command]
pub fn create_workspace(app: AppHandle, name: String) -> Result<String, String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let workspace_id = format!("workspace-{}", uuid::Uuid::new_v4());
    connection
        .execute(
            "INSERT INTO workspaces (id, name, active_environment) VALUES (?1, ?2, 'Development')",
            params![workspace_id, name],
        )
        .map_err(|error| format!("failed to create workspace: {error}"))?;
    Ok(workspace_id)
}

#[tauri::command]
pub fn create_collection(app: AppHandle, name: String, workspace_id: Option<String>) -> Result<String, String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let workspace_id = match workspace_id {
        Some(id) => id,
        None => active_workspace_id(&connection)?
    };
    let collection_id = format!("collection-{}", uuid::Uuid::new_v4());
    connection
        .execute(
            "INSERT INTO collections (id, workspace_id, name, position) VALUES (?1, ?2, ?3, (SELECT COALESCE(MAX(position), -1) + 1 FROM collections WHERE workspace_id = ?2))",
            params![collection_id, workspace_id, name],
        )
        .map_err(|error| format!("failed to create collection: {error}"))?;
    Ok(collection_id)
}

#[tauri::command]
pub fn initialize_persistence(app: AppHandle) -> Result<PersistenceStatus, String> {
    ensure_database(&app)
}

#[tauri::command]
pub fn load_workspace(app: AppHandle) -> Result<WorkspaceSummary, String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let active_id: Option<String> = connection
        .query_row(
            "SELECT value FROM settings WHERE key = 'last_active_workspace_id'",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| format!("failed to read active workspace setting: {e}"))?;

    if let Some(id) = active_id {
        let exists: bool = connection
            .query_row(
                "SELECT COUNT(*) FROM workspaces WHERE id = ?1",
                params![id],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|e| format!("failed to verify workspace: {e}"))?
            > 0;
        if exists {
            return load_workspace_by_id_inner(&connection, &id);
        }
    }
    load_first_workspace(&connection)
}

#[tauri::command]
pub fn list_workspaces(app: AppHandle) -> Result<Vec<WorkspaceListItem>, String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let mut statement = connection
        .prepare("SELECT id, name FROM workspaces ORDER BY created_at, id")
        .map_err(|e| format!("failed to list workspaces: {e}"))?;
    let rows = statement
        .query_map([], |row| Ok(WorkspaceListItem {
            id: row.get(0)?,
            name: row.get(1)?,
        }))
        .map_err(|e| format!("failed to query workspaces: {e}"))?;
    let mut list = Vec::new();
    for row in rows {
        list.push(row.map_err(|e| format!("failed to read workspace row: {e}"))?);
    }
    Ok(list)
}

#[tauri::command]
pub fn rename_workspace(app: AppHandle, workspace_id: String, name: String) -> Result<(), String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let trimmed = name.trim().to_string();
    if trimmed.is_empty() {
        return Err("workspace name cannot be blank".to_string());
    }
    connection
        .execute(
            "UPDATE workspaces SET name = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![trimmed, workspace_id],
        )
        .map_err(|e| format!("failed to rename workspace: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn delete_workspace(app: AppHandle, workspace_id: String) -> Result<(), String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let count: i64 = connection
        .query_row("SELECT COUNT(*) FROM workspaces", [], |row| row.get(0))
        .map_err(|e| format!("failed to count workspaces: {e}"))?;
    if count <= 1 {
        return Err("cannot delete the last workspace".to_string());
    }
    connection
        .execute("DELETE FROM workspaces WHERE id = ?1", params![workspace_id])
        .map_err(|e| format!("failed to delete workspace: {e}"))?;
    connection
        .execute(
            "DELETE FROM settings WHERE key = 'last_active_workspace_id' AND value = ?1",
            params![workspace_id],
        )
        .map_err(|e| format!("failed to clear active workspace setting: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn switch_workspace(app: AppHandle, workspace_id: String) -> Result<WorkspaceSummary, String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    connection
        .execute(
            "INSERT INTO settings (key, value, updated_at) VALUES ('last_active_workspace_id', ?1, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            params![workspace_id],
        )
        .map_err(|e| format!("failed to persist active workspace: {e}"))?;
    load_workspace_by_id_inner(&connection, &workspace_id)
}

#[tauri::command]
pub fn load_workspace_by_id(app: AppHandle, workspace_id: String) -> Result<WorkspaceSummary, String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    load_workspace_by_id_inner(&connection, &workspace_id)
}

fn load_workspace_by_id_inner(connection: &Connection, workspace_id: &str) -> Result<WorkspaceSummary, String> {
    let workspace = connection
        .query_row(
            "SELECT id, name, active_environment FROM workspaces WHERE id = ?1",
            params![workspace_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?)),
        )
        .optional()
        .map_err(|e| format!("failed to load workspace: {e}"))?
        .ok_or_else(|| format!("workspace '{}' not found", workspace_id))?;

    Ok(WorkspaceSummary {
        id: workspace.0.clone(),
        name: workspace.1,
        active_environment: workspace.2,
        environments: load_environments(connection, &workspace.0)?,
        folders: load_folders(connection, &workspace.0)?,
        requests: load_requests(connection, &workspace.0)?,
        collections: Some(load_collections(connection, &workspace.0)?),
    })
}

#[tauri::command]
pub fn record_request_history(app: AppHandle, entry: RequestHistoryEntry) -> Result<(), String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let workspace_id = match entry.workspace_id {
        Some(workspace_id) => workspace_id,
        None => first_workspace_id(&connection)?,
    };

    connection
        .execute(
            "INSERT INTO request_history (
                workspace_id,
                request_id,
                method,
                url,
                status,
                duration_ms,
                size_bytes,
                response_headers,
                response_body_text,
                response_body_base64,
                run_id,
                scope_id,
                scope_name,
                test_passed,
                passed_tests,
                failed_tests,
                test_results
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
            params![
                workspace_id,
                entry.request_id,
                entry.method,
                entry.url,
                i64::from(entry.status),
                entry.duration_ms as i64,
                entry.size_bytes as i64,
                entry.response_headers,
                entry.response_body_text,
                entry.response_body_base64,
                entry.run_id,
                entry.scope_id,
                entry.scope_name,
                entry.test_passed,
                entry.passed_tests,
                entry.failed_tests,
                entry.test_results
            ],
        )
        .map_err(|error| format!("failed to record request history: {error}"))?;

    Ok(())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: i64,
    pub request_id: String,
    pub method: String,
    pub url: String,
    pub status: i64,
    pub duration_ms: i64,
    pub size_bytes: i64,
    pub created_at: String,
    pub run_id: Option<String>,
    pub scope_id: Option<String>,
    pub scope_name: Option<String>,
    pub test_passed: Option<bool>,
    pub passed_tests: Option<i64>,
    pub failed_tests: Option<i64>,
    pub test_results: Option<String>,
    pub response_headers: Option<String>,
    pub response_body_text: Option<String>,
    pub response_body_base64: Option<String>,
}

#[tauri::command]
pub fn load_request_history(app: AppHandle) -> Result<Vec<HistoryEntry>, String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let workspace_id = first_workspace_id(&connection)?;
    let mut statement = connection
        .prepare(
            "SELECT id, request_id, method, url, status, duration_ms, size_bytes, created_at, run_id, scope_id, scope_name, test_passed, response_headers, response_body_text, response_body_base64, passed_tests, failed_tests, test_results
             FROM request_history
             WHERE workspace_id = ?1
             ORDER BY created_at DESC, id DESC
             LIMIT 200",
        )
        .map_err(|error| format!("failed to prepare history query: {error}"))?;
    let rows = statement
        .query_map(params![workspace_id], |row| {
            Ok(HistoryEntry {
                id: row.get(0)?,
                request_id: row.get(1)?,
                method: row.get(2)?,
                url: row.get(3)?,
                status: row.get(4)?,
                duration_ms: row.get(5)?,
                size_bytes: row.get(6)?,
                created_at: row.get(7)?,
                run_id: row.get(8)?,
                scope_id: row.get(9)?,
                scope_name: row.get(10)?,
                test_passed: row.get(11)?,
                response_headers: row.get(12)?,
                response_body_text: row.get(13)?,
                response_body_base64: row.get(14)?,
                passed_tests: row.get(15)?,
                failed_tests: row.get(16)?,
                test_results: row.get(17)?,
            })
        })
        .map_err(|error| format!("failed to query history: {error}"))?;
    collect_rows(rows, "history entry")
}

#[tauri::command]
pub fn clear_request_history(app: AppHandle) -> Result<(), String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let workspace_id = first_workspace_id(&connection)?;
    connection
        .execute(
            "DELETE FROM request_history WHERE workspace_id = ?1",
            params![workspace_id],
        )
        .map_err(|error| format!("failed to clear history: {error}"))?;
    Ok(())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryResponsePayload {
    pub response_headers: Option<String>,
    pub response_body_text: Option<String>,
    pub response_body_base64: Option<String>,
}

#[tauri::command]
pub fn load_history_response(app: AppHandle, id: i64) -> Result<HistoryResponsePayload, String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let mut statement = connection
        .prepare("SELECT response_headers, response_body_text, response_body_base64 FROM request_history WHERE id = ?1")
        .map_err(|error| format!("failed to prepare history response query: {error}"))?;
    
    let payload = statement
        .query_row(params![id], |row| {
            Ok(HistoryResponsePayload {
                response_headers: row.get(0)?,
                response_body_text: row.get(1)?,
                response_body_base64: row.get(2)?,
            })
        })
        .optional()
        .map_err(|error| format!("failed to query history response: {error}"))?
        .unwrap_or(HistoryResponsePayload {
            response_headers: None,
            response_body_text: None,
            response_body_base64: None,
        });

    Ok(payload)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionRunSummary {
    pub run_id: String,
    pub scope_id: String,
    pub scope_name: String,
    pub created_at: String,
    pub total_requests: i64,
    pub passed_requests: i64,
    pub failed_requests: i64,
    pub passed_tests: Option<i64>,
    pub failed_tests: Option<i64>,
    pub total_duration_ms: i64,
}

#[tauri::command]
pub fn load_collection_runs(app: AppHandle, scope_id: String) -> Result<Vec<CollectionRunSummary>, String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let workspace_id = first_workspace_id(&connection)?;
    
    let mut statement = connection
        .prepare(
            "SELECT 
                run_id,
                scope_id,
                scope_name,
                MIN(created_at) as created_at,
                COUNT(*) as total_requests,
                SUM(CASE WHEN COALESCE(test_passed, status < 400) = 1 THEN 1 ELSE 0 END) as passed_requests,
                SUM(CASE WHEN COALESCE(test_passed, status < 400) = 0 THEN 1 ELSE 0 END) as failed_requests,
                SUM(duration_ms) as total_duration_ms,
                SUM(passed_tests) as passed_tests,
                SUM(failed_tests) as failed_tests
             FROM request_history
             WHERE workspace_id = ?1 AND run_id IS NOT NULL AND scope_id = ?2
             GROUP BY run_id
             ORDER BY created_at DESC
             LIMIT 50",
        )
        .map_err(|error| format!("failed to prepare collection runs query: {error}"))?;
    
    let rows = statement
        .query_map(params![workspace_id, scope_id], |row| {
            Ok(CollectionRunSummary {
                run_id: row.get(0)?,
                scope_id: row.get(1)?,
                scope_name: row.get(2)?,
                created_at: row.get(3)?,
                total_requests: row.get(4)?,
                passed_requests: row.get(5)?,
                failed_requests: row.get(6)?,
                total_duration_ms: row.get(7)?,
                passed_tests: row.get(8)?,
                failed_tests: row.get(9)?,
            })
        })
        .map_err(|error| format!("failed to query collection runs: {error}"))?;
    
    collect_rows(rows, "collection run")
}

#[tauri::command]
pub fn load_collection_run_details(app: AppHandle, run_id: String) -> Result<Vec<HistoryEntry>, String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    
    let mut statement = connection
        .prepare(
            "SELECT id, request_id, method, url, status, duration_ms, size_bytes, created_at, run_id, scope_id, scope_name, test_passed, response_headers, response_body_text, response_body_base64, passed_tests, failed_tests, test_results
             FROM request_history
             WHERE run_id = ?1
             ORDER BY id ASC",
        )
        .map_err(|error| format!("failed to prepare run details query: {error}"))?;
    
    let rows = statement
        .query_map(params![run_id], |row| {
            Ok(HistoryEntry {
                id: row.get(0)?,
                request_id: row.get(1)?,
                method: row.get(2)?,
                url: row.get(3)?,
                status: row.get(4)?,
                duration_ms: row.get(5)?,
                size_bytes: row.get(6)?,
                created_at: row.get(7)?,
                run_id: row.get(8)?,
                scope_id: row.get(9)?,
                scope_name: row.get(10)?,
                test_passed: row.get(11)?,
                response_headers: row.get(12)?,
                response_body_text: row.get(13)?,
                response_body_base64: row.get(14)?,
                passed_tests: row.get(15)?,
                failed_tests: row.get(16)?,
                test_results: row.get(17)?,
            })
        })
        .map_err(|error| format!("failed to query run details: {error}"))?;
    
    collect_rows(rows, "run detail")
}

fn default_app_settings() -> AppSettings {
    AppSettings {
        update_checks_enabled: false,
        theme: "system".to_string(),
        export_redaction_enabled: true,
        diagnostics_redaction_enabled: true,
        offline_behavior: "silent".to_string(),
    }
}

#[tauri::command]
pub fn load_app_settings(app: AppHandle) -> Result<AppSettings, String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let stored = connection
        .query_row(
            "SELECT value FROM settings WHERE key = 'app_settings'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| format!("failed to load app settings: {error}"))?;

    match stored {
        Some(json) => serde_json::from_str(&json)
            .map_err(|error| format!("failed to parse app settings: {error}")),
        None => Ok(default_app_settings()),
    }
}

#[tauri::command]
pub fn save_app_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let json = serde_json::to_string(&settings)
        .map_err(|error| format!("failed to serialize app settings: {error}"))?;
    connection
        .execute(
            "INSERT INTO settings (key, value, updated_at)
             VALUES ('app_settings', ?1, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET
               value = excluded.value,
               updated_at = CURRENT_TIMESTAMP",
            params![json],
        )
        .map_err(|error| format!("failed to save app settings: {error}"))?;
    Ok(())
}

fn ensure_auth_config_column(connection: &Connection) -> Result<(), String> {
    let mut statement = connection
        .prepare("PRAGMA table_info(requests)")
        .map_err(|error| format!("failed to inspect requests table: {error}"))?;
    let columns = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| format!("failed to query requests table info: {error}"))?;

    for column in columns {
        if column.map_err(|error| format!("failed to read requests column: {error}"))?
            == "auth_config"
        {
            return Ok(());
        }
    }

    connection
        .execute("ALTER TABLE requests ADD COLUMN auth_config TEXT", [])
        .map_err(|error| format!("failed to add requests.auth_config column: {error}"))?;

    Ok(())
}

fn ensure_folder_auth_columns(connection: &Connection) -> Result<(), String> {
    let mut statement = connection
        .prepare("PRAGMA table_info(folders)")
        .map_err(|error| format!("failed to inspect folders table: {error}"))?;
    let columns: Vec<String> = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| format!("failed to query folders table info: {error}"))?
        .filter_map(|c| c.ok())
        .collect();

    if !columns.contains(&"auth_mode".to_string()) {
        connection
            .execute("ALTER TABLE folders ADD COLUMN auth_mode TEXT NOT NULL DEFAULT 'none'", [])
            .map_err(|error| format!("failed to add folders.auth_mode column: {error}"))?;
    }
    if !columns.contains(&"auth_config".to_string()) {
        connection
            .execute("ALTER TABLE folders ADD COLUMN auth_config TEXT", [])
            .map_err(|error| format!("failed to add folders.auth_config column: {error}"))?;
    }
    Ok(())
}

fn ensure_collection_auth_columns(connection: &Connection) -> Result<(), String> {
    let mut statement = connection
        .prepare("PRAGMA table_info(collections)")
        .map_err(|error| format!("failed to inspect collections table: {error}"))?;
    let columns: Vec<String> = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| format!("failed to query collections table info: {error}"))?
        .filter_map(|c| c.ok())
        .collect();

    if !columns.contains(&"auth_mode".to_string()) {
        connection
            .execute("ALTER TABLE collections ADD COLUMN auth_mode TEXT NOT NULL DEFAULT 'none'", [])
            .map_err(|error| format!("failed to add collections.auth_mode column: {error}"))?;
    }
    if !columns.contains(&"auth_config".to_string()) {
        connection
            .execute("ALTER TABLE collections ADD COLUMN auth_config TEXT", [])
            .map_err(|error| format!("failed to add collections.auth_config column: {error}"))?;
    }
    Ok(())
}

fn ensure_secret_ref_column(connection: &Connection) -> Result<(), String> {
    let mut statement = connection
        .prepare("PRAGMA table_info(variables)")
        .map_err(|error| format!("failed to inspect variables table: {error}"))?;
    let columns = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| format!("failed to query variables table info: {error}"))?;

    for column in columns {
        if column.map_err(|error| format!("failed to read variables column: {error}"))?
            == "secret_ref"
        {
            return Ok(());
        }
    }

    connection
        .execute("ALTER TABLE variables ADD COLUMN secret_ref TEXT", [])
        .map_err(|error| format!("failed to add variables.secret_ref column: {error}"))?;

    Ok(())
}

fn ensure_masked_column(connection: &Connection) -> Result<(), String> {
    let mut statement = connection
        .prepare("PRAGMA table_info(variables)")
        .map_err(|error| format!("failed to inspect variables table: {error}"))?;
    let columns: Vec<String> = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| format!("failed to query variables table info: {error}"))?
        .filter_map(|r| r.ok())
        .collect();

    if !columns.contains(&"masked".to_string()) {
        connection
            .execute("ALTER TABLE variables ADD COLUMN masked INTEGER NOT NULL DEFAULT 0", [])
            .map_err(|error| format!("failed to add variables.masked column: {error}"))?;
    }

    Ok(())
}

fn seed_default_workspace(connection: &mut Connection) -> Result<(), String> {
    let workspace_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM workspaces", [], |row| row.get(0))
        .map_err(|error| format!("failed to inspect local workspace seed state: {error}"))?;

    if workspace_count > 0 {
        return Ok(());
    }

    let transaction = connection
        .transaction()
        .map_err(|error| format!("failed to start local workspace seed: {error}"))?;

    transaction
        .execute(
            "INSERT INTO workspaces (id, name, active_environment) VALUES (?1, ?2, ?3)",
            params!["local-workspace", "Local Workspace", "Development"],
        )
        .map_err(|error| format!("failed to seed workspace: {error}"))?;
    transaction
        .execute(
            "INSERT INTO collections (id, workspace_id, name, position) VALUES (?1, ?2, ?3, ?4)",
            params!["default-collection", "local-workspace", "KobeanREST", 0],
        )
        .map_err(|error| format!("failed to seed collection: {error}"))?;

    for (position, folder) in ["System", "Users API", "Orders API"].iter().enumerate() {
        transaction
            .execute(
                "INSERT INTO folders (id, collection_id, name, position) VALUES (?1, ?2, ?3, ?4)",
                params![
                    format!("folder-{}", uuid::Uuid::new_v4()),
                    "default-collection",
                    folder,
                    position as i64
                ],
            )
            .map_err(|error| format!("failed to seed folder '{folder}': {error}"))?;
    }


    let requests = [
        (
            "req-health",
            "Health check",
            "GET",
            "{{baseUrl}}/health",
            "System",
            "none",
            "",
            vec![("Accept", "application/json", true)],
        ),
        (
            "req-profile",
            "Fetch profile",
            "GET",
            "{{baseUrl}}/v1/profile",
            "Users API",
            "bearer",
            "",
            vec![("Authorization", "Bearer {{token}}", true)],
        ),
        (
            "req-create-order",
            "Create order",
            "POST",
            "{{baseUrl}}/v1/orders",
            "Orders API",
            "apiKey",
            "{\n  \"sku\": \"kobean-rest-pro\",\n  \"quantity\": 1\n}",
            vec![
                ("Content-Type", "application/json", true),
                ("X-API-Key", "{{token}}", true),
            ],
        ),
    ];

    for (position, request) in requests.iter().enumerate() {
        transaction
            .execute(
                "INSERT INTO requests (
                    id,
                    workspace_id,
                    folder_id,
                    name,
                    method,
                    url,
                    auth_mode,
                    body,
                    timeout_ms,
                    follow_redirects,
                    position
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                params![
                    request.0,
                    "local-workspace",
                    format!("folder-{}", request.4.to_lowercase().replace(" ", "-")),
                    request.1,
                    request.2,
                    request.3,
                    request.5,
                    request.6,
                    30_000_i64,
                    1_i64,
                    position as i64
                ],
            )
            .map_err(|error| format!("failed to seed request '{}': {error}", request.1))?;

        for (header_position, header) in request.7.iter().enumerate() {
            transaction
                .execute(
                    "INSERT INTO request_headers (
                        request_id,
                        header_key,
                        header_value,
                        enabled,
                        position
                    ) VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![
                        request.0,
                        header.0,
                        header.1,
                        if header.2 { 1_i64 } else { 0_i64 },
                        header_position as i64
                    ],
                )
                .map_err(|error| {
                    format!("failed to seed request header '{}': {error}", header.0)
                })?;
        }
    }

    for (position, environment) in ["Development", "Production"].iter().enumerate() {
        let environment_id = environment_id(environment);
        let base_url = if *environment == "Development" {
            "https://api.example.local"
        } else {
            "https://api.example.com"
        };

        transaction
            .execute(
                "INSERT INTO environments (id, workspace_id, name, position) VALUES (?1, ?2, ?3, ?4)",
                params![environment_id, "local-workspace", environment, position as i64],
            )
            .map_err(|error| format!("failed to seed environment '{environment}': {error}"))?;
        for (variable_position, variable) in [
            ("baseUrl", base_url, None),
            (
                "token",
                REDACTED_SECRET_VALUE,
                Some(format!(
                    "kobeanrest://secrets/{}/token",
                    environment.to_lowercase()
                )),
            ),
        ]
        .iter()
        .enumerate()
        {
            transaction
                .execute(
                    "INSERT INTO variables (
                        environment_id,
                        variable_key,
                        variable_value,
                        secret_ref,
                        secret,
                        masked,
                        position
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        environment_id,
                        variable.0,
                        variable.1,
                        variable.2,
                        if variable.2.is_some() { 1_i64 } else { 0_i64 },
                        if variable.2.is_some() { 1_i64 } else { 0_i64 },
                        variable_position as i64
                    ],
                )
                .map_err(|error| format!("failed to seed variable '{}': {error}", variable.0))?;
        }
    }

    transaction
        .commit()
        .map_err(|error| format!("failed to commit local workspace seed: {error}"))?;

    Ok(())
}

fn load_first_workspace(connection: &Connection) -> Result<WorkspaceSummary, String> {
    let workspace = connection
        .query_row(
            "SELECT id, name, active_environment FROM workspaces ORDER BY created_at, id LIMIT 1",
            [],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            },
        )
        .optional()
        .map_err(|error| format!("failed to load workspace: {error}"))?
        .ok_or_else(|| "local workspace is not initialized".to_string())?;

    Ok(WorkspaceSummary {
        id: workspace.0.clone(),
        name: workspace.1,
        active_environment: workspace.2,
        environments: load_environments(connection, &workspace.0)?,
        folders: load_folders(connection, &workspace.0)?,
        requests: load_requests(connection, &workspace.0)?,
        collections: Some(load_collections(connection, &workspace.0)?),
    })
}

fn load_environments(
    connection: &Connection,
    workspace_id: &str,
) -> Result<Vec<EnvironmentSummary>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, name
             FROM environments
             WHERE workspace_id = ?1
             ORDER BY position, name",
        )
        .map_err(|error| format!("failed to prepare environments query: {error}"))?;
    let rows = statement
        .query_map(params![workspace_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| format!("failed to query environments: {error}"))?;

    let mut environments = Vec::new();
    for row in rows {
        let (environment_id, name) =
            row.map_err(|error| format!("failed to read environment: {error}"))?;
        environments.push(EnvironmentSummary {
            name,
            variables: load_variables(connection, &environment_id)?,
        });
    }

    Ok(environments)
}

fn load_variables(
    connection: &Connection,
    environment_id: &str,
) -> Result<Vec<EnvironmentVariable>, String> {
    let mut statement = connection
        .prepare(
            "SELECT variable_key, variable_value, secret, secret_ref, masked
             FROM variables
             WHERE environment_id = ?1
             ORDER BY position, variable_key",
        )
        .map_err(|error| format!("failed to prepare variables query: {error}"))?;
    let rows = statement
        .query_map(params![environment_id], |row| {
            Ok(EnvironmentVariable {
                key: row.get(0)?,
                value: row.get(1)?,
                secret: row.get::<_, i64>(2)? != 0,
                secret_ref: row.get(3)?,
                masked: row.get::<_, i64>(4).unwrap_or(0) != 0,
            })
        })
        .map_err(|error| format!("failed to query variables: {error}"))?;

    collect_rows(rows, "variable")
}

fn load_scoped_variables(
    connection: &Connection,
    entity_id: &str,
    entity_type: &str,
) -> Result<Vec<ScopedVariable>, String> {
    let mut statement = connection
        .prepare(
            "SELECT variable_key, variable_value, secret, secret_ref
             FROM scoped_variables
             WHERE entity_id = ?1 AND entity_type = ?2
             ORDER BY position, variable_key",
        )
        .map_err(|error| format!("failed to prepare scoped variables query: {error}"))?;
    let rows = statement
        .query_map(params![entity_id, entity_type], |row| {
            Ok(ScopedVariable {
                key: row.get(0)?,
                value: row.get(1)?,
                secret: row.get::<_, i64>(2)? != 0,
                secret_ref: row.get(3)?,
            })
        })
        .map_err(|error| format!("failed to query scoped variables: {error}"))?;

    collect_rows(rows, "scoped variable")
}

fn load_folders(connection: &Connection, workspace_id: &str) -> Result<Vec<FolderSummary>, String> {
    let mut statement = connection
        .prepare(
            "SELECT folders.id, folders.name, folders.auth_mode, folders.auth_config, folders.collection_id, folders.parent_id FROM folders
         JOIN collections ON collections.id = folders.collection_id
         WHERE collections.workspace_id = ?1 ORDER BY folders.position",
        )
        .map_err(|e| e.to_string())?;

    let rows = statement
        .query_map(rusqlite::params![workspace_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, Option<String>>(5)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut folders = Vec::new();
    for row in rows {
        let (id, name, auth_mode, auth_config, collection_id, parent_id) =
            row.map_err(|e| format!("failed to read folder: {e}"))?;
        folders.push(FolderSummary {
            id: id.clone(),
            name,
            auth_mode,
            auth_config,
            collection_id,
            parent_id,
            variables: Some(load_scoped_variables(connection, &id, "folder")?),
        });
    }

    Ok(folders)
}

fn load_collections(connection: &Connection, workspace_id: &str) -> Result<Vec<CollectionSummary>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, name, auth_mode, auth_config, default_environment FROM collections
             WHERE workspace_id = ?1 ORDER BY position",
        )
        .map_err(|e| e.to_string())?;

    let rows = statement
        .query_map(rusqlite::params![workspace_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<String>>(4)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut collections = Vec::new();
    for row in rows {
        let (id, name, auth_mode, auth_config, default_environment) =
            row.map_err(|e| format!("failed to read collection: {e}"))?;
        collections.push(CollectionSummary {
            id: id.clone(),
            name,
            auth_mode,
            auth_config,
            variables: Some(load_scoped_variables(connection, &id, "collection")?),
            default_environment,
        });
    }

    Ok(collections)
}

fn load_requests(connection: &Connection, workspace_id: &str) -> Result<Vec<SavedRequest>, String> {
    let mut statement = connection
        .prepare(
            "SELECT
                requests.id,
                requests.name,
                requests.method,
                requests.url,
                requests.folder_id,
                requests.auth_mode,
                requests.body,
                requests.timeout_ms,
                requests.follow_redirects,
                requests.auth_config,
                requests.body_mime_type,
                requests.body_form,
                requests.query_params
             FROM requests
             LEFT JOIN folders ON folders.id = requests.folder_id
             WHERE requests.workspace_id = ?1
             ORDER BY COALESCE(folders.position, 0), requests.position, requests.name",
        )
        .map_err(|error| format!("failed to prepare requests query: {error}"))?;
    let rows = statement
        .query_map(params![workspace_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, i64>(7)?,
                row.get::<_, i64>(8)? != 0,
                row.get::<_, Option<String>>(9)?,
                row.get::<_, String>(10)?,
                row.get::<_, String>(11)?,
                row.get::<_, String>(12)?,
            ))
        })
        .map_err(|error| format!("failed to query requests: {error}"))?;

    let mut requests = Vec::new();
    for row in rows {
        let row = row.map_err(|error| format!("failed to read request: {error}"))?;
        requests.push(SavedRequest {
            id: row.0.clone(),
            name: row.1,
            method: row.2,
            url: row.3,
            folder_id: row.4,
            auth_mode: row.5,
            headers: load_headers(connection, &row.0)?,
            body: row.6,
            timeout_ms: row.7,
            follow_redirects: row.8,
            auth_config: row.9.unwrap_or_else(|| "{}".to_string()),
            body_mime_type: row.10,
            body_form: row.11,
            query_params: row.12,
            variables: Some(load_scoped_variables(connection, &row.0, "request")?),
        });
    }

    Ok(requests)
}

fn load_headers(connection: &Connection, request_id: &str) -> Result<Vec<HeaderEntry>, String> {
    let mut statement = connection
        .prepare(
            "SELECT header_key, header_value, enabled
             FROM request_headers
             WHERE request_id = ?1
             ORDER BY position, id",
        )
        .map_err(|error| format!("failed to prepare headers query: {error}"))?;
    let rows = statement
        .query_map(params![request_id], |row| {
            Ok(HeaderEntry {
                key: row.get(0)?,
                value: row.get(1)?,
                enabled: row.get::<_, i64>(2)? != 0,
            })
        })
        .map_err(|error| format!("failed to query headers: {error}"))?;

    collect_rows(rows, "header")
}

fn collect_rows<T>(
    rows: impl Iterator<Item = rusqlite::Result<T>>,
    label: &str,
) -> Result<Vec<T>, String> {
    rows.map(|row| row.map_err(|error| format!("failed to read {label}: {error}")))
        .collect()
}

fn ensure_requests_fk_removed(connection: &Connection) -> Result<(), String> {
    let mut stmt = connection
        .prepare("PRAGMA foreign_key_list(requests)")
        .map_err(|e| e.to_string())?;
    
    let mut has_folders_fk = false;
    let iter = stmt.query_map([], |row| {
        let table: String = row.get(2)?;
        Ok(table)
    }).map_err(|e| e.to_string())?;

    for table_res in iter {
        if let Ok(table) = table_res {
            if table == "folders" {
                has_folders_fk = true;
            }
        }
    }
    
    if has_folders_fk {
        let create_sql: String = connection.query_row(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='requests'",
            [],
            |row| row.get(0)
        ).map_err(|e| e.to_string())?;
        
        // Remove the foreign key constraint
        let new_create_sql = create_sql
            .replace("folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE", "folder_id TEXT NOT NULL")
            .replace("CREATE TABLE requests", "CREATE TABLE new_requests")
            .replace("CREATE TABLE \"requests\"", "CREATE TABLE new_requests");
            
        connection.execute_batch(&format!(
            "PRAGMA foreign_keys=OFF;
             BEGIN TRANSACTION;
             {} ;
             INSERT INTO new_requests SELECT * FROM requests;
             DROP TABLE requests;
             ALTER TABLE new_requests RENAME TO requests;
             COMMIT;
             PRAGMA foreign_keys=ON;",
             new_create_sql
        )).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

fn first_workspace_id(connection: &Connection) -> Result<String, String> {
    connection
        .query_row(
            "SELECT id FROM workspaces ORDER BY created_at, id LIMIT 1",
            [],
            |row| row.get(0),
        )
        .map_err(|error| format!("failed to resolve active workspace: {error}"))
}

/// Returns the active workspace id, mirroring the logic used by load_workspace.
/// Falls back to the oldest workspace if no active workspace is recorded.
fn active_workspace_id(connection: &Connection) -> Result<String, String> {
    let active_id: Option<String> = connection
        .query_row(
            "SELECT value FROM settings WHERE key = 'last_active_workspace_id'",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| format!("failed to read active workspace setting: {e}"))?;

    if let Some(id) = active_id {
        let exists: bool = connection
            .query_row(
                "SELECT COUNT(*) FROM workspaces WHERE id = ?1",
                params![id],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|e| format!("failed to verify workspace: {e}"))?
            > 0;
        if exists {
            return Ok(id);
        }
    }
    first_workspace_id(connection)
}

fn environment_id(environment: &str) -> &'static str {
    match environment {
        "Development" => "env-development",
        "Production" => "env-production",
        _ => "env-default",
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportData {
    pub version: u32,
    pub workspaces: Vec<WorkspaceRow>,
    pub collections: Vec<CollectionRow>,
    pub folders: Vec<FolderRow>,
    pub requests: Vec<RequestRow>,
    pub request_headers: Vec<RequestHeaderRow>,
    pub environments: Vec<EnvironmentRow>,
    pub variables: Vec<VariableRow>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspaceRow {
    pub id: String,
    pub name: String,
    pub active_environment: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CollectionRow {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub position: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FolderRow {
    pub id: String,
    pub collection_id: String,
    pub name: String,
    pub position: i64,
}

fn default_body_mime_type() -> String {
    "text/plain".to_string()
}
fn default_body_form() -> String {
    "[]".to_string()
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RequestRow {
    pub id: String,
    pub workspace_id: String,
    pub folder_id: String,
    pub name: String,
    pub method: String,
    pub url: String,
    pub auth_mode: String,
    pub auth_config: Option<String>,
    pub body: String,
    #[serde(default = "default_body_mime_type")]
    pub body_mime_type: String,
    #[serde(default = "default_body_form")]
    pub body_form: String,
    #[serde(default = "default_body_form")]
    pub query_params: String,
    pub timeout_ms: i64,
    pub follow_redirects: i64,
    pub position: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RequestHeaderRow {
    pub request_id: String,
    pub header_key: String,
    pub header_value: String,
    pub enabled: i64,
    pub position: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EnvironmentRow {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub position: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VariableRow {
    pub environment_id: String,
    pub variable_key: String,
    pub variable_value: String,
    pub secret_ref: Option<String>,
    pub secret: i64,
    pub masked: i64,
    pub position: i64,
}

#[tauri::command]
pub fn export_workspace_data(app: AppHandle) -> Result<String, String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;

    let workspaces = collect_rows(
        connection
            .prepare("SELECT id, name, active_environment FROM workspaces")
            .map_err(|e| e.to_string())?
            .query_map([], |row| {
                Ok(WorkspaceRow {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    active_environment: row.get(2)?,
                })
            })
            .map_err(|e| e.to_string())?,
        "workspace",
    )?;

    let collections = collect_rows(
        connection
            .prepare("SELECT id, workspace_id, name, position FROM collections")
            .map_err(|e| e.to_string())?
            .query_map([], |row| {
                Ok(CollectionRow {
                    id: row.get(0)?,
                    workspace_id: row.get(1)?,
                    name: row.get(2)?,
                    position: row.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?,
        "collection",
    )?;

    let folders = collect_rows(
        connection
            .prepare("SELECT id, collection_id, name, position FROM folders")
            .map_err(|e| e.to_string())?
            .query_map([], |row| {
                Ok(FolderRow {
                    id: row.get(0)?,
                    collection_id: row.get(1)?,
                    name: row.get(2)?,
                    position: row.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?,
        "folder",
    )?;

    let requests = collect_rows(
        connection.prepare("SELECT id, workspace_id, folder_id, name, method, url, auth_mode, auth_config, body, body_mime_type, body_form, query_params, timeout_ms, follow_redirects, position FROM requests ORDER BY position")
            .map_err(|e| e.to_string())?
            .query_map([], |row| {
                Ok(RequestRow {
                    id: row.get(0)?,
                    workspace_id: row.get(1)?,
                    folder_id: row.get(2)?,
                    name: row.get(3)?,
                    method: row.get(4)?,
                    url: row.get(5)?,
                    auth_mode: row.get(6)?,
                    auth_config: row.get(7)?,
                    body: row.get(8)?,
                    body_mime_type: row.get(9)?,
                    body_form: row.get(10)?,
                    query_params: row.get(11)?,
                    timeout_ms: row.get(12)?,
                    follow_redirects: row.get(13)?,
                    position: row.get(14)?,
                })
            })
            .map_err(|e| e.to_string())?,
        "request",
    )?;

    let request_headers = collect_rows(
        connection.prepare("SELECT request_id, header_key, header_value, enabled, position FROM request_headers")
            .map_err(|e| e.to_string())?
            .query_map([], |row| {
                Ok(RequestHeaderRow {
                    request_id: row.get(0)?,
                    header_key: row.get(1)?,
                    header_value: row.get(2)?,
                    enabled: row.get(3)?,
                    position: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?,
        "request header",
    )?;

    let environments = collect_rows(
        connection
            .prepare("SELECT id, workspace_id, name, position FROM environments")
            .map_err(|e| e.to_string())?
            .query_map([], |row| {
                Ok(EnvironmentRow {
                    id: row.get(0)?,
                    workspace_id: row.get(1)?,
                    name: row.get(2)?,
                    position: row.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?,
        "environment",
    )?;

    let variables = collect_rows(
        connection.prepare("SELECT environment_id, variable_key, variable_value, secret_ref, secret, masked, position FROM variables")
            .map_err(|e| e.to_string())?
            .query_map([], |row| {
                let secret: i64 = row.get(4)?;
                let masked: i64 = row.get::<_, i64>(5).unwrap_or(0);
                let mut variable_value: String = row.get(2)?;
                if secret != 0 {
                    variable_value = REDACTED_SECRET_VALUE.to_string();
                } else if masked != 0 {
                    variable_value = String::new();
                }
                Ok(VariableRow {
                    environment_id: row.get(0)?,
                    variable_key: row.get(1)?,
                    variable_value,
                    secret_ref: row.get(3)?,
                    secret,
                    masked,
                    position: row.get(6)?,
                })
            })
            .map_err(|e| e.to_string())?,
        "variable",
    )?;

    let export_data = ExportData {
        version: 1,
        workspaces,
        collections,
        folders,
        requests,
        request_headers,
        environments,
        variables,
    };

    serde_json::to_string_pretty(&export_data)
        .map_err(|error| format!("failed to serialize export data: {error}"))
}

use std::collections::HashMap;

#[tauri::command]
pub fn import_workspace_data(app: AppHandle, json: String) -> Result<(), String> {
    ensure_database(&app)?;
    let mut connection = open_database(&app)?;

    let export_data: ExportData = serde_json::from_str(&json)
        .map_err(|error| format!("failed to parse import data: {error}"))?;

    if export_data.version != 1 {
        return Err(format!(
            "unsupported export version: {}",
            export_data.version
        ));
    }

    let transaction = connection
        .transaction()
        .map_err(|error| format!("failed to start import transaction: {error}"))?;

    let mut workspace_id_map = HashMap::new();
    let mut collection_id_map = HashMap::new();
    let mut folder_id_map = HashMap::new();
    let mut request_id_map = HashMap::new();
    let mut environment_id_map = HashMap::new();

    for workspace in export_data.workspaces {
        let new_id = format!("workspace-{}", uuid::Uuid::new_v4());
        workspace_id_map.insert(workspace.id.clone(), new_id.clone());
        transaction
            .execute(
                "INSERT INTO workspaces (id, name, active_environment) VALUES (?1, ?2, ?3)",
                params![new_id, workspace.name, workspace.active_environment],
            )
            .map_err(|e| format!("failed to import workspace: {e}"))?;
    }

    for collection in export_data.collections {
        let new_id = format!("collection-{}", uuid::Uuid::new_v4());
        collection_id_map.insert(collection.id.clone(), new_id.clone());
        let workspace_id = workspace_id_map
            .get(&collection.workspace_id)
            .ok_or("invalid workspace reference in collection")?;
        transaction.execute(
            "INSERT INTO collections (id, workspace_id, name, position) VALUES (?1, ?2, ?3, ?4)",
            params![new_id, workspace_id, collection.name, collection.position],
        ).map_err(|e| format!("failed to import collection: {e}"))?;
    }

    for folder in export_data.folders {
        let new_id = format!("folder-{}", uuid::Uuid::new_v4());
        folder_id_map.insert(folder.id.clone(), new_id.clone());
        let collection_id = collection_id_map
            .get(&folder.collection_id)
            .ok_or("invalid collection reference in folder")?;
        transaction
            .execute(
                "INSERT INTO folders (id, collection_id, name, position) VALUES (?1, ?2, ?3, ?4)",
                params![new_id, collection_id, folder.name, folder.position],
            )
            .map_err(|e| format!("failed to import folder: {e}"))?;
    }

    for request in export_data.requests {
        let new_id = format!("request-{}", uuid::Uuid::new_v4());
        request_id_map.insert(request.id.clone(), new_id.clone());
        let workspace_id = workspace_id_map
            .get(&request.workspace_id)
            .ok_or("invalid workspace reference in request")?;
        let folder_id = folder_id_map
            .get(&request.folder_id)
            .ok_or("invalid folder reference in request")?;
        transaction.execute(
            "INSERT INTO requests (id, workspace_id, folder_id, name, method, url, auth_mode, auth_config, body, body_mime_type, body_form, query_params, timeout_ms, follow_redirects, position) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![new_id, workspace_id, folder_id, request.name, request.method, request.url, request.auth_mode, request.auth_config, request.body, request.body_mime_type, request.body_form, request.query_params, request.timeout_ms, request.follow_redirects, request.position],
        ).map_err(|e| format!("failed to import request: {e}"))?;
    }

    for header in export_data.request_headers {
        let request_id = request_id_map
            .get(&header.request_id)
            .ok_or("invalid request reference in request header")?;
        transaction.execute(
            "INSERT INTO request_headers (request_id, header_key, header_value, enabled, position) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![request_id, header.header_key, header.header_value, header.enabled, header.position],
        ).map_err(|e| format!("failed to import request header: {e}"))?;
    }

    for environment in export_data.environments {
        let new_id = format!("env-{}", uuid::Uuid::new_v4());
        environment_id_map.insert(environment.id.clone(), new_id.clone());
        let workspace_id = workspace_id_map
            .get(&environment.workspace_id)
            .ok_or("invalid workspace reference in environment")?;
        transaction.execute(
            "INSERT INTO environments (id, workspace_id, name, position) VALUES (?1, ?2, ?3, ?4)",
            params![new_id, workspace_id, environment.name, environment.position],
        ).map_err(|e| format!("failed to import environment: {e}"))?;
    }

    for variable in export_data.variables {
        let environment_id = environment_id_map
            .get(&variable.environment_id)
            .ok_or("invalid environment reference in variable")?;
        transaction.execute(
            "INSERT INTO variables (environment_id, variable_key, variable_value, secret_ref, secret, masked, position) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![environment_id, variable.variable_key, variable.variable_value, variable.secret_ref, variable.secret, variable.masked, variable.position],
        ).map_err(|e| format!("failed to import variable: {e}"))?;
    }

    transaction
        .commit()
        .map_err(|e| format!("failed to commit import transaction: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn reorder_items(app: AppHandle, item_type: String, ids: Vec<String>) -> Result<(), String> {
    ensure_database(&app)?;
    let mut connection = open_database(&app)?;
    let tx = connection.transaction().map_err(|e| format!("failed to start tx: {e}"))?;
    
    let table = match item_type.as_str() {
        "folder" => "folders",
        "request" => "requests",
        "collection" => "collections",
        "environment" => "environments",
        _ => return Err("invalid item type".to_string()),
    };
    
    for (i, id) in ids.iter().enumerate() {
        tx.execute(
            &format!("UPDATE {} SET position = ?1 WHERE id = ?2", table),
            params![i as i64, id],
        ).map_err(|e| format!("failed to update position: {e}"))?;
    }
    tx.commit().map_err(|e| format!("failed to commit: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn save_request(app: AppHandle, request: SavedRequest) -> Result<(), String> {
    ensure_database(&app)?;
    let mut connection = open_database(&app)?;
    let transaction = connection.transaction().map_err(|e| e.to_string())?;

    let clean_target = request.folder_id.trim_start_matches("collection:").trim_start_matches("folder:").trim();

    let target_folder_id: String = transaction
        .query_row(
            "SELECT id FROM folders WHERE id = ?1 OR id = ?2 OR LOWER(name) = LOWER(?2) LIMIT 1",
            rusqlite::params![&request.folder_id, clean_target],
            |row| row.get(0),
        )
        .or_else(|_| {
            transaction.query_row(
                "SELECT id FROM collections WHERE id = ?1 OR id = ?2 OR LOWER(name) = LOWER(?2) LIMIT 1",
                rusqlite::params![&request.folder_id, clean_target],
                |row| row.get(0),
            )
        })
        .unwrap_or_else(|_| request.folder_id.clone());

    let workspace_id: String = transaction
        .query_row(
            "SELECT collections.workspace_id FROM folders JOIN collections ON collections.id = folders.collection_id WHERE folders.id = ?1",
            rusqlite::params![&target_folder_id],
            |row| row.get(0),
        )
        .or_else(|_| {
            transaction.query_row(
                "SELECT workspace_id FROM collections WHERE id = ?1",
                rusqlite::params![&target_folder_id],
                |row| row.get(0),
            )
        })
        .unwrap_or_else(|_| first_workspace_id(&transaction).unwrap_or_default());

    transaction.execute(
        "INSERT INTO requests (id, workspace_id, folder_id, name, method, url, auth_mode, auth_config, body, body_mime_type, body_form, query_params, timeout_ms, follow_redirects, position)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, (SELECT COALESCE(MAX(position), -1) + 1 FROM requests WHERE folder_id = ?3))
         ON CONFLICT(id) DO UPDATE SET
            workspace_id = excluded.workspace_id,
            folder_id = excluded.folder_id,
            name = excluded.name,
            method = excluded.method,
            url = excluded.url,
            auth_mode = excluded.auth_mode,
            auth_config = excluded.auth_config,
            body = excluded.body,
            body_mime_type = excluded.body_mime_type,
            body_form = excluded.body_form,
            query_params = excluded.query_params,
            timeout_ms = excluded.timeout_ms,
            follow_redirects = excluded.follow_redirects",
        rusqlite::params![
            request.id,
            workspace_id,
            target_folder_id,
            request.name,
            request.method,
            request.url,
            request.auth_mode,
            request.auth_config,
            request.body,
            request.body_mime_type,
            request.body_form,
            request.query_params,
            request.timeout_ms,
            request.follow_redirects
        ]
    ).map_err(|e| e.to_string())?;

    transaction
        .execute(
            "DELETE FROM request_headers WHERE request_id = ?1",
            rusqlite::params![request.id],
        )
        .map_err(|e| e.to_string())?;

    for (i, header) in request.headers.iter().enumerate() {
        transaction.execute(
            "INSERT INTO request_headers (request_id, header_key, header_value, enabled, position) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![request.id, header.key, header.value, header.enabled, i as i64]
        ).map_err(|e| e.to_string())?;
    }

    transaction.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_request(app: AppHandle, request_id: String) -> Result<(), String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    connection
        .execute(
            "DELETE FROM request_headers WHERE request_id = ?1",
            rusqlite::params![&request_id],
        )
        .map_err(|e| e.to_string())?;
    connection
        .execute(
            "DELETE FROM requests WHERE id = ?1",
            rusqlite::params![&request_id],
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn create_folder(app: AppHandle, name: String, collection_id: Option<String>, parent_id: Option<String>) -> Result<FolderSummary, String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let folder_id = format!("folder-{}", uuid::Uuid::new_v4());

    let final_collection_id = match collection_id {
        Some(id) => id,
        None => connection
            .query_row(
                "SELECT id FROM collections ORDER BY position LIMIT 1",
                [],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?,
    };

    connection.execute(
        "INSERT INTO folders (id, collection_id, name, parent_id, position) VALUES (?1, ?2, ?3, ?4, (SELECT COALESCE(MAX(position), -1) + 1 FROM folders WHERE collection_id = ?2 AND parent_id IS ?4))",
        rusqlite::params![folder_id, final_collection_id, name, parent_id]
    ).map_err(|e| e.to_string())?;

    Ok(FolderSummary {
        id: folder_id,
        name,
        auth_mode: None,
        auth_config: None,
        collection_id: Some(final_collection_id),
        parent_id: parent_id,
        variables: Some(Vec::new()),
    })
}

#[tauri::command]
pub fn update_folder(app: AppHandle, folder_id: String, name: String) -> Result<(), String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    connection
        .execute(
            "UPDATE folders SET name = ?2 WHERE id = ?1",
            rusqlite::params![folder_id, name],
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Reparent a folder: set its collection_id + parent_id and append it at the end of
/// the new sibling group. Collection_id follows the parent (or the supplied value
/// when moving to a collection root).
#[tauri::command]
pub fn move_folder(
    app: AppHandle,
    folder_id: String,
    parent_id: Option<String>,
    collection_id: Option<String>,
) -> Result<(), String> {
    ensure_database(&app)?;
    let mut connection = open_database(&app)?;
    let tx = connection.transaction().map_err(|e| format!("failed to start tx: {e}"))?;

    let final_collection_id = match &parent_id {
        Some(pid) => tx
            .query_row(
                "SELECT collection_id FROM folders WHERE id = ?1",
                rusqlite::params![pid],
                |row| row.get::<_, String>(0),
            )
            .map_err(|e| format!("parent folder not found: {e}"))?,
        None => collection_id
            .ok_or_else(|| "collection_id required when moving to a collection root".to_string())?,
    };

    if parent_id.as_deref() == Some(&folder_id) {
        return Err("cannot move a folder into itself".to_string());
    }

    tx.execute(
        "UPDATE folders SET collection_id = ?2, parent_id = ?3,
         position = (SELECT COALESCE(MAX(position), -1) + 1 FROM folders WHERE collection_id = ?2 AND parent_id IS ?3)
         WHERE id = ?1",
        rusqlite::params![folder_id, final_collection_id, parent_id],
    )
    .map_err(|e| format!("failed to move folder: {e}"))?;

    tx.commit().map_err(|e| format!("failed to commit: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn update_collection(app: AppHandle, collection_id: String, name: String) -> Result<(), String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    connection
        .execute(
            "UPDATE collections SET name = ?2 WHERE id = ?1",
            rusqlite::params![collection_id, name],
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_collection_default_environment(app: AppHandle, collection_id: String, default_environment: Option<String>) -> Result<(), String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    connection
        .execute(
            "UPDATE collections SET default_environment = ?2 WHERE id = ?1",
            rusqlite::params![collection_id, default_environment],
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
pub fn delete_collection(app: AppHandle, collection_id: String) -> Result<(), String> {
    ensure_database(&app)?;
    let mut connection = open_database(&app)?;
    let transaction = connection.transaction().map_err(|e| e.to_string())?;

    transaction
        .execute(
            "DELETE FROM request_headers WHERE request_id IN (
                SELECT requests.id FROM requests
                LEFT JOIN folders ON folders.id = requests.folder_id
                WHERE folders.collection_id = ?1 OR requests.folder_id = ?1
            )",
            rusqlite::params![&collection_id],
        )
        .map_err(|e| e.to_string())?;
    transaction
        .execute(
            "DELETE FROM scripts WHERE
                (entity_type = 'collection' AND entity_id = ?1)
                OR (entity_type = 'folder' AND entity_id IN (
                    SELECT id FROM folders WHERE collection_id = ?1
                ))
                OR (entity_type = 'request' AND entity_id IN (
                    SELECT requests.id FROM requests
                    LEFT JOIN folders ON folders.id = requests.folder_id
                    WHERE folders.collection_id = ?1 OR requests.folder_id = ?1
                ))",
            rusqlite::params![&collection_id],
        )
        .map_err(|e| e.to_string())?;
    transaction
        .execute(
            "DELETE FROM requests WHERE folder_id = ?1 OR folder_id IN (
                SELECT id FROM folders WHERE collection_id = ?1
            )",
            rusqlite::params![&collection_id],
        )
        .map_err(|e| e.to_string())?;
    transaction
        .execute(
            "DELETE FROM folders WHERE collection_id = ?1",
            rusqlite::params![&collection_id],
        )
        .map_err(|e| e.to_string())?;
    transaction
        .execute(
            "DELETE FROM collections WHERE id = ?1",
            rusqlite::params![&collection_id],
        )
        .map_err(|e| e.to_string())?;

    transaction.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_folder(app: AppHandle, folder_id: String) -> Result<(), String> {
    ensure_database(&app)?;
    let mut connection = open_database(&app)?;
    let transaction = connection.transaction().map_err(|e| e.to_string())?;

    // delete all requests in folder
    let mut statement = transaction
        .prepare("SELECT id FROM requests WHERE folder_id = ?1")
        .map_err(|e| e.to_string())?;
    let req_ids = statement
        .query_map(rusqlite::params![&folder_id], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    for id in req_ids {
        if let Ok(rid) = id {
            transaction
                .execute(
                    "DELETE FROM request_headers WHERE request_id = ?1",
                    rusqlite::params![&rid],
                )
                .map_err(|e| e.to_string())?;
            transaction
                .execute(
                    "DELETE FROM requests WHERE id = ?1",
                    rusqlite::params![&rid],
                )
                .map_err(|e| e.to_string())?;
        }
    }
    drop(statement);

    transaction
        .execute(
            "DELETE FROM folders WHERE id = ?1",
            rusqlite::params![&folder_id],
        )
        .map_err(|e| e.to_string())?;
    transaction.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn create_request(app: AppHandle, folder_id: String) -> Result<SavedRequest, String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let clean_target = folder_id.trim_start_matches("collection:").trim_start_matches("folder:").trim();

    let target_folder_id: String = connection
        .query_row(
            "SELECT id FROM folders WHERE id = ?1 OR id = ?2 OR LOWER(name) = LOWER(?2) LIMIT 1",
            rusqlite::params![&folder_id, clean_target],
            |row| row.get(0),
        )
        .or_else(|_| {
            connection.query_row(
                "SELECT id FROM collections WHERE id = ?1 OR id = ?2 OR LOWER(name) = LOWER(?2) LIMIT 1",
                rusqlite::params![&folder_id, clean_target],
                |row| row.get(0),
            )
        })
        .unwrap_or_else(|_| clean_target.to_string());

    let request_id = format!("request-{}", uuid::Uuid::new_v4());
    let req = SavedRequest {
        id: request_id,
        name: "New Request".to_string(),
        method: "GET".to_string(),
        url: "".to_string(),
        folder_id: target_folder_id,
        auth_mode: "none".to_string(),
        auth_config: "{}".to_string(),
        headers: vec![],
        body: "".to_string(),
        body_mime_type: "text/plain".to_string(),
        body_form: "[]".to_string(),
        query_params: "[]".to_string(),
        timeout_ms: 30000,
        follow_redirects: true,
        variables: Some(Vec::new()),
    };
    save_request(app, req.clone())?;
    Ok(req)
}

fn find_environment_id(
    connection: &Connection,
    workspace_id: &str,
    name: &str,
) -> Result<String, String> {
    connection
        .query_row(
            "SELECT id FROM environments WHERE workspace_id = ?1 AND name = ?2",
            params![workspace_id, name],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| format!("failed to lookup environment: {error}"))?
        .ok_or_else(|| format!("environment '{name}' not found"))
}

#[tauri::command]
pub fn create_environment(app: AppHandle, name: String) -> Result<EnvironmentSummary, String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let workspace_id = active_workspace_id(&connection)?;
    let env_id = format!("env-{}", uuid::Uuid::new_v4());
    connection
        .execute(
            "INSERT INTO environments (id, workspace_id, name, position)
             VALUES (?1, ?2, ?3, (SELECT COALESCE(MAX(position), -1) + 1 FROM environments WHERE workspace_id = ?2))",
            params![env_id, workspace_id, name],
        )
        .map_err(|error| format!("failed to create environment: {error}"))?;
    Ok(EnvironmentSummary {
        name,
        variables: vec![],
    })
}

#[tauri::command]
pub fn rename_environment(
    app: AppHandle,
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let workspace_id = active_workspace_id(&connection)?;
    let env_id = find_environment_id(&connection, &workspace_id, &old_name)?;
    let next_name = new_name.trim();
    if next_name.is_empty() {
        return Err("environment name cannot be blank".to_string());
    }
    let duplicate_env_id = connection
        .query_row(
            "SELECT id FROM environments WHERE workspace_id = ?1 AND name = ?2 AND id != ?3",
            params![workspace_id, next_name, env_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| format!("failed to check environment name: {error}"))?;
    if duplicate_env_id.is_some() {
        return Err(format!("environment '{next_name}' already exists"));
    }
    connection
        .execute(
            "UPDATE environments SET name = ?2 WHERE id = ?1",
            params![env_id, next_name],
        )
        .map_err(|error| format!("failed to rename environment: {error}"))?;
    connection
        .execute(
            "UPDATE workspaces SET active_environment = ?2 WHERE id = ?3 AND active_environment = ?1",
            params![old_name, next_name, workspace_id],
        )
        .map_err(|error| format!("failed to update active environment reference: {error}"))?;
    Ok(())
}

#[tauri::command]
pub fn delete_environment(app: AppHandle, name: String) -> Result<(), String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let workspace_id = active_workspace_id(&connection)?;
    let env_id = find_environment_id(&connection, &workspace_id, &name)?;
    connection
        .execute(
            "DELETE FROM variables WHERE environment_id = ?1",
            params![env_id],
        )
        .map_err(|error| format!("failed to delete environment variables: {error}"))?;
    connection
        .execute("DELETE FROM environments WHERE id = ?1", params![env_id])
        .map_err(|error| format!("failed to delete environment: {error}"))?;
    let next_active_environment = connection
        .query_row(
            "SELECT name FROM environments WHERE workspace_id = ?1 ORDER BY position, name LIMIT 1",
            params![workspace_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| format!("failed to load next active environment: {error}"))?;
    if let Some(next_name) = next_active_environment {
        connection
            .execute(
                "UPDATE workspaces SET active_environment = ?1 WHERE id = ?2 AND active_environment = ?3",
                params![next_name, workspace_id, name],
            )
            .map_err(|error| format!("failed to update active environment reference: {error}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn set_active_environment(app: AppHandle, name: String) -> Result<(), String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let workspace_id = active_workspace_id(&connection)?;
    connection
        .execute(
            "UPDATE workspaces SET active_environment = ?2 WHERE id = ?1",
            params![workspace_id, name],
        )
        .map_err(|error| format!("failed to set active environment: {error}"))?;
    Ok(())
}

#[tauri::command]
pub fn save_variable(
    app: AppHandle,
    environment_name: String,
    key: String,
    value: String,
    masked: Option<bool>,
) -> Result<(), String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let workspace_id = active_workspace_id(&connection)?;
    let env_id = find_environment_id(&connection, &workspace_id, &environment_name)?;
    let masked_val: i64 = if masked.unwrap_or(false) { 1 } else { 0 };
    let updated = connection
        .execute(
            "UPDATE variables SET variable_value = ?3, secret = 0, secret_ref = NULL, masked = ?4 WHERE environment_id = ?1 AND variable_key = ?2",
            params![env_id, key, value, masked_val],
        )
        .map_err(|error| format!("failed to update variable: {error}"))?;
    if updated == 0 {
        connection
            .execute(
                "INSERT INTO variables (environment_id, variable_key, variable_value, secret, masked, position)
                 VALUES (?1, ?2, ?3, 0, ?4, (SELECT COALESCE(MAX(position), -1) + 1 FROM variables WHERE environment_id = ?1))",
                params![env_id, key, value, masked_val],
            )
            .map_err(|error| format!("failed to insert variable: {error}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn delete_variable(
    app: AppHandle,
    environment_name: String,
    key: String,
) -> Result<(), String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let workspace_id = active_workspace_id(&connection)?;
    let env_id = find_environment_id(&connection, &workspace_id, &environment_name)?;
    connection
        .execute(
            "DELETE FROM variables WHERE environment_id = ?1 AND variable_key = ?2",
            params![env_id, key],
        )
        .map_err(|error| format!("failed to delete variable: {error}"))?;
    Ok(())
}

#[tauri::command]
pub fn save_secret_variable(
    app: AppHandle,
    environment_name: String,
    key: String,
    secret_ref: String,
) -> Result<(), String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let workspace_id = active_workspace_id(&connection)?;
    let env_id = find_environment_id(&connection, &workspace_id, &environment_name)?;
    let updated = connection
        .execute(
            "UPDATE variables SET variable_value = ?3, secret_ref = ?4, secret = 1, masked = 1 WHERE environment_id = ?1 AND variable_key = ?2",
            params![env_id, key, REDACTED_SECRET_VALUE, secret_ref],
        )
        .map_err(|error| format!("failed to update secret variable: {error}"))?;
    if updated == 0 {
        connection
            .execute(
                "INSERT INTO variables (environment_id, variable_key, variable_value, secret_ref, secret, masked, position)
                 VALUES (?1, ?2, ?3, ?4, 1, 1, (SELECT COALESCE(MAX(position), -1) + 1 FROM variables WHERE environment_id = ?1))",
                params![env_id, key, REDACTED_SECRET_VALUE, secret_ref],
            )
            .map_err(|error| format!("failed to insert secret variable: {error}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn save_scoped_variable(
    app: AppHandle,
    entity_id: String,
    entity_type: String,
    key: String,
    value: String,
) -> Result<(), String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let updated = connection
        .execute(
            "UPDATE scoped_variables SET variable_value = ?4, secret = 0, secret_ref = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE entity_id = ?1 AND entity_type = ?2 AND variable_key = ?3",
            params![entity_id, entity_type, key, value],
        )
        .map_err(|error| format!("failed to update scoped variable: {error}"))?;
    if updated == 0 {
        connection
            .execute(
                "INSERT INTO scoped_variables (entity_id, entity_type, variable_key, variable_value, secret, position)
                 VALUES (?1, ?2, ?3, ?4, 0, (SELECT COALESCE(MAX(position), -1) + 1 FROM scoped_variables WHERE entity_id = ?1 AND entity_type = ?2))",
                params![entity_id, entity_type, key, value],
            )
            .map_err(|error| format!("failed to insert scoped variable: {error}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn save_scoped_secret_variable(
    app: AppHandle,
    entity_id: String,
    entity_type: String,
    key: String,
    secret_ref: String,
) -> Result<(), String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let updated = connection
        .execute(
            "UPDATE scoped_variables SET variable_value = ?4, secret_ref = ?5, secret = 1, updated_at = CURRENT_TIMESTAMP
             WHERE entity_id = ?1 AND entity_type = ?2 AND variable_key = ?3",
            params![entity_id, entity_type, key, REDACTED_SECRET_VALUE, secret_ref],
        )
        .map_err(|error| format!("failed to update scoped secret variable: {error}"))?;
    if updated == 0 {
        connection
            .execute(
                "INSERT INTO scoped_variables (entity_id, entity_type, variable_key, variable_value, secret_ref, secret, position)
                 VALUES (?1, ?2, ?3, ?4, ?5, 1, (SELECT COALESCE(MAX(position), -1) + 1 FROM scoped_variables WHERE entity_id = ?1 AND entity_type = ?2))",
                params![entity_id, entity_type, key, REDACTED_SECRET_VALUE, secret_ref],
            )
            .map_err(|error| format!("failed to insert scoped secret variable: {error}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn delete_scoped_variable(
    app: AppHandle,
    entity_id: String,
    entity_type: String,
    key: String,
) -> Result<(), String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    connection
        .execute(
            "DELETE FROM scoped_variables WHERE entity_id = ?1 AND entity_type = ?2 AND variable_key = ?3",
            params![entity_id, entity_type, key],
        )
        .map_err(|error| format!("failed to delete scoped variable: {error}"))?;
    Ok(())
}

#[tauri::command]
pub fn get_scoped_variables(
    app: AppHandle,
    entity_id: String,
    entity_type: String,
) -> Result<Vec<ScopedVariable>, String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    load_scoped_variables(&connection, &entity_id, &entity_type)
}

#[tauri::command]
pub fn get_scripts(app: AppHandle, entity_id: String, entity_type: String) -> Result<Vec<Script>, String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let mut statement = connection
        .prepare(
            "SELECT id, entity_id, entity_type, script_type, content, position
             FROM scripts
             WHERE entity_id = ?1 AND entity_type = ?2
             ORDER BY position, id",
        )
        .map_err(|error| format!("failed to prepare scripts query: {error}"))?;
    let rows = statement
        .query_map(params![entity_id, entity_type], |row| {
            Ok(Script {
                id: row.get(0)?,
                entity_id: row.get(1)?,
                entity_type: row.get(2)?,
                script_type: row.get(3)?,
                content: row.get(4)?,
                position: row.get(5)?,
            })
        })
        .map_err(|error| format!("failed to query scripts: {error}"))?;
    collect_rows(rows, "script")
}

#[tauri::command]
pub fn get_all_scripts(app: AppHandle) -> Result<Vec<Script>, String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let mut statement = connection
        .prepare(
            "SELECT id, entity_id, entity_type, script_type, content, position
             FROM scripts
             ORDER BY entity_id, position, id",
        )
        .map_err(|error| format!("failed to prepare all scripts query: {error}"))?;
    let rows = statement
        .query_map(params![], |row| {
            Ok(Script {
                id: row.get(0)?,
                entity_id: row.get(1)?,
                entity_type: row.get(2)?,
                script_type: row.get(3)?,
                content: row.get(4)?,
                position: row.get(5)?,
            })
        })
        .map_err(|error| format!("failed to query all scripts: {error}"))?;
    collect_rows(rows, "script")
}

#[tauri::command]
pub fn save_script(
    app: AppHandle,
    entity_id: String,
    entity_type: String,
    script_type: String,
    content: String,
) -> Result<(), String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let script_id = format!("script-{}", uuid::Uuid::new_v4());

    // Check if a script of this type already exists for this entity
    let existing_id: Option<String> = connection
        .query_row(
            "SELECT id FROM scripts WHERE entity_id = ?1 AND entity_type = ?2 AND script_type = ?3",
            params![entity_id, entity_type, script_type],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| format!("failed to lookup existing script: {error}"))?;

    if let Some(id) = existing_id {
        connection
            .execute(
                "UPDATE scripts SET content = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
                params![content, id],
            )
            .map_err(|error| format!("failed to update script: {error}"))?;
    } else {
        connection
            .execute(
                "INSERT INTO scripts (id, entity_id, entity_type, script_type, content, position)
                 VALUES (?1, ?2, ?3, ?4, ?5, 0)",
                params![script_id, entity_id, entity_type, script_type, content],
            )
            .map_err(|error| format!("failed to insert script: {error}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn delete_script(app: AppHandle, script_id: String) -> Result<(), String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    connection
        .execute("DELETE FROM scripts WHERE id = ?1", params![script_id])
        .map_err(|error| format!("failed to delete script: {error}"))?;
    Ok(())
}

#[tauri::command]
pub fn save_folder_auth(
    app: AppHandle,
    folder_id: String,
    auth_mode: String,
    auth_config: serde_json::Value,
) -> Result<(), String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let config_str = serde_json::to_string(&auth_config)
        .map_err(|e| format!("failed to serialize auth config: {e}"))?;
    connection
        .execute(
            "UPDATE folders SET auth_mode = ?2, auth_config = ?3, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            rusqlite::params![folder_id, auth_mode, config_str],
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn save_collection_auth(
    app: AppHandle,
    collection_id: String,
    auth_mode: String,
    auth_config: serde_json::Value,
) -> Result<(), String> {
    ensure_database(&app)?;
    let connection = open_database(&app)?;
    let config_str = serde_json::to_string(&auth_config)
        .map_err(|e| format!("failed to serialize auth config: {e}"))?;
    connection
        .execute(
            "UPDATE collections SET auth_mode = ?2, auth_config = ?3, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            rusqlite::params![collection_id, auth_mode, config_str],
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}
