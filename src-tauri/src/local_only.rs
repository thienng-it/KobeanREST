use serde::Serialize;

pub use kobean_core::local_only::{AppContract, LocalStorageStatus};

const TAURI_UPDATER_PLACEHOLDER_KEY: &str =
    "REPLACE_WITH_TAURI_UPDATER_PUBLIC_KEY_BEFORE_PUBLIC_RELEASE";

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
    kobean_core::local_only::app_contract()
}

#[tauri::command]
pub fn request_auth_modes() -> Vec<&'static str> {
    kobean_core::local_only::request_auth_modes()
}

#[tauri::command]
pub fn local_storage_status() -> LocalStorageStatus {
    kobean_core::local_only::local_storage_status()
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
