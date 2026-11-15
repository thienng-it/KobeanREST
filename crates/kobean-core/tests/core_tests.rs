use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use kobean_core::local_only::{app_contract, local_storage_status, request_auth_modes};
use kobean_core::mcp_server::{execute_mcp_tool_call, export_mcp_manifest};
use kobean_core::mock_server::{
    clear_mock_request_log, get_mock_request_log, get_mock_routes, get_mock_server_status,
    sanitize_header_value, set_mock_routes, start_local_mock_server, stop_local_mock_server,
    MockRoute, MockServerState,
};
use kobean_core::persistence::{
    create_collection, create_folder, create_request, create_workspace, ensure_database,
    export_workspace_data, get_scripts, load_app_settings, load_workspace, open_database,
    save_app_settings, save_request, save_secret_variable, save_variable, switch_workspace,
    ExportData, HeaderEntry, REDACTED_SECRET_VALUE,
};
use kobean_core::secrets::{resolve_secrets_strict, secret_ref};
use kobean_core::spec_generator::export_openapi_30_spec;

fn temp_data_dir(label: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let dir = std::env::temp_dir().join(format!(
        "kobean_core_test_{}_{}_{}",
        label,
        std::process::id(),
        nanos
    ));
    std::fs::create_dir_all(&dir).expect("create temp dir");
    dir
}

fn free_ephemeral_port() -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind ephemeral port");
    listener.local_addr().expect("local addr").port()
}

#[test]
fn persistence_round_trip_and_secret_redaction() {
    let data_dir = temp_data_dir("persistence");

    let status = ensure_database(&data_dir).expect("ensure_database");
    assert!(status.migrated);
    assert!(status.database_path.ends_with("kobeanrest.sqlite"));

    let workspace_id =
        create_workspace(&data_dir, "Test Workspace".to_string()).expect("create_workspace");
    let switched =
        switch_workspace(&data_dir, workspace_id.clone()).expect("switch_workspace");
    assert_eq!(switched.id, workspace_id);
    assert_eq!(switched.name, "Test Workspace");

    let collection_id = create_collection(
        &data_dir,
        "Orders Collection".to_string(),
        Some(workspace_id.clone()),
    )
    .expect("create_collection");

    let folder = create_folder(
        &data_dir,
        "V1".to_string(),
        Some(collection_id.clone()),
        None,
    )
    .expect("create_folder");

    let mut req = create_request(&data_dir, folder.id.clone()).expect("create_request");
    req.name = "List Orders".to_string();
    req.method = "GET".to_string();
    req.url = "https://api.example.local/v1/orders".to_string();
    save_request(&data_dir, req.clone()).expect("save_request");

    // Seed Development environment on the newly created workspace? Or test on default workspace.
    // Switch back to default workspace ("local-workspace") where Development/Production environments exist.
    switch_workspace(&data_dir, "local-workspace".to_string()).expect("switch to default");

    save_variable(
        &data_dir,
        "Development".to_string(),
        "apiHost".to_string(),
        "https://dev.example.local".to_string(),
        Some(false),
    )
    .expect("save_variable");

    let ref_id = secret_ref("Development", "apiKey");
    save_secret_variable(
        &data_dir,
        "Development".to_string(),
        "apiKey".to_string(),
        ref_id.clone(),
    )
    .expect("save_secret_variable");

    let loaded = load_workspace(&data_dir).expect("load_workspace");
    let dev_env = loaded
        .environments
        .iter()
        .find(|e| e.name == "Development")
        .expect("Development env");
    let api_host = dev_env
        .variables
        .iter()
        .find(|v| v.key == "apiHost")
        .expect("apiHost variable");
    assert_eq!(api_host.value, "https://dev.example.local");
    assert!(!api_host.secret);

    let api_key = dev_env
        .variables
        .iter()
        .find(|v| v.key == "apiKey")
        .expect("apiKey secret variable");
    assert!(api_key.secret);
    assert_eq!(api_key.secret_ref.as_deref(), Some(ref_id.as_str()));
    assert_eq!(api_key.value, REDACTED_SECRET_VALUE);

    let exported = export_workspace_data(&data_dir).expect("export_workspace_data");
    assert!(exported.contains("List Orders"));
    assert!(exported.contains(REDACTED_SECRET_VALUE));

    let _ = std::fs::remove_dir_all(&data_dir);
}

#[test]
fn secret_ref_normalizes_scope_and_key() {
    assert_eq!(
        secret_ref("Development Env", "API Key/Token!"),
        "kobeanrest://secrets/development-env/api-key-token-"
    );
    assert_eq!(
        secret_ref("Prod_1.0", "auth.token-v2"),
        "kobeanrest://secrets/prod_1.0/auth.token-v2"
    );
}

#[test]
fn mock_server_start_status_stop_on_free_port() {
    let state = MockServerState::default();
    let initial = get_mock_server_status(&state).expect("initial status");
    assert!(!initial.running);

    let routes = vec![MockRoute {
        id: "route-1".to_string(),
        method: "GET".to_string(),
        path: "/ping".to_string(),
        status_code: 200,
        response_body: r#"{"ok":true}"#.to_string(),
        content_type: "application/json".to_string(),
        delay_ms: 0,
        enabled: true,
    }];
    set_mock_routes(&state, routes).expect("set_mock_routes");
    assert_eq!(get_mock_routes(&state).expect("get_mock_routes").len(), 1);

    let port = free_ephemeral_port();
    let bound_port =
        start_local_mock_server(&state, port, Some("col-1".to_string())).expect("start mock");
    assert_eq!(bound_port, port);

    let running_status = get_mock_server_status(&state).expect("running status");
    assert!(running_status.running);
    assert_eq!(running_status.port, port);
    assert_eq!(
        running_status.active_collection_id.as_deref(),
        Some("col-1")
    );

    clear_mock_request_log(&state).expect("clear_mock_request_log");
    assert!(get_mock_request_log(&state)
        .expect("get_mock_request_log")
        .is_empty());

    stop_local_mock_server(&state).expect("stop_local_mock_server");
    let stopped_status = get_mock_server_status(&state).expect("stopped status");
    assert!(!stopped_status.running);
}

#[test]
fn openapi_export_and_mcp_list_collections() {
    let data_dir = temp_data_dir("openapi_mcp");
    ensure_database(&data_dir).expect("ensure_database");

    let folder = create_folder(
        &data_dir,
        "Health Endpoints".to_string(),
        Some("default-collection".to_string()),
        None,
    )
    .expect("create_folder");
    let mut req = create_request(&data_dir, folder.id).expect("create_request");
    req.name = "Health Check".to_string();
    req.method = "GET".to_string();
    req.url = "https://api.example.local/health".to_string();
    save_request(&data_dir, req).expect("save_request");

    let openapi =
        export_openapi_30_spec(&data_dir, None, Some("Core Spec".to_string())).expect("openapi");
    assert_eq!(openapi.format, "json");
    assert_eq!(openapi.title, "Core Spec");
    assert!(openapi.spec_json.contains("\"openapi\": \"3.0.3\""));
    assert!(openapi.spec_json.contains("/health"));

    let manifest = export_mcp_manifest().expect("export_mcp_manifest");
    assert_eq!(manifest.server_name, "KobeanREST MCP Server");
    assert!(manifest.manifest_json.contains("list_collections"));

    let mcp_res = execute_mcp_tool_call(
        &data_dir,
        "list_collections".to_string(),
        "{}".to_string(),
    )
    .expect("execute_mcp_tool_call");
    assert_eq!(mcp_res["status"], "success");
    let cols = mcp_res["collections"].as_array().expect("collections array");
    assert!(!cols.is_empty());

    let contract = app_contract();
    assert!(contract.offline_ready);
    assert_eq!(request_auth_modes().len(), 5);
    assert_eq!(
        local_storage_status().database,
        "SQLite local application data"
    );

    let _ = std::fs::remove_dir_all(&data_dir);
}

#[test]
fn open_database_configures_wal_mode_and_busy_timeout() {
    let data_dir = temp_data_dir("wal_pragma");
    ensure_database(&data_dir).expect("ensure_database");

    let conn = open_database(&data_dir).expect("open_database");
    let journal_mode: String = conn
        .query_row("PRAGMA journal_mode;", [], |row| row.get(0))
        .expect("query journal_mode");
    assert_eq!(journal_mode.to_ascii_lowercase(), "wal");

    let busy_timeout: i64 = conn
        .query_row("PRAGMA busy_timeout;", [], |row| row.get(0))
        .expect("query busy_timeout");
    assert_eq!(busy_timeout, 5000);

    drop(conn);
    let _ = std::fs::remove_dir_all(&data_dir);
}

#[test]
fn export_workspace_data_redacts_auth_config_and_sensitive_headers_unless_disabled() {
    let data_dir = temp_data_dir("export_redaction");
    ensure_database(&data_dir).expect("ensure_database");

    let folder = create_folder(
        &data_dir,
        "Auth Folder".to_string(),
        Some("default-collection".to_string()),
        None,
    )
    .expect("create_folder");

    let mut req = create_request(&data_dir, folder.id).expect("create_request");
    req.name = "Secret Request".to_string();
    req.auth_mode = "bearer".to_string();
    req.auth_config = serde_json::json!({
        "token": "plaintext-bearer-token",
        "password": "plaintext-password",
        "keyValue": "{{apiKeyVar}}",
        "clientSecret": "kobeanrest://secrets/dev/client-secret",
        "refreshToken": "plaintext-refresh-token",
        "username": "alice"
    })
    .to_string();
    req.headers = vec![
        HeaderEntry {
            key: "Authorization".to_string(),
            value: "Bearer super-secret-jwt".to_string(),
            enabled: true,
        },
        HeaderEntry {
            key: "Cookie".to_string(),
            value: "session=secret-cookie".to_string(),
            enabled: true,
        },
        HeaderEntry {
            key: "X-Custom-Token".to_string(),
            value: "tok-123".to_string(),
            enabled: true,
        },
        HeaderEntry {
            key: "X-Api-Key".to_string(),
            value: "{{myApiKey}}".to_string(),
            enabled: true,
        },
        HeaderEntry {
            key: "X-Auth-Token".to_string(),
            value: "".to_string(),
            enabled: true,
        },
        HeaderEntry {
            key: "Content-Type".to_string(),
            value: "application/json".to_string(),
            enabled: true,
        },
    ];
    save_request(&data_dir, req.clone()).expect("save_request");

    let exported_json = export_workspace_data(&data_dir).expect("export_workspace_data");
    let exported: ExportData = serde_json::from_str(&exported_json).expect("parse ExportData");

    let exported_req = exported
        .requests
        .iter()
        .find(|r| r.id == req.id)
        .expect("exported request");
    let auth_cfg: serde_json::Value = serde_json::from_str(
        exported_req
            .auth_config
            .as_deref()
            .expect("auth_config present"),
    )
    .expect("parse auth_config");
    assert_eq!(auth_cfg["token"], REDACTED_SECRET_VALUE);
    assert_eq!(auth_cfg["password"], REDACTED_SECRET_VALUE);
    assert_eq!(auth_cfg["refreshToken"], REDACTED_SECRET_VALUE);
    assert_eq!(auth_cfg["keyValue"], "{{apiKeyVar}}");
    assert_eq!(
        auth_cfg["clientSecret"],
        "kobeanrest://secrets/dev/client-secret"
    );
    assert_eq!(auth_cfg["username"], "alice");

    let find_header = |name: &str| -> String {
        exported
            .request_headers
            .iter()
            .find(|h| h.request_id == req.id && h.header_key == name)
            .map(|h| h.header_value.clone())
            .expect("header present")
    };
    assert_eq!(find_header("Authorization"), REDACTED_SECRET_VALUE);
    assert_eq!(find_header("Cookie"), REDACTED_SECRET_VALUE);
    assert_eq!(find_header("X-Custom-Token"), REDACTED_SECRET_VALUE);
    assert_eq!(find_header("X-Api-Key"), "{{myApiKey}}");
    assert_eq!(find_header("X-Auth-Token"), "");
    assert_eq!(find_header("Content-Type"), "application/json");

    // When export_redaction_enabled is disabled in AppSettings, plaintext values are kept.
    let mut settings = load_app_settings(&data_dir).expect("load_app_settings");
    settings.export_redaction_enabled = false;
    save_app_settings(&data_dir, settings).expect("save_app_settings");

    let unredacted_json = export_workspace_data(&data_dir).expect("export unredacted");
    let unredacted: ExportData = serde_json::from_str(&unredacted_json).expect("parse unredacted");
    let unredacted_req = unredacted
        .requests
        .iter()
        .find(|r| r.id == req.id)
        .expect("unredacted request");
    let unredacted_auth: serde_json::Value =
        serde_json::from_str(unredacted_req.auth_config.as_deref().unwrap()).unwrap();
    assert_eq!(unredacted_auth["token"], "plaintext-bearer-token");
    let unredacted_auth_hdr = unredacted
        .request_headers
        .iter()
        .find(|h| h.request_id == req.id && h.header_key == "Authorization")
        .unwrap();
    assert_eq!(unredacted_auth_hdr.header_value, "Bearer super-secret-jwt");

    let _ = std::fs::remove_dir_all(&data_dir);
}

#[test]
fn mcp_server_normalizes_script_types() {
    let data_dir = temp_data_dir("mcp_scripts");
    ensure_database(&data_dir).expect("ensure_database");

    let manifest = export_mcp_manifest().expect("export_mcp_manifest");
    assert!(manifest.manifest_json.contains("pre_request"));
    assert!(manifest.manifest_json.contains("post_request"));
    assert!(manifest.manifest_json.contains("\"pre\""));
    assert!(manifest.manifest_json.contains("\"post\""));

    let save_pre = execute_mcp_tool_call(
        &data_dir,
        "save_request_script".to_string(),
        serde_json::json!({
            "entity_id": "req-1",
            "entity_type": "request",
            "script_type": "pre_request",
            "content": "console.log('pre');"
        })
        .to_string(),
    )
    .expect("save pre_request script");
    assert_eq!(save_pre["status"], "success");

    let save_post = execute_mcp_tool_call(
        &data_dir,
        "save_request_script".to_string(),
        serde_json::json!({
            "entity_id": "req-1",
            "entity_type": "request",
            "script_type": "post_request",
            "content": "console.log('post');"
        })
        .to_string(),
    )
    .expect("save post_request script");
    assert_eq!(save_post["status"], "success");

    let stored = get_scripts(&data_dir, "req-1".to_string(), "request".to_string())
        .expect("get_scripts from persistence");
    assert_eq!(stored.len(), 2);
    assert!(stored.iter().any(|s| s.script_type == "pre"));
    assert!(stored.iter().any(|s| s.script_type == "post"));

    let filtered = execute_mcp_tool_call(
        &data_dir,
        "get_scripts".to_string(),
        serde_json::json!({
            "entity_id": "req-1",
            "entity_type": "request",
            "script_type": "pre_request"
        })
        .to_string(),
    )
    .expect("mcp get_scripts filtered");
    let scripts = filtered["scripts"].as_array().expect("scripts array");
    assert_eq!(scripts.len(), 1);
    assert_eq!(scripts[0]["scriptType"], "pre");

    let invalid = execute_mcp_tool_call(
        &data_dir,
        "save_request_script".to_string(),
        serde_json::json!({
            "entity_id": "req-1",
            "entity_type": "request",
            "script_type": "invalid_phase",
            "content": ""
        })
        .to_string(),
    );
    assert!(invalid.is_err());

    let _ = std::fs::remove_dir_all(&data_dir);
}

#[test]
fn mock_server_sanitizes_crlf_headers_restricts_cors_and_json_escapes_404() {
    assert_eq!(
        sanitize_header_value("application/json\r\nX-Evil: 1\n\x07"),
        "application/jsonX-Evil: 1"
    );

    let state = MockServerState::default();
    set_mock_routes(
        &state,
        vec![MockRoute {
            id: "crlf-route".to_string(),
            method: "GET".to_string(),
            path: "/safe".to_string(),
            status_code: 200,
            response_body: r#"{"ok":true}"#.to_string(),
            content_type: "application/json\r\nX-Injected: pwned".to_string(),
            delay_ms: 0,
            enabled: true,
        }],
    )
    .expect("set_mock_routes");

    let port = free_ephemeral_port();
    start_local_mock_server(&state, port, None).expect("start mock server");

    let send_raw = |raw_req: &str| -> String {
        let mut stream = TcpStream::connect(("127.0.0.1", port)).expect("connect mock server");
        stream
            .set_read_timeout(Some(Duration::from_secs(2)))
            .expect("set_read_timeout");
        stream
            .write_all(raw_req.as_bytes())
            .expect("write raw request");
        let mut response = String::new();
        let _ = stream.read_to_string(&mut response);
        response
    };

    let matched_resp = send_raw("GET /safe HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n");
    assert!(matched_resp.starts_with("HTTP/1.1 200 OK\r\n"));
    assert!(!matched_resp.contains("\r\nX-Injected: pwned"));
    assert!(matched_resp.contains("Access-Control-Allow-Origin: http://127.0.0.1\r\n"));
    assert!(!matched_resp.contains("Access-Control-Allow-Origin: *"));
    assert!(!matched_resp.contains("Access-Control-Allow-Headers: *"));

    let unmatched_resp =
        send_raw("GET /missing\"quote\\slash HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n");
    assert!(unmatched_resp.starts_with("HTTP/1.1 404 Not Found\r\n"));
    let (_, body) = unmatched_resp
        .split_once("\r\n\r\n")
        .expect("404 response body");
    let parsed_404: serde_json::Value = serde_json::from_str(body).expect("valid escaped 404 JSON");
    assert_eq!(parsed_404["error"], "No mock route matched");
    assert_eq!(parsed_404["path"], "/missing\"quote\\slash");

    let preflight_resp = send_raw("OPTIONS /unmatched HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n");
    assert!(preflight_resp.starts_with("HTTP/1.1 204 No Content\r\n"));
    assert!(preflight_resp.contains("Access-Control-Allow-Origin: http://127.0.0.1\r\n"));
    assert!(!preflight_resp.contains("Access-Control-Allow-Origin: *"));
    assert!(!preflight_resp.contains("Access-Control-Allow-Headers: *"));

    stop_local_mock_server(&state).expect("stop mock server");
}

#[test]
fn secrets_resolve_strict_fails_closed_on_missing_ref() {
    let empty_ok = resolve_secrets_strict(vec!["".to_string()]).expect("empty ref ignored");
    assert!(empty_ok.is_empty());

    let missing = resolve_secrets_strict(vec![
        "kobeanrest://secrets/nonexistent-test-scope/nonexistent-key-99999".to_string(),
    ]);
    assert!(missing.is_err());
}

#[test]
fn persistence_seeded_requests_match_seeded_folders_and_scopes_history_to_active_workspace() {
    let dir = temp_data_dir("seeded_and_active_ws");
    kobean_core::persistence::ensure_database(&dir).expect("ensure_database");

    let ws = kobean_core::persistence::load_workspace(&dir).expect("load_workspace");
    let folder_ids: std::collections::HashSet<&str> =
        ws.folders.iter().map(|f| f.id.as_str()).collect();
    for req in &ws.requests {
        assert!(
            folder_ids.contains(req.folder_id.as_str()),
            "seeded request '{}' references missing folder '{}'",
            req.name,
            req.folder_id
        );
    }

    // Create and switch to a second workspace, verify history follows active workspace
    let ws2_id =
        kobean_core::persistence::create_workspace(&dir, "Second".to_string()).expect("ws2");
    kobean_core::persistence::switch_workspace(&dir, ws2_id.clone()).expect("switch ws2");
    kobean_core::persistence::record_request_history(
        &dir,
        kobean_core::persistence::RequestHistoryEntry {
            request_id: "req-ws2".to_string(),
            workspace_id: None,
            method: "GET".to_string(),
            url: "https://example.com/ws2".to_string(),
            status: 200,
            duration_ms: 10,
            size_bytes: 2,
            response_headers: None,
            response_body_text: Some("ok".to_string()),
            response_body_base64: None,
            run_id: None,
            scope_id: None,
            scope_name: None,
            test_passed: None,
            passed_tests: None,
            failed_tests: None,
            test_results: None,
        },
    )
    .expect("record history in ws2");

    let ws2_history =
        kobean_core::persistence::load_request_history(&dir).expect("load ws2 history");
    assert_eq!(ws2_history.len(), 1);
    assert_eq!(ws2_history[0].request_id, "req-ws2");

    // Switching back to ws1 should NOT show ws2 history
    kobean_core::persistence::switch_workspace(&dir, ws.id.clone()).expect("switch ws1");
    let ws1_history =
        kobean_core::persistence::load_request_history(&dir).expect("load ws1 history");
    assert!(ws1_history.is_empty());
}

#[test]
fn persistence_enables_foreign_keys_delete_folder_cascades_and_move_rejects_cycles() {
    let dir = temp_data_dir("fk_and_folder_cycles");
    kobean_core::persistence::ensure_database(&dir).expect("ensure_database");

    let conn = kobean_core::persistence::open_database(&dir).expect("open_database");
    let fk_enabled: i64 = conn
        .query_row("PRAGMA foreign_keys;", [], |r| r.get(0))
        .expect("query PRAGMA foreign_keys");
    assert_eq!(fk_enabled, 1);
    drop(conn);

    let ws = kobean_core::persistence::load_workspace(&dir).expect("load_workspace");
    let col_id = ws.collections.as_ref().unwrap()[0].id.clone();

    let parent = kobean_core::persistence::create_folder(
        &dir,
        "Parent".to_string(),
        Some(col_id.clone()),
        None,
    )
    .expect("parent folder");
    let child = kobean_core::persistence::create_folder(
        &dir,
        "Child".to_string(),
        Some(col_id.clone()),
        Some(parent.id.clone()),
    )
    .expect("child folder");

    // Multi-hop cycle (moving Parent into Child) must fail
    let cycle_err = kobean_core::persistence::move_folder(
        &dir,
        parent.id.clone(),
        Some(child.id.clone()),
        Some(col_id.clone()),
    )
    .expect_err("multi-hop cycle move should fail");
    assert!(cycle_err.to_lowercase().contains("cycle") || cycle_err.to_lowercase().contains("descendant"));

    // Deleting Parent must recursively delete Child + nested requests + scripts
    let nested_req = kobean_core::persistence::create_request(&dir, child.id.clone()).expect("req");
    kobean_core::persistence::save_script(
        &dir,
        nested_req.id.clone(),
        "request".to_string(),
        "pre".to_string(),
        "console.log(1);".to_string(),
    )
    .expect("save script");
    kobean_core::persistence::delete_folder(&dir, parent.id.clone()).expect("delete parent");

    let after = kobean_core::persistence::load_workspace(&dir).expect("reload");
    assert!(!after.folders.iter().any(|f| f.id == child.id));
    assert!(!after.requests.iter().any(|r| r.id == nested_req.id));
    let scripts =
        kobean_core::persistence::get_scripts(&dir, nested_req.id, "request".to_string())
            .expect("scripts");
    assert!(scripts.is_empty());
}
