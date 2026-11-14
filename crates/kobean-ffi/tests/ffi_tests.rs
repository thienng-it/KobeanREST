use std::fs;
use std::net::TcpListener;
use std::path::PathBuf;

use kobean_ffi::*;

fn temp_data_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "kobean_ffi_test_{}_{}_{}",
        name,
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn free_ephemeral_port() -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    listener.local_addr().unwrap().port()
}

#[test]
fn app_contract_and_local_status_match_core() {
    let contract = ffi_app_contract();
    assert!(contract.offline_ready);
    assert_eq!(contract.launch_model, "download, launch, use");

    let status = ffi_local_storage_status();
    assert!(!status.database.is_empty());
    assert!(!status.secret_storage.is_empty());

    let modes = ffi_request_auth_modes();
    assert!(modes.contains(&"Bearer Token".to_string()));
    assert!(modes.contains(&"OAuth 2.0".to_string()));

    let r = secret_ref("Env Dev".to_string(), "API_KEY".to_string());
    assert_eq!(r, "kobeanrest://secrets/env-dev/api_key");
}

#[test]
fn persistence_workspace_and_entities_roundtrip() {
    let dir = temp_data_dir("persistence");
    let data_dir = dir.to_string_lossy().to_string();

    let status = ffi_initialize_persistence(data_dir.clone()).unwrap();
    assert!(status.migrated);
    assert!(status.database_path.ends_with("kobeanrest.sqlite"));

    let ws_json = load_workspace_json(data_dir.clone()).unwrap();
    let ws: serde_json::Value = serde_json::from_str(&ws_json).unwrap();
    assert!(ws["id"].is_string());
    assert!(ws["environments"].is_array());

    // Create second workspace and switch
    let ws2_id = create_workspace(data_dir.clone(), "Second Workspace".to_string()).unwrap();
    rename_workspace(data_dir.clone(), ws2_id.clone(), "Renamed Workspace".to_string()).unwrap();
    let list_json = list_workspaces_json(data_dir.clone()).unwrap();
    let list: serde_json::Value = serde_json::from_str(&list_json).unwrap();
    assert!(list
        .as_array()
        .unwrap()
        .iter()
        .any(|w| w["id"] == ws2_id && w["name"] == "Renamed Workspace"));

    let switched_json = switch_workspace_json(data_dir.clone(), ws2_id.clone()).unwrap();
    let switched: serde_json::Value = serde_json::from_str(&switched_json).unwrap();
    assert_eq!(switched["id"], ws2_id);

    // Collection, folder, request
    let col_id = create_collection(data_dir.clone(), "Users API".to_string(), Some(ws2_id.clone())).unwrap();
    update_collection(data_dir.clone(), col_id.clone(), "Users API v2".to_string()).unwrap();
    save_collection_auth(
        data_dir.clone(),
        col_id.clone(),
        "Bearer Token".to_string(),
        r#"{"token":"abc"}"#.to_string(),
    )
    .unwrap();
    save_collection_description(data_dir.clone(), col_id.clone(), "Collection docs".to_string())
        .unwrap();

    let folder_json = create_folder(
        data_dir.clone(),
        "Auth".to_string(),
        Some(col_id.clone()),
        None,
    )
    .unwrap();
    let folder: serde_json::Value = serde_json::from_str(&folder_json).unwrap();
    let folder_id = folder["id"].as_str().unwrap().to_string();
    update_folder(data_dir.clone(), folder_id.clone(), "Authentication".to_string()).unwrap();

    let req_json = create_request(data_dir.clone(), folder_id.clone()).unwrap();
    let mut req: serde_json::Value = serde_json::from_str(&req_json).unwrap();
    req["name"] = serde_json::json!("Login");
    req["method"] = serde_json::json!("POST");
    req["url"] = serde_json::json!("https://example.com/login");
    save_request_json(data_dir.clone(), serde_json::to_string(&req).unwrap()).unwrap();

    // Scoped variables & scripts
    save_scoped_variable(
        data_dir.clone(),
        col_id.clone(),
        "collection".to_string(),
        "baseUrl".to_string(),
        "https://example.com".to_string(),
    )
    .unwrap();
    let scoped_json = get_scoped_variables_json(data_dir.clone(), col_id.clone(), "collection".to_string()).unwrap();
    assert!(scoped_json.contains("baseUrl"));

    save_script(
        data_dir.clone(),
        req["id"].as_str().unwrap().to_string(),
        "request".to_string(),
        "pre_request".to_string(),
        "console.log('hi');".to_string(),
    )
    .unwrap();
    let all_scripts = get_all_scripts_json(data_dir.clone()).unwrap();
    assert!(all_scripts.contains("console.log('hi');"));

    // Environment & variables
    let env_json = create_environment(data_dir.clone(), "Staging".to_string()).unwrap();
    assert!(env_json.contains("Staging"));
    set_active_environment(data_dir.clone(), "Staging".to_string()).unwrap();
    save_variable(
        data_dir.clone(),
        "Staging".to_string(),
        "TOKEN".to_string(),
        "123".to_string(),
        Some(false),
    )
    .unwrap();
    delete_variable(data_dir.clone(), "Staging".to_string(), "TOKEN".to_string()).unwrap();
    rename_environment(data_dir.clone(), "Staging".to_string(), "QA".to_string()).unwrap();
    delete_environment(data_dir.clone(), "QA".to_string()).unwrap();

    // App settings
    let settings_json = load_app_settings_json(data_dir.clone()).unwrap();
    let mut settings: serde_json::Value = serde_json::from_str(&settings_json).unwrap();
    settings["theme"] = serde_json::json!("dark");
    save_app_settings_json(data_dir.clone(), serde_json::to_string(&settings).unwrap()).unwrap();
    let reloaded_settings = load_app_settings_json(data_dir.clone()).unwrap();
    assert!(reloaded_settings.contains("\"dark\""));

    // OpenAPI & MCP
    let openapi = export_openapi_30_spec_json(data_dir.clone(), Some(col_id.clone()), None).unwrap();
    assert!(openapi.contains("Users API v2"));
    let manifest = export_mcp_manifest_json().unwrap();
    assert!(manifest.contains("KobeanREST MCP Server"));
    let mcp_res = execute_mcp_tool_call_json(
        data_dir.clone(),
        "list_workspaces".to_string(),
        "{}".to_string(),
    )
    .unwrap();
    assert!(mcp_res.contains("Renamed Workspace"));

    // Export / Import
    let exported = export_workspace_data(data_dir.clone()).unwrap();
    assert!(exported.contains("Renamed Workspace"));

    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn mock_server_and_http_client_roundtrip() {
    let server = FfiMockServer::new();
    let port = free_ephemeral_port();
    let bound_port = server.start(port, Some("col-1".to_string())).unwrap();
    assert_eq!(bound_port, port);

    let routes = serde_json::json!([
        {
            "id": "route-1",
            "method": "GET",
            "path": "/hello",
            "status_code": 200,
            "response_body": "{\"ok\":true}",
            "content_type": "application/json",
            "delay_ms": 0,
            "enabled": true
        }
    ]);
    server.set_routes_json(routes.to_string()).unwrap();
    let stored_routes = server.get_routes_json().unwrap();
    assert!(stored_routes.contains("/hello"));

    let req = serde_json::json!({
        "method": "GET",
        "url": format!("http://127.0.0.1:{bound_port}/hello"),
        "headers": [],
        "timeoutMs": 5000,
        "followRedirects": true
    });
    let resp_json = execute_http_request_json(req.to_string()).unwrap();
    let resp: serde_json::Value = serde_json::from_str(&resp_json).unwrap();
    assert_eq!(resp["status"], 200);
    assert_eq!(resp["bodyText"], "{\"ok\":true}");

    let status_json = server.status_json().unwrap();
    let status: serde_json::Value = serde_json::from_str(&status_json).unwrap();
    assert_eq!(status["running"], true);
    assert_eq!(status["request_count"], 1);

    let log_json = server.get_request_log_json().unwrap();
    assert!(log_json.contains("/hello"));
    server.clear_request_log().unwrap();
    let cleared = server.get_request_log_json().unwrap();
    assert_eq!(cleared, "[]");

    server.stop().unwrap();
}

#[test]
fn domain_request_prep_and_scoped_variables_roundtrip() {
    let dir = temp_data_dir("domain_prep");
    let data_dir = dir.to_string_lossy().to_string();
    ffi_initialize_persistence(data_dir.clone()).unwrap();

    let ws_json = load_workspace_json(data_dir.clone()).unwrap();
    let ws: serde_json::Value = serde_json::from_str(&ws_json).unwrap();
    let active_env = ws["activeEnvironment"].as_str().unwrap().to_string();
    save_variable(
        data_dir.clone(),
        active_env,
        "baseUrl".to_string(),
        "https://api.example.com".to_string(),
        None,
    )
    .unwrap();

    let col_id = create_collection(data_dir.clone(), "Users".to_string(), None).unwrap();
    save_scoped_variable(
        data_dir.clone(),
        col_id.clone(),
        "collection".to_string(),
        "version".to_string(),
        "v2".to_string(),
    )
    .unwrap();
    let folder_json = create_folder(data_dir.clone(), "V2".to_string(), Some(col_id.clone()), None).unwrap();
    let folder: serde_json::Value = serde_json::from_str(&folder_json).unwrap();
    let folder_id = folder["id"].as_str().unwrap().to_string();

    let req_json = create_request(data_dir.clone(), folder_id.clone()).unwrap();
    let mut req: serde_json::Value = serde_json::from_str(&req_json).unwrap();
    req["method"] = serde_json::json!("GET");
    req["url"] = serde_json::json!("{{baseUrl}}/{{version}}/users/:userId");
    req["authMode"] = serde_json::json!("bearer");
    req["authConfig"] = serde_json::json!(r#"{"token":"secret-tok"}"#);
    req["pathVariables"] = serde_json::json!([
        { "key": "userId", "value": "42", "enabled": true }
    ]);
    let updated_req_json = serde_json::to_string(&req).unwrap();
    save_request_json(data_dir.clone(), updated_req_json.clone()).unwrap();

    let reloaded_ws_json = load_workspace_json(data_dir.clone()).unwrap();
    let var_map_json = build_scoped_variable_map_json(
        reloaded_ws_json.clone(),
        Some(col_id),
        Some(folder_id),
        req["id"].as_str().map(str::to_string),
        Some(updated_req_json.clone()),
    )
    .unwrap();
    let var_map: serde_json::Value = serde_json::from_str(&var_map_json).unwrap();
    assert_eq!(var_map["baseUrl"], "https://api.example.com");
    assert_eq!(var_map["version"], "v2");

    let prepared_json = prepare_http_request_json(
        updated_req_json,
        reloaded_ws_json,
        var_map_json,
        None,
    )
    .unwrap();
    let prepared: serde_json::Value = serde_json::from_str(&prepared_json).unwrap();
    assert_eq!(prepared["url"], "https://api.example.com/v2/users/42");
    assert_eq!(prepared["method"], "GET");
    let headers = prepared["headers"].as_array().unwrap();
    assert!(headers
        .iter()
        .any(|h| h["key"] == "Authorization" && h["value"] == "Bearer secret-tok"));

    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn domain_path_vars_importer_and_auth_redaction() {
    // Path variables
    let keys = extract_path_variables("https://api.example.com/orgs/:orgId/repos/:repoId".to_string());
    assert_eq!(keys, vec!["orgId", "repoId"]);

    let synced_json = sync_path_variables_json(
        "https://api.example.com/orgs/:orgId/repos/:repoId".to_string(),
        Some(r#"[{"key":"orgId","value":"acme","enabled":true}]"#.to_string()),
    )
    .unwrap();
    let synced: serde_json::Value = serde_json::from_str(&synced_json).unwrap();
    let arr = synced.as_array().unwrap();
    assert_eq!(arr.len(), 2);
    assert_eq!(arr[0]["key"], "orgId");
    assert_eq!(arr[0]["value"], "acme");
    assert_eq!(arr[1]["key"], "repoId");

    // Importer
    let curl = "curl -X POST https://api.example.com/items -H 'Content-Type: application/json' -d '{\"a\":1}'";
    assert_eq!(detect_import_format(curl.to_string()), "curl");

    let parsed_curl_json = parse_curl_command_json(curl.to_string()).unwrap();
    let parsed_curl: serde_json::Value = serde_json::from_str(&parsed_curl_json).unwrap();
    assert_eq!(parsed_curl["method"], "POST");
    assert_eq!(parsed_curl["url"], "https://api.example.com/items");

    let universal_json = parse_universal_import_json(curl.to_string(), Some("My WS".to_string())).unwrap();
    let universal: serde_json::Value = serde_json::from_str(&universal_json).unwrap();
    assert_eq!(universal["format"], "curl");
    assert_eq!(universal["exportData"]["workspaces"][0]["name"], "My WS");

    // Auth redaction
    let redacted_url = redact_auth_from_url(
        "https://api.example.com/data?api_key=supersecret&page=1".to_string(),
        "apiKey".to_string(),
        r#"{"keyName":"api_key","placement":"query"}"#.to_string(),
    )
    .unwrap();
    assert_eq!(
        redacted_url,
        "https://api.example.com/data?api_key=[redacted]&page=1"
    );

    let redacted_headers_json = redact_auth_headers_json(
        r#"[{"key":"Authorization","value":"Bearer topsecret","enabled":true},{"key":"X-Api-Key","value":"abc","enabled":true},{"key":"Accept","value":"application/json","enabled":true}]"#.to_string(),
        "apiKey".to_string(),
        r#"{"keyName":"X-Api-Key","placement":"header"}"#.to_string(),
    )
    .unwrap();
    let redacted_headers: serde_json::Value = serde_json::from_str(&redacted_headers_json).unwrap();
    assert_eq!(redacted_headers[0]["value"], "[redacted]");
    assert_eq!(redacted_headers[1]["value"], "[redacted]");
    assert_eq!(redacted_headers[2]["value"], "application/json");
}
