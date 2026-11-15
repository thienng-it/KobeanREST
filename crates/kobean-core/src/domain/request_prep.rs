use std::collections::HashMap;
use std::fmt;

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::http_client::{self, ExecuteHttpRequest};
use crate::persistence::{HeaderEntry, PathVariableEntry, SavedRequest, WorkspaceSummary};

use super::auth::{
    apply_auth, get_effective_auth, parse_auth_config, redact_auth_from_url, resolve_auth_config,
    AuthConfig,
};
use super::path_variables::resolve_path_variables_in_url;
use super::variables::{resolve_request_fields, resolve_string_safe, UnresolvedVariableError};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PrepareRequestError {
    UnresolvedVariables(UnresolvedVariableError),
}

impl fmt::Display for PrepareRequestError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PrepareRequestError::UnresolvedVariables(err) => err.fmt(f),
        }
    }
}

impl std::error::Error for PrepareRequestError {}

impl From<UnresolvedVariableError> for PrepareRequestError {
    fn from(value: UnresolvedVariableError) -> Self {
        PrepareRequestError::UnresolvedVariables(value)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreparedHttpRequest {
    pub method: String,
    pub url: String,
    pub headers: Vec<HeaderEntry>,
    pub body: Option<String>,
    pub body_mime_type: Option<String>,
    pub body_form: Vec<http_client::HeaderEntry>,
    pub timeout_ms: u64,
    pub follow_redirects: bool,
    pub history_url: String,
    pub effective_auth_mode: String,
    pub effective_auth_config: AuthConfig,
    pub auth_entity_id: Option<String>,
    pub auth_entity_type: Option<String>,
}

impl PreparedHttpRequest {
    pub fn to_execute_http_request(&self) -> ExecuteHttpRequest {
        ExecuteHttpRequest {
            method: self.method.clone(),
            url: self.url.clone(),
            headers: self
                .headers
                .iter()
                .map(|h| http_client::HeaderEntry {
                    key: h.key.clone(),
                    value: h.value.clone(),
                    enabled: h.enabled,
                    field_type: None,
                })
                .collect(),
            body: self.body.clone(),
            body_mime_type: self.body_mime_type.clone(),
            body_form: self
                .body_form
                .iter()
                .map(|f| http_client::HeaderEntry {
                    key: f.key.clone(),
                    value: f.value.clone(),
                    enabled: f.enabled,
                    field_type: f.field_type.clone(),
                })
                .collect(),
            timeout_ms: self.timeout_ms,
            follow_redirects: self.follow_redirects,
        }
    }
}

fn normalize_graphql_body(raw_body: &str) -> String {
    if let Ok(Value::Object(obj)) = serde_json::from_str::<Value>(raw_body) {
        if obj.contains_key("query") || obj.contains_key("variables") {
            let query = obj
                .get("query")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let mut payload = Map::new();
            payload.insert("query".to_string(), Value::String(query));

            if let Some(vars_val) = obj.get("variables") {
                let normalized_vars = match vars_val {
                    Value::String(s) if !s.trim().is_empty() => {
                        serde_json::from_str::<Value>(s).unwrap_or_else(|_| Value::String(s.clone()))
                    }
                    Value::String(_) | Value::Null => Value::Null,
                    other => other.clone(),
                };
                if !normalized_vars.is_null() {
                    payload.insert("variables".to_string(), normalized_vars);
                }
            }

            if let Some(op) = obj.get("operationName") {
                let include = match op {
                    Value::String(s) => !s.is_empty(),
                    Value::Null => false,
                    _ => true,
                };
                if include {
                    payload.insert("operationName".to_string(), op.clone());
                }
            }

            return serde_json::to_string_pretty(&Value::Object(payload))
                .unwrap_or_else(|_| raw_body.to_string());
        }
    }

    let mut payload = Map::new();
    payload.insert("query".to_string(), Value::String(raw_body.to_string()));
    serde_json::to_string_pretty(&Value::Object(payload)).unwrap_or_else(|_| raw_body.to_string())
}

pub fn prepare_http_request(
    request: &SavedRequest,
    workspace: &WorkspaceSummary,
    variable_map: &HashMap<String, String>,
    custom_method: Option<&str>,
) -> Result<PreparedHttpRequest, PrepareRequestError> {
    let body_input = if request.body.is_empty() {
        None
    } else {
        Some(request.body.as_str())
    };
    let resolved =
        resolve_request_fields(variable_map, &request.url, &request.headers, body_input)?;

    let mut final_url = resolved.url;
    if let Some(path_vars) = request.path_variables.as_ref() {
        if !path_vars.is_empty() {
            let resolved_path_vars: Vec<PathVariableEntry> = path_vars
                .iter()
                .map(|p| PathVariableEntry {
                    key: p.key.clone(),
                    value: if p.enabled {
                        resolve_string_safe(&p.value, variable_map)
                    } else {
                        p.value.clone()
                    },
                    enabled: p.enabled,
                    description: p.description.clone(),
                })
                .collect();
            final_url = resolve_path_variables_in_url(&final_url, Some(&resolved_path_vars));
        }
    }

    let has_manual_auth_header = resolved
        .headers
        .iter()
        .any(|h| h.key.eq_ignore_ascii_case("authorization") && h.enabled);

    let (final_auth_mode, final_auth_config, auth_entity_id, auth_entity_type) =
        if request.auth_mode == "none" && !has_manual_auth_header {
            let inherited = get_effective_auth(request, Some(workspace));
            if inherited.mode != "none" {
                (
                    inherited.mode,
                    inherited.config,
                    inherited.entity_id,
                    inherited.entity_type,
                )
            } else {
                (
                    request.auth_mode.clone(),
                    parse_auth_config(Some(&request.auth_config)),
                    Some(request.id.clone()),
                    Some("request".to_string()),
                )
            }
        } else {
            (
                request.auth_mode.clone(),
                parse_auth_config(Some(&request.auth_config)),
                Some(request.id.clone()),
                Some("request".to_string()),
            )
        };

    let resolved_auth = resolve_auth_config(&final_auth_config, variable_map);
    let applied = apply_auth(&final_auth_mode, &resolved_auth, &final_url, &resolved.headers);
    let history_url = redact_auth_from_url(&applied.url, &final_auth_mode, &resolved_auth);

    let effective_method = if request.method == "CUSTOM" {
        custom_method
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_ascii_uppercase)
            .unwrap_or_else(|| "CUSTOM".to_string())
    } else {
        request.method.clone()
    };

    let mut final_body = resolved.body;
    let mut final_mime_type = if request.body_mime_type.is_empty() {
        None
    } else {
        Some(request.body_mime_type.clone())
    };
    let mut final_headers = applied.headers;

    if request.body_mime_type == "application/graphql" {
        final_mime_type = Some("application/json".to_string());
        if !final_headers
            .iter()
            .any(|h| h.key.eq_ignore_ascii_case("content-type") && h.enabled)
        {
            final_headers.push(HeaderEntry {
                key: "Content-Type".to_string(),
                value: "application/json".to_string(),
                enabled: true,
            });
        }
        if let Some(body_str) = final_body.as_deref() {
            final_body = Some(normalize_graphql_body(body_str));
        }
    }

    let body_form: Vec<http_client::HeaderEntry> =
        serde_json::from_str::<Vec<http_client::HeaderEntry>>(&request.body_form)
            .unwrap_or_default()
            .into_iter()
            .map(|mut item| {
                if item.enabled {
                    item.key = resolve_string_safe(&item.key, variable_map);
                    item.value = resolve_string_safe(&item.value, variable_map);
                }
                item
            })
            .collect();

    Ok(PreparedHttpRequest {
        method: effective_method,
        url: applied.url,
        headers: final_headers,
        body: final_body,
        body_mime_type: final_mime_type,
        body_form,
        timeout_ms: request.timeout_ms.max(0) as u64,
        follow_redirects: request.follow_redirects,
        history_url,
        effective_auth_mode: final_auth_mode,
        effective_auth_config: resolved_auth,
        auth_entity_id,
        auth_entity_type,
    })
}
