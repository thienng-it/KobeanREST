use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::persistence::{
    CollectionRow, EnvironmentRow, ExportData, FolderRow, HeaderEntry, HeaderEntrySimple,
    PathVariableEntry, RequestHeaderRow, RequestRow, ResponseExample, ScopedVariable,
    VariableRow, WorkspaceRow,
};

use super::auth::AuthConfig;
use super::path_variables::sync_path_variables_with_url;
use super::variables::encode_uri_component;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ImportFormatType {
    KobeanrestNative,
    PostmanCollection,
    PostmanEnvironment,
    HapiRoutes,
    OpenApi,
    Insomnia,
    Hoppscotch,
    Har,
    Curl,
    Unknown,
}

impl ImportFormatType {
    pub fn as_str(self) -> &'static str {
        match self {
            ImportFormatType::KobeanrestNative => "kobeanrest-native",
            ImportFormatType::PostmanCollection => "postman-collection",
            ImportFormatType::PostmanEnvironment => "postman-environment",
            ImportFormatType::HapiRoutes => "hapi-routes",
            ImportFormatType::OpenApi => "openapi",
            ImportFormatType::Insomnia => "insomnia",
            ImportFormatType::Hoppscotch => "hoppscotch",
            ImportFormatType::Har => "har",
            ImportFormatType::Curl => "curl",
            ImportFormatType::Unknown => "unknown",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CurlImportResult {
    pub method: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub custom_method: Option<String>,
    pub url: String,
    pub headers: Vec<HeaderEntry>,
    pub body: String,
    pub body_mime_type: String,
    pub body_form: Vec<HeaderEntry>,
    pub auth_mode: String,
    pub auth_config: AuthConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostmanImportedFolder {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    pub variables: Vec<ScopedVariable>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auth_mode: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auth_config: Option<AuthConfig>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pre_script: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub post_script: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostmanImportedRequest {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub folder_id: Option<String>,
    pub method: String,
    pub url: String,
    pub headers: Vec<HeaderEntry>,
    pub query_params: Vec<HeaderEntry>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path_variables: Option<Vec<PathVariableEntry>>,
    pub body: String,
    pub body_mime_type: String,
    pub body_form: Vec<HeaderEntry>,
    pub auth_mode: String,
    pub auth_config: AuthConfig,
    pub variables: Vec<ScopedVariable>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pre_script: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub post_script: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub examples: Option<Vec<ResponseExample>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostmanCollectionImportResult {
    pub collection_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub collection_description: Option<String>,
    pub collection_variables: Vec<ScopedVariable>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub collection_pre_script: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub collection_post_script: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub collection_auth_mode: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub collection_auth_config: Option<AuthConfig>,
    pub folders: Vec<PostmanImportedFolder>,
    pub requests: Vec<PostmanImportedRequest>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostmanEnvironmentVariable {
    pub key: String,
    pub value: String,
    pub secret: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostmanEnvironmentImportResult {
    pub name: String,
    pub variables: Vec<PostmanEnvironmentVariable>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportStats {
    pub collections_count: usize,
    pub folders_count: usize,
    pub requests_count: usize,
    pub environments_count: usize,
    pub variables_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NormalizedImportResult {
    pub format: ImportFormatType,
    pub format_label: String,
    pub title: String,
    pub export_data: ExportData,
    pub stats: ImportStats,
}

fn generate_id(prefix: &str) -> String {
    format!("{prefix}-{}", Uuid::new_v4())
}

fn starts_with_curl_flag(trimmed: &str) -> bool {
    let lower = trimmed.to_ascii_lowercase();
    for prefix in ["curl", "-x", "--request"] {
        if let Some(rest) = lower.strip_prefix(prefix) {
            if rest.starts_with(char::is_whitespace) {
                return true;
            }
        }
    }
    false
}

fn has_non_json_hapi_pattern(trimmed: &str) -> bool {
    let lower = trimmed.to_ascii_lowercase();
    if lower.contains("server.route(") {
        return true;
    }
    if let Some(idx) = lower.find("module.exports") {
        if lower[idx + "module.exports".len()..]
            .trim_start()
            .starts_with('=')
        {
            return true;
        }
    }
    if lower.contains("export const ") && lower.contains("routes") {
        return true;
    }
    if let Some(idx) = lower.find("method:") {
        let after = lower[idx + "method:".len()..].trim_start();
        if (after.starts_with('\'') || after.starts_with('"'))
            && after[1..].chars().next().is_some_and(|c| c.is_ascii_alphanumeric() || c == '_')
        {
            return true;
        }
    }
    false
}

fn has_yaml_line_prefix(trimmed: &str, key: &str, expected_digit: char) -> bool {
    trimmed.lines().any(|line| {
        if let Some(rest) = line.strip_prefix(key) {
            let after = rest.trim_start().trim_start_matches(['\'', '"']);
            after.starts_with(expected_digit)
        } else {
            false
        }
    })
}

fn is_truthy_json(val: Option<&Value>) -> bool {
    match val {
        None | Some(Value::Null) => false,
        Some(Value::Bool(b)) => *b,
        Some(Value::Number(n)) => n.as_f64().is_some_and(|f| f != 0.0),
        Some(Value::String(s)) => !s.is_empty(),
        Some(Value::Array(_)) | Some(Value::Object(_)) => true,
    }
}

pub fn detect_import_format(content: &str) -> ImportFormatType {
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return ImportFormatType::Unknown;
    }

    if starts_with_curl_flag(trimmed) {
        return ImportFormatType::Curl;
    }

    let Ok(parsed) = serde_json::from_str::<Value>(trimmed) else {
        if has_non_json_hapi_pattern(trimmed) {
            return ImportFormatType::HapiRoutes;
        }
        if has_yaml_line_prefix(trimmed, "openapi:", '3')
            || has_yaml_line_prefix(trimmed, "swagger:", '2')
        {
            return ImportFormatType::OpenApi;
        }
        if trimmed.contains("_type:") && trimmed.contains("export") {
            return ImportFormatType::Insomnia;
        }
        return ImportFormatType::Unknown;
    };

    if !parsed.is_object() && !parsed.is_array() {
        return ImportFormatType::Unknown;
    }

    // KobeanREST Native
    if parsed.get("version").and_then(|v| v.as_u64()) == Some(1)
        && parsed.get("workspaces").is_some_and(Value::is_array)
        && parsed.get("collections").is_some_and(Value::is_array)
    {
        return ImportFormatType::KobeanrestNative;
    }

    // Postman Collection
    if let Some(info) = parsed.get("info").and_then(Value::as_object) {
        if (is_truthy_json(info.get("schema"))
            || is_truthy_json(info.get("_postman_id"))
            || is_truthy_json(info.get("name")))
            && parsed.get("item").is_some_and(Value::is_array)
        {
            return ImportFormatType::PostmanCollection;
        }
    }

    // Postman Environment
    if parsed.get("_postman_variable_scope").and_then(Value::as_str) == Some("environment")
        || (is_truthy_json(parsed.get("name"))
            && parsed
                .get("values")
                .and_then(Value::as_array)
                .is_some_and(|vals| vals.iter().any(|v| v.is_object() && v.get("key").is_some())))
    {
        return ImportFormatType::PostmanEnvironment;
    }

    // OpenAPI / Swagger JSON
    if is_truthy_json(parsed.get("openapi"))
        || is_truthy_json(parsed.get("swagger"))
        || (is_truthy_json(parsed.get("paths")) && is_truthy_json(parsed.get("info")))
    {
        return ImportFormatType::OpenApi;
    }

    // Insomnia
    if parsed.get("_type").and_then(Value::as_str) == Some("export")
        && parsed.get("resources").is_some_and(Value::is_array)
    {
        return ImportFormatType::Insomnia;
    }

    // Hoppscotch
    if let Some(arr) = parsed.as_array() {
        if let Some(first) = arr.first() {
            if is_truthy_json(first.get("v"))
                && (is_truthy_json(first.get("name")) || is_truthy_json(first.get("folders")))
            {
                return ImportFormatType::Hoppscotch;
            }
        }
    }
    if is_truthy_json(parsed.get("v"))
        && (is_truthy_json(parsed.get("name"))
            || is_truthy_json(parsed.get("folders"))
            || is_truthy_json(parsed.get("requests")))
    {
        return ImportFormatType::Hoppscotch;
    }

    // HAR Archive
    if parsed
        .get("log")
        .and_then(|l| l.get("entries"))
        .is_some_and(Value::is_array)
    {
        return ImportFormatType::Har;
    }

    // Hapi.js Route array
    if let Some(arr) = parsed.as_array() {
        if !arr.is_empty()
            && arr.iter().any(|item| {
                item.is_object()
                    && (is_truthy_json(item.get("method")) || is_truthy_json(item.get("path")))
            })
        {
            return ImportFormatType::HapiRoutes;
        }
    }

    ImportFormatType::Unknown
}

pub fn is_graphql_payload(
    body: Option<&str>,
    ct_header_value: Option<&str>,
    url: Option<&str>,
) -> bool {
    if let Some(ct) = ct_header_value {
        if ct.to_ascii_lowercase().contains("graphql") {
            return true;
        }
    }

    let Some(body_str) = body else {
        return false;
    };
    let trimmed = body_str.trim();
    if trimmed.is_empty() {
        return false;
    }

    if trimmed.starts_with('{') && trimmed.ends_with('}') {
        if let Ok(Value::Object(obj)) = serde_json::from_str::<Value>(trimmed) {
            if obj
                .get("query")
                .and_then(Value::as_str)
                .is_some_and(|q| !q.trim().is_empty())
            {
                return true;
            }
        }
    }

    let lower = trimmed.to_ascii_lowercase();
    let is_graphql_keyword = ["query", "mutation", "subscription", "fragment"]
        .iter()
        .any(|kw| {
            lower.strip_prefix(kw).is_some_and(|rest| {
                rest.chars()
                    .next()
                    .is_none_or(|c| !c.is_ascii_alphanumeric() && c != '_')
            })
        });

    let is_graphql_selection = trimmed.strip_prefix('{').is_some_and(|rest| {
        rest.trim_start()
            .chars()
            .next()
            .is_some_and(|c| c.is_ascii_alphabetic() || c == '_')
    });

    let is_graphql_endpoint = url.is_some_and(|u| {
        let u_lower = u.to_ascii_lowercase();
        if let Some(idx) = u_lower.find("graphql") {
            let after = &u_lower[idx + "graphql".len()..];
            after.is_empty() || after.starts_with('/') || after.starts_with('?')
        } else {
            false
        }
    });

    is_graphql_keyword
        || (is_graphql_selection
            && (is_graphql_endpoint || trimmed.contains('(') || trimmed.contains('}')))
}

fn normalize_curl_lines(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    let chars: Vec<char> = raw.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '\\' {
            let mut j = i + 1;
            while j < chars.len() && (chars[j] == ' ' || chars[j] == '\t') {
                j += 1;
            }
            if j < chars.len() && chars[j] == '\r' && j + 1 < chars.len() && chars[j + 1] == '\n' {
                out.push(' ');
                i = j + 2;
                continue;
            }
            if j < chars.len() && chars[j] == '\n' {
                out.push(' ');
                i = j + 1;
                continue;
            }
        }
        if chars[i] == '\r' && i + 1 < chars.len() && chars[i + 1] == '\n' {
            out.push(' ');
            i += 2;
            continue;
        }
        if chars[i] == '\n' {
            out.push(' ');
            i += 1;
            continue;
        }
        out.push(chars[i]);
        i += 1;
    }
    out.trim().to_string()
}

fn tokenize_curl(input: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let chars: Vec<char> = input.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        while i < chars.len() && chars[i].is_whitespace() {
            i += 1;
        }
        if i >= chars.len() {
            break;
        }

        let mut token = String::new();
        while i < chars.len() && !chars[i].is_whitespace() {
            let ch = chars[i];
            if ch == '\'' {
                i += 1;
                while i < chars.len() && chars[i] != '\'' {
                    token.push(chars[i]);
                    i += 1;
                }
                if i < chars.len() {
                    i += 1;
                }
            } else if ch == '$' && i + 1 < chars.len() && chars[i + 1] == '\'' {
                i += 2;
                while i < chars.len() && chars[i] != '\'' {
                    if chars[i] == '\\' && i + 1 < chars.len() {
                        let esc = chars[i + 1];
                        i += 2;
                        match esc {
                            'n' => token.push('\n'),
                            't' => token.push('\t'),
                            'r' => token.push('\r'),
                            '\\' => token.push('\\'),
                            '\'' => token.push('\''),
                            '"' => token.push('"'),
                            other => {
                                token.push('\\');
                                token.push(other);
                            }
                        }
                    } else {
                        token.push(chars[i]);
                        i += 1;
                    }
                }
                if i < chars.len() {
                    i += 1;
                }
            } else if ch == '"' {
                i += 1;
                while i < chars.len() && chars[i] != '"' {
                    if chars[i] == '\\' && i + 1 < chars.len() {
                        let next = chars[i + 1];
                        if matches!(next, '"' | '\\' | '$' | '`') {
                            token.push(next);
                            i += 2;
                        } else {
                            token.push(chars[i]);
                            i += 1;
                        }
                    } else {
                        token.push(chars[i]);
                        i += 1;
                    }
                }
                if i < chars.len() {
                    i += 1;
                }
            } else if ch == '\\' && i + 1 < chars.len() {
                token.push(chars[i + 1]);
                i += 2;
            } else {
                token.push(ch);
                i += 1;
            }
        }

        if !token.is_empty() {
            tokens.push(token);
        }
    }

    tokens
}

pub fn parse_curl_command(raw: &str) -> CurlImportResult {
    let cleaned = normalize_curl_lines(raw);
    let mut tokens = tokenize_curl(&cleaned);

    if tokens
        .first()
        .is_some_and(|t| t.eq_ignore_ascii_case("curl"))
    {
        tokens.remove(0);
    }

    let mut method: Option<String> = None;
    let mut url = String::new();
    let mut headers: Vec<HeaderEntry> = Vec::new();
    let mut body = String::new();
    let mut auth_mode = "none".to_string();
    let mut auth_config = AuthConfig::default();
    let mut data_flag_used: Option<String> = None;

    const VALUE_FLAGS: &[&str] = &[
        "-o",
        "--output",
        "-O",
        "-e",
        "--referer",
        "-A",
        "--user-agent",
        "-b",
        "--cookie",
        "-c",
        "--cookie-jar",
        "--connect-timeout",
        "-m",
        "--max-time",
        "--retry",
        "--retry-delay",
        "-w",
        "--write-out",
        "-T",
        "--upload-file",
        "--proxy",
        "-x",
        "--cert",
        "--key",
        "--cacert",
        "--resolve",
        "--interface",
        "--max-redirs",
        "-r",
        "--range",
        "--limit-rate",
    ];

    let mut i = 0;
    while i < tokens.len() {
        let token = tokens[i].as_str();
        if token.is_empty() || token == "\\" {
            i += 1;
            continue;
        }

        if token == "-X" || token == "--request" {
            i += 1;
            if let Some(m) = tokens.get(i) {
                method = Some(m.to_ascii_uppercase());
            }
        } else if token == "-H" || token == "--header" {
            i += 1;
            let header_str = tokens.get(i).map(String::as_str).unwrap_or("");
            if let Some(colon_idx) = header_str.find(':') {
                if colon_idx > 0 {
                    headers.push(HeaderEntry {
                        key: header_str[..colon_idx].trim().to_string(),
                        value: header_str[colon_idx + 1..].trim().to_string(),
                        enabled: true,
                    });
                }
            }
        } else if matches!(
            token,
            "-d" | "--data"
                | "--data-raw"
                | "--data-binary"
                | "--data-ascii"
                | "--data-urlencode"
                | "--json"
        ) {
            let flag = token.to_string();
            if data_flag_used.is_none() {
                data_flag_used = Some(flag.clone());
            }
            i += 1;
            let raw_chunk = tokens.get(i).map(String::as_str).unwrap_or("");
            let chunk = if flag == "--data-urlencode" {
                match raw_chunk.find('=') {
                    Some(eq_idx) if eq_idx > 0 => format!(
                        "{}{}",
                        &raw_chunk[..eq_idx + 1],
                        encode_uri_component(&raw_chunk[eq_idx + 1..])
                    ),
                    Some(0) => encode_uri_component(&raw_chunk[1..]),
                    _ => encode_uri_component(raw_chunk),
                }
            } else {
                raw_chunk.to_string()
            };

            if body.is_empty() {
                body = chunk;
            } else {
                body.push('&');
                body.push_str(&chunk);
            }

            if flag == "--json" {
                if !headers
                    .iter()
                    .any(|h| h.key.eq_ignore_ascii_case("content-type"))
                {
                    headers.push(HeaderEntry {
                        key: "Content-Type".to_string(),
                        value: "application/json".to_string(),
                        enabled: true,
                    });
                }
                if !headers.iter().any(|h| h.key.eq_ignore_ascii_case("accept")) {
                    headers.push(HeaderEntry {
                        key: "Accept".to_string(),
                        value: "application/json".to_string(),
                        enabled: true,
                    });
                }
            }
        } else if token == "-u" || token == "--user" {
            i += 1;
            let cred = tokens.get(i).map(String::as_str).unwrap_or("");
            auth_mode = "basic".to_string();
            if let Some(sep_idx) = cred.find(':') {
                if sep_idx > 0 {
                    auth_config = AuthConfig {
                        username: Some(cred[..sep_idx].to_string()),
                        password: Some(cred[sep_idx + 1..].to_string()),
                        ..Default::default()
                    };
                } else {
                    auth_config = AuthConfig {
                        username: Some(cred.to_string()),
                        password: Some(String::new()),
                        ..Default::default()
                    };
                }
            } else {
                auth_config = AuthConfig {
                    username: Some(cred.to_string()),
                    password: Some(String::new()),
                    ..Default::default()
                };
            }
        } else if token == "--url" {
            i += 1;
            url = tokens.get(i).cloned().unwrap_or_default();
        } else if token.starts_with('-') {
            if VALUE_FLAGS.contains(&token) {
                i += 1;
            }
        } else if url.is_empty() {
            url = token.to_string();
        }

        i += 1;
    }

    let resolved_method = method.unwrap_or_else(|| {
        if body.is_empty() {
            "GET".to_string()
        } else {
            "POST".to_string()
        }
    });

    if auth_mode == "none" {
        if let Some(idx) = headers
            .iter()
            .position(|h| h.key.eq_ignore_ascii_case("authorization"))
        {
            let val = headers[idx].value.clone();
            if val.len() >= 7 && val[..6].eq_ignore_ascii_case("bearer") && val.as_bytes()[6].is_ascii_whitespace() {
                let token = val[6..].trim_start().to_string();
                auth_mode = "bearer".to_string();
                auth_config = AuthConfig {
                    token: Some(token),
                    ..Default::default()
                };
                headers.remove(idx);
            }
        }
    }

    const KNOWN_METHODS: &[&str] = &["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
    let (final_method, custom_method) = if KNOWN_METHODS.contains(&resolved_method.as_str()) {
        (resolved_method, None)
    } else {
        ("CUSTOM".to_string(), Some(resolved_method))
    };

    let ct_value = headers
        .iter()
        .find(|h| h.key.eq_ignore_ascii_case("content-type"))
        .map(|h| h.value.clone());

    let mut body_mime_type = if let Some(ref ct) = ct_value {
        ct.clone()
    } else if data_flag_used.as_deref() == Some("--json") {
        "application/json".to_string()
    } else if matches!(
        data_flag_used.as_deref(),
        Some("--data-urlencode" | "-d" | "--data" | "--data-ascii")
    ) {
        "application/x-www-form-urlencoded".to_string()
    } else if matches!(
        data_flag_used.as_deref(),
        Some("--data-binary" | "--data-raw")
    ) {
        "application/octet-stream".to_string()
    } else {
        "text/plain".to_string()
    };

    if is_graphql_payload(
        Some(&body),
        ct_value.as_deref(),
        Some(&url),
    ) {
        body_mime_type = "application/graphql".to_string();
    }

    let mut body_form = Vec::new();
    if body_mime_type == "application/x-www-form-urlencoded" && !body.is_empty() {
        for (k, v) in form_urlencoded::parse(body.as_bytes()) {
            body_form.push(HeaderEntry {
                key: k.into_owned(),
                value: v.into_owned(),
                enabled: true,
            });
        }
    }

    CurlImportResult {
        method: final_method,
        custom_method,
        url,
        headers,
        body,
        body_mime_type,
        body_form,
        auth_mode,
        auth_config,
    }
}

fn extract_description(val: Option<&Value>) -> Option<String> {
    match val {
        Some(Value::String(s)) => Some(s.clone()),
        Some(Value::Object(obj)) => obj
            .get("content")
            .and_then(Value::as_str)
            .map(ToString::to_string),
        _ => None,
    }
}

fn convert_postman_script(script_content: &str, context: &str) -> String {
    if script_content.trim().is_empty() {
        return String::new();
    }
    if script_content
        .trim_start()
        .starts_with("// Imported from Postman")
    {
        return script_content.to_string();
    }
    let label = if context == "pre" {
        "pre-request"
    } else {
        "test"
    };
    format!(
        "// Imported from Postman {label} script\n// KobeanREST natively supports the Postman pm.* API at runtime.\n// pm.request, pm.response, pm.environment, pm.collectionVariables, pm.variables\n// pm.test, pm.expect, pm.sendRequest are all available.\n{script_content}"
    )
}

fn extract_postman_events(events: Option<&Vec<Value>>) -> (Option<String>, Option<String>) {
    let Some(events) = events else {
        return (None, None);
    };
    let mut pre = String::new();
    let mut post = String::new();

    for event in events {
        if event.get("disabled").and_then(Value::as_bool) == Some(true) {
            continue;
        }
        let listen = event.get("listen").and_then(Value::as_str).unwrap_or("");
        let exec = event.get("script").and_then(|s| s.get("exec"));
        let script_content = match exec {
            Some(Value::String(s)) => s.clone(),
            Some(Value::Array(arr)) => arr
                .iter()
                .filter_map(Value::as_str)
                .collect::<Vec<_>>()
                .join("\n"),
            _ => String::new(),
        };
        if script_content.trim().is_empty() {
            continue;
        }

        if listen == "prerequest" {
            let converted = convert_postman_script(&script_content, "pre");
            if !converted.trim().is_empty() {
                if !pre.is_empty() {
                    pre.push_str("\n\n");
                }
                pre.push_str(&converted);
            }
        } else if listen == "test" {
            let converted = convert_postman_script(&script_content, "post");
            if !converted.trim().is_empty() {
                if !post.is_empty() {
                    post.push_str("\n\n");
                }
                post.push_str(&converted);
            }
        }
    }

    (
        if pre.trim().is_empty() {
            None
        } else {
            Some(pre.trim().to_string())
        },
        if post.trim().is_empty() {
            None
        } else {
            Some(post.trim().to_string())
        },
    )
}

fn find_kv_value(arr: Option<&Vec<Value>>, key: &str) -> String {
    arr.and_then(|items| {
        items
            .iter()
            .find(|item| item.get("key").and_then(Value::as_str) == Some(key))
            .and_then(|item| item.get("value").and_then(Value::as_str))
    })
    .unwrap_or("")
    .to_string()
}

fn convert_postman_auth(auth: Option<&Value>, fallback_mode: &str) -> (String, AuthConfig) {
    let Some(auth) = auth else {
        return (fallback_mode.to_string(), AuthConfig::default());
    };
    let auth_type = auth.get("type").and_then(Value::as_str).unwrap_or("");
    if auth_type == "noauth" {
        return ("none".to_string(), AuthConfig::default());
    }

    match auth_type {
        "basic" => {
            let arr = auth.get("basic").and_then(Value::as_array);
            (
                "basic".to_string(),
                AuthConfig {
                    username: Some(find_kv_value(arr, "username")),
                    password: Some(find_kv_value(arr, "password")),
                    ..Default::default()
                },
            )
        }
        "bearer" => {
            let arr = auth.get("bearer").and_then(Value::as_array);
            (
                "bearer".to_string(),
                AuthConfig {
                    token: Some(find_kv_value(arr, "token")),
                    ..Default::default()
                },
            )
        }
        "apikey" => {
            let arr = auth.get("apikey").and_then(Value::as_array);
            (
                "apiKey".to_string(),
                AuthConfig {
                    key_name: Some(find_kv_value(arr, "key")),
                    key_value: Some(find_kv_value(arr, "value")),
                    placement: Some("header".to_string()),
                    ..Default::default()
                },
            )
        }
        "oauth2" => {
            let arr = auth.get("oauth2").and_then(Value::as_array);
            let raw_grant = find_kv_value(arr, "grant_type");
            let grant_type = match raw_grant.as_str() {
                "password_credentials" | "password" => "password_credentials",
                "authorization_code" => "authorization_code",
                _ => "client_credentials",
            };
            (
                "oauth2".to_string(),
                AuthConfig {
                    grant_type: Some(grant_type.to_string()),
                    access_token_url: Some(find_kv_value(arr, "accessTokenUrl")),
                    auth_url: Some(find_kv_value(arr, "authUrl")),
                    client_id: Some(find_kv_value(arr, "clientId")),
                    client_secret: Some(find_kv_value(arr, "clientSecret")),
                    scope: Some(find_kv_value(arr, "scope")),
                    audience: Some(find_kv_value(arr, "audience")),
                    username: Some(find_kv_value(arr, "username")),
                    password: Some(find_kv_value(arr, "password")),
                    ..Default::default()
                },
            )
        }
        _ => ("none".to_string(), AuthConfig::default()),
    }
}

fn convert_postman_variables(vars: Option<&Vec<Value>>) -> Vec<ScopedVariable> {
    let Some(vars) = vars else {
        return Vec::new();
    };
    vars.iter()
        .filter(|v| v.get("disabled").and_then(Value::as_bool) != Some(true))
        .filter_map(|v| {
            let key = v.get("key").and_then(Value::as_str)?.to_string();
            let value = v
                .get("value")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            Some(ScopedVariable {
                key,
                value,
                secret: false,
                secret_ref: None,
            })
        })
        .collect()
}

fn build_url_from_postman_object(url_obj: &Value) -> String {
    if let Some(raw) = url_obj.get("raw").and_then(Value::as_str) {
        if !raw.is_empty() {
            return raw.to_string();
        }
    }

    let mut result = String::new();
    if let Some(protocol) = url_obj.get("protocol").and_then(Value::as_str) {
        result.push_str(protocol);
        result.push_str("://");
    }
    if let Some(host_arr) = url_obj.get("host").and_then(Value::as_array) {
        let host = host_arr
            .iter()
            .filter_map(Value::as_str)
            .collect::<Vec<_>>()
            .join(".");
        result.push_str(&host);
    } else if let Some(host_str) = url_obj.get("host").and_then(Value::as_str) {
        result.push_str(host_str);
    }
    if let Some(port) = url_obj.get("port").and_then(Value::as_str) {
        result.push(':');
        result.push_str(port);
    }
    if let Some(path_arr) = url_obj.get("path").and_then(Value::as_array) {
        let path = path_arr
            .iter()
            .filter_map(Value::as_str)
            .collect::<Vec<_>>()
            .join("/");
        result.push('/');
        result.push_str(&path);
    } else if let Some(path_str) = url_obj.get("path").and_then(Value::as_str) {
        if !path_str.is_empty() {
            result.push('/');
            result.push_str(path_str);
        }
    }

    if let Some(query_arr) = url_obj.get("query").and_then(Value::as_array) {
        let parts: Vec<String> = query_arr
            .iter()
            .filter(|q| q.get("disabled").and_then(Value::as_bool) != Some(true))
            .map(|q| {
                let k = q.get("key").and_then(Value::as_str).unwrap_or("");
                let v = q.get("value").and_then(Value::as_str).unwrap_or("");
                format!("{}={}", encode_uri_component(k), encode_uri_component(v))
            })
            .collect();
        if !parts.is_empty() {
            result.push('?');
            result.push_str(&parts.join("&"));
        }
    }

    result
}

fn parse_postman_examples(responses: Option<&Vec<Value>>) -> Option<Vec<ResponseExample>> {
    let responses = responses.filter(|r| !r.is_empty())?;
    let examples = responses
        .iter()
        .enumerate()
        .map(|(idx, res)| {
            let mut res_headers = Vec::new();
            if let Some(hdrs) = res.get("header").and_then(Value::as_array) {
                for h in hdrs {
                    let (key, value) = if let Some(s) = h.as_str() {
                        match s.split_once(':') {
                            Some((k, v)) => (k.trim().to_string(), v.trim().to_string()),
                            None => (s.trim().to_string(), String::new()),
                        }
                    } else {
                        (
                            h.get("key")
                                .and_then(Value::as_str)
                                .unwrap_or("")
                                .to_string(),
                            h.get("value")
                                .and_then(Value::as_str)
                                .unwrap_or("")
                                .to_string(),
                        )
                    };
                    if !key.is_empty() {
                        res_headers.push(HeaderEntrySimple { key, value });
                    }
                }
            }

            let raw_body = res
                .get("body")
                .and_then(Value::as_str)
                .or_else(|| res.get("_postman_exported_body").and_then(Value::as_str))
                .unwrap_or("")
                .to_string();

            let preview_lang = res
                .get("_postman_previewlanguage")
                .and_then(Value::as_str)
                .unwrap_or("");
            let trimmed_body = raw_body.trim();
            let is_json = preview_lang == "json"
                || trimmed_body.starts_with('{')
                || trimmed_body.starts_with('[');
            let mime = if is_json {
                "application/json".to_string()
            } else if preview_lang == "xml" || trimmed_body.starts_with('<') {
                "application/xml".to_string()
            } else if !preview_lang.is_empty() {
                preview_lang.to_string()
            } else {
                "text/plain".to_string()
            };

            let code = res.get("code").and_then(Value::as_i64).unwrap_or(200);
            let status = res
                .get("status")
                .and_then(Value::as_str)
                .unwrap_or("OK")
                .to_string();

            ResponseExample {
                id: res
                    .get("id")
                    .and_then(Value::as_str)
                    .map(ToString::to_string)
                    .unwrap_or_else(|| format!("example-{}-{idx}", generate_id("ex"))),
                name: res
                    .get("name")
                    .and_then(Value::as_str)
                    .map(ToString::to_string)
                    .unwrap_or_else(|| format!("{code} {status}")),
                code,
                status,
                headers: Some(res_headers),
                body: raw_body,
                body_mime_type: Some(mime),
            }
        })
        .collect();
    Some(examples)
}

fn process_postman_items(
    items: &[Value],
    parent_folder_id: Option<&str>,
    folders: &mut Vec<PostmanImportedFolder>,
    requests: &mut Vec<PostmanImportedRequest>,
) {
    for item in items {
        let Some(item_obj) = item.as_object() else {
            continue;
        };

        let item_auth = if let Some(req_auth) = item_obj
            .get("request")
            .and_then(Value::as_object)
            .and_then(|r| r.get("auth"))
        {
            convert_postman_auth(Some(req_auth), "none")
        } else if let Some(a) = item_obj.get("auth") {
            convert_postman_auth(Some(a), "none")
        } else {
            ("none".to_string(), AuthConfig::default())
        };

        let is_request = item_obj.contains_key("request") || !item_obj.contains_key("item");

        if is_request {
            let Some(req_val) = item_obj.get("request") else {
                continue;
            };
            let req_id = generate_id("req");
            let mut method = "GET".to_string();
            let mut url = String::new();
            let mut headers = Vec::new();
            let mut body = String::new();
            let mut body_mime_type = "text/plain".to_string();
            let mut body_form = Vec::new();
            let mut query_params = Vec::new();
            let mut path_vars: Option<Vec<PathVariableEntry>> = None;

            if let Some(url_str) = req_val.as_str() {
                url = url_str.to_string();
            } else if let Some(req_obj) = req_val.as_object() {
                if let Some(m) = req_obj.get("method").and_then(Value::as_str) {
                    method = m.to_ascii_uppercase();
                }

                if let Some(u) = req_obj.get("url") {
                    if let Some(u_str) = u.as_str() {
                        url = u_str.to_string();
                    } else if u.is_object() {
                        url = build_url_from_postman_object(u);
                        if let Some(q_arr) = u.get("query").and_then(Value::as_array) {
                            for q in q_arr {
                                query_params.push(HeaderEntry {
                                    key: q
                                        .get("key")
                                        .and_then(Value::as_str)
                                        .unwrap_or("")
                                        .to_string(),
                                    value: q
                                        .get("value")
                                        .and_then(Value::as_str)
                                        .unwrap_or("")
                                        .to_string(),
                                    enabled: q.get("disabled").and_then(Value::as_bool) != Some(true),
                                });
                            }
                        }
                        if let Some(v_arr) = u.get("variable").and_then(Value::as_array) {
                            let parsed_vars: Vec<PathVariableEntry> = v_arr
                                .iter()
                                .filter(|v| {
                                    v.get("key").and_then(Value::as_str).is_some()
                                        || v.get("value").and_then(Value::as_str).is_some()
                                })
                                .map(|v| PathVariableEntry {
                                    key: v
                                        .get("key")
                                        .and_then(Value::as_str)
                                        .unwrap_or("")
                                        .trim_start_matches(':')
                                        .to_string(),
                                    value: v
                                        .get("value")
                                        .and_then(Value::as_str)
                                        .unwrap_or("")
                                        .to_string(),
                                    enabled: v.get("disabled").and_then(Value::as_bool) != Some(true),
                                    description: v
                                        .get("description")
                                        .and_then(Value::as_str)
                                        .map(ToString::to_string),
                                })
                                .collect();
                            if !parsed_vars.is_empty() {
                                path_vars = Some(parsed_vars);
                            }
                        }
                    }
                }

                if let Some(hdr_arr) = req_obj.get("header").and_then(Value::as_array) {
                    for h in hdr_arr {
                        let key = h
                            .get("key")
                            .and_then(Value::as_str)
                            .unwrap_or("")
                            .to_string();
                        let value = h
                            .get("value")
                            .and_then(Value::as_str)
                            .unwrap_or("")
                            .to_string();
                        let disabled = h.get("disabled").and_then(Value::as_bool) == Some(true);
                        if !disabled && key.eq_ignore_ascii_case("content-type") {
                            body_mime_type =
                                value.split(';').next().unwrap_or("").trim().to_string();
                        }
                        headers.push(HeaderEntry {
                            key,
                            value,
                            enabled: !disabled,
                        });
                    }
                }

                if let Some(body_obj) = req_obj.get("body").and_then(Value::as_object) {
                    let mode = body_obj.get("mode").and_then(Value::as_str).unwrap_or("");
                    match mode {
                        "raw" => {
                            body = body_obj
                                .get("raw")
                                .and_then(Value::as_str)
                                .unwrap_or("")
                                .to_string();
                            if body_obj
                                .get("options")
                                .and_then(|o| o.get("raw"))
                                .and_then(|r| r.get("language"))
                                .and_then(Value::as_str)
                                == Some("json")
                            {
                                body_mime_type = "application/json".to_string();
                            }
                        }
                        "urlencoded" => {
                            if let Some(arr) = body_obj.get("urlencoded").and_then(Value::as_array)
                            {
                                let mut serializer =
                                    form_urlencoded::Serializer::new(String::new());
                                for f in arr {
                                    let k = f.get("key").and_then(Value::as_str).unwrap_or("");
                                    let v = f.get("value").and_then(Value::as_str).unwrap_or("");
                                    let disabled =
                                        f.get("disabled").and_then(Value::as_bool) == Some(true);
                                    if !disabled {
                                        serializer.append_pair(k, v);
                                    }
                                    body_form.push(HeaderEntry {
                                        key: k.to_string(),
                                        value: v.to_string(),
                                        enabled: !disabled,
                                    });
                                }
                                body = serializer.finish();
                                body_mime_type = "application/x-www-form-urlencoded".to_string();
                            }
                        }
                        "formdata" => {
                            if let Some(arr) = body_obj.get("formdata").and_then(Value::as_array) {
                                let mut form_entries = Vec::new();
                                for f in arr {
                                    let k = f.get("key").and_then(Value::as_str).unwrap_or("");
                                    let mut v = f
                                        .get("value")
                                        .and_then(Value::as_str)
                                        .unwrap_or("")
                                        .to_string();
                                    let src = f.get("src");
                                    if v.is_empty() {
                                        if let Some(s) = src {
                                            if let Some(arr_s) = s.as_array() {
                                                v = arr_s
                                                    .iter()
                                                    .filter_map(Value::as_str)
                                                    .collect::<Vec<_>>()
                                                    .join(", ");
                                            } else if let Some(str_s) = s.as_str() {
                                                v = str_s.to_string();
                                            }
                                        }
                                    }
                                    let disabled =
                                        f.get("disabled").and_then(Value::as_bool) == Some(true);
                                    let f_type = f
                                        .get("type")
                                        .and_then(Value::as_str)
                                        .unwrap_or(if src.is_some() { "file" } else { "text" });
                                    form_entries.push(json!({
                                        "key": k,
                                        "value": v,
                                        "type": f_type,
                                        "src": src,
                                        "disabled": disabled,
                                    }));
                                    body_form.push(HeaderEntry {
                                        key: k.to_string(),
                                        value: v,
                                        enabled: !disabled,
                                    });
                                }
                                body = serde_json::to_string_pretty(&form_entries)
                                    .unwrap_or_default();
                                body_mime_type = "multipart/form-data".to_string();
                            }
                        }
                        "file" => {
                            body_mime_type = "application/octet-stream".to_string();
                            if let Some(src) = body_obj
                                .get("file")
                                .and_then(|f| f.get("src"))
                                .and_then(Value::as_str)
                            {
                                let file_name = src
                                    .rsplit(['/', '\\'])
                                    .next()
                                    .filter(|s| !s.is_empty())
                                    .unwrap_or(src);
                                body = serde_json::to_string_pretty(&json!({
                                    "type": "file",
                                    "fileName": file_name,
                                    "fileSize": 0,
                                    "fileType": "application/octet-stream",
                                    "base64": ""
                                }))
                                .unwrap_or_default();
                            }
                        }
                        "graphql" => {
                            if let Some(gql) = body_obj.get("graphql") {
                                let query = gql.get("query").and_then(Value::as_str).unwrap_or("");
                                let variables =
                                    gql.get("variables").and_then(Value::as_str).unwrap_or("");
                                body = serde_json::to_string_pretty(&json!({
                                    "query": query,
                                    "variables": variables,
                                }))
                                .unwrap_or_default();
                                body_mime_type = "application/graphql".to_string();
                            }
                        }
                        _ => {}
                    }
                }
            }

            if !url.is_empty() {
                let synced = sync_path_variables_with_url(&url, path_vars.as_deref());
                path_vars = if synced.is_empty() {
                    None
                } else {
                    Some(synced)
                };
            }

            let (pre_script, post_script) =
                extract_postman_events(item_obj.get("event").and_then(Value::as_array));
            let variables =
                convert_postman_variables(item_obj.get("variable").and_then(Value::as_array));
            let description =
                extract_description(req_val.as_object().and_then(|r| r.get("description")))
                    .or_else(|| extract_description(item_obj.get("description")));
            let examples =
                parse_postman_examples(item_obj.get("response").and_then(Value::as_array));

            requests.push(PostmanImportedRequest {
                id: req_id,
                name: item_obj
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or("Unnamed Request")
                    .to_string(),
                folder_id: parent_folder_id.map(ToString::to_string),
                method,
                url,
                headers,
                query_params,
                path_variables: path_vars,
                body,
                body_mime_type,
                body_form,
                auth_mode: item_auth.0,
                auth_config: item_auth.1,
                variables,
                pre_script,
                post_script,
                description,
                examples,
            });
        } else {
            let folder_id = generate_id("folder");
            let (pre_script, post_script) =
                extract_postman_events(item_obj.get("event").and_then(Value::as_array));
            let variables =
                convert_postman_variables(item_obj.get("variable").and_then(Value::as_array));
            let description = extract_description(item_obj.get("description"));

            folders.push(PostmanImportedFolder {
                id: folder_id.clone(),
                name: item_obj
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or("Unnamed Folder")
                    .to_string(),
                parent_id: parent_folder_id.map(ToString::to_string),
                variables,
                auth_mode: Some(item_auth.0),
                auth_config: Some(item_auth.1),
                pre_script,
                post_script,
                description,
            });

            if let Some(sub_items) = item_obj.get("item").and_then(Value::as_array) {
                process_postman_items(sub_items, Some(&folder_id), folders, requests);
            }
        }
    }
}

pub fn parse_postman_collection(json: &str) -> Result<PostmanCollectionImportResult, String> {
    let collection: Value =
        serde_json::from_str(json).map_err(|e| format!("invalid Postman collection JSON: {e}"))?;

    let info = collection.get("info");
    let collection_name = info
        .and_then(|i| i.get("name"))
        .and_then(Value::as_str)
        .unwrap_or("Imported Collection")
        .to_string();
    let collection_description = extract_description(info.and_then(|i| i.get("description")));
    let collection_variables =
        convert_postman_variables(collection.get("variable").and_then(Value::as_array));
    let (collection_pre_script, collection_post_script) =
        extract_postman_events(collection.get("event").and_then(Value::as_array));
    let (auth_mode, auth_config) = convert_postman_auth(collection.get("auth"), "none");

    let mut folders = Vec::new();
    let mut requests = Vec::new();

    if let Some(items) = collection.get("item").and_then(Value::as_array) {
        process_postman_items(items, None, &mut folders, &mut requests);
    }

    Ok(PostmanCollectionImportResult {
        collection_name,
        collection_description,
        collection_variables,
        collection_pre_script,
        collection_post_script,
        collection_auth_mode: Some(auth_mode),
        collection_auth_config: Some(auth_config),
        folders,
        requests,
    })
}

pub fn parse_postman_environment(json: &str) -> Result<PostmanEnvironmentImportResult, String> {
    let env: Value =
        serde_json::from_str(json).map_err(|e| format!("invalid Postman environment JSON: {e}"))?;

    let name = env
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("Imported Environment")
        .to_string();

    let mut variables = Vec::new();
    if let Some(values) = env.get("values").and_then(Value::as_array) {
        for v in values {
            if v.get("enabled").and_then(Value::as_bool) == Some(false) {
                continue;
            }
            let Some(key) = v.get("key").and_then(Value::as_str) else {
                continue;
            };
            let value = v
                .get("value")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            let secret = v.get("type").and_then(Value::as_str) == Some("secret");
            variables.push(PostmanEnvironmentVariable {
                key: key.to_string(),
                value,
                secret,
            });
        }
    }

    Ok(PostmanEnvironmentImportResult { name, variables })
}

fn replace_single_braces_with_double(path: &str) -> String {
    let bytes = path.as_bytes();
    let mut out = String::with_capacity(path.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'{' {
            let mut j = i + 1;
            while j < bytes.len() && (bytes[j].is_ascii_alphanumeric() || bytes[j] == b'_') {
                j += 1;
            }
            if j > i + 1 && j < bytes.len() && bytes[j] == b'}' {
                out.push_str("{{");
                out.push_str(&path[i + 1..j]);
                out.push_str("}}");
                i = j + 1;
                continue;
            }
        }
        let ch = path[i..].chars().next().unwrap();
        out.push(ch);
        i += ch.len_utf8();
    }
    out
}

pub fn parse_universal_import(
    content: &str,
    default_workspace_name: Option<&str>,
) -> Result<NormalizedImportResult, String> {
    let format = detect_import_format(content);
    let workspace_id = generate_id("workspace");
    let workspace_name = default_workspace_name
        .filter(|s| !s.trim().is_empty())
        .unwrap_or("Imported Workspace")
        .to_string();

    let mut export_data = ExportData {
        version: 1,
        workspaces: vec![WorkspaceRow {
            id: workspace_id.clone(),
            name: workspace_name,
            active_environment: "Development".to_string(),
        }],
        collections: Vec::new(),
        folders: Vec::new(),
        requests: Vec::new(),
        request_headers: Vec::new(),
        environments: Vec::new(),
        variables: Vec::new(),
    };

    let title: String;
    let format_label: String;

    match format {
        ImportFormatType::KobeanrestNative => {
            format_label = "KobeanREST Native Export".to_string();
            let parsed: ExportData = serde_json::from_str(content.trim())
                .map_err(|e| format!("invalid KobeanREST native export: {e}"))?;
            title = parsed
                .workspaces
                .first()
                .map(|w| w.name.clone())
                .unwrap_or_else(|| "Native Workspace".to_string());
            let stats = ImportStats {
                collections_count: parsed.collections.len(),
                folders_count: parsed.folders.len(),
                requests_count: parsed.requests.len(),
                environments_count: parsed.environments.len(),
                variables_count: parsed.variables.len(),
            };
            return Ok(NormalizedImportResult {
                format,
                format_label,
                title,
                export_data: parsed,
                stats,
            });
        }
        ImportFormatType::PostmanCollection => {
            format_label = "Postman Collection (v2.0/v2.1)".to_string();
            let pm = parse_postman_collection(content.trim())?;
            title = pm.collection_name.clone();

            let collection_id = generate_id("collection");
            export_data.collections.push(CollectionRow {
                id: collection_id.clone(),
                workspace_id: workspace_id.clone(),
                name: pm.collection_name,
                position: 0,
                description: pm.collection_description,
            });

            for (f_pos, f) in pm.folders.into_iter().enumerate() {
                export_data.folders.push(FolderRow {
                    id: f.id,
                    collection_id: collection_id.clone(),
                    name: f.name,
                    position: f_pos as i64,
                    description: f.description,
                });
            }

            for (r_pos, r) in pm.requests.into_iter().enumerate() {
                let auth_config_str =
                    serde_json::to_string(&r.auth_config).unwrap_or_else(|_| "{}".to_string());
                let body_form_str =
                    serde_json::to_string(&r.body_form).unwrap_or_else(|_| "[]".to_string());
                let query_params_str =
                    serde_json::to_string(&r.query_params).unwrap_or_else(|_| "[]".to_string());

                for (h_pos, h) in r.headers.into_iter().enumerate() {
                    export_data.request_headers.push(RequestHeaderRow {
                        request_id: r.id.clone(),
                        header_key: h.key,
                        header_value: h.value,
                        enabled: i64::from(h.enabled),
                        position: h_pos as i64,
                    });
                }

                export_data.requests.push(RequestRow {
                    id: r.id,
                    workspace_id: workspace_id.clone(),
                    folder_id: r.folder_id.unwrap_or_default(),
                    name: r.name,
                    method: r.method,
                    url: r.url,
                    auth_mode: r.auth_mode,
                    auth_config: Some(auth_config_str),
                    body: r.body,
                    body_mime_type: r.body_mime_type,
                    body_form: body_form_str,
                    query_params: query_params_str,
                    timeout_ms: 30_000,
                    follow_redirects: 1,
                    position: r_pos as i64,
                    description: r.description,
                    examples: r.examples,
                    path_variables: r.path_variables,
                });
            }
        }
        ImportFormatType::PostmanEnvironment => {
            format_label = "Postman Environment".to_string();
            let env = parse_postman_environment(content.trim())?;
            title = env.name.clone();

            let env_id = generate_id("environment");
            export_data.environments.push(EnvironmentRow {
                id: env_id.clone(),
                workspace_id: workspace_id.clone(),
                name: env.name,
                position: 0,
            });

            for (v_pos, v) in env.variables.into_iter().enumerate() {
                export_data.variables.push(VariableRow {
                    environment_id: env_id.clone(),
                    variable_key: v.key,
                    variable_value: v.value,
                    secret_ref: None,
                    secret: i64::from(v.secret),
                    masked: 0,
                    position: v_pos as i64,
                });
            }

            export_data.collections.push(CollectionRow {
                id: generate_id("collection"),
                workspace_id: workspace_id.clone(),
                name: "General Collection".to_string(),
                position: 0,
                description: None,
            });
        }
        ImportFormatType::Curl => {
            format_label = "cURL Command".to_string();
            title = "cURL Import".to_string();
            let curl_res = parse_curl_command(content);

            let collection_id = generate_id("collection");
            export_data.collections.push(CollectionRow {
                id: collection_id,
                workspace_id: workspace_id.clone(),
                name: "cURL Imports".to_string(),
                position: 0,
                description: None,
            });

            let req_id = generate_id("request");
            let auth_config_str =
                serde_json::to_string(&curl_res.auth_config).unwrap_or_else(|_| "{}".to_string());
            let body_form_str =
                serde_json::to_string(&curl_res.body_form).unwrap_or_else(|_| "[]".to_string());
            let url_prefix: String = curl_res.url.chars().take(30).collect();

            export_data.requests.push(RequestRow {
                id: req_id.clone(),
                workspace_id: workspace_id.clone(),
                folder_id: String::new(),
                name: format!("{} {url_prefix}", curl_res.method),
                method: curl_res.method,
                url: curl_res.url,
                auth_mode: curl_res.auth_mode,
                auth_config: Some(auth_config_str),
                body: curl_res.body,
                body_mime_type: curl_res.body_mime_type,
                body_form: body_form_str,
                query_params: "[]".to_string(),
                timeout_ms: 30_000,
                follow_redirects: 1,
                position: 0,
                description: None,
                examples: None,
                path_variables: None,
            });

            for (h_pos, h) in curl_res.headers.into_iter().enumerate() {
                export_data.request_headers.push(RequestHeaderRow {
                    request_id: req_id.clone(),
                    header_key: h.key,
                    header_value: h.value,
                    enabled: i64::from(h.enabled),
                    position: h_pos as i64,
                });
            }
        }
        ImportFormatType::OpenApi => {
            format_label = "OpenAPI / Swagger Spec".to_string();
            let parsed: Value = serde_json::from_str(content.trim()).unwrap_or(Value::Null);
            title = parsed
                .get("info")
                .and_then(|i| i.get("title"))
                .and_then(Value::as_str)
                .unwrap_or("OpenAPI Spec")
                .to_string();
            let col_desc = parsed
                .get("info")
                .and_then(|i| i.get("description"))
                .and_then(Value::as_str)
                .map(ToString::to_string);

            let collection_id = generate_id("collection");
            export_data.collections.push(CollectionRow {
                id: collection_id,
                workspace_id: workspace_id.clone(),
                name: title.clone(),
                position: 0,
                description: col_desc,
            });

            let base_url = parsed
                .get("servers")
                .and_then(Value::as_array)
                .and_then(|s| s.first())
                .and_then(|s| s.get("url"))
                .and_then(Value::as_str)
                .map(ToString::to_string)
                .unwrap_or_else(|| {
                    if let Some(host) = parsed.get("host").and_then(Value::as_str) {
                        let scheme = parsed
                            .get("schemes")
                            .and_then(Value::as_array)
                            .and_then(|s| s.first())
                            .and_then(Value::as_str)
                            .unwrap_or("https");
                        let base_path = parsed
                            .get("basePath")
                            .and_then(Value::as_str)
                            .unwrap_or("");
                        format!("{scheme}://{host}{base_path}")
                    } else {
                        "http://localhost:8080".to_string()
                    }
                });

            let mut r_pos: i64 = 0;
            if let Some(paths) = parsed.get("paths").and_then(Value::as_object) {
                for (path_key, path_obj) in paths {
                    let Some(path_map) = path_obj.as_object() else {
                        continue;
                    };
                    for (method_key, op_obj) in path_map {
                        let m_lower = method_key.to_ascii_lowercase();
                        if !matches!(
                            m_lower.as_str(),
                            "get" | "post" | "put" | "delete" | "patch" | "head" | "options"
                        ) {
                            continue;
                        }
                        let method = m_lower.to_ascii_uppercase();
                        let req_name = op_obj
                            .get("summary")
                            .and_then(Value::as_str)
                            .or_else(|| op_obj.get("operationId").and_then(Value::as_str))
                            .map(ToString::to_string)
                            .unwrap_or_else(|| format!("{method} {path_key}"));
                        let path_url = replace_single_braces_with_double(path_key);
                        let full_url = if let Some(stripped) = base_url.strip_suffix('/') {
                            format!("{stripped}{path_url}")
                        } else {
                            format!("{base_url}{path_url}")
                        };

                        let mut q_arr = Vec::new();
                        if let Some(params) = op_obj.get("parameters").and_then(Value::as_array) {
                            for p in params {
                                if p.get("in").and_then(Value::as_str) == Some("query") {
                                    let key = p.get("name").and_then(Value::as_str).unwrap_or("");
                                    let val = p
                                        .get("example")
                                        .or_else(|| p.get("default"))
                                        .and_then(Value::as_str)
                                        .unwrap_or("");
                                    let enabled = p
                                        .get("required")
                                        .and_then(Value::as_bool)
                                        .unwrap_or(true);
                                    q_arr.push(json!({
                                        "key": key,
                                        "value": val,
                                        "enabled": enabled
                                    }));
                                }
                            }
                        }

                        let summary = op_obj.get("summary").and_then(Value::as_str);
                        let desc = op_obj.get("description").and_then(Value::as_str);
                        let open_api_desc = match (summary, desc) {
                            (Some(s), Some(d)) => format!("### {s}\n\n{d}"),
                            (None, Some(d)) => d.to_string(),
                            (Some(s), None) => s.to_string(),
                            (None, None) => String::new(),
                        };

                        export_data.requests.push(RequestRow {
                            id: generate_id("request"),
                            workspace_id: workspace_id.clone(),
                            folder_id: String::new(),
                            name: req_name,
                            method,
                            url: full_url,
                            auth_mode: "none".to_string(),
                            auth_config: Some("{}".to_string()),
                            body: String::new(),
                            body_mime_type: "application/json".to_string(),
                            body_form: "[]".to_string(),
                            query_params: serde_json::to_string(&q_arr)
                                .unwrap_or_else(|_| "[]".to_string()),
                            timeout_ms: 30_000,
                            follow_redirects: 1,
                            position: r_pos,
                            description: Some(open_api_desc),
                            examples: None,
                            path_variables: None,
                        });
                        r_pos += 1;
                    }
                }
            }
        }
        ImportFormatType::Insomnia => {
            format_label = "Insomnia Export".to_string();
            title = "Insomnia Import".to_string();
            let parsed: Value = serde_json::from_str(content.trim())
                .map_err(|e| format!("invalid Insomnia JSON: {e}"))?;

            let collection_id = generate_id("collection");
            export_data.collections.push(CollectionRow {
                id: collection_id,
                workspace_id: workspace_id.clone(),
                name: title.clone(),
                position: 0,
                description: None,
            });

            if let Some(resources) = parsed.get("resources").and_then(Value::as_array) {
                let mut r_pos: i64 = 0;
                for res in resources {
                    if res.get("_type").and_then(Value::as_str) != Some("request") {
                        continue;
                    }
                    let body_text = res
                        .get("body")
                        .and_then(|b| b.get("text"))
                        .and_then(Value::as_str)
                        .unwrap_or("")
                        .to_string();
                    let req_url = res
                        .get("url")
                        .and_then(Value::as_str)
                        .unwrap_or("")
                        .to_string();
                    let mut mime_type = res
                        .get("body")
                        .and_then(|b| b.get("mimeType"))
                        .and_then(Value::as_str)
                        .unwrap_or("application/json")
                        .to_string();
                    if is_graphql_payload(Some(&body_text), Some(&mime_type), Some(&req_url)) {
                        mime_type = "application/graphql".to_string();
                    }
                    export_data.requests.push(RequestRow {
                        id: generate_id("request"),
                        workspace_id: workspace_id.clone(),
                        folder_id: String::new(),
                        name: res
                            .get("name")
                            .and_then(Value::as_str)
                            .unwrap_or("Untitled Request")
                            .to_string(),
                        method: res
                            .get("method")
                            .and_then(Value::as_str)
                            .unwrap_or("GET")
                            .to_ascii_uppercase(),
                        url: req_url,
                        auth_mode: "none".to_string(),
                        auth_config: Some("{}".to_string()),
                        body: body_text,
                        body_mime_type: mime_type,
                        body_form: "[]".to_string(),
                        query_params: "[]".to_string(),
                        timeout_ms: 30_000,
                        follow_redirects: 1,
                        position: r_pos,
                        description: Some(
                            res.get("description")
                                .and_then(Value::as_str)
                                .unwrap_or("")
                                .to_string(),
                        ),
                        examples: None,
                        path_variables: None,
                    });
                    r_pos += 1;
                }
            }
        }
        ImportFormatType::HapiRoutes => {
            format_label = "Hapi.js Routes Spec".to_string();
            title = "Hapi.js Routes".to_string();
            let collection_id = generate_id("collection");
            export_data.collections.push(CollectionRow {
                id: collection_id.clone(),
                workspace_id: workspace_id.clone(),
                name: title.clone(),
                position: 0,
                description: None,
            });
            let folder_id = generate_id("folder");
            export_data.folders.push(FolderRow {
                id: folder_id.clone(),
                collection_id,
                name: "Routes".to_string(),
                position: 0,
                description: None,
            });

            if let Ok(Value::Array(routes)) = serde_json::from_str::<Value>(content.trim()) {
                let mut r_pos: i64 = 0;
                for route in routes {
                    let Some(raw_path) = route.get("path").and_then(Value::as_str) else {
                        continue;
                    };
                    let path = replace_single_braces_with_double(raw_path);
                    let methods: Vec<String> = match route.get("method") {
                        Some(Value::Array(arr)) => arr
                            .iter()
                            .filter_map(Value::as_str)
                            .map(str::to_ascii_uppercase)
                            .collect(),
                        Some(Value::String(s)) => vec![s.to_ascii_uppercase()],
                        _ => vec!["GET".to_string()],
                    };
                    for method in methods {
                        let req_name = route
                            .get("notes")
                            .and_then(Value::as_str)
                            .or_else(|| {
                                route
                                    .get("config")
                                    .and_then(|c| c.get("notes"))
                                    .and_then(Value::as_str)
                            })
                            .map(ToString::to_string)
                            .unwrap_or_else(|| format!("{method} {raw_path}"));
                        export_data.requests.push(RequestRow {
                            id: generate_id("request"),
                            workspace_id: workspace_id.clone(),
                            folder_id: folder_id.clone(),
                            name: req_name,
                            method,
                            url: format!("http://localhost:3000{path}"),
                            auth_mode: "none".to_string(),
                            auth_config: Some("{}".to_string()),
                            body: String::new(),
                            body_mime_type: "application/json".to_string(),
                            body_form: "[]".to_string(),
                            query_params: "[]".to_string(),
                            timeout_ms: 30_000,
                            follow_redirects: 1,
                            position: r_pos,
                            description: None,
                            examples: None,
                            path_variables: None,
                        });
                        r_pos += 1;
                    }
                }
            }
        }
        ImportFormatType::Har => {
            format_label = "HTTP Archive (HAR)".to_string();
            title = "HAR Import".to_string();
            let parsed: Value = serde_json::from_str(content.trim())
                .map_err(|e| format!("invalid HAR JSON: {e}"))?;
            export_data.collections.push(CollectionRow {
                id: generate_id("collection"),
                workspace_id: workspace_id.clone(),
                name: title.clone(),
                position: 0,
                description: None,
            });
            if let Some(entries) = parsed
                .get("log")
                .and_then(|l| l.get("entries"))
                .and_then(Value::as_array)
            {
                for (r_pos, entry) in entries.iter().enumerate() {
                    let Some(req) = entry.get("request") else {
                        continue;
                    };
                    let req_id = generate_id("request");
                    let method = req
                        .get("method")
                        .and_then(Value::as_str)
                        .unwrap_or("GET")
                        .to_ascii_uppercase();
                    let url = req
                        .get("url")
                        .and_then(Value::as_str)
                        .unwrap_or("")
                        .to_string();
                    let body_text = req
                        .get("postData")
                        .and_then(|p| p.get("text"))
                        .and_then(Value::as_str)
                        .unwrap_or("")
                        .to_string();
                    let mime = req
                        .get("postData")
                        .and_then(|p| p.get("mimeType"))
                        .and_then(Value::as_str)
                        .unwrap_or("application/json")
                        .to_string();
                    if let Some(hdrs) = req.get("headers").and_then(Value::as_array) {
                        for (h_pos, h) in hdrs.iter().enumerate() {
                            if let (Some(k), Some(v)) = (
                                h.get("name").and_then(Value::as_str),
                                h.get("value").and_then(Value::as_str),
                            ) {
                                export_data.request_headers.push(RequestHeaderRow {
                                    request_id: req_id.clone(),
                                    header_key: k.to_string(),
                                    header_value: v.to_string(),
                                    enabled: 1,
                                    position: h_pos as i64,
                                });
                            }
                        }
                    }
                    export_data.requests.push(RequestRow {
                        id: req_id,
                        workspace_id: workspace_id.clone(),
                        folder_id: String::new(),
                        name: format!("{method} {url}"),
                        method,
                        url,
                        auth_mode: "none".to_string(),
                        auth_config: Some("{}".to_string()),
                        body: body_text,
                        body_mime_type: mime,
                        body_form: "[]".to_string(),
                        query_params: "[]".to_string(),
                        timeout_ms: 30_000,
                        follow_redirects: 1,
                        position: r_pos as i64,
                        description: None,
                        examples: None,
                        path_variables: None,
                    });
                }
            }
        }
        ImportFormatType::Hoppscotch | ImportFormatType::Unknown => {
            format_label = if format == ImportFormatType::Hoppscotch {
                "Hoppscotch Collection".to_string()
            } else {
                "Unknown Format".to_string()
            };
            title = "Imported API".to_string();
            export_data.collections.push(CollectionRow {
                id: generate_id("collection"),
                workspace_id: workspace_id.clone(),
                name: title.clone(),
                position: 0,
                description: None,
            });
        }
    }

    // Ensure every request has a valid folder_id for persistence::import_workspace_data.
    let mut fallback_collection_id = export_data.collections.first().map(|c| c.id.clone());
    let mut default_folder_id: Option<String> = None;

    for req in &mut export_data.requests {
        if req.folder_id.is_empty() {
            let col_id = match &fallback_collection_id {
                Some(id) => id.clone(),
                None => {
                    let id = generate_id("collection");
                    export_data.collections.push(CollectionRow {
                        id: id.clone(),
                        workspace_id: workspace_id.clone(),
                        name: "Imported Collection".to_string(),
                        position: 0,
                        description: None,
                    });
                    fallback_collection_id = Some(id.clone());
                    id
                }
            };
            let fld_id = match &default_folder_id {
                Some(id) => id.clone(),
                None => {
                    let id = generate_id("folder");
                    export_data.folders.push(FolderRow {
                        id: id.clone(),
                        collection_id: col_id,
                        name: "Default Folder".to_string(),
                        position: 0,
                        description: None,
                    });
                    default_folder_id = Some(id.clone());
                    id
                }
            };
            req.folder_id = fld_id;
        }
    }

    let stats = ImportStats {
        collections_count: export_data.collections.len(),
        folders_count: export_data.folders.len(),
        requests_count: export_data.requests.len(),
        environments_count: export_data.environments.len(),
        variables_count: export_data.variables.len(),
    };

    Ok(NormalizedImportResult {
        format,
        format_label,
        title,
        export_data,
        stats,
    })
}
