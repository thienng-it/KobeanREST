# Graph Report - KobeanREST  (2026-11-15)

## Corpus Check
- 275 files · ~656,328 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2637 nodes · 5315 edges · 59 communities detected
- Extraction: 83% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 910 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 91|Community 91]]

## God Nodes (most connected - your core abstractions)
1. `ok` - 106 edges
2. `ensure_database()` - 85 edges
3. `CodingKeys` - 85 edges
4. `rustCallWithError()` - 73 edges
5. `AppState` - 72 edges
6. `CoreBridge` - 71 edges
7. `map_err()` - 70 edges
8. `MockCoreBridge` - 62 edges
9. `SidebarMockBridge` - 61 edges
10. `MockRunnerBridge` - 59 edges

## Surprising Connections (you probably didn't know these)
- `openapi_export_and_mcp_list_collections()` --calls--> `app_contract()`  [INFERRED]
  crates/kobean-core/tests/core_tests.rs → src-tauri/src/local_only.rs
- `export_openapi_30_spec()` --calls--> `export_openapi_30_spec_json()`  [INFERRED]
  src-tauri/src/spec_generator.rs → crates/kobean-ffi/src/lib.rs
- `import_openapi_30_spec()` --calls--> `import_openapi_30_spec_json()`  [INFERRED]
  src-tauri/src/spec_generator.rs → crates/kobean-ffi/src/lib.rs
- `start_local_mock_server()` --calls--> `ok`  [INFERRED]
  src-tauri/src/mock_server.rs → macos/Generated/kobean_ffi.swift
- `stop_local_mock_server()` --calls--> `ok`  [INFERRED]
  src-tauri/src/mock_server.rs → macos/Generated/kobean_ffi.swift

## Communities

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (167): AnyObject, CaseIterable, Codable, CollectionRunnerViewModel, PersistedScriptEntry, RunnerItemStatus, failed, passed (+159 more)

### Community 1 - "Community 1"
Cohesion: 0.02
Nodes (198): AppliedAuth, apply_auth(), AuthConfig, EffectiveAuth, get_effective_auth(), is_absolute_url(), parse_auth_config(), redact_auth_from_url() (+190 more)

### Community 2 - "Community 2"
Cohesion: 0.03
Nodes (126): FfiConverter, buildScopedVariableMapJson(), clearRequestHistory(), createCollection(), createEnvironment(), createFolder(), createReader(), createRequest() (+118 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (142): parse_postman_environment(), ok, ffi_initialize_persistence(), execute_mcp_tool_call(), export_mcp_manifest(), McpManifestResult, normalize_script_type(), active_workspace_id() (+134 more)

### Community 4 - "Community 4"
Cohesion: 0.03
Nodes (120): handleExport(), async(), updateConfig(), applyFilter(), fetchPreview(), handleRefreshRequest(), handleSave(), handleTokenObtained() (+112 more)

### Community 5 - "Community 5"
Cohesion: 0.03
Nodes (3): AppState, SidebarMockBridge, SidebarTreeTests

### Community 6 - "Community 6"
Cohesion: 0.04
Nodes (43): Error, UniffiInternalError, bufferOverflow, incompleteData, rustPanic, unexpectedEnumCase, unexpectedNullPointer, unexpectedOptionalTag (+35 more)

### Community 7 - "Community 7"
Cohesion: 0.03
Nodes (25): RootWorkbenchView, SettingsView, CollectionRunnerSheetView, color(), DropDelegate, EnvironmentManagerView, McpToolsSheetView, McpToolsViewModel (+17 more)

### Community 8 - "Community 8"
Cohesion: 0.02
Nodes (99): CodingKey, CodingKeys, manifestJson, serverName, version, CodingKeys, activeCollectionId, contentType (+91 more)

### Community 9 - "Community 9"
Cohesion: 0.03
Nodes (28): registerCommands(), HttpCodeLensProvider, HttpCompletionProvider, HttpDiagnosticsProvider, HttpDocumentLinkProvider, HttpHoverProvider, parseHttpFile(), HttpEngine (+20 more)

### Community 10 - "Community 10"
Cohesion: 0.05
Nodes (43): ASWebAuthenticationPresentationContextProviding, handler(), CustomDebugStringConvertible, CustomStringConvertible, Invocation, makeHTTPResponse(), MockHTTPTransport, MockWebAuthSessionRunner (+35 more)

### Community 11 - "Community 11"
Cohesion: 0.06
Nodes (9): collections, CoreBridge, CoreBridgeError, decoding, encoding, ffi, invalidData, missingSecret (+1 more)

### Community 12 - "Community 12"
Cohesion: 0.04
Nodes (5): CoreBridgeTests, MockCoreBridge, TestOAuthHTTPTransport, scripts, OAuthHTTPTransport

### Community 13 - "Community 13"
Cohesion: 0.05
Nodes (39): handleSubmit(), addHeader(), addQueryParam(), async(), encodeIfNeeded(), getHeaderPresetMenuLayout(), handleHeaderPaste(), handleHeadersBulkChange() (+31 more)

### Community 14 - "Community 14"
Cohesion: 0.04
Nodes (4): CoreBridgeProtocol, Invocation, MockRunnerBridge, reserveLoopbackPort()

### Community 15 - "Community 15"
Cohesion: 0.05
Nodes (24): getCollectionStats(), findParentCollectionId(), generateSalt(), getCollectionLockConfig(), getStoredCollectionLocks(), hashPassword(), isCollectionLocked(), isItemInLockedCollection() (+16 more)

### Community 16 - "Community 16"
Cohesion: 0.07
Nodes (12): SnippetGeneratorTests, AuthService, ResolvedRequest, SnippetGenerator, SnippetRequestInput, StringLiteralFlavor, go, javascript (+4 more)

### Community 17 - "Community 17"
Cohesion: 0.07
Nodes (26): handleKeyDown(), handleSendMessage(), handleToggleConnection(), NSLock, UniffiHandleMap, WebSocketClient, clear_mock_request_log(), current_unix_ms() (+18 more)

### Community 18 - "Community 18"
Cohesion: 0.12
Nodes (1): WorkspaceStorageService

### Community 19 - "Community 19"
Cohesion: 0.15
Nodes (20): getMethodDropdownLayout(), resolvedMethodLabel(), updateLayout(), detectImportFormat(), generateId(), parseUniversalImport(), generateCurlSnippet(), generateFetchSnippet() (+12 more)

### Community 20 - "Community 20"
Cohesion: 0.13
Nodes (14): none, read(), append_bounded_chunk(), execute_http_request(), ExecuteHttpRequest, ExecuteHttpResponse, format_reqwest_error(), HeaderEntry (+6 more)

### Community 21 - "Community 21"
Cohesion: 0.15
Nodes (16): countScripts(), handleClose(), handleDrop(), handleFileSelect(), handleImport(), handleInputChange(), parseAndPreview(), resetState() (+8 more)

### Community 22 - "Community 22"
Cohesion: 0.15
Nodes (14): emitChange(), formatGraphQLQuery(), handleApplyPastedSDL(), handleApplyTemplate(), handleBeautifyQuery(), handleBeautifyVariables(), handleGenerateQuery(), handleQueryChange() (+6 more)

### Community 23 - "Community 23"
Cohesion: 0.18
Nodes (15): getInstalledPlugins(), installPlugin(), saveInstalledPlugins(), togglePlugin(), uninstallPlugin(), updateLocalFilePlugin(), runPluginPostResponseScripts(), runPluginPreRequestScripts() (+7 more)

### Community 24 - "Community 24"
Cohesion: 0.21
Nodes (1): MockServerViewModel

### Community 25 - "Community 25"
Cohesion: 0.14
Nodes (5): categorizeCommits(), exec(), generateReleaseNotes(), getLatestReleaseTag(), scanCommitsSince()

### Community 26 - "Community 26"
Cohesion: 0.15
Nodes (3): formatBytes(), handleCopyMarkdown(), handleExportHtml()

### Community 27 - "Community 27"
Cohesion: 0.15
Nodes (4): handleGeneratePayload(), handleInvokeRpc(), executeGrpcCall(), generateSampleMessageJson()

### Community 28 - "Community 28"
Cohesion: 0.23
Nodes (8): applyBulk(), cancelInlineEdit(), commitInlineEdit(), enterBulk(), handleEditingRowBlur(), handleGlobalToggle(), parseBulkText(), toBulkText()

### Community 29 - "Community 29"
Cohesion: 0.23
Nodes (8): applyBulk(), cancelInlineEdit(), commitInlineEdit(), enterBulk(), handleEditingRowBlur(), handleGlobalToggle(), parseBulkText(), toBulkText()

### Community 30 - "Community 30"
Cohesion: 0.27
Nodes (1): SocketIOClient

### Community 32 - "Community 32"
Cohesion: 0.25
Nodes (2): handleSubmit(), processChat()

### Community 33 - "Community 33"
Cohesion: 0.31
Nodes (5): LayoutControls(), detectSystemLanguage(), getResolvedLanguage(), t(), useI18n()

### Community 34 - "Community 34"
Cohesion: 0.25
Nodes (2): loadActiveSessionId(), loadChatSessions()

### Community 35 - "Community 35"
Cohesion: 0.29
Nodes (2): applyAutocomplete(), handleKeyDown()

### Community 36 - "Community 36"
Cohesion: 0.43
Nodes (4): addPlatformEntries(), downloadUrl(), findFileInDir(), readSignature()

### Community 37 - "Community 37"
Cohesion: 0.4
Nodes (2): hashPassword(), verifyPassword()

### Community 38 - "Community 38"
Cohesion: 0.4
Nodes (2): getRoute(), parseRoute()

### Community 39 - "Community 39"
Cohesion: 0.6
Nodes (3): DeveloperToolsSupport.ColorResource, DeveloperToolsSupport.ImageResource, ResourceBundleClass

### Community 40 - "Community 40"
Cohesion: 0.5
Nodes (2): extractPathVariablesFromUrl(), syncPathVariablesWithUrl()

### Community 41 - "Community 41"
Cohesion: 0.6
Nodes (3): read(), readApp(), readSource()

### Community 42 - "Community 42"
Cohesion: 0.4
Nodes (1): MockStorage

### Community 45 - "Community 45"
Cohesion: 0.83
Nodes (3): CLISection(), DownloadSection(), useLatestVersion()

### Community 46 - "Community 46"
Cohesion: 0.67
Nodes (2): read(), readSource()

### Community 48 - "Community 48"
Cohesion: 0.67
Nodes (2): read(), readSource()

### Community 49 - "Community 49"
Cohesion: 0.67
Nodes (2): read(), readSource()

### Community 50 - "Community 50"
Cohesion: 0.67
Nodes (2): read(), readSource()

### Community 52 - "Community 52"
Cohesion: 0.67
Nodes (2): read(), readSource()

### Community 53 - "Community 53"
Cohesion: 0.67
Nodes (2): read(), readSource()

### Community 54 - "Community 54"
Cohesion: 0.67
Nodes (2): read(), readSource()

### Community 59 - "Community 59"
Cohesion: 0.67
Nodes (2): App, KobeanRESTApp

### Community 60 - "Community 60"
Cohesion: 1.0
Nodes (2): read(), readSource()

### Community 63 - "Community 63"
Cohesion: 1.0
Nodes (2): read(), readSource()

### Community 65 - "Community 65"
Cohesion: 1.0
Nodes (2): read(), readSource()

### Community 67 - "Community 67"
Cohesion: 1.0
Nodes (2): read(), readSource()

### Community 68 - "Community 68"
Cohesion: 1.0
Nodes (2): read(), readSource()

### Community 73 - "Community 73"
Cohesion: 1.0
Nodes (2): read(), readSource()

### Community 75 - "Community 75"
Cohesion: 1.0
Nodes (2): read(), readSource()

### Community 91 - "Community 91"
Cohesion: 1.0
Nodes (1): persistence::WorkspaceSummary

## Knowledge Gaps
- **254 isolated node(s):** `OpenApiExportResult`, `MockRoute`, `MockRequestLog`, `MockServerStatus`, `PersistenceStatus` (+249 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 18`** (30 nodes): `WorkspaceStorageService`, `.addHistoryEntry()`, `.addRequest()`, `.clearHistory()`, `.constructor()`, `.convertOpenApiSpec()`, `.convertPostmanCollection()`, `.createCollection()`, `.createDefaultData()`, `.createEnvironment()`, `.createFolder()`, `.deleteEnvironment()`, `.deleteItem()`, `.duplicateRequest()`, `.exportAllCollections()`, `.getActiveEnvironment()`, `.getActiveEnvironmentName()`, `.getAllRequests()`, `.getCollections()`, `.getEnvironments()`, `.getHistory()`, `.importCollection()`, `.loadFromDisk()`, `.resolveLocation()`, `.saveToDisk()`, `.setActiveEnvironment()`, `.updateCollection()`, `.updateEnvironment()`, `.updateFolder()`, `.updateRequest()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (17 nodes): `MockServerViewModel`, `.addRoute()`, `.clearRequestLog()`, `.deleteRoute()`, `.extractPath()`, `.importRoutes()`, `.init()`, `.loadRoutes()`, `.mockRoute()`, `.refreshAll()`, `.refreshRequestLog()`, `.refreshStatus()`, `.setRoutes()`, `.startServer()`, `.stopServer()`, `.syncRoutesToServer()`, `.toggleServer()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (10 nodes): `SocketIOClient`, `.connect()`, `.constructor()`, `.disconnect()`, `.emit()`, `.getSocket()`, `.getStatus()`, `.getUrl()`, `.setStatus()`, `socketio-client.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (9 nodes): `clearChat()`, `handleDoubleClickResizer()`, `handleMouseDownResizer()`, `handleSubmit()`, `handleWindowResize()`, `processChat()`, `renderMarkdown()`, `stop()`, `AIChatSidebar.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (9 nodes): `loadActiveSessionId()`, `loadChatSessions()`, `loadKnowledgeBase()`, `loadMcpServers()`, `saveActiveSessionId()`, `saveChatSessions()`, `saveKnowledgeBase()`, `saveMcpServers()`, `ai-chat-store.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (8 nodes): `applyAutocomplete()`, `checkAutocomplete()`, `handleKeyDown()`, `handlePointerDownOutside()`, `if()`, `renderHighlightedText()`, `updateRect()`, `VariableInput.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (6 nodes): `generateSalt()`, `hasFile()`, `hashPassword()`, `collection-lock-contract.test.mjs`, `read()`, `verifyPassword()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (5 nodes): `App.tsx`, `site.ts`, `App()`, `getRoute()`, `parseRoute()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (5 nodes): `extractPathVariablesFromUrl()`, `path-variables-contract.test.mjs`, `read()`, `resolvePathVariablesInUrl()`, `syncPathVariablesWithUrl()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (5 nodes): `MockStorage`, `.getActiveEnvironment()`, `.getActiveEnvironmentName()`, `resolveString()`, `variable-resolver.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (4 nodes): `hasFile()`, `persistence-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (4 nodes): `hasFile()`, `docs-site-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (4 nodes): `hasFile()`, `rest-client-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (4 nodes): `hasFile()`, `universal-import-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (4 nodes): `hasFile()`, `local-only-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (4 nodes): `hasFile()`, `api-auth-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (4 nodes): `hasFile()`, `import-export-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (3 nodes): `App`, `KobeanRESTApp`, `KobeanRESTApp.swift`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (3 nodes): `variable-resolution-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (3 nodes): `history-viewer-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (3 nodes): `multiple-workspace-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (3 nodes): `environment-editor-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (3 nodes): `download-docs-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 73`** (3 nodes): `auto-update-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 75`** (3 nodes): `settings-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 91`** (2 nodes): `persistence::WorkspaceSummary`, `.from()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `normalize_graphql_body()` connect `Community 1` to `Community 0`?**
  _High betweenness centrality (0.139) - this node is a cross-community bridge._
- **Why does `ok` connect `Community 3` to `Community 17`, `Community 2`, `Community 20`, `Community 1`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Why does `sendSelectedRequest()` connect `Community 4` to `Community 0`, `Community 13`, `Community 15`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Are the 105 inferred relationships involving `ok` (e.g. with `export_openapi_30_spec()` and `import_openapi_30_spec()`) actually correct?**
  _`ok` has 105 INFERRED edges - model-reasoned connections that need verification._
- **Are the 11 inferred relationships involving `ensure_database()` (e.g. with `persistence_round_trip_and_secret_redaction()` and `openapi_export_and_mcp_list_collections()`) actually correct?**
  _`ensure_database()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **Are the 47 inferred relationships involving `String` (e.g. with `normalize_graphql_body()` and `uniffiTraitInterfaceCall()`) actually correct?**
  _`String` has 47 INFERRED edges - model-reasoned connections that need verification._
- **What connects `OpenApiExportResult`, `MockRoute`, `MockRequestLog` to the rest of the system?**
  _254 weakly-connected nodes found - possible documentation gaps or missing edges._