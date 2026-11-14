use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct AppContract {
    pub launch_model: &'static str,
    pub account_system: &'static str,
    pub offline_ready: bool,
    pub update_checks: &'static str,
}

#[derive(Debug, Serialize)]
pub struct LocalStorageStatus {
    pub database: &'static str,
    pub secret_storage: &'static str,
    pub export_policy: &'static str,
}

pub fn app_contract() -> AppContract {
    AppContract {
        launch_model: "download, launch, use",
        account_system: "no login, no registration, no user account database",
        offline_ready: true,
        update_checks: "automatic update checks are optional and signed",
    }
}

pub fn request_auth_modes() -> Vec<&'static str> {
    vec!["None", "Basic Auth", "Bearer Token", "API Key", "OAuth 2.0"]
}

pub fn local_storage_status() -> LocalStorageStatus {
    LocalStorageStatus {
        database: "SQLite local application data",
        secret_storage: "operating-system keychain first, encrypted vault fallback",
        export_policy: "portable exports exclude sensitive values by default",
    }
}
