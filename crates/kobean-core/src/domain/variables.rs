use std::collections::{HashMap, HashSet};
use std::fmt;
use std::time::{SystemTime, UNIX_EPOCH};

use uuid::Uuid;

use crate::persistence::{HeaderEntry, SavedRequest, WorkspaceSummary};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedString {
    pub resolved: String,
    pub used_variables: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UnresolvedVariableError {
    pub unresolved_names: Vec<String>,
}

impl fmt::Display for UnresolvedVariableError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let plural = if self.unresolved_names.len() > 1 {
            "s"
        } else {
            ""
        };
        write!(
            f,
            "Unresolved variable{}: {}",
            plural,
            self.unresolved_names.join(", ")
        )
    }
}

impl std::error::Error for UnresolvedVariableError {}

#[derive(Debug, Clone)]
pub struct ResolvedRequestFields {
    pub url: String,
    pub headers: Vec<HeaderEntry>,
    pub body: Option<String>,
}

#[derive(Debug, Default, Clone)]
pub struct VariableScope<'a> {
    pub collection_id: Option<&'a str>,
    pub folder_id: Option<&'a str>,
    pub request_id: Option<&'a str>,
    pub request: Option<&'a SavedRequest>,
}

pub type DynamicVariableEntry = (&'static str, fn() -> String);

pub const DYNAMIC_VARIABLES: &[DynamicVariableEntry] = &[
    ("$guid", random_uuid),
    ("$randomUUID", random_uuid),
    ("$timestamp", current_timestamp_secs),
    ("$timestampMs", current_timestamp_ms),
    ("$isoTimestamp", current_iso_timestamp),
    ("$isoDatetime", current_iso_timestamp),
    ("$datetime", current_iso_timestamp),
    ("$date", current_utc_date),
    ("$randomInt", random_int),
    ("$randomString", random_string_8),
];

fn random_uuid() -> String {
    Uuid::new_v4().to_string()
}

fn now_duration() -> std::time::Duration {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
}

fn current_timestamp_secs() -> String {
    now_duration().as_secs().to_string()
}

fn current_timestamp_ms() -> String {
    now_duration().as_millis().to_string()
}

/// Howard Hinnant's civil-from-days algorithm: converts days since 1970-01-01 to (year, month, day).
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = (yoe as i64) + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = y + if m <= 2 { 1 } else { 0 };
    (year, m as u32, d as u32)
}

fn current_iso_timestamp() -> String {
    let dur = now_duration();
    let total_secs = dur.as_secs();
    let days = (total_secs / 86_400) as i64;
    let secs_of_day = total_secs % 86_400;
    let (year, month, day) = civil_from_days(days);
    let hour = secs_of_day / 3600;
    let minute = (secs_of_day % 3600) / 60;
    let second = secs_of_day % 60;
    let millis = dur.subsec_millis();
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}.{millis:03}Z")
}

fn current_utc_date() -> String {
    current_iso_timestamp()[..10].to_string()
}

fn random_int() -> String {
    let bytes = Uuid::new_v4().into_bytes();
    let val = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) % 1000;
    val.to_string()
}

fn random_string_8() -> String {
    const CHARSET: &[u8] = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let bytes = Uuid::new_v4().into_bytes();
    let mut out = String::with_capacity(8);
    for &b in &bytes[..8] {
        out.push(CHARSET[(b as usize) % CHARSET.len()] as char);
    }
    out
}

pub fn resolve_dynamic_variable(name: &str) -> Option<String> {
    DYNAMIC_VARIABLES
        .iter()
        .find(|(key, _)| *key == name)
        .map(|(_, gen_fn)| gen_fn())
}

fn contains_delimited_pair(haystack: &str, left: &str, right: &str) -> bool {
    let mut search_from = 0;
    while let Some(pos) = haystack[search_from..].find(left) {
        let after_left = search_from + pos + left.len();
        let rest = &haystack[after_left..];
        if rest.starts_with(right) {
            return true;
        }
        if let Some(first) = rest.chars().next() {
            if matches!(first, '_' | '-' | '.') && rest[first.len_utf8()..].starts_with(right) {
                return true;
            }
        }
        search_from = search_from + pos + 1;
    }
    false
}

/// Returns true if the variable key looks like it holds sensitive data.
pub fn is_sensitive_key(key: &str) -> bool {
    let lower = key.to_ascii_lowercase();
    const SIMPLE_PATTERNS: &[&str] = &[
        "password",
        "passwd",
        "secret",
        "token",
        "auth",
        "credential",
        "bearer",
        "jwt",
        "passphrase",
        "cert",
        "ssl",
        "tls",
    ];
    if SIMPLE_PATTERNS.iter().any(|pat| lower.contains(pat)) {
        return true;
    }
    contains_delimited_pair(&lower, "api", "key")
        || contains_delimited_pair(&lower, "private", "key")
        || contains_delimited_pair(&lower, "access", "key")
        || contains_delimited_pair(&lower, "client", "secret")
}

/// Finds non-overlapping `{{...}}` spans matching `/\{\{([^{}]+)\}\}/g`.
fn find_variable_spans(text: &str) -> Vec<(usize, usize, &str)> {
    let bytes = text.as_bytes();
    let mut spans = Vec::new();
    let mut i = 0;

    while i + 3 < bytes.len() {
        if bytes[i] == b'{' && bytes[i + 1] == b'{' {
            let content_start = i + 2;
            let mut j = content_start;
            let mut valid = false;
            while j < bytes.len() {
                if bytes[j] == b'{' {
                    // Encountered `{` inside candidate; restart scan from this `{`.
                    i = j;
                    break;
                }
                if bytes[j] == b'}' {
                    if j + 1 < bytes.len() && bytes[j + 1] == b'}' && j > content_start {
                        spans.push((i, j + 2, &text[content_start..j]));
                        i = j + 2;
                        valid = true;
                    } else {
                        i = j + 1;
                    }
                    break;
                }
                j += 1;
            }
            if j >= bytes.len() {
                break;
            }
            if !valid {
                continue;
            }
        } else {
            i += 1;
        }
    }

    spans
}

/// Detect all `{{variableName}}` references in a string (trimmed unique names in encounter order).
pub fn detect_variables(text: &str) -> Vec<String> {
    let mut names = Vec::new();
    for (_, _, raw) in find_variable_spans(text) {
        let name = raw.trim();
        if !name.is_empty() && !names.iter().any(|existing| existing == name) {
            names.push(name.to_string());
        }
    }
    names
}

pub fn contains_variables(text: &str) -> bool {
    !find_variable_spans(text).is_empty()
}

fn lookup_variable<'a>(
    name: &str,
    variable_map: &'a HashMap<String, String>,
) -> Option<(&'a str, &'a str)> {
    if let Some((k, v)) = variable_map.get_key_value(name) {
        return Some((k.as_str(), v.as_str()));
    }
    let name_lower = name.to_lowercase();
    let mut ci_matches: Vec<(&str, &str)> = variable_map
        .iter()
        .filter(|(k, _)| k.to_lowercase() == name_lower)
        .map(|(k, v)| (k.as_str(), v.as_str()))
        .collect();
    ci_matches.sort_by(|a, b| a.0.cmp(b.0));
    ci_matches.into_iter().next()
}

fn substitute_variables(
    text: &str,
    variable_map: &HashMap<String, String>,
    mut used_variables: Option<&mut Vec<String>>,
) -> String {
    let spans = find_variable_spans(text);
    if spans.is_empty() {
        return text.to_string();
    }

    let mut out = String::with_capacity(text.len());
    let mut cursor = 0;

    for (start, end, raw_name) in spans {
        out.push_str(&text[cursor..start]);
        let name = raw_name.trim();
        if let Some((matched_key, val)) = lookup_variable(name, variable_map) {
            if let Some(used) = used_variables.as_deref_mut() {
                if !used.iter().any(|u| u == matched_key) {
                    used.push(matched_key.to_string());
                }
            }
            out.push_str(val);
        } else if let Some(dynamic_val) = resolve_dynamic_variable(name) {
            if let Some(used) = used_variables.as_deref_mut() {
                if !used.iter().any(|u| u == name) {
                    used.push(name.to_string());
                }
            }
            out.push_str(&dynamic_val);
        } else {
            out.push_str(&text[start..end]);
        }
        cursor = end;
    }

    out.push_str(&text[cursor..]);
    out
}

pub fn resolve_string(
    text: &str,
    variable_map: &HashMap<String, String>,
) -> Result<ResolvedString, UnresolvedVariableError> {
    let mut used_variables = Vec::new();
    let resolved = substitute_variables(text, variable_map, Some(&mut used_variables));
    let remaining = detect_variables(&resolved);
    if !remaining.is_empty() {
        return Err(UnresolvedVariableError {
            unresolved_names: remaining,
        });
    }
    Ok(ResolvedString {
        resolved,
        used_variables,
    })
}

pub fn resolve_string_safe(text: &str, variable_map: &HashMap<String, String>) -> String {
    substitute_variables(text, variable_map, None)
}

fn is_uri_component_unreserved(byte: u8) -> bool {
    byte.is_ascii_alphanumeric()
        || matches!(
            byte,
            b'-' | b'_' | b'.' | b'!' | b'~' | b'*' | b'\'' | b'(' | b')'
        )
}

pub(crate) fn encode_uri_component(input: &str) -> String {
    const HEX: &[u8; 16] = b"0123456789ABCDEF";
    let mut out = String::with_capacity(input.len());
    for &b in input.as_bytes() {
        if is_uri_component_unreserved(b) {
            out.push(b as char);
        } else {
            out.push('%');
            out.push(HEX[(b >> 4) as usize] as char);
            out.push(HEX[(b & 0x0F) as usize] as char);
        }
    }
    out
}

fn decode_uri_component_strict(input: &str) -> Option<String> {
    let bytes = input.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            if i + 2 >= bytes.len() {
                return None;
            }
            let hi = (bytes[i + 1] as char).to_digit(16)?;
            let lo = (bytes[i + 2] as char).to_digit(16)?;
            decoded.push(((hi << 4) | lo) as u8);
            i += 3;
        } else {
            decoded.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(decoded).ok()
}

fn has_percent_hex_pair(segment: &str) -> bool {
    let bytes = segment.as_bytes();
    bytes
        .windows(3)
        .any(|w| w[0] == b'%' && w[1].is_ascii_hexdigit() && w[2].is_ascii_hexdigit())
}

fn is_already_encoded(segment: &str) -> bool {
    if !has_percent_hex_pair(segment) {
        return false;
    }
    decode_uri_component_strict(segment)
        .is_some_and(|decoded| encode_uri_component(&decoded) == segment)
}

pub(crate) fn encode_if_needed(segment: &str) -> String {
    if is_already_encoded(segment) {
        segment.to_string()
    } else {
        encode_uri_component(segment)
    }
}

pub fn encode_query_params_in_resolved_url(url: &str) -> String {
    let Some(q_index) = url.find('?') else {
        return url.to_string();
    };
    let base = &url[..q_index];
    let after_q = &url[q_index + 1..];
    let (query_string, fragment) = match after_q.find('#') {
        Some(h_idx) => (&after_q[..h_idx], Some(&after_q[h_idx..])),
        None => (after_q, None),
    };
    if query_string.is_empty() {
        return url.to_string();
    }

    let encoded: Vec<String> = query_string
        .split('&')
        .map(|pair| {
            if pair.is_empty() {
                return String::new();
            }
            match pair.find('=') {
                Some(eq_idx) => {
                    let k = &pair[..eq_idx];
                    let v = &pair[eq_idx + 1..];
                    format!("{}={}", encode_if_needed(k), encode_if_needed(v))
                }
                None => encode_if_needed(pair),
            }
        })
        .collect();

    match fragment {
        Some(frag) => format!("{base}?{}{frag}", encoded.join("&")),
        None => format!("{base}?{}", encoded.join("&")),
    }
}

pub fn build_scoped_variable_map(
    workspace: &WorkspaceSummary,
    scope: &VariableScope<'_>,
) -> HashMap<String, String> {
    let mut map = HashMap::new();

    // 1. Active environment (lowest precedence), skipping secrets.
    if !workspace.active_environment.is_empty() {
        if let Some(env) = workspace
            .environments
            .iter()
            .find(|e| e.name == workspace.active_environment)
        {
            for v in &env.variables {
                let has_secret_ref = v.secret_ref.as_deref().is_some_and(|r| !r.is_empty());
                if v.secret || has_secret_ref || v.key.is_empty() {
                    continue;
                }
                map.insert(v.key.clone(), v.value.clone());
            }
        }
    }

    let ingest_scoped = |map: &mut HashMap<String, String>,
                         vars: Option<&Vec<crate::persistence::ScopedVariable>>| {
        if let Some(vars) = vars {
            for v in vars {
                let has_secret_ref = v.secret_ref.as_deref().is_some_and(|r| !r.is_empty());
                if v.secret || has_secret_ref || v.key.is_empty() {
                    continue;
                }
                map.insert(v.key.clone(), v.value.clone());
            }
        }
    };

    let resolved_folder_id: Option<&str> = scope
        .folder_id
        .or_else(|| scope.request.map(|r| r.folder_id.as_str()))
        .or_else(|| {
            scope.request_id.and_then(|rid| {
                workspace
                    .requests
                    .iter()
                    .find(|r| r.id == rid)
                    .map(|r| r.folder_id.as_str())
            })
        });

    let mut resolved_collection_id: Option<&str> = scope.collection_id;
    let mut folder_chain = Vec::new();
    let mut visited_folders = HashSet::new();

    if let Some(mut current_folder_id) = resolved_folder_id {
        while !current_folder_id.is_empty() && visited_folders.insert(current_folder_id) {
            if let Some(folder) = workspace.folders.iter().find(|f| f.id == current_folder_id) {
                folder_chain.push(folder);
                if resolved_collection_id.is_none() {
                    if let Some(cid) = folder.collection_id.as_deref() {
                        resolved_collection_id = Some(cid);
                    }
                }
                match folder.parent_id.as_deref() {
                    Some(pid) => current_folder_id = pid,
                    None => break,
                }
            } else {
                if resolved_collection_id.is_none()
                    && workspace
                        .collections
                        .as_ref()
                        .is_some_and(|cols| cols.iter().any(|c| c.id == current_folder_id))
                {
                    resolved_collection_id = Some(current_folder_id);
                }
                break;
            }
        }
    }

    // 2. Collection variables
    if let Some(cid) = resolved_collection_id {
        if let Some(collection) = workspace
            .collections
            .as_ref()
            .and_then(|cols| cols.iter().find(|c| c.id == cid))
        {
            ingest_scoped(&mut map, collection.variables.as_ref());
        }
    }

    // 3. Folders from root down to immediate folder
    for folder in folder_chain.into_iter().rev() {
        ingest_scoped(&mut map, folder.variables.as_ref());
    }

    // 4. Request variables (highest precedence)
    if let Some(req) = scope.request {
        ingest_scoped(&mut map, req.variables.as_ref());
    } else if let Some(rid) = scope.request_id {
        if let Some(req) = workspace.requests.iter().find(|r| r.id == rid) {
            ingest_scoped(&mut map, req.variables.as_ref());
        }
    }

    map
}

fn strip_duplicate_leading_scheme(url: &str) -> String {
    let lower = url.to_ascii_lowercase();
    let outer_len = if lower.starts_with("https://") {
        8
    } else if lower.starts_with("http://") {
        7
    } else {
        return url.to_string();
    };

    let rest_lower = &lower[outer_len..];
    if rest_lower.starts_with("https://") || rest_lower.starts_with("http://") {
        url[outer_len..].to_string()
    } else {
        url.to_string()
    }
}

pub fn resolve_request_fields(
    variable_map: &HashMap<String, String>,
    url: &str,
    headers: &[HeaderEntry],
    body: Option<&str>,
) -> Result<ResolvedRequestFields, UnresolvedVariableError> {
    let mut resolved_url = resolve_string(url, variable_map)?.resolved;
    resolved_url = strip_duplicate_leading_scheme(&resolved_url);
    resolved_url = encode_query_params_in_resolved_url(&resolved_url);

    let mut resolved_headers = Vec::with_capacity(headers.len());
    for header in headers {
        let (key, value) = if header.enabled {
            (
                resolve_string(&header.key, variable_map)?.resolved,
                resolve_string(&header.value, variable_map)?.resolved,
            )
        } else {
            (header.key.clone(), header.value.clone())
        };
        resolved_headers.push(HeaderEntry {
            key,
            value,
            enabled: header.enabled,
        });
    }

    let resolved_body = match body {
        Some(b) if !b.trim().is_empty() => Some(resolve_string(b, variable_map)?.resolved),
        Some(b) => Some(b.to_string()),
        None => None,
    };

    Ok(ResolvedRequestFields {
        url: resolved_url,
        headers: resolved_headers,
        body: resolved_body,
    })
}

pub fn resolve_request_fields_safe(
    variable_map: &HashMap<String, String>,
    url: &str,
    headers: &[HeaderEntry],
    body: Option<&str>,
) -> ResolvedRequestFields {
    let mut resolved_url = resolve_string_safe(url, variable_map);
    resolved_url = strip_duplicate_leading_scheme(&resolved_url);
    resolved_url = encode_query_params_in_resolved_url(&resolved_url);

    let resolved_headers = headers
        .iter()
        .map(|header| HeaderEntry {
            key: header.key.clone(),
            value: if header.enabled {
                resolve_string_safe(&header.value, variable_map)
            } else {
                header.value.clone()
            },
            enabled: header.enabled,
        })
        .collect();

    let resolved_body = match body {
        Some(b) if !b.trim().is_empty() => Some(resolve_string_safe(b, variable_map)),
        Some(b) => Some(b.to_string()),
        None => None,
    };

    ResolvedRequestFields {
        url: resolved_url,
        headers: resolved_headers,
        body: resolved_body,
    }
}
