use std::time::{Duration, Instant};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use reqwest::{header::HeaderMap, Method};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct HeaderEntry {
    pub key: String,
    pub value: String,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteHttpRequest {
    pub method: String,
    pub url: String,
    #[serde(default)]
    pub headers: Vec<HeaderEntry>,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default = "default_timeout_ms")]
    pub timeout_ms: u64,
    #[serde(default = "default_follow_redirects")]
    pub follow_redirects: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteHttpResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: Vec<HeaderEntry>,
    pub body_text: Option<String>,
    pub body_base64: Option<String>,
    pub duration_ms: u128,
    pub size_bytes: usize,
    pub content_type: Option<String>,
}

fn default_enabled() -> bool {
    true
}

fn default_timeout_ms() -> u64 {
    30_000
}

fn default_follow_redirects() -> bool {
    true
}

fn build_client(input: &ExecuteHttpRequest) -> Result<reqwest::Client, String> {
    let redirect_policy = if input.follow_redirects {
        reqwest::redirect::Policy::limited(10)
    } else {
        reqwest::redirect::Policy::none()
    };

    reqwest::Client::builder()
        .redirect(redirect_policy)
        .timeout(Duration::from_millis(input.timeout_ms.max(1)))
        .build()
        .map_err(|error| format!("failed to build HTTP client: {error}"))
}

fn response_headers(headers: &HeaderMap) -> Vec<HeaderEntry> {
    headers
        .iter()
        .map(|(key, value)| HeaderEntry {
            key: key.to_string(),
            value: value.to_str().unwrap_or("<binary header>").to_string(),
            enabled: true,
        })
        .collect()
}

fn is_text_response(content_type: Option<&str>) -> bool {
    match content_type {
        Some(value) => {
            let normalized = value.to_ascii_lowercase();
            normalized.starts_with("text/")
                || normalized.contains("json")
                || normalized.contains("xml")
                || normalized.contains("javascript")
                || normalized.contains("x-www-form-urlencoded")
        }
        None => true,
    }
}

#[tauri::command]
pub async fn execute_http_request(
    input: ExecuteHttpRequest,
) -> Result<ExecuteHttpResponse, String> {
    let method = Method::from_bytes(input.method.as_bytes())
        .map_err(|error| format!("invalid HTTP method '{}': {error}", input.method))?;
    let client = build_client(&input)?;
    let mut request = client.request(method, &input.url);

    for header in input.headers.iter().filter(|header| header.enabled) {
        if header.key.trim().is_empty() {
            continue;
        }
        request = request.header(header.key.trim(), header.value.as_str());
    }

    if let Some(body) = input.body.as_ref().filter(|body| !body.is_empty()) {
        request = request.body(body.clone());
    }

    let started = Instant::now();
    let response = request
        .send()
        .await
        .map_err(|error| format!("request failed: {error}"))?;
    let status = response.status();
    let headers = response_headers(response.headers());
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(ToOwned::to_owned);
    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("failed to read response body: {error}"))?;
    let size_bytes = bytes.len();
    let duration_ms = started.elapsed().as_millis();

    let (body_text, body_base64) = if is_text_response(content_type.as_deref()) {
        match String::from_utf8(bytes.to_vec()) {
            Ok(text) => (Some(text), None),
            Err(_) => (None, Some(BASE64.encode(&bytes))),
        }
    } else {
        (None, Some(BASE64.encode(&bytes)))
    };

    Ok(ExecuteHttpResponse {
        status: status.as_u16(),
        status_text: status.canonical_reason().unwrap_or("Unknown").to_string(),
        headers,
        body_text,
        body_base64,
        duration_ms,
        size_bytes,
        content_type,
    })
}
