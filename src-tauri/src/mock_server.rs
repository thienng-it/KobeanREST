use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::{Arc, Mutex};
use tauri::State;

// ── Types ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MockRoute {
    pub id: String,
    pub method: String,    // GET, POST, *, etc.
    pub path: String,      // e.g. /users or /users/:id
    pub status_code: u16,
    pub response_body: String,
    pub content_type: String,
    pub delay_ms: u32,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MockRequestLog {
    pub id: u64,
    pub timestamp: u64,
    pub method: String,
    pub path: String,
    pub matched_route_id: Option<String>,
    pub status_code: u16,
    pub duration_ms: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MockServerStatus {
    pub running: bool,
    pub port: u16,
    pub request_count: u32,
    pub active_collection_id: Option<String>,
}

pub struct MockServerState {
    pub running: Arc<Mutex<bool>>,
    pub port: Arc<Mutex<u16>>,
    pub request_count: Arc<Mutex<u32>>,
    pub active_collection_id: Arc<Mutex<Option<String>>>,
    pub routes: Arc<Mutex<Vec<MockRoute>>>,
    pub request_log: Arc<Mutex<VecDeque<MockRequestLog>>>,
    pub log_id_counter: Arc<Mutex<u64>>,
}

impl Default for MockServerState {
    fn default() -> Self {
        Self {
            running: Arc::new(Mutex::new(false)),
            port: Arc::new(Mutex::new(3010)),
            request_count: Arc::new(Mutex::new(0)),
            active_collection_id: Arc::new(Mutex::new(None)),
            routes: Arc::new(Mutex::new(Vec::new())),
            request_log: Arc::new(Mutex::new(VecDeque::with_capacity(200))),
            log_id_counter: Arc::new(Mutex::new(0)),
        }
    }
}

// ── HTTP Parsing Helpers ───────────────────────────────────────────────────

fn parse_request_line(buffer: &[u8]) -> Option<(String, String)> {
    let text = std::str::from_utf8(buffer).ok()?;
    let first_line = text.lines().next()?;
    let mut parts = first_line.splitn(3, ' ');
    let method = parts.next()?.to_uppercase();
    let path_full = parts.next()?;
    // Strip query string from path for matching
    let path = path_full.split('?').next().unwrap_or(path_full).to_string();
    Some((method, path))
}

/// Match a route path pattern against an incoming path.
/// Supports exact match and `:param` segments. `*` matches any path.
fn path_matches(pattern: &str, path: &str) -> bool {
    if pattern == "*" || pattern == "/*" {
        return true;
    }
    let pat_segs: Vec<&str> = pattern.trim_matches('/').split('/').collect();
    let path_segs: Vec<&str> = path.trim_matches('/').split('/').collect();
    if pat_segs.len() != path_segs.len() {
        return false;
    }
    pat_segs.iter().zip(path_segs.iter()).all(|(p, s)| {
        p.starts_with(':') || *p == *s
    })
}

fn find_matching_route(routes: &[MockRoute], method: &str, path: &str) -> Option<MockRoute> {
    // First pass: exact method match
    for route in routes.iter().filter(|r| r.enabled) {
        if (route.method == method || route.method == "*") && path_matches(&route.path, path) {
            return Some(route.clone());
        }
    }
    None
}

fn current_unix_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

// ── Tauri Commands ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn start_local_mock_server(
    state: State<'_, MockServerState>,
    port: u16,
    collection_id: Option<String>,
) -> Result<u16, String> {
    let mut running_guard = state.running.lock().map_err(|e| e.to_string())?;
    if *running_guard {
        return Ok(*state.port.lock().map_err(|e| e.to_string())?);
    }

    let target_port = if port == 0 { 3010 } else { port };
    let listener = TcpListener::bind(format!("127.0.0.1:{}", target_port))
        .map_err(|e| format!("Failed to bind mock server to port {}: {}", target_port, e))?;

    let actual_port = listener.local_addr().map_err(|e| e.to_string())?.port();
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;

    *running_guard = true;
    *state.port.lock().map_err(|e| e.to_string())? = actual_port;
    *state.active_collection_id.lock().map_err(|e| e.to_string())? = collection_id;
    *state.request_count.lock().map_err(|e| e.to_string())? = 0;

    let running_flag = Arc::clone(&state.running);
    let request_count = Arc::clone(&state.request_count);
    let routes = Arc::clone(&state.routes);
    let request_log = Arc::clone(&state.request_log);
    let log_id_counter = Arc::clone(&state.log_id_counter);

    tauri::async_runtime::spawn_blocking(move || {
        while *running_flag.lock().unwrap_or_else(|e| e.into_inner()) {
            if let Ok((mut socket, _)) = listener.accept() {
                let start_ms = current_unix_ms();

                // Increment request count
                let mut req_counter = request_count.lock().unwrap_or_else(|e| e.into_inner());
                *req_counter += 1;
                drop(req_counter);

                // Read raw request
                let mut buffer = [0u8; 4096];
                let n = socket.read(&mut buffer).unwrap_or(0);

                let (method, path) = parse_request_line(&buffer[..n])
                    .unwrap_or_else(|| ("GET".to_string(), "/".to_string()));

                // Find matching route
                let routes_guard = routes.lock().unwrap_or_else(|e| e.into_inner());
                let matched = find_matching_route(&routes_guard, &method, &path);
                drop(routes_guard);

                let (status_code, body, content_type, delay_ms, matched_id) = if let Some(route) = matched {
                    let id = route.id.clone();
                    let delay = route.delay_ms;
                    let sc = route.status_code;
                    let ct = route.content_type.clone();
                    let b = route.response_body.clone();
                    (sc, b, ct, delay, Some(id))
                } else {
                    // Default 404 for unmatched routes
                    let body = format!(
                        r#"{{"error":"No mock route matched","method":"{}","path":"{}"}}"#,
                        method, path
                    );
                    (404u16, body, "application/json".to_string(), 0u32, None)
                };

                // Apply delay
                if delay_ms > 0 {
                    std::thread::sleep(std::time::Duration::from_millis(delay_ms as u64));
                }

                let duration_ms = (current_unix_ms() - start_ms) as u32;

                // Status text
                let status_text = match status_code {
                    200 => "OK", 201 => "Created", 204 => "No Content",
                    400 => "Bad Request", 401 => "Unauthorized", 403 => "Forbidden",
                    404 => "Not Found", 405 => "Method Not Allowed", 409 => "Conflict",
                    422 => "Unprocessable Entity", 429 => "Too Many Requests",
                    500 => "Internal Server Error", 502 => "Bad Gateway", 503 => "Service Unavailable",
                    _ => "Unknown",
                };

                let response = format!(
                    "HTTP/1.1 {} {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD\r\nAccess-Control-Allow-Headers: *\r\nX-Powered-By: KobeanREST-MockServer\r\n\r\n{}",
                    status_code,
                    status_text,
                    content_type,
                    body.len(),
                    body
                );
                let _ = socket.write_all(response.as_bytes());

                // Log the request (keep last 200)
                let mut log_guard = request_log.lock().unwrap_or_else(|e| e.into_inner());
                let mut id_guard = log_id_counter.lock().unwrap_or_else(|e| e.into_inner());
                *id_guard += 1;
                let entry = MockRequestLog {
                    id: *id_guard,
                    timestamp: start_ms,
                    method,
                    path,
                    matched_route_id: matched_id,
                    status_code,
                    duration_ms,
                };
                if log_guard.len() >= 200 { log_guard.pop_front(); }
                log_guard.push_back(entry);
            } else {
                std::thread::sleep(std::time::Duration::from_millis(20));
            }
        }
    });

    Ok(actual_port)
}

#[tauri::command]
pub async fn stop_local_mock_server(
    state: State<'_, MockServerState>,
) -> Result<(), String> {
    let mut running = state.running.lock().map_err(|e| e.to_string())?;
    *running = false;
    Ok(())
}

#[tauri::command]
pub fn get_mock_server_status(
    state: State<'_, MockServerState>,
) -> Result<MockServerStatus, String> {
    let running = *state.running.lock().map_err(|e| e.to_string())?;
    let port = *state.port.lock().map_err(|e| e.to_string())?;
    let request_count = *state.request_count.lock().map_err(|e| e.to_string())?;
    let active_collection_id = state.active_collection_id.lock().map_err(|e| e.to_string())?.clone();
    Ok(MockServerStatus { running, port, request_count, active_collection_id })
}

#[tauri::command]
pub fn set_mock_routes(
    state: State<'_, MockServerState>,
    routes: Vec<MockRoute>,
) -> Result<(), String> {
    let mut routes_guard = state.routes.lock().map_err(|e| e.to_string())?;
    *routes_guard = routes;
    Ok(())
}

#[tauri::command]
pub fn get_mock_routes(
    state: State<'_, MockServerState>,
) -> Result<Vec<MockRoute>, String> {
    let routes_guard = state.routes.lock().map_err(|e| e.to_string())?;
    Ok(routes_guard.clone())
}

#[tauri::command]
pub fn get_mock_request_log(
    state: State<'_, MockServerState>,
) -> Result<Vec<MockRequestLog>, String> {
    let log_guard = state.request_log.lock().map_err(|e| e.to_string())?;
    Ok(log_guard.iter().cloned().collect())
}

#[tauri::command]
pub fn clear_mock_request_log(
    state: State<'_, MockServerState>,
) -> Result<(), String> {
    let mut log_guard = state.request_log.lock().map_err(|e| e.to_string())?;
    log_guard.clear();
    Ok(())
}
