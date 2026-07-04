use keyring::Entry;
use serde::{Deserialize, Serialize};

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
    if input.value.is_empty() {
        return Err("secret value cannot be empty".to_string());
    }

    let ref_id = secret_ref(&input.scope, &input.key);
    let entry = Entry::new(KEYCHAIN_SERVICE, &ref_id)
        .map_err(|error| format!("failed to open keychain entry: {error}"))?;
    entry
        .set_password(&input.value)
        .map_err(|error| format!("failed to store secret in keychain: {error}"))?;

    Ok(SecretReference { ref_id })
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
