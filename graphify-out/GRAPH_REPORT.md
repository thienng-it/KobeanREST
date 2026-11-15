# Graph Report - KobeanREST  (2026-11-15)

## Corpus Check
- 276 files · ~905,521 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2651 nodes · 5382 edges · 61 communities detected
- Extraction: 82% EXTRACTED · 18% INFERRED · 0% AMBIGUOUS · INFERRED: 947 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 93|Community 93]]

## God Nodes (most connected - your core abstractions)
1. `ok` - 106 edges
2. `ensure_database()` - 85 edges
3. `CodingKeys` - 85 edges
4. `rustCallWithError()` - 73 edges
5. `AppState` - 73 edges
6. `CoreBridge` - 72 edges
7. `map_err()` - 70 edges
8. `MockCoreBridge` - 62 edges
9. `SidebarMockBridge` - 61 edges
10. `MockRunnerBridge` - 59 edges

## Surprising Connections (you probably didn't know these)
- `openapi_export_and_mcp_list_collections()` --calls--> `app_contract()`  [INFERRED]
  crates/kobean-core/tests/core_tests.rs → src-tauri/src/local_only.rs
- `start_local_mock_server()` --calls--> `ok`  [INFERRED]
  src-tauri/src/mock_server.rs → macos/Generated/kobean_ffi.swift
- `stop_local_mock_server()` --calls--> `ok`  [INFERRED]
  src-tauri/src/mock_server.rs → macos/Generated/kobean_ffi.swift
- `get_mock_server_status()` --calls--> `ok`  [INFERRED]
  src-tauri/src/mock_server.rs → macos/Generated/kobean_ffi.swift
- `set_mock_routes()` --calls--> `ok`  [INFERRED]
  src-tauri/src/mock_server.rs → macos/Generated/kobean_ffi.swift

## Communities

### Community 0 - "Community 0"
Cohesion: 0.01
Nodes (172): AnyObject, CaseIterable, Codable, CollectionRunnerSheetView, CollectionRunnerViewModel, PersistedScriptEntry, RunnerItemStatus, failed (+164 more)

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (224): parse_postman_environment(), ok, build_scoped_variable_map_json(), clear_request_history(), create_collection(), create_environment(), create_folder(), create_request() (+216 more)

### Community 2 - "Community 2"
Cohesion: 0.03
Nodes (124): buildScopedVariableMapJson(), clearRequestHistory(), createCollection(), createEnvironment(), createFolder(), createReader(), createRequest(), createWorkspace() (+116 more)

### Community 3 - "Community 3"
Cohesion: 0.03
Nodes (120): handleExport(), async(), updateConfig(), applyFilter(), fetchPreview(), handleRefreshRequest(), handleSave(), handleTokenObtained() (+112 more)

### Community 4 - "Community 4"
Cohesion: 0.03
Nodes (100): AppliedAuth, apply_auth(), AuthConfig, EffectiveAuth, get_effective_auth(), is_absolute_url(), parse_auth_config(), redact_auth_from_url() (+92 more)

### Community 5 - "Community 5"
Cohesion: 0.03
Nodes (3): AppState, SidebarMockBridge, SidebarTreeTests

### Community 6 - "Community 6"
Cohesion: 0.03
Nodes (45): ASWebAuthenticationPresentationContextProviding, Error, UniffiInternalError, bufferOverflow, incompleteData, rustPanic, unexpectedEnumCase, unexpectedNullPointer (+37 more)

### Community 7 - "Community 7"
Cohesion: 0.02
Nodes (102): CodingKey, FfiConverter, FfiConverterByRefBytes, CodingKeys, manifestJson, serverName, version, CodingKeys (+94 more)

### Community 8 - "Community 8"
Cohesion: 0.03
Nodes (28): registerCommands(), HttpCodeLensProvider, HttpCompletionProvider, HttpDiagnosticsProvider, HttpDocumentLinkProvider, HttpHoverProvider, parseHttpFile(), HttpEngine (+20 more)

### Community 9 - "Community 9"
Cohesion: 0.04
Nodes (19): RootWorkbenchView, SettingsView, color(), DropDelegate, EnvironmentManagerView, ResponseInspectorView, text, MethodBadge (+11 more)

### Community 10 - "Community 10"
Cohesion: 0.06
Nodes (32): handler(), Invocation, makeHTTPResponse(), MockHTTPTransport, MockWebAuthSessionRunner, OAuthSessionTests, parseFormBody(), RecordedRequest (+24 more)

### Community 11 - "Community 11"
Cohesion: 0.04
Nodes (7): CoreBridgeProtocol, CoreBridgeTests, MockCoreBridge, TestOAuthHTTPTransport, authConfig, scripts, OAuthHTTPTransport

### Community 12 - "Community 12"
Cohesion: 0.06
Nodes (9): collections, CoreBridge, CoreBridgeError, decoding, encoding, ffi, invalidData, missingSecret (+1 more)

### Community 13 - "Community 13"
Cohesion: 0.05
Nodes (39): handleSubmit(), addHeader(), addQueryParam(), async(), encodeIfNeeded(), getHeaderPresetMenuLayout(), handleHeaderPaste(), handleHeadersBulkChange() (+31 more)

### Community 14 - "Community 14"
Cohesion: 0.06
Nodes (29): handleKeyDown(), handleSendMessage(), handleToggleConnection(), NSLock, UniffiHandleMap, init(), WebSocketClient, run() (+21 more)

### Community 15 - "Community 15"
Cohesion: 0.05
Nodes (24): getCollectionStats(), findParentCollectionId(), generateSalt(), getCollectionLockConfig(), getStoredCollectionLocks(), hashPassword(), isCollectionLocked(), isItemInLockedCollection() (+16 more)

### Community 16 - "Community 16"
Cohesion: 0.04
Nodes (1): MockRunnerBridge

### Community 17 - "Community 17"
Cohesion: 0.09
Nodes (6): NSBezierPath, ScreenshotCaptureTests, SnippetGeneratorTests, SnippetRequestInput, SnippetSheetView, XCTestCase

### Community 18 - "Community 18"
Cohesion: 0.12
Nodes (1): WorkspaceStorageService

### Community 19 - "Community 19"
Cohesion: 0.13
Nodes (8): AuthService, ResolvedRequest, SnippetGenerator, StringLiteralFlavor, go, javascript, python, swift

### Community 20 - "Community 20"
Cohesion: 0.15
Nodes (20): getMethodDropdownLayout(), resolvedMethodLabel(), updateLayout(), detectImportFormat(), generateId(), parseUniversalImport(), generateCurlSnippet(), generateFetchSnippet() (+12 more)

### Community 21 - "Community 21"
Cohesion: 0.13
Nodes (14): none, read(), append_bounded_chunk(), execute_http_request(), ExecuteHttpRequest, ExecuteHttpResponse, format_reqwest_error(), HeaderEntry (+6 more)

### Community 22 - "Community 22"
Cohesion: 0.15
Nodes (16): countScripts(), handleClose(), handleDrop(), handleFileSelect(), handleImport(), handleInputChange(), parseAndPreview(), resetState() (+8 more)

### Community 23 - "Community 23"
Cohesion: 0.15
Nodes (14): emitChange(), formatGraphQLQuery(), handleApplyPastedSDL(), handleApplyTemplate(), handleBeautifyQuery(), handleBeautifyVariables(), handleGenerateQuery(), handleQueryChange() (+6 more)

### Community 24 - "Community 24"
Cohesion: 0.18
Nodes (15): getInstalledPlugins(), installPlugin(), saveInstalledPlugins(), togglePlugin(), uninstallPlugin(), updateLocalFilePlugin(), runPluginPostResponseScripts(), runPluginPreRequestScripts() (+7 more)

### Community 25 - "Community 25"
Cohesion: 0.14
Nodes (5): categorizeCommits(), exec(), generateReleaseNotes(), getLatestReleaseTag(), scanCommitsSince()

### Community 26 - "Community 26"
Cohesion: 0.18
Nodes (13): ffi_app_contract(), ffi_local_storage_status(), ffi_request_auth_modes(), secret_ref(), app_contract(), AppContract, check_for_update(), local_storage_status() (+5 more)

### Community 27 - "Community 27"
Cohesion: 0.16
Nodes (11): SidebarNodeID, collection, folder, request, sectionHeader, SidebarTreeBuilder, SidebarTreeRowKind, collection (+3 more)

### Community 28 - "Community 28"
Cohesion: 0.15
Nodes (3): formatBytes(), handleCopyMarkdown(), handleExportHtml()

### Community 29 - "Community 29"
Cohesion: 0.15
Nodes (4): handleGeneratePayload(), handleInvokeRpc(), executeGrpcCall(), generateSampleMessageJson()

### Community 30 - "Community 30"
Cohesion: 0.23
Nodes (8): applyBulk(), cancelInlineEdit(), commitInlineEdit(), enterBulk(), handleEditingRowBlur(), handleGlobalToggle(), parseBulkText(), toBulkText()

### Community 31 - "Community 31"
Cohesion: 0.23
Nodes (8): applyBulk(), cancelInlineEdit(), commitInlineEdit(), enterBulk(), handleEditingRowBlur(), handleGlobalToggle(), parseBulkText(), toBulkText()

### Community 32 - "Community 32"
Cohesion: 0.27
Nodes (1): SocketIOClient

### Community 34 - "Community 34"
Cohesion: 0.31
Nodes (5): LayoutControls(), detectSystemLanguage(), getResolvedLanguage(), t(), useI18n()

### Community 35 - "Community 35"
Cohesion: 0.25
Nodes (2): handleSubmit(), processChat()

### Community 36 - "Community 36"
Cohesion: 0.25
Nodes (2): loadActiveSessionId(), loadChatSessions()

### Community 37 - "Community 37"
Cohesion: 0.29
Nodes (2): applyAutocomplete(), handleKeyDown()

### Community 38 - "Community 38"
Cohesion: 0.43
Nodes (4): addPlatformEntries(), downloadUrl(), findFileInDir(), readSignature()

### Community 39 - "Community 39"
Cohesion: 0.4
Nodes (2): hashPassword(), verifyPassword()

### Community 40 - "Community 40"
Cohesion: 0.4
Nodes (2): getRoute(), parseRoute()

### Community 41 - "Community 41"
Cohesion: 0.6
Nodes (3): DeveloperToolsSupport.ColorResource, DeveloperToolsSupport.ImageResource, ResourceBundleClass

### Community 42 - "Community 42"
Cohesion: 0.5
Nodes (2): extractPathVariablesFromUrl(), syncPathVariablesWithUrl()

### Community 43 - "Community 43"
Cohesion: 0.6
Nodes (3): read(), readApp(), readSource()

### Community 44 - "Community 44"
Cohesion: 0.4
Nodes (1): MockStorage

### Community 47 - "Community 47"
Cohesion: 0.83
Nodes (3): CLISection(), DownloadSection(), useLatestVersion()

### Community 48 - "Community 48"
Cohesion: 0.67
Nodes (2): read(), readSource()

### Community 50 - "Community 50"
Cohesion: 0.67
Nodes (2): read(), readSource()

### Community 51 - "Community 51"
Cohesion: 0.67
Nodes (2): read(), readSource()

### Community 52 - "Community 52"
Cohesion: 0.67
Nodes (2): read(), readSource()

### Community 54 - "Community 54"
Cohesion: 0.67
Nodes (2): read(), readSource()

### Community 55 - "Community 55"
Cohesion: 0.67
Nodes (2): read(), readSource()

### Community 56 - "Community 56"
Cohesion: 0.67
Nodes (2): read(), readSource()

### Community 61 - "Community 61"
Cohesion: 0.67
Nodes (2): App, KobeanRESTApp

### Community 62 - "Community 62"
Cohesion: 1.0
Nodes (2): read(), readSource()

### Community 65 - "Community 65"
Cohesion: 1.0
Nodes (2): read(), readSource()

### Community 67 - "Community 67"
Cohesion: 1.0
Nodes (2): read(), readSource()

### Community 69 - "Community 69"
Cohesion: 1.0
Nodes (2): read(), readSource()

### Community 70 - "Community 70"
Cohesion: 1.0
Nodes (2): read(), readSource()

### Community 75 - "Community 75"
Cohesion: 1.0
Nodes (2): read(), readSource()

### Community 77 - "Community 77"
Cohesion: 1.0
Nodes (2): read(), readSource()

### Community 93 - "Community 93"
Cohesion: 1.0
Nodes (1): persistence::WorkspaceSummary

## Knowledge Gaps
- **254 isolated node(s):** `OpenApiExportResult`, `MockRoute`, `MockRequestLog`, `MockServerStatus`, `PersistenceStatus` (+249 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 16`** (50 nodes): `MockRunnerBridge`, `.buildScopedVariableMap()`, `.clearRequestHistory()`, `.createCollection()`, `.createEnvironment()`, `.createFolder()`, `.createRequest()`, `.createWorkspace()`, `.deleteCollection()`, `.deleteEnvironment()`, `.deleteFolder()`, `.deleteRequest()`, `.deleteScript()`, `.deleteSecret()`, `.deleteVariable()`, `.deleteWorkspace()`, `.detectImportFormat()`, `.exportWorkspaceData()`, `.extractPathVariables()`, `.getAllScripts()`, `.getScripts()`, `.importWorkspaceData()`, `.init()`, `.initializePersistence()`, `.listWorkspaces()`, `.loadAppSettings()`, `.loadRequestHistory()`, `.loadWorkspace()`, `.parseCurlCommand()`, `.recordRequestHistory()`, `.redactHeadersForHistory()`, `.redactUrlForHistory()`, `.renameEnvironment()`, `.renameWorkspace()`, `.requestAuthModes()`, `.resolveEnvironmentSecretValues()`, `.resolveSecrets()`, `.saveAppSettings()`, `.saveCollectionAuth()`, `.saveFolderAuth()`, `.saveRequest()`, `.saveScript()`, `.saveSecretVariable()`, `.saveVariable()`, `.setActiveEnvironment()`, `.storeSecret()`, `.switchWorkspace()`, `.syncPathVariables()`, `.updateCollection()`, `.updateFolder()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (30 nodes): `WorkspaceStorageService`, `.addHistoryEntry()`, `.addRequest()`, `.clearHistory()`, `.constructor()`, `.convertOpenApiSpec()`, `.convertPostmanCollection()`, `.createCollection()`, `.createDefaultData()`, `.createEnvironment()`, `.createFolder()`, `.deleteEnvironment()`, `.deleteItem()`, `.duplicateRequest()`, `.exportAllCollections()`, `.getActiveEnvironment()`, `.getActiveEnvironmentName()`, `.getAllRequests()`, `.getCollections()`, `.getEnvironments()`, `.getHistory()`, `.importCollection()`, `.loadFromDisk()`, `.resolveLocation()`, `.saveToDisk()`, `.setActiveEnvironment()`, `.updateCollection()`, `.updateEnvironment()`, `.updateFolder()`, `.updateRequest()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (10 nodes): `SocketIOClient`, `.connect()`, `.constructor()`, `.disconnect()`, `.emit()`, `.getSocket()`, `.getStatus()`, `.getUrl()`, `.setStatus()`, `socketio-client.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (9 nodes): `clearChat()`, `handleDoubleClickResizer()`, `handleMouseDownResizer()`, `handleSubmit()`, `handleWindowResize()`, `processChat()`, `renderMarkdown()`, `stop()`, `AIChatSidebar.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (9 nodes): `loadActiveSessionId()`, `loadChatSessions()`, `loadKnowledgeBase()`, `loadMcpServers()`, `saveActiveSessionId()`, `saveChatSessions()`, `saveKnowledgeBase()`, `saveMcpServers()`, `ai-chat-store.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (8 nodes): `applyAutocomplete()`, `checkAutocomplete()`, `handleKeyDown()`, `handlePointerDownOutside()`, `if()`, `renderHighlightedText()`, `updateRect()`, `VariableInput.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (6 nodes): `generateSalt()`, `hasFile()`, `hashPassword()`, `collection-lock-contract.test.mjs`, `read()`, `verifyPassword()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (5 nodes): `App.tsx`, `site.ts`, `App()`, `getRoute()`, `parseRoute()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (5 nodes): `extractPathVariablesFromUrl()`, `path-variables-contract.test.mjs`, `read()`, `resolvePathVariablesInUrl()`, `syncPathVariablesWithUrl()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (5 nodes): `MockStorage`, `.getActiveEnvironment()`, `.getActiveEnvironmentName()`, `resolveString()`, `variable-resolver.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (4 nodes): `hasFile()`, `persistence-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (4 nodes): `hasFile()`, `docs-site-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (4 nodes): `hasFile()`, `rest-client-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (4 nodes): `hasFile()`, `universal-import-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (4 nodes): `hasFile()`, `local-only-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (4 nodes): `hasFile()`, `api-auth-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (4 nodes): `hasFile()`, `import-export-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (3 nodes): `App`, `KobeanRESTApp`, `KobeanRESTApp.swift`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (3 nodes): `variable-resolution-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (3 nodes): `history-viewer-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (3 nodes): `multiple-workspace-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (3 nodes): `environment-editor-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (3 nodes): `download-docs-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 75`** (3 nodes): `auto-update-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 77`** (3 nodes): `settings-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 93`** (2 nodes): `persistence::WorkspaceSummary`, `.from()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `normalize_graphql_body()` connect `Community 4` to `Community 0`, `Community 1`?**
  _High betweenness centrality (0.145) - this node is a cross-community bridge._
- **Why does `sendSelectedRequest()` connect `Community 3` to `Community 0`, `Community 13`, `Community 15`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Why does `ok` connect `Community 1` to `Community 2`, `Community 4`, `Community 21`, `Community 14`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Are the 105 inferred relationships involving `ok` (e.g. with `export_openapi_30_spec()` and `import_openapi_30_spec()`) actually correct?**
  _`ok` has 105 INFERRED edges - model-reasoned connections that need verification._
- **Are the 11 inferred relationships involving `ensure_database()` (e.g. with `persistence_round_trip_and_secret_redaction()` and `openapi_export_and_mcp_list_collections()`) actually correct?**
  _`ensure_database()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **Are the 50 inferred relationships involving `String` (e.g. with `normalize_graphql_body()` and `uniffiTraitInterfaceCall()`) actually correct?**
  _`String` has 50 INFERRED edges - model-reasoned connections that need verification._
- **What connects `OpenApiExportResult`, `MockRoute`, `MockRequestLog` to the rest of the system?**
  _254 weakly-connected nodes found - possible documentation gaps or missing edges._