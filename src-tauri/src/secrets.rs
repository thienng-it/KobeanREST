use std::collections::HashMap;

pub use kobean_core::secrets::{SecretReference, StoreSecretInput};

#[tauri::command]
pub fn store_secret(input: StoreSecretInput) -> Result<SecretReference, String> {
    kobean_core::secrets::store_secret(input)
}

#[tauri::command]
pub fn resolve_secrets(ref_ids: Vec<String>) -> Result<HashMap<String, String>, String> {
    kobean_core::secrets::resolve_secrets(ref_ids)
}

#[tauri::command]
pub fn delete_secret(ref_id: String) -> Result<(), String> {
    kobean_core::secrets::delete_secret(ref_id)
}
