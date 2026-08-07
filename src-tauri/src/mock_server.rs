use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::{Arc, Mutex};
use tauri::State;

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
}

impl Default for MockServerState {
    fn default() -> Self {
        Self {
            running: Arc::new(Mutex::new(false)),
            port: Arc::new(Mutex::new(3010)),
            request_count: Arc::new(Mutex::new(0)),
            active_collection_id: Arc::new(Mutex::new(None)),
        }
    }
}

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

    tauri::async_runtime::spawn_blocking(move || {
        while *running_flag.lock().unwrap_or_else(|e| e.into_inner()) {
            if let Ok((mut socket, _)) = listener.accept() {
                let mut req_counter = request_count.lock().unwrap_or_else(|e| e.into_inner());
                *req_counter += 1;
                drop(req_counter);

                let mut buffer = [0u8; 1024];
                let _ = socket.read(&mut buffer);
                let response_body = r#"{"mock": true, "status": "ok", "message": "KobeanREST Mock Server Response"}"#;
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                    response_body.len(),
                    response_body
                );
                let _ = socket.write_all(response.as_bytes());
            } else {
                std::thread::sleep(std::time::Duration::from_millis(50));
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

    Ok(MockServerStatus {
        running,
        port,
        request_count,
        active_collection_id,
    })
}
