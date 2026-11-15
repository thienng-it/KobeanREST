use std::collections::{HashMap, HashSet};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::{Deserialize, Serialize};

use crate::persistence::{HeaderEntry, SavedRequest, WorkspaceSummary};

use super::variables::{contains_variables, encode_uri_component, resolve_string_safe};

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AuthConfig {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub key_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub key_value: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub placement: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub grant_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auth_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub access_token_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub client_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub client_secret: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audience: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub redirect_uri: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EffectiveAuth {
    pub mode: String,
    pub config: AuthConfig,
    pub source: String,
    pub entity_id: Option<String>,
    pub entity_type: Option<String>,
}

#[derive(Debug, Clone)]
pub struct AppliedAuth {
    pub url: String,
    pub headers: Vec<HeaderEntry>,
}

pub fn parse_auth_config(raw: Option<&str>) -> AuthConfig {
    let Some(s) = raw.map(str::trim).filter(|s| !s.is_empty()) else {
        return AuthConfig::default();
    };
    serde_json::from_str(s).unwrap_or_default()
}

fn try_resolve(value: Option<&str>, variable_map: &HashMap<String, String>) -> Option<String> {
    let v = value?;
    if v.is_empty() {
        return None;
    }
    let resolved = if contains_variables(v) {
        resolve_string_safe(v, variable_map)
    } else {
        v.to_string()
    };
    if resolved.is_empty() {
        None
    } else {
        Some(resolved)
    }
}

pub fn resolve_auth_config(
    auth_config: &AuthConfig,
    variable_map: &HashMap<String, String>,
) -> AuthConfig {
    AuthConfig {
        username: try_resolve(auth_config.username.as_deref(), variable_map),
        password: try_resolve(auth_config.password.as_deref(), variable_map),
        token: try_resolve(auth_config.token.as_deref(), variable_map),
        key_name: try_resolve(auth_config.key_name.as_deref(), variable_map),
        key_value: try_resolve(auth_config.key_value.as_deref(), variable_map),
        placement: auth_config.placement.clone(),
        grant_type: auth_config.grant_type.clone(),
        auth_url: try_resolve(auth_config.auth_url.as_deref(), variable_map),
        access_token_url: try_resolve(auth_config.access_token_url.as_deref(), variable_map),
        client_id: try_resolve(auth_config.client_id.as_deref(), variable_map),
        client_secret: try_resolve(auth_config.client_secret.as_deref(), variable_map),
        scope: try_resolve(auth_config.scope.as_deref(), variable_map),
        audience: try_resolve(auth_config.audience.as_deref(), variable_map),
        refresh_token: auth_config.refresh_token.clone(),
        expires_at: auth_config.expires_at,
        redirect_uri: try_resolve(auth_config.redirect_uri.as_deref(), variable_map),
    }
}

pub fn get_effective_auth(
    request: &SavedRequest,
    workspace: Option<&WorkspaceSummary>,
) -> EffectiveAuth {
    let Some(workspace) = workspace else {
        return EffectiveAuth {
            mode: "none".to_string(),
            config: AuthConfig::default(),
            source: "No workspace loaded".to_string(),
            entity_id: None,
            entity_type: None,
        };
    };

    if !request.auth_mode.is_empty() && request.auth_mode != "none" {
        return EffectiveAuth {
            mode: request.auth_mode.clone(),
            config: parse_auth_config(Some(&request.auth_config)),
            source: "Request level".to_string(),
            entity_id: Some(request.id.clone()),
            entity_type: Some("request".to_string()),
        };
    }

    let mut current_folder_id: Option<&str> = Some(request.folder_id.as_str());
    let mut resolved_collection_id: Option<&str> = None;
    let mut visited = HashSet::new();

    while let Some(fid) = current_folder_id {
        if fid.is_empty() || !visited.insert(fid) {
            break;
        }
        if let Some(folder) = workspace.folders.iter().find(|f| f.id == fid) {
            if let Some(mode) = folder.auth_mode.as_deref() {
                if !mode.is_empty() && mode != "none" {
                    return EffectiveAuth {
                        mode: mode.to_string(),
                        config: parse_auth_config(folder.auth_config.as_deref()),
                        source: format!("Inherited from folder: {}", folder.name),
                        entity_id: Some(folder.id.clone()),
                        entity_type: Some("folder".to_string()),
                    };
                }
            }
            if resolved_collection_id.is_none() {
                resolved_collection_id = folder.collection_id.as_deref();
            }
            current_folder_id = folder.parent_id.as_deref();
        } else {
            if resolved_collection_id.is_none()
                && workspace
                    .collections
                    .as_ref()
                    .is_some_and(|cols| cols.iter().any(|c| c.id == fid))
            {
                resolved_collection_id = Some(fid);
            }
            break;
        }
    }

    if let Some(cid) = resolved_collection_id {
        if let Some(collection) = workspace
            .collections
            .as_ref()
            .and_then(|cols| cols.iter().find(|c| c.id == cid))
        {
            if let Some(mode) = collection.auth_mode.as_deref() {
                if !mode.is_empty() && mode != "none" {
                    return EffectiveAuth {
                        mode: mode.to_string(),
                        config: parse_auth_config(collection.auth_config.as_deref()),
                        source: format!("Inherited from collection: {}", collection.name),
                        entity_id: Some(collection.id.clone()),
                        entity_type: Some("collection".to_string()),
                    };
                }
            }
        }
    }

    EffectiveAuth {
        mode: "none".to_string(),
        config: AuthConfig::default(),
        source: "No inherited auth".to_string(),
        entity_id: None,
        entity_type: None,
    }
}

pub fn apply_auth(
    auth_mode: &str,
    auth_config: &AuthConfig,
    url: &str,
    headers: &[HeaderEntry],
) -> AppliedAuth {
    let mut result_headers: Vec<HeaderEntry> = headers
        .iter()
        .filter(|h| {
            let key_lower = h.key.to_ascii_lowercase();
            if key_lower == "authorization"
                && matches!(auth_mode, "basic" | "bearer" | "oauth2")
            {
                return false;
            }
            if auth_mode == "apiKey" {
                if let Some(key_name) = auth_config.key_name.as_deref() {
                    if !key_name.is_empty()
                        && auth_config.placement.as_deref() != Some("query")
                        && h.key.eq_ignore_ascii_case(key_name)
                    {
                        return false;
                    }
                }
            }
            true
        })
        .cloned()
        .collect();

    let mut result_url = url.to_string();

    match auth_mode {
        "basic" => {
            let user = auth_config.username.as_deref().unwrap_or("");
            let pass = auth_config.password.as_deref().unwrap_or("");
            if !user.is_empty() || !pass.is_empty() {
                let encoded = BASE64.encode(format!("{user}:{pass}").as_bytes());
                result_headers.push(HeaderEntry {
                    key: "Authorization".to_string(),
                    value: format!("Basic {encoded}"),
                    enabled: true,
                });
            }
        }
        "bearer" | "oauth2" => {
            if let Some(token) = auth_config.token.as_deref().filter(|t| !t.is_empty()) {
                result_headers.push(HeaderEntry {
                    key: "Authorization".to_string(),
                    value: format!("Bearer {token}"),
                    enabled: true,
                });
            }
        }
        "apiKey" => {
            if let (Some(key_name), Some(key_value)) = (
                auth_config.key_name.as_deref().filter(|k| !k.is_empty()),
                auth_config.key_value.as_deref().filter(|v| !v.is_empty()),
            ) {
                if auth_config.placement.as_deref() == Some("query") {
                    let sep = if result_url.contains('?') { "&" } else { "?" };
                    result_url = format!(
                        "{result_url}{sep}{}={}",
                        encode_uri_component(key_name),
                        encode_uri_component(key_value)
                    );
                } else {
                    result_headers.push(HeaderEntry {
                        key: key_name.to_string(),
                        value: key_value.to_string(),
                        enabled: true,
                    });
                }
            }
        }
        _ => {}
    }

    AppliedAuth {
        url: result_url,
        headers: result_headers,
    }
}

fn is_absolute_url(url: &str) -> bool {
    let Some(pos) = url.find("://") else {
        return false;
    };
    let scheme = &url[..pos];
    let mut chars = scheme.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    if !first.is_ascii_alphabetic()
        || !chars.all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '-' | '.'))
    {
        return false;
    }
    !url[pos + 3..].is_empty()
}

pub fn redact_auth_from_url(url: &str, auth_mode: &str, auth_config: &AuthConfig) -> String {
    if auth_mode != "apiKey" || auth_config.placement.as_deref() != Some("query") {
        return url.to_string();
    }
    let Some(key_name) = auth_config.key_name.as_deref().filter(|k| !k.is_empty()) else {
        return url.to_string();
    };
    if !is_absolute_url(url) {
        return url.to_string();
    }

    let (before_hash, hash) = match url.find('#') {
        Some(h) => (&url[..h], &url[h..]),
        None => (url, ""),
    };
    let Some(q_idx) = before_hash.find('?') else {
        return url.to_string();
    };
    let base = &before_hash[..q_idx];
    let query = &before_hash[q_idx + 1..];
    if query.is_empty() {
        return url.to_string();
    }

    let mut changed = false;
    let encoded_target = encode_uri_component(key_name);
    let pairs: Vec<String> = query
        .split('&')
        .map(|pair| {
            if let Some(eq_idx) = pair.find('=') {
                let raw_key = &pair[..eq_idx];
                let decoded_key = form_urlencoded::parse(raw_key.as_bytes())
                    .next()
                    .map(|(k, _)| k.into_owned());
                if raw_key == key_name
                    || raw_key == encoded_target
                    || decoded_key.as_deref() == Some(key_name)
                {
                    changed = true;
                    return format!("{raw_key}=[redacted]");
                }
            } else if pair == key_name || pair == encoded_target {
                changed = true;
                return format!("{pair}=[redacted]");
            }
            pair.to_string()
        })
        .collect();

    if changed {
        format!("{base}?{}{hash}", pairs.join("&"))
    } else {
        url.to_string()
    }
}

pub fn redact_auth_headers(
    headers: &[HeaderEntry],
    auth_mode: &str,
    auth_config: &AuthConfig,
) -> Vec<HeaderEntry> {
    headers
        .iter()
        .map(|h| {
            if h.key.eq_ignore_ascii_case("authorization") {
                return HeaderEntry {
                    key: h.key.clone(),
                    value: "[redacted]".to_string(),
                    enabled: h.enabled,
                };
            }
            if auth_mode == "apiKey" {
                if let Some(key_name) = auth_config.key_name.as_deref() {
                    if !key_name.is_empty() && h.key.eq_ignore_ascii_case(key_name) {
                        return HeaderEntry {
                            key: h.key.clone(),
                            value: "[redacted]".to_string(),
                            enabled: h.enabled,
                        };
                    }
                }
            }
            h.clone()
        })
        .collect()
}
