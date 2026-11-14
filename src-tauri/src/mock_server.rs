use tauri::State;

pub use kobean_core::mock_server::{MockRequestLog, MockRoute, MockServerState, MockServerStatus};

#[tauri::command]
pub async fn start_local_mock_server(
    state: State<'_, MockServerState>,
    port: u16,
    collection_id: Option<String>,
) -> Result<u16, String> {
    kobean_core::mock_server::start_local_mock_server(&state, port, collection_id)
}

#[tauri::command]
pub async fn stop_local_mock_server(state: State<'_, MockServerState>) -> Result<(), String> {
    kobean_core::mock_server::stop_local_mock_server(&state)
}

#[tauri::command]
pub fn get_mock_server_status(
    state: State<'_, MockServerState>,
) -> Result<MockServerStatus, String> {
    kobean_core::mock_server::get_mock_server_status(&state)
}

#[tauri::command]
pub fn set_mock_routes(
    state: State<'_, MockServerState>,
    routes: Vec<MockRoute>,
) -> Result<(), String> {
    kobean_core::mock_server::set_mock_routes(&state, routes)
}

#[tauri::command]
pub fn get_mock_routes(state: State<'_, MockServerState>) -> Result<Vec<MockRoute>, String> {
    kobean_core::mock_server::get_mock_routes(&state)
}

#[tauri::command]
pub fn get_mock_request_log(
    state: State<'_, MockServerState>,
) -> Result<Vec<MockRequestLog>, String> {
    kobean_core::mock_server::get_mock_request_log(&state)
}

#[tauri::command]
pub fn clear_mock_request_log(state: State<'_, MockServerState>) -> Result<(), String> {
    kobean_core::mock_server::clear_mock_request_log(&state)
}
