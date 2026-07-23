use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const KEYCHAIN_SERVICE: &str = "KobeanREST";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreSecretInput {
    pub scope: String,
    pub key: String,
    pub value: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecretReference {
    pub ref_id: String,
}

pub fn secret_ref(scope: &str, key: &str) -> String {
    format!(
        "kobeanrest://secrets/{}/{}",
        normalize_ref_part(scope),
        normalize_ref_part(key)
    )
}

#[tauri::command]
pub fn store_secret(input: StoreSecretInput) -> Result<SecretReference, String> {
    let ref_id = secret_ref(&input.scope, &input.key);
    let entry = Entry::new(KEYCHAIN_SERVICE, &ref_id)
        .map_err(|error| format!("failed to open keychain entry: {error}"))?;
    entry
        .set_password(&input.value)
        .map_err(|error| format!("failed to store secret in keychain: {error}"))?;

    Ok(SecretReference { ref_id })
}

/// Resolve a batch of secret references into their plaintext values.
/// Missing/unreadable secrets resolve to an empty string with a logged warning
/// rather than failing the whole send (non-blocking, offline-friendly).
#[tauri::command]
pub fn resolve_secrets(ref_ids: Vec<String>) -> Result<HashMap<String, String>, String> {
    let mut resolved: HashMap<String, String> = HashMap::new();
    for ref_id in ref_ids {
        match Entry::new(KEYCHAIN_SERVICE, &ref_id) {
            Ok(entry) => match entry.get_password() {
                Ok(value) => {
                    resolved.insert(ref_id, value);
                }
                Err(error) => {
                    eprintln!("failed to read secret '{ref_id}': {error}");
                    resolved.insert(ref_id, String::new());
                }
            },
            Err(error) => {
                eprintln!("failed to open keychain entry for '{ref_id}': {error}");
                resolved.insert(ref_id, String::new());
            }
        }
    }
    Ok(resolved)
}

#[tauri::command]
pub fn delete_secret(ref_id: String) -> Result<(), String> {
    let entry = Entry::new(KEYCHAIN_SERVICE, &ref_id)
        .map_err(|error| format!("failed to open keychain entry: {error}"))?;
    entry
        .delete_credential()
        .map_err(|error| format!("failed to delete secret from keychain: {error}"))
}

fn normalize_ref_part(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.') {
                character.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect()
}
