use std::collections::HashMap;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use kobean_core::domain::auth::{
    apply_auth, get_effective_auth, redact_auth_from_url, redact_auth_headers, resolve_auth_config,
    AuthConfig,
};
use kobean_core::domain::importer::{
    detect_import_format, parse_curl_command, parse_postman_collection, parse_postman_environment,
    parse_universal_import, ImportFormatType,
};
use kobean_core::domain::path_variables::{
    extract_path_variables_from_url, has_path_variables_in_url, resolve_path_variables_in_url,
    sync_path_variables_with_url,
};
use kobean_core::domain::request_prep::{prepare_http_request, PrepareRequestError};
use kobean_core::domain::variables::{
    build_scoped_variable_map, detect_variables, encode_query_params_in_resolved_url,
    is_sensitive_key, resolve_request_fields, resolve_request_fields_safe, resolve_string,
    resolve_string_safe, VariableScope, DYNAMIC_VARIABLES,
};
use kobean_core::http_client::{append_bounded_chunk, MAX_RESPONSE_BODY_BYTES};
use kobean_core::persistence::{
    ensure_database, import_workspace_data, list_workspaces, load_workspace, switch_workspace,
    CollectionSummary, EnvironmentSummary, EnvironmentVariable, FolderSummary, HeaderEntry,
    PathVariableEntry, SavedRequest, ScopedVariable, WorkspaceSummary,
};

fn temp_data_dir(label: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let dir = std::env::temp_dir().join(format!(
        "kobean_domain_test_{}_{}_{}",
        label,
        std::process::id(),
        nanos
    ));
    std::fs::create_dir_all(&dir).expect("create temp dir");
    dir
}

fn sample_request(id: &str, folder_id: &str) -> SavedRequest {
    SavedRequest {
        id: id.to_string(),
        name: "Sample".to_string(),
        method: "GET".to_string(),
        url: "https://api.example.com".to_string(),
        folder_id: folder_id.to_string(),
        auth_mode: "none".to_string(),
        auth_config: "{}".to_string(),
        headers: vec![],
        query_params: "[]".to_string(),
        body: String::new(),
        body_mime_type: "application/json".to_string(),
        body_form: "[]".to_string(),
        timeout_ms: 30_000,
        follow_redirects: true,
        variables: None,
        description: None,
        examples: None,
        path_variables: None,
    }
}

fn sample_workspace() -> WorkspaceSummary {
    WorkspaceSummary {
        id: "ws-1".to_string(),
        name: "Test Workspace".to_string(),
        active_environment: "Dev".to_string(),
        environments: vec![EnvironmentSummary {
            name: "Dev".to_string(),
            variables: vec![
                EnvironmentVariable {
                    key: "baseUrl".to_string(),
                    value: "https://dev.example.com".to_string(),
                    secret: false,
                    secret_ref: None,
                    masked: false,
                },
                EnvironmentVariable {
                    key: "sharedVar".to_string(),
                    value: "from-env".to_string(),
                    secret: false,
                    secret_ref: None,
                    masked: false,
                },
                EnvironmentVariable {
                    key: "apiSecret".to_string(),
                    value: "[secret stored outside SQLite]".to_string(),
                    secret: true,
                    secret_ref: Some("kobeanrest://secrets/dev/apisecret".to_string()),
                    masked: true,
                },
                EnvironmentVariable {
                    key: "refOnlySecret".to_string(),
                    value: "[secret stored outside SQLite]".to_string(),
                    secret: false,
                    secret_ref: Some("kobeanrest://secrets/dev/refonly".to_string()),
                    masked: false,
                },
            ],
        }],
        collections: Some(vec![CollectionSummary {
            id: "col-1".to_string(),
            name: "Main Collection".to_string(),
            auth_mode: Some("bearer".to_string()),
            auth_config: Some(r#"{"token":"col-token"}"#.to_string()),
            variables: Some(vec![
                ScopedVariable {
                    key: "sharedVar".to_string(),
                    value: "from-collection".to_string(),
                    secret: false,
                    secret_ref: None,
                },
                ScopedVariable {
                    key: "colOnly".to_string(),
                    value: "col-val".to_string(),
                    secret: false,
                    secret_ref: None,
                },
            ]),
            default_environment: None,
            description: None,
        }]),
        folders: vec![
            FolderSummary {
                id: "folder-root".to_string(),
                name: "Root Folder".to_string(),
                auth_mode: Some("none".to_string()),
                auth_config: None,
                collection_id: Some("col-1".to_string()),
                parent_id: None,
                variables: Some(vec![ScopedVariable {
                    key: "sharedVar".to_string(),
                    value: "from-root-folder".to_string(),
                    secret: false,
                    secret_ref: None,
                }]),
                description: None,
            },
            FolderSummary {
                id: "folder-child".to_string(),
                name: "Child Folder".to_string(),
                auth_mode: Some("apiKey".to_string()),
                auth_config: Some(
                    r#"{"keyName":"X-Folder-Key","keyValue":"{{colOnly}}-secret","placement":"header"}"#
                        .to_string(),
                ),
                collection_id: Some("col-1".to_string()),
                parent_id: Some("folder-root".to_string()),
                variables: Some(vec![ScopedVariable {
                    key: "sharedVar".to_string(),
                    value: "from-child-folder".to_string(),
                    secret: false,
                    secret_ref: None,
                }]),
                description: None,
            },
        ],
        requests: vec![],
    }
}

// ---------------------------------------------------------------------------
// Path variables tests (exact parity with tests/path-variables-contract.test.mjs)
// ---------------------------------------------------------------------------

#[test]
fn path_variables_extract_contract_fixtures() {
    assert_eq!(
        extract_path_variables_from_url("https://api.example.com/users/:userId/posts/:postId?query=1"),
        vec!["userId", "postId"]
    );
    assert_eq!(
        extract_path_variables_from_url("https://api.example.com/orgs/{orgId}/teams/{teamId}#hash"),
        vec!["orgId", "teamId"]
    );
    assert_eq!(
        extract_path_variables_from_url("{{baseUrl}}/v1/users/:id/details"),
        vec!["id"]
    );
    assert_eq!(
        extract_path_variables_from_url("http://localhost:8080/items/:itemId?filter=:notAPathVar"),
        vec!["itemId"]
    );
    assert!(has_path_variables_in_url("https://example.com/:id"));
    assert!(!has_path_variables_in_url("https://localhost:8080/items?a=:b"));
}

#[test]
fn path_variables_resolve_combined_and_sync_preserves_values() {
    let url = "https://api.example.com/users/:userId/orders/{orderId}?status=active";
    let vars = vec![
        PathVariableEntry {
            key: "userId".to_string(),
            value: "42".to_string(),
            enabled: true,
            description: None,
        },
        PathVariableEntry {
            key: "orderId".to_string(),
            value: "order-999".to_string(),
            enabled: true,
            description: None,
        },
    ];
    assert_eq!(
        resolve_path_variables_in_url(url, Some(&vars)),
        "https://api.example.com/users/42/orders/order-999?status=active"
    );

    // Must not partially replace :userId inside :userIdExtra
    let prefix_url = "https://api.example.com/users/:userIdExtra/:userId";
    assert_eq!(
        resolve_path_variables_in_url(prefix_url, Some(&vars[..1])),
        "https://api.example.com/users/:userIdExtra/42"
    );

    let old_vars = vec![PathVariableEntry {
        key: "userId".to_string(),
        value: "100".to_string(),
        enabled: true,
        description: Some("User identifier".to_string()),
    }];
    let synced = sync_path_variables_with_url(
        "https://api.example.com/users/:userId/posts/:postId",
        Some(&old_vars),
    );
    assert_eq!(synced.len(), 2);
    assert_eq!(synced[0].key, "userId");
    assert_eq!(synced[0].value, "100");
    assert!(synced[0].enabled);
    assert_eq!(synced[0].description.as_deref(), Some("User identifier"));
    assert_eq!(synced[1].key, "postId");
    assert_eq!(synced[1].value, "");
    assert!(synced[1].enabled);
}

// ---------------------------------------------------------------------------
// Variables tests
// ---------------------------------------------------------------------------

#[test]
fn variables_sensitive_keys_and_detection() {
    assert!(is_sensitive_key("db_PASSWORD"));
    assert!(is_sensitive_key("api_key"));
    assert!(is_sensitive_key("api-key"));
    assert!(is_sensitive_key("api.key"));
    assert!(is_sensitive_key("apikey"));
    assert!(is_sensitive_key("clientSecret"));
    assert!(is_sensitive_key("client-secret"));
    assert!(is_sensitive_key("private_key"));
    assert!(is_sensitive_key("access.key"));
    assert!(is_sensitive_key("jwtToken"));
    assert!(is_sensitive_key("sslCert"));
    assert!(!is_sensitive_key("baseUrl"));
    assert!(!is_sensitive_key("pageSize"));

    assert_eq!(
        detect_variables("{{ baseUrl }}/users/{{userId}}/{{ baseUrl }}/{{   }}"),
        vec!["baseUrl", "userId"]
    );
}

#[test]
fn variables_dynamic_and_precedence_and_unresolved() {
    let mut map = HashMap::new();
    map.insert("baseUrl".to_string(), "https://api.example.com".to_string());
    // Override a dynamic variable to test exact precedence
    map.insert("$date".to_string(), "1999-12-31".to_string());

    // Exact match, case-insensitive match, dynamic match
    let res = resolve_string(
        "{{BASEURL}}/{{$guid}}/{{$randomInt}}/{{$randomString}}/{{$date}}/{{$isoTimestamp}}/{{$timestamp}}/{{$timestampMs}}",
        &map,
    )
    .expect("resolve_string");

    assert!(res.resolved.starts_with("https://api.example.com/"));
    let tail = &res.resolved["https://api.example.com/".len()..];
    let parts: Vec<&str> = tail.split('/').collect();
    assert_eq!(parts[0].len(), 36);
    assert!(parts[1].parse::<u32>().expect("randomInt") < 1000);
    assert_eq!(parts[2].len(), 8);
    assert!(parts[2].chars().all(|c| c.is_ascii_alphanumeric()));
    assert_eq!(parts[3], "1999-12-31");
    assert!(parts[4].ends_with('Z') && parts[4].contains('T'));
    assert!(parts[5].parse::<u64>().is_ok());
    assert!(parts[6].parse::<u64>().is_ok());
    assert!(DYNAMIC_VARIABLES.len() >= 10);

    // Unresolved variable error
    let err = resolve_string("{{baseUrl}}/{{missingOne}}/{{missingTwo}}", &map)
        .expect_err("should fail on unresolved");
    assert_eq!(err.unresolved_names, vec!["missingOne", "missingTwo"]);

    // Safe keeps unresolved intact
    assert_eq!(
        resolve_string_safe("{{baseUrl}}/{{missing}}", &map),
        "https://api.example.com/{{missing}}"
    );
}

#[test]
fn variables_query_encoding_preserves_encoded_and_fixes_malformed_percent() {
    assert_eq!(
        encode_query_params_in_resolved_url("https://example.com/search?q=hello%20world&pct=100%"),
        "https://example.com/search?q=hello%20world&pct=100%25"
    );
    assert_eq!(
        encode_query_params_in_resolved_url("https://example.com/search?email=hello+123@hello.com"),
        "https://example.com/search?email=hello%2B123%40hello.com"
    );
}

#[test]
fn variables_scoped_precedence_and_secret_filtering_and_field_resolution() {
    let ws = sample_workspace();
    let mut req = sample_request("req-1", "folder-child");
    req.variables = Some(vec![ScopedVariable {
        key: "sharedVar".to_string(),
        value: "from-request".to_string(),
        secret: false,
        secret_ref: None,
    }]);

    let scoped = build_scoped_variable_map(
        &ws,
        &VariableScope {
            request: Some(&req),
            ..Default::default()
        },
    );
    assert_eq!(scoped.get("sharedVar").map(String::as_str), Some("from-request"));
    assert_eq!(scoped.get("colOnly").map(String::as_str), Some("col-val"));
    assert_eq!(
        scoped.get("baseUrl").map(String::as_str),
        Some("https://dev.example.com")
    );
    assert!(!scoped.contains_key("apiSecret"));
    assert!(!scoped.contains_key("refOnlySecret"));

    // Request fields resolution: duplicate http(s):// stripped, disabled header skipped, empty body skipped
    let headers = vec![
        HeaderEntry {
            key: "X-Active".to_string(),
            value: "{{colOnly}}".to_string(),
            enabled: true,
        },
        HeaderEntry {
            key: "X-Disabled".to_string(),
            value: "{{unresolvedDisabled}}".to_string(),
            enabled: false,
        },
    ];
    let resolved = resolve_request_fields(
        &scoped,
        "https://{{baseUrl}}/v1?q=100%",
        &headers,
        Some("   "),
    )
    .expect("resolve_request_fields");
    assert_eq!(resolved.url, "https://dev.example.com/v1?q=100%25");
    assert_eq!(resolved.headers[0].value, "col-val");
    assert_eq!(resolved.headers[1].value, "{{unresolvedDisabled}}");
    assert_eq!(resolved.body.as_deref(), Some("   "));

    let safe = resolve_request_fields_safe(
        &scoped,
        "http://https://example.com/{{missing}}",
        &headers,
        Some("{{missingBody}}"),
    );
    assert_eq!(safe.url, "https://example.com/{{missing}}");
    assert_eq!(safe.body.as_deref(), Some("{{missingBody}}"));
}

// ---------------------------------------------------------------------------
// Auth tests
// ---------------------------------------------------------------------------

#[test]
fn auth_inheritance_and_application_and_redaction() {
    let ws = sample_workspace();

    // Request inside child folder inherits child folder's apiKey
    let req_in_child = sample_request("req-1", "folder-child");
    let eff_child = get_effective_auth(&req_in_child, Some(&ws));
    assert_eq!(eff_child.mode, "apiKey");
    assert_eq!(eff_child.entity_type.as_deref(), Some("folder"));
    assert_eq!(eff_child.entity_id.as_deref(), Some("folder-child"));

    // Request inside root folder (which has auth_mode="none") inherits collection bearer
    let req_in_root = sample_request("req-2", "folder-root");
    let eff_root = get_effective_auth(&req_in_root, Some(&ws));
    assert_eq!(eff_root.mode, "bearer");
    assert_eq!(eff_root.entity_type.as_deref(), Some("collection"));
    assert_eq!(eff_root.config.token.as_deref(), Some("col-token"));

    // Request-level overrides folder/collection
    let mut req_override = sample_request("req-3", "folder-child");
    req_override.auth_mode = "basic".to_string();
    req_override.auth_config = r#"{"username":"alice","password":"{{secretPass}}"}"#.to_string();
    let eff_req = get_effective_auth(&req_override, Some(&ws));
    assert_eq!(eff_req.mode, "basic");
    assert_eq!(eff_req.entity_type.as_deref(), Some("request"));

    let mut vars = HashMap::new();
    vars.insert("secretPass".to_string(), "s3cr3t".to_string());
    let resolved_basic = resolve_auth_config(&eff_req.config, &vars);

    // Basic auth replaces existing Authorization header
    let initial_headers = vec![HeaderEntry {
        key: "Authorization".to_string(),
        value: "Bearer stale".to_string(),
        enabled: true,
    }];
    let applied_basic = apply_auth(
        "basic",
        &resolved_basic,
        "https://api.example.com/me",
        &initial_headers,
    );
    assert_eq!(applied_basic.headers.len(), 1);
    assert_eq!(applied_basic.headers[0].key, "Authorization");
    assert_eq!(applied_basic.headers[0].value, "Basic YWxpY2U6czNjcjN0");

    // ApiKey query placement + URL redaction
    let api_key_query = AuthConfig {
        key_name: Some("api_key".to_string()),
        key_value: Some("super-secret-key".to_string()),
        placement: Some("query".to_string()),
        ..Default::default()
    };
    let applied_query = apply_auth(
        "apiKey",
        &api_key_query,
        "https://api.example.com/items?limit=10",
        &[],
    );
    assert_eq!(
        applied_query.url,
        "https://api.example.com/items?limit=10&api_key=super-secret-key"
    );
    let redacted_url = redact_auth_from_url(&applied_query.url, "apiKey", &api_key_query);
    assert!(!redacted_url.contains("super-secret-key"));
    assert!(redacted_url.contains("limit=10"));
    assert!(redacted_url.contains("[redacted]"));

    // Header redaction for Authorization and apiKey header
    let api_key_header = AuthConfig {
        key_name: Some("X-Api-Key".to_string()),
        key_value: Some("secret-hdr".to_string()),
        placement: Some("header".to_string()),
        ..Default::default()
    };
    let applied_hdr = apply_auth("apiKey", &api_key_header, "https://api.example.com", &initial_headers);
    let redacted_hdrs = redact_auth_headers(&applied_hdr.headers, "apiKey", &api_key_header);
    assert!(redacted_hdrs.iter().all(|h| h.value == "[redacted]"));
}

// ---------------------------------------------------------------------------
// Request prep tests
// ---------------------------------------------------------------------------

#[test]
fn request_prep_graphql_normalization_custom_method_and_redacted_history() {
    let ws = sample_workspace();
    let mut req = sample_request("req-gql", "folder-root");
    req.method = "CUSTOM".to_string();
    req.url = "{{baseUrl}}/users/:userId?api_key=keep".to_string();
    req.path_variables = Some(vec![PathVariableEntry {
        key: "userId".to_string(),
        value: "{{userNum}}".to_string(),
        enabled: true,
        description: None,
    }]);
    req.body_mime_type = "application/graphql".to_string();
    req.body = r#"{"query":"query GetUser { user(id: {{userNum}}) { name } }","variables":"{\"active\":true}","operationName":"GetUser"}"#.to_string();
    req.auth_mode = "apiKey".to_string();
    req.auth_config = r#"{"keyName":"token","keyValue":"{{secretTok}}","placement":"query"}"#.to_string();

    let mut vars = build_scoped_variable_map(
        &ws,
        &VariableScope {
            request: Some(&req),
            ..Default::default()
        },
    );
    vars.insert("userNum".to_string(), "77".to_string());
    vars.insert("secretTok".to_string(), "topsecret".to_string());

    let prepared = prepare_http_request(&req, &ws, &vars, Some("  query "))
        .expect("prepare_http_request");

    assert_eq!(prepared.method, "QUERY");
    assert_eq!(
        prepared.url,
        "https://dev.example.com/users/77?api_key=keep&token=topsecret"
    );
    assert!(prepared.history_url.contains("token=[redacted]"));
    assert!(!prepared.history_url.contains("topsecret"));
    assert_eq!(prepared.body_mime_type.as_deref(), Some("application/json"));
    assert!(prepared
        .headers
        .iter()
        .any(|h| h.key.eq_ignore_ascii_case("content-type") && h.value == "application/json"));

    let body_json: serde_json::Value =
        serde_json::from_str(prepared.body.as_deref().expect("body")).expect("valid json");
    assert_eq!(body_json["query"], "query GetUser { user(id: 77) { name } }");
    assert_eq!(body_json["variables"]["active"], true);
    assert_eq!(body_json["operationName"], "GetUser");

    // Unresolved variable produces PrepareRequestError::UnresolvedVariables
    let mut bad_req = sample_request("req-bad", "folder-root");
    bad_req.url = "{{unknownHost}}/test".to_string();
    let err = prepare_http_request(&bad_req, &ws, &vars, None).expect_err("should fail");
    match err {
        PrepareRequestError::UnresolvedVariables(e) => {
            assert_eq!(e.unresolved_names, vec!["unknownHost"]);
        }
    }
}

// ---------------------------------------------------------------------------
// Importer tests
// ---------------------------------------------------------------------------

#[test]
fn importer_format_detection_and_curl_parsing() {
    assert_eq!(
        detect_import_format("curl -X POST https://example.com"),
        ImportFormatType::Curl
    );
    assert_eq!(
        detect_import_format(r#"{"info":{"name":"C","schema":"https://schema.getpostman.com/json/collection/v2.1.0/collection.json"},"item":[]}"#),
        ImportFormatType::PostmanCollection
    );
    assert_eq!(
        detect_import_format(r#"{"name":"Env","_postman_variable_scope":"environment","values":[{"key":"a","value":"b"}]}"#),
        ImportFormatType::PostmanEnvironment
    );
    assert_eq!(
        detect_import_format(r#"{"openapi":"3.0.0","info":{"title":"API"},"paths":{}}"#),
        ImportFormatType::OpenApi
    );
    assert_eq!(
        detect_import_format(r#"{"_type":"export","resources":[]}"#),
        ImportFormatType::Insomnia
    );
    assert_eq!(
        detect_import_format(r#"{"v":2,"name":"Hopp","requests":[]}"#),
        ImportFormatType::Hoppscotch
    );
    assert_eq!(
        detect_import_format(r#"{"log":{"entries":[]}}"#),
        ImportFormatType::Har
    );
    assert_eq!(
        detect_import_format(r#"[{"method":"GET","path":"/ping"}]"#),
        ImportFormatType::HapiRoutes
    );
    assert_eq!(
        detect_import_format(r#"{"version":1,"workspaces":[],"collections":[]}"#),
        ImportFormatType::KobeanrestNative
    );
    assert_eq!(
        detect_import_format("not a valid format at all"),
        ImportFormatType::Unknown
    );

    let curl = "curl \\\n  -X POST \\\n  -H 'Authorization: Bearer my-jwt' \\\n  -H \"X-Custom: val\\\"1\" \\\n  --json $'{\"query\":\"{ users { id } }\"}' \\\n  https://api.example.com/graphql";
    let parsed_curl = parse_curl_command(curl);
    assert_eq!(parsed_curl.method, "POST");
    assert_eq!(parsed_curl.url, "https://api.example.com/graphql");
    assert_eq!(parsed_curl.auth_mode, "bearer");
    assert_eq!(parsed_curl.auth_config.token.as_deref(), Some("my-jwt"));
    assert_eq!(parsed_curl.body_mime_type, "application/graphql");
    assert!(parsed_curl
        .headers
        .iter()
        .any(|h| h.key == "X-Custom" && h.value == "val\"1"));
    assert!(!parsed_curl
        .headers
        .iter()
        .any(|h| h.key.eq_ignore_ascii_case("authorization")));
}

#[test]
fn importer_postman_and_universal_persistence_round_trip() {
    let postman_col = r#"{
      "info": {
        "name": "Demo API",
        "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
      },
      "auth": {
        "type": "bearer",
        "bearer": [{"key": "token", "value": "col-tok"}]
      },
      "item": [
        {
          "name": "Users",
          "item": [
            {
              "name": "Get User",
              "event": [
                {
                  "listen": "test",
                  "script": { "exec": ["pm.test('ok', () => {});"] }
                }
              ],
              "request": {
                "method": "GET",
                "url": {
                  "raw": "https://api.example.com/users/:userId?active=true",
                  "protocol": "https",
                  "host": ["api", "example", "com"],
                  "path": ["users", ":userId"],
                  "query": [{"key": "active", "value": "true"}],
                  "variable": [{"key": "userId", "value": "42", "description": "User ID"}]
                }
              },
              "response": [
                {
                  "name": "200 OK",
                  "code": 200,
                  "status": "OK",
                  "body": "{\"id\":42}"
                }
              ]
            }
          ]
        }
      ]
    }"#;

    let col_res = parse_postman_collection(postman_col).expect("parse_postman_collection");
    assert_eq!(col_res.collection_name, "Demo API");
    assert_eq!(col_res.collection_auth_mode.as_deref(), Some("bearer"));
    assert_eq!(col_res.folders.len(), 1);
    assert_eq!(col_res.requests.len(), 1);
    let req = &col_res.requests[0];
    assert!(req.post_script.as_deref().unwrap_or("").contains("pm.test"));
    assert_eq!(req.examples.as_ref().map(|e| e.len()), Some(1));
    let pv = req.path_variables.as_ref().expect("path variables");
    assert_eq!(pv[0].key, "userId");
    assert_eq!(pv[0].value, "42");

    let postman_env = r#"{
      "name": "Staging",
      "_postman_variable_scope": "environment",
      "values": [
        {"key": "host", "value": "https://staging.example.com", "enabled": true},
        {"key": "apiKey", "value": "secret-val", "type": "secret", "enabled": true},
        {"key": "disabledVar", "value": "skip", "enabled": false}
      ]
    }"#;
    let env_res = parse_postman_environment(postman_env).expect("parse_postman_environment");
    assert_eq!(env_res.name, "Staging");
    assert_eq!(env_res.variables.len(), 2);
    assert!(env_res.variables[1].secret);

    // Universal import -> serialize ExportData -> persistence::import_workspace_data round-trip
    let universal = parse_universal_import(postman_col, Some("Imported Demo"))
        .expect("parse_universal_import");
    assert_eq!(universal.format, ImportFormatType::PostmanCollection);
    assert_eq!(universal.stats.collections_count, 1);
    assert_eq!(universal.stats.folders_count, 1);
    assert_eq!(universal.stats.requests_count, 1);

    let data_dir = temp_data_dir("universal_roundtrip");
    ensure_database(&data_dir).expect("ensure_database");
    let export_json = serde_json::to_string(&universal.export_data).expect("serialize ExportData");
    import_workspace_data(&data_dir, export_json).expect("import_workspace_data");

    let workspaces = list_workspaces(&data_dir).expect("list_workspaces");
    let imported_ws = workspaces
        .iter()
        .find(|w| w.name == "Imported Demo")
        .expect("imported workspace exists");
    let loaded = switch_workspace(&data_dir, imported_ws.id.clone()).expect("switch_workspace");
    assert!(loaded.requests.iter().any(|r| r.name == "Get User"));
    let reloaded = load_workspace(&data_dir).expect("load_workspace");
    assert!(reloaded.requests.iter().any(|r| r.name == "Get User"));

    let _ = std::fs::remove_dir_all(&data_dir);
}

#[test]
fn importer_curl_basic_auth_urlencode_and_custom_method() {
    let basic_pair = ["alice", "p@ss"].join(":");
    let curl = format!(
        "curl -X TRACE -u {basic_pair} --data-urlencode 'msg=hello world' --url https://api.example.com/trace"
    );
    let parsed = parse_curl_command(&curl);
    assert_eq!(parsed.method, "CUSTOM");
    assert_eq!(parsed.custom_method.as_deref(), Some("TRACE"));
    assert_eq!(parsed.url, "https://api.example.com/trace");
    assert_eq!(parsed.auth_mode, "basic");
    assert_eq!(parsed.auth_config.username.as_deref(), Some("alice"));
    assert_eq!(parsed.auth_config.password.as_deref(), Some("p@ss"));
    assert_eq!(parsed.body, "msg=hello%20world");
    assert_eq!(parsed.body_mime_type, "application/x-www-form-urlencoded");
    assert_eq!(parsed.body_form.len(), 1);
    assert_eq!(parsed.body_form[0].key, "msg");
    assert_eq!(parsed.body_form[0].value, "hello world");
}

#[test]
fn request_fields_error_on_unresolved_enabled_header_or_body() {
    let vars = HashMap::new();
    let enabled_header = vec![HeaderEntry {
        key: "X-Token".to_string(),
        value: "{{missingHeaderVar}}".to_string(),
        enabled: true,
    }];
    let hdr_err = resolve_request_fields(&vars, "https://example.com", &enabled_header, None)
        .expect_err("enabled header unresolved var should fail");
    assert_eq!(hdr_err.unresolved_names, vec!["missingHeaderVar"]);

    let body_err = resolve_request_fields(
        &vars,
        "https://example.com",
        &[],
        Some("{\"id\":\"{{missingBodyVar}}\"}"),
    )
    .expect_err("non-empty body unresolved var should fail");
    assert_eq!(body_err.unresolved_names, vec!["missingBodyVar"]);

    // Relative URL is not redacted by redact_auth_from_url
    let cfg = AuthConfig {
        key_name: Some("api_key".to_string()),
        key_value: Some("secret".to_string()),
        placement: Some("query".to_string()),
        ..Default::default()
    };
    assert_eq!(
        redact_auth_from_url("/items?api_key=secret", "apiKey", &cfg),
        "/items?api_key=secret"
    );
}

#[test]
fn http_client_bounded_response_limit_and_chunk_guard() {
    assert_eq!(MAX_RESPONSE_BODY_BYTES, 50 * 1024 * 1024);

    let mut buf = Vec::new();
    append_bounded_chunk(&mut buf, b"hello ", 11).expect("within limit");
    append_bounded_chunk(&mut buf, b"world", 11).expect("exact limit");
    assert_eq!(buf, b"hello world");

    let err = append_bounded_chunk(&mut buf, b"!", 11).expect_err("exceeds limit");
    assert!(err.contains("response body exceeded maximum allowed limit of 11 bytes"));
}

#[test]
fn importer_sanitizes_pseudo_headers_and_newlines_across_har_curl_postman() {
    // cURL with ANSI-C newline inside header and leading-space pseudo-header
    let curl = "curl -H ' :authority: api.example.com' -H $'X-Note: line1\\nline2' -H 'Accept: application/json' https://api.example.com/v1";
    let parsed_curl = parse_curl_command(curl);
    assert!(!parsed_curl.headers.iter().any(|h| h.key.starts_with(':')));
    assert_eq!(parsed_curl.headers.len(), 2);
    assert!(!parsed_curl.headers.iter().any(|h| h.value.contains('\n') || h.value.contains('\r')));

    // HAR with Chrome HTTP/2 pseudo-headers + normal headers
    let har = serde_json::json!({
        "log": {
            "entries": [{
                "request": {
                    "method": "GET",
                    "url": "https://api.example.com/items",
                    "headers": [
                        { "name": ":authority", "value": "api.example.com" },
                        { "name": ":method", "value": "GET" },
                        { "name": ":path", "value": "/items" },
                        { "name": ":scheme", "value": "https" },
                        { "name": "Accept", "value": "application/json\r\n" },
                        { "name": "", "value": "ignored" }
                    ]
                }
            }]
        }
    });
    let har_res = parse_universal_import(&har.to_string(), None).expect("HAR import");
    let hdrs = &har_res.export_data.request_headers;
    assert_eq!(hdrs.len(), 1);
    assert_eq!(hdrs[0].header_key, "Accept");
    assert_eq!(hdrs[0].header_value, "application/json");
}

#[test]
fn request_prep_preserves_multipart_file_type_and_resolves_body_form_and_redirect_uri() {
    let ws = sample_workspace();
    let mut req = sample_request("req-mp", "folder-root");
    req.url = "{{baseUrl}}/upload".to_string();
    req.body_mime_type = "multipart/form-data".to_string();
    req.body_form = serde_json::json!([
        { "key": "doc", "value": "/tmp/{{fileName}}", "enabled": true, "type": "file" },
        { "key": "tag", "value": "{{sharedVar}}", "enabled": true }
    ])
    .to_string();
    req.auth_mode = "oauth2".to_string();
    req.auth_config = serde_json::json!({
        "grantType": "authorization_code",
        "redirectUri": "http://localhost:8765/cb",
        "token": "tok-1"
    })
    .to_string();

    let mut vars = build_scoped_variable_map(
        &ws,
        &VariableScope {
            request: Some(&req),
            ..Default::default()
        },
    );
    vars.insert("fileName".to_string(), "spec.pdf".to_string());

    let prepared = prepare_http_request(&req, &ws, &vars, None).expect("prepare multipart");
    assert_eq!(prepared.body_form.len(), 2);
    assert_eq!(prepared.body_form[0].field_type.as_deref(), Some("file"));
    assert_eq!(prepared.body_form[0].value, "/tmp/spec.pdf");
    assert_eq!(prepared.body_form[1].value, "from-root-folder");

    let exec_req = prepared.to_execute_http_request();
    assert_eq!(exec_req.body_form[0].field_type.as_deref(), Some("file"));
    assert_eq!(
        prepared.effective_auth_config.redirect_uri.as_deref(),
        Some("http://localhost:8765/cb")
    );
}

#[test]
fn variables_preserve_fragment_resolve_header_keys_and_encode_path_vars() {
    assert_eq!(
        encode_query_params_in_resolved_url("https://example.com/docs?q=hello world#section-2"),
        "https://example.com/docs?q=hello%20world#section-2"
    );

    let mut vars = HashMap::new();
    vars.insert("hdrName".to_string(), "X-Tenant".to_string());
    vars.insert("tenant".to_string(), "acme".to_string());
    let resolved = resolve_request_fields(
        &vars,
        "https://example.com",
        &[HeaderEntry {
            key: "{{hdrName}}".to_string(),
            value: "{{tenant}}".to_string(),
            enabled: true,
        }],
        None,
    )
    .expect("resolve templated header key");
    assert_eq!(resolved.headers[0].key, "X-Tenant");
    assert_eq!(resolved.headers[0].value, "acme");

    let path_vars = vec![PathVariableEntry {
        key: "id".to_string(),
        value: "hello world/a?b=1".to_string(),
        enabled: true,
        description: None,
    }];
    assert_eq!(
        resolve_path_variables_in_url("https://example.com/items/:id", Some(&path_vars)),
        "https://example.com/items/hello%20world%2Fa%3Fb%3D1"
    );
}
