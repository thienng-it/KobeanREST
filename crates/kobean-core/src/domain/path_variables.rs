use std::collections::{HashMap, HashSet};

use crate::persistence::PathVariableEntry;

use super::variables::{contains_variables, encode_if_needed};

fn strip_scheme(s: &str) -> &str {
    if let Some(idx) = s.find("://") {
        let prefix = &s[..idx];
        let mut chars = prefix.chars();
        if let Some(first) = chars.next() {
            if first.is_ascii_alphabetic()
                && chars.all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '-' | '.'))
            {
                return &s[idx + 3..];
            }
        }
    }
    s
}

fn mask_double_curly_vars(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = String::with_capacity(s.len());
    let mut i = 0;

    while i < bytes.len() {
        if i + 3 < bytes.len() && bytes[i] == b'{' && bytes[i + 1] == b'{' {
            let mut j = i + 2;
            let mut closed = None;
            while j < bytes.len() {
                if bytes[j] == b'{' {
                    break;
                }
                if bytes[j] == b'}' {
                    if j + 1 < bytes.len() && bytes[j + 1] == b'}' && j > i + 2 {
                        closed = Some(j + 2);
                    }
                    break;
                }
                j += 1;
            }
            if let Some(end) = closed {
                out.push_str("__ENV_VAR__");
                i = end;
                continue;
            }
        }
        let ch = s[i..].chars().next().unwrap();
        out.push(ch);
        i += ch.len_utf8();
    }

    out
}

fn is_ident_char(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'_'
}

/// Extracts path variable keys (`:varName` and `{varName}`) from a URL string.
pub fn extract_path_variables_from_url(url: &str) -> Vec<String> {
    if url.is_empty() {
        return Vec::new();
    }

    let mut end_idx = url.len();
    if let Some(q_idx) = url.find('?') {
        end_idx = q_idx;
    }
    if let Some(hash_idx) = url.find('#') {
        if hash_idx < end_idx {
            end_idx = hash_idx;
        }
    }

    let path_part = strip_scheme(&url[..end_idx]);
    let masked = mask_double_curly_vars(path_part);
    let bytes = masked.as_bytes();

    let mut keys = Vec::new();
    let mut seen = HashSet::new();

    // 1. Match colon path variables: (?:^|[/?#]):([a-zA-Z0-9_]+)
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b':' {
            let valid_prefix = i == 0 || matches!(bytes[i - 1], b'/' | b'?' | b'#');
            if valid_prefix {
                let start = i + 1;
                let mut end = start;
                while end < bytes.len() && is_ident_char(bytes[end]) {
                    end += 1;
                }
                if end > start {
                    let key = &masked[start..end];
                    if seen.insert(key.to_string()) {
                        keys.push(key.to_string());
                    }
                    i = end;
                    continue;
                }
            }
        }
        i += 1;
    }

    // 2. Match single curly brace path variables: \{([a-zA-Z0-9_]+)\}
    i = 0;
    while i < bytes.len() {
        if bytes[i] == b'{' {
            let start = i + 1;
            let mut end = start;
            while end < bytes.len() && is_ident_char(bytes[end]) {
                end += 1;
            }
            if end > start && end < bytes.len() && bytes[end] == b'}' {
                let key = &masked[start..end];
                if key != "__ENV_VAR__" && seen.insert(key.to_string()) {
                    keys.push(key.to_string());
                }
                i = end + 1;
                continue;
            }
        }
        i += 1;
    }

    keys
}

pub fn has_path_variables_in_url(url: &str) -> bool {
    !extract_path_variables_from_url(url).is_empty()
}

pub fn sync_path_variables_with_url(
    url: &str,
    existing_path_variables: Option<&[PathVariableEntry]>,
) -> Vec<PathVariableEntry> {
    let detected_keys = extract_path_variables_from_url(url);
    if detected_keys.is_empty() {
        return existing_path_variables.unwrap_or(&[]).to_vec();
    }

    let mut existing_map: HashMap<String, &PathVariableEntry> = HashMap::new();
    if let Some(existing) = existing_path_variables {
        for item in existing {
            if !item.key.is_empty() {
                let clean = item.key.strip_prefix(':').unwrap_or(&item.key);
                existing_map.entry(clean.to_string()).or_insert(item);
                existing_map.entry(item.key.clone()).or_insert(item);
            }
        }
    }

    detected_keys
        .into_iter()
        .map(|key| {
            let clean_key = key.strip_prefix(':').unwrap_or(&key).to_string();
            let colon_key = format!(":{clean_key}");
            if let Some(existing) = existing_map
                .get(&clean_key)
                .or_else(|| existing_map.get(&key))
                .or_else(|| existing_map.get(&colon_key))
            {
                PathVariableEntry {
                    key: clean_key,
                    value: existing.value.clone(),
                    enabled: existing.enabled,
                    description: existing.description.clone().or_else(|| Some(String::new())),
                }
            } else {
                PathVariableEntry {
                    key: clean_key,
                    value: String::new(),
                    enabled: true,
                    description: Some(String::new()),
                }
            }
        })
        .collect()
}

fn replace_colon_param(input: &str, key: &str, value: &str) -> String {
    let pattern = format!(":{key}");
    let mut out = String::with_capacity(input.len());
    let mut cursor = 0;

    while let Some(rel_idx) = input[cursor..].find(&pattern) {
        let match_start = cursor + rel_idx;
        let match_end = match_start + pattern.len();
        let next_ok = input[match_end..]
            .chars()
            .next()
            .is_none_or(|ch| matches!(ch, '/' | '?' | '#'));
        if next_ok {
            out.push_str(&input[cursor..match_start]);
            out.push_str(value);
            cursor = match_end;
        } else {
            out.push_str(&input[cursor..match_end]);
            cursor = match_end;
        }
    }

    out.push_str(&input[cursor..]);
    out
}

pub fn resolve_path_variables_in_url(
    url: &str,
    path_variables: Option<&[PathVariableEntry]>,
) -> String {
    let Some(vars) = path_variables else {
        return url.to_string();
    };
    if url.is_empty() || vars.is_empty() {
        return url.to_string();
    }

    let mut resolved = url.to_string();
    for item in vars {
        if !item.enabled {
            continue;
        }
        let key = item.key.trim();
        if key.is_empty() {
            continue;
        }
        let encoded_value = if item.value.is_empty() || contains_variables(&item.value) {
            item.value.clone()
        } else {
            encode_if_needed(&item.value)
        };
        resolved = replace_colon_param(&resolved, key, &encoded_value);
        let brace_pattern = format!("{{{key}}}");
        resolved = resolved.replace(&brace_pattern, &encoded_value);
    }

    resolved
}
