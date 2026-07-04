use serde::Serialize;

const TAURI_UPDATER_PLACEHOLDER_KEY: &str =
    "REPLACE_WITH_TAURI_UPDATER_PUBLIC_KEY_BEFORE_PUBLIC_RELEASE";

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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckPreview {
    pub enabled_by_default: bool,
    pub requires_account: bool,
    pub metadata: &'static str,
    pub release_ready: bool,
    pub message: String,
}

fn updater_release_status() -> (bool, String) {
    let config = include_str!("../tauri.conf.json");
    if config.contains(TAURI_UPDATER_PLACEHOLDER_KEY) {
        return (
            false,
            "Updater is not release-ready: the Tauri updater public key is still a placeholder."
                .to_string(),
        );
    }

    (
        true,
        "Signed updater metadata is configured. Checking GitHub Releases can continue.".to_string(),
    )
}

#[tauri::command]
pub fn app_contract() -> AppContract {
    AppContract {
        launch_model: "download, launch, use",
        account_system: "no login, no registration, no user account database",
        offline_ready: true,
        update_checks: "automatic update checks are optional and signed",
    }
}

#[tauri::command]
pub fn request_auth_modes() -> Vec<&'static str> {
    vec!["None", "Basic Auth", "Bearer Token", "API Key", "OAuth 2.0"]
}

#[tauri::command]
pub fn local_storage_status() -> LocalStorageStatus {
    LocalStorageStatus {
        database: "SQLite local application data",
        secret_storage: "operating-system keychain first, encrypted vault fallback",
        export_policy: "portable exports exclude sensitive values by default",
    }
}

#[tauri::command]
pub async fn check_for_update() -> UpdateCheckPreview {
    let (release_ready, message) = updater_release_status();

    UpdateCheckPreview {
        enabled_by_default: false,
        requires_account: false,
        metadata: "GitHub Releases latest.json signed by Tauri updater keys",
        release_ready,
        message,
    }
}
