pub use kobean_core::http_client::{ExecuteHttpRequest, ExecuteHttpResponse};

#[tauri::command]
pub async fn execute_http_request(
    input: ExecuteHttpRequest,
) -> Result<ExecuteHttpResponse, String> {
    kobean_core::http_client::execute_http_request(input).await
}
