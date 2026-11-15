use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

// ── Types ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MockRoute {
    pub id: String,
    pub method: String, // GET, POST, *, etc.
    pub path: String,   // e.g. /users or /users/:id
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
    pub worker_handle: Arc<Mutex<Option<JoinHandle<()>>>>,
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
            worker_handle: Arc::new(Mutex::new(None)),
        }
    }
}

fn read_http_request(socket: &mut TcpStream) -> Vec<u8> {
    let mut buf = Vec::with_capacity(4096);
    let mut chunk = [0u8; 4096];
    let max_bytes = 1024 * 1024;
    let mut content_length: Option<usize> = None;
    let mut header_end: Option<usize> = None;

    while buf.len() < max_bytes {
        match socket.read(&mut chunk) {
            Ok(0) => break,
            Ok(n) => {
                buf.extend_from_slice(&chunk[..n]);
                if header_end.is_none() {
                    if let Some(pos) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
                        let end = pos + 4;
                        header_end = Some(end);
                        let headers_str = String::from_utf8_lossy(&buf[..end]);
                        for line in headers_str.lines() {
                            if let Some((k, v)) = line.split_once(':') {
                                if k.trim().eq_ignore_ascii_case("content-length") {
                                    content_length = v.trim().parse::<usize>().ok();
                                }
                            }
                        }
                    }
                }
                if let Some(end) = header_end {
                    let expected_total = end.saturating_add(content_length.unwrap_or(0));
                    if buf.len() >= expected_total {
                        break;
                    }
                }
            }
            Err(err)
                if matches!(
                    err.kind(),
                    std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
                ) =>
            {
                break;
            }
            Err(_) => break,
        }
    }
    buf
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
    pat_segs
        .iter()
        .zip(path_segs.iter())
        .all(|(p, s)| p.starts_with(':') || *p == *s)
}

fn find_matching_route(routes: &[MockRoute], method: &str, path: &str) -> Option<MockRoute> {
    // First pass: exact method or gRPC POST matching
    for route in routes.iter().filter(|r| r.enabled) {
        let method_matches = route.method == method
            || route.method == "*"
            || (route.method.eq_ignore_ascii_case("GRPC") && (method == "POST" || method == "GRPC"));
        if method_matches && path_matches(&route.path, path) {
            return Some(route.clone());
        }
    }
    None
}

pub fn sanitize_header_value(value: &str) -> String {
    value
        .chars()
        .filter(|ch| *ch != '\r' && *ch != '\n' && !ch.is_control())
        .collect()
}

fn current_unix_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

// ── Mock Server Operations ─────────────────────────────────────────────────

pub fn start_local_mock_server(
    state: &MockServerState,
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
    *state
        .active_collection_id
        .lock()
        .map_err(|e| e.to_string())? = collection_id;
    *state.request_count.lock().map_err(|e| e.to_string())? = 0;

    let running_flag = Arc::clone(&state.running);
    let request_count = Arc::clone(&state.request_count);
    let routes = Arc::clone(&state.routes);
    let request_log = Arc::clone(&state.request_log);
    let log_id_counter = Arc::clone(&state.log_id_counter);

    let handle = std::thread::spawn(move || {
        while *running_flag.lock().unwrap_or_else(|e| e.into_inner()) {
            if let Ok((mut socket, _)) = listener.accept() {
                let _ = socket.set_read_timeout(Some(Duration::from_secs(5)));
                let req_started = Instant::now();
                let start_ms = current_unix_ms();

                // Increment request count
                let mut req_counter = request_count.lock().unwrap_or_else(|e| e.into_inner());
                *req_counter += 1;
                drop(req_counter);

                // Read HTTP request headers & declared body
                let raw_request = read_http_request(&mut socket);

                let (method, path) = parse_request_line(&raw_request)
                    .unwrap_or_else(|| ("GET".to_string(), "/".to_string()));

                // Find matching route
                let routes_guard = routes.lock().unwrap_or_else(|e| e.into_inner());
                let matched = find_matching_route(&routes_guard, &method, &path);
                drop(routes_guard);

                // Handle CORS preflight for browser/WebKit callers
                if method == "OPTIONS" && matched.is_none() {
                    let preflight = "HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: http://127.0.0.1\r\nAccess-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD, GRPC\r\nAccess-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With\r\nAccess-Control-Expose-Headers: grpc-status, grpc-message, x-grpc-web, content-type\r\nAccess-Control-Max-Age: 86400\r\nConnection: close\r\nContent-Length: 0\r\n\r\n";
                    let _ = socket.write_all(preflight.as_bytes());
                    let duration_ms = req_started.elapsed().as_millis() as u32;
                    let mut log_guard = request_log.lock().unwrap_or_else(|e| e.into_inner());
                    let mut id_guard = log_id_counter.lock().unwrap_or_else(|e| e.into_inner());
                    *id_guard += 1;
                    if log_guard.len() >= 200 {
                        log_guard.pop_front();
                    }
                    log_guard.push_back(MockRequestLog {
                        id: *id_guard,
                        timestamp: start_ms,
                        method,
                        path,
                        matched_route_id: None,
                        status_code: 204,
                        duration_ms,
                    });
                    continue;
                }

                let (status_code, body, content_type, delay_ms, matched_id, is_grpc) =
                    if let Some(route) = matched {
                        let id = route.id.clone();
                        let delay = route.delay_ms;
                        let sc = if (100..=599).contains(&route.status_code) {
                            route.status_code
                        } else {
                            500
                        };
                        let ct = sanitize_header_value(&route.content_type);
                        let b = route.response_body.clone();
                        let grpc_flag = route.method.eq_ignore_ascii_case("GRPC") || ct.contains("grpc");
                        (sc, b, ct, delay, Some(id), grpc_flag)
                    } else {
                        // Default 404 for unmatched routes
                        let body = serde_json::json!({
                            "error": "No mock route matched",
                            "method": method,
                            "path": path
                        })
                        .to_string();
                        (404u16, body, "application/json".to_string(), 0u32, None, false)
                    };

                // Apply delay
                if delay_ms > 0 {
                    std::thread::sleep(Duration::from_millis(delay_ms as u64));
                }

                let duration_ms = req_started.elapsed().as_millis() as u32;

                // Status text
                let status_text = match status_code {
                    200 => "OK",
                    201 => "Created",
                    204 => "No Content",
                    400 => "Bad Request",
                    401 => "Unauthorized",
                    403 => "Forbidden",
                    404 => "Not Found",
                    405 => "Method Not Allowed",
                    409 => "Conflict",
                    422 => "Unprocessable Entity",
                    429 => "Too Many Requests",
                    500 => "Internal Server Error",
                    502 => "Bad Gateway",
                    503 => "Service Unavailable",
                    _ => "Unknown",
                };

                let grpc_status_header = if is_grpc {
                    let grpc_code = if status_code == 200 { 0 } else if status_code == 400 { 3 } else if status_code == 404 { 5 } else { 14 };
                    format!("grpc-status: {}\r\ngrpc-message: {}\r\n", grpc_code, status_text)
                } else {
                    String::new()
                };

                let response = format!(
                    "HTTP/1.1 {} {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\nAccess-Control-Allow-Origin: http://127.0.0.1\r\nAccess-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD\r\nAccess-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With\r\nAccess-Control-Expose-Headers: grpc-status, grpc-message, x-grpc-web, content-type\r\nX-Powered-By: KobeanREST-MockServer\r\n{}\r\n{}",
                    status_code,
                    status_text,
                    content_type,
                    body.len(),
                    grpc_status_header,
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
                if log_guard.len() >= 200 {
                    log_guard.pop_front();
                }
                log_guard.push_back(entry);
            } else {
                std::thread::sleep(Duration::from_millis(20));
            }
        }
    });

    if let Ok(mut handle_guard) = state.worker_handle.lock() {
        *handle_guard = Some(handle);
    }

    Ok(actual_port)
}

pub fn stop_local_mock_server(state: &MockServerState) -> Result<(), String> {
    {
        let mut running = state.running.lock().map_err(|e| e.to_string())?;
        *running = false;
    }
    let handle = state
        .worker_handle
        .lock()
        .map_err(|e| e.to_string())?
        .take();
    if let Some(join_handle) = handle {
        let _ = join_handle.join();
    }
    Ok(())
}

pub fn get_mock_server_status(state: &MockServerState) -> Result<MockServerStatus, String> {
    let running = *state.running.lock().map_err(|e| e.to_string())?;
    let port = *state.port.lock().map_err(|e| e.to_string())?;
    let request_count = *state.request_count.lock().map_err(|e| e.to_string())?;
    let active_collection_id = state
        .active_collection_id
        .lock()
        .map_err(|e| e.to_string())?
        .clone();
    Ok(MockServerStatus {
        running,
        port,
        request_count,
        active_collection_id,
    })
}

pub fn set_mock_routes(state: &MockServerState, routes: Vec<MockRoute>) -> Result<(), String> {
    let mut routes_guard = state.routes.lock().map_err(|e| e.to_string())?;
    *routes_guard = routes;
    Ok(())
}

pub fn get_mock_routes(state: &MockServerState) -> Result<Vec<MockRoute>, String> {
    let routes_guard = state.routes.lock().map_err(|e| e.to_string())?;
    Ok(routes_guard.clone())
}

pub fn get_mock_request_log(state: &MockServerState) -> Result<Vec<MockRequestLog>, String> {
    let log_guard = state.request_log.lock().map_err(|e| e.to_string())?;
    Ok(log_guard.iter().cloned().collect())
}

pub fn clear_mock_request_log(state: &MockServerState) -> Result<(), String> {
    let mut log_guard = state.request_log.lock().map_err(|e| e.to_string())?;
    log_guard.clear();
    Ok(())
}
