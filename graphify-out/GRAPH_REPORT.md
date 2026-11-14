# Graph Report - KobeanREST  (2026-11-14)

## Corpus Check
- 273 files · ~648,070 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2521 nodes · 5083 edges · 60 communities detected
- Extraction: 83% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 847 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 92|Community 92]]

## God Nodes (most connected - your core abstractions)
1. `ok` - 105 edges
2. `CodingKeys` - 85 edges
3. `ensure_database()` - 83 edges
4. `rustCallWithError()` - 73 edges
5. `CoreBridge` - 71 edges
6. `map_err()` - 70 edges
7. `MockCoreBridge` - 61 edges
8. `MockRunnerBridge` - 59 edges
9. `AppState` - 57 edges
10. `open_database()` - 54 edges

## Surprising Connections (you probably didn't know these)
- `append_bounded_chunk()` --calls--> `ok`  [INFERRED]
  crates/kobean-core/src/http_client.rs → macos/Generated/kobean_ffi.swift
- `execute_http_request()` --calls--> `read()`  [INFERRED]
  src-tauri/src/http_client.rs → scripts/check-release-preflight.mjs
- `execute_http_request()` --calls--> `ok`  [INFERRED]
  src-tauri/src/http_client.rs → macos/Generated/kobean_ffi.swift
- `execute_http_request()` --calls--> `execute_http_request_json()`  [INFERRED]
  src-tauri/src/http_client.rs → crates/kobean-ffi/src/lib.rs
- `resolve_string()` --calls--> `ok`  [INFERRED]
  crates/kobean-core/src/domain/variables.rs → macos/Generated/kobean_ffi.swift

## Communities

### Community 0 - "Community 0"
Cohesion: 0.03
Nodes (247): parse_postman_environment(), build_scoped_variable_map(), ok, init(), build_scoped_variable_map_json(), clear_request_history(), create_collection(), create_environment() (+239 more)

### Community 1 - "Community 1"
Cohesion: 0.02
Nodes (151): CaseIterable, Codable, CollectionRunnerViewModel, PersistedScriptEntry, RunnerItemStatus, failed, passed, pending (+143 more)

### Community 2 - "Community 2"
Cohesion: 0.03
Nodes (124): buildScopedVariableMapJson(), clearRequestHistory(), createCollection(), createEnvironment(), createFolder(), createReader(), createRequest(), createWorkspace() (+116 more)

### Community 3 - "Community 3"
Cohesion: 0.02
Nodes (125): handleSubmit(), processChat(), handleExport(), async(), updateConfig(), applyFilter(), fetchPreview(), handleRefreshRequest() (+117 more)

### Community 4 - "Community 4"
Cohesion: 0.03
Nodes (96): AppliedAuth, apply_auth(), AuthConfig, EffectiveAuth, get_effective_auth(), is_absolute_url(), parse_auth_config(), redact_auth_from_url() (+88 more)

### Community 5 - "Community 5"
Cohesion: 0.04
Nodes (48): AnyObject, Error, UniffiInternalError, bufferOverflow, incompleteData, rustPanic, unexpectedEnumCase, unexpectedNullPointer (+40 more)

### Community 6 - "Community 6"
Cohesion: 0.02
Nodes (101): CodingKey, FfiConverter, FfiConverterByRefBytes, CodingKeys, manifestJson, serverName, version, CodingKeys (+93 more)

### Community 7 - "Community 7"
Cohesion: 0.03
Nodes (28): registerCommands(), HttpCodeLensProvider, HttpCompletionProvider, HttpDiagnosticsProvider, HttpDocumentLinkProvider, HttpHoverProvider, parseHttpFile(), HttpEngine (+20 more)

### Community 8 - "Community 8"
Cohesion: 0.05
Nodes (42): ASWebAuthenticationPresentationContextProviding, handler(), CustomDebugStringConvertible, CustomStringConvertible, Invocation, makeHTTPResponse(), MockHTTPTransport, MockWebAuthSessionRunner (+34 more)

### Community 9 - "Community 9"
Cohesion: 0.04
Nodes (27): RootWorkbenchView, SettingsView, CollectionRunnerSheetView, color(), EnvironmentManagerView, McpToolsSheetView, McpToolsViewModel, MockServerSheetView (+19 more)

### Community 10 - "Community 10"
Cohesion: 0.04
Nodes (7): CoreBridgeProtocol, CoreBridgeTests, MockCoreBridge, TestOAuthHTTPTransport, authConfig, scripts, OAuthHTTPTransport

### Community 11 - "Community 11"
Cohesion: 0.06
Nodes (9): collections, CoreBridge, CoreBridgeError, decoding, encoding, ffi, invalidData, missingSecret (+1 more)

### Community 12 - "Community 12"
Cohesion: 0.05
Nodes (35): handleSubmit(), addHeader(), addQueryParam(), async(), encodeIfNeeded(), getHeaderPresetMenuLayout(), handleHeaderPaste(), handleHeadersBulkChange() (+27 more)

### Community 13 - "Community 13"
Cohesion: 0.04
Nodes (3): Invocation, MockRunnerBridge, reserveLoopbackPort()

### Community 14 - "Community 14"
Cohesion: 0.05
Nodes (24): getCollectionStats(), findParentCollectionId(), generateSalt(), getCollectionLockConfig(), getStoredCollectionLocks(), hashPassword(), isCollectionLocked(), isItemInLockedCollection() (+16 more)

### Community 15 - "Community 15"
Cohesion: 0.07
Nodes (12): SnippetGeneratorTests, AuthService, ResolvedRequest, SnippetGenerator, SnippetRequestInput, StringLiteralFlavor, go, javascript (+4 more)

### Community 16 - "Community 16"
Cohesion: 0.08
Nodes (1): AppState

### Community 17 - "Community 17"
Cohesion: 0.12
Nodes (1): WorkspaceStorageService

### Community 18 - "Community 18"
Cohesion: 0.14
Nodes (21): getMethodDropdownLayout(), resolvedMethodLabel(), updateLayout(), applyAuth(), detectImportFormat(), generateId(), parseUniversalImport(), generateCurlSnippet() (+13 more)

### Community 19 - "Community 19"
Cohesion: 0.14
Nodes (15): emitChange(), formatGraphQLQuery(), handleApplyPastedSDL(), handleApplyTemplate(), handleBeautifyQuery(), handleBeautifyVariables(), handleFetchSchema(), handleGenerateQuery() (+7 more)

### Community 20 - "Community 20"
Cohesion: 0.15
Nodes (16): countScripts(), handleClose(), handleDrop(), handleFileSelect(), handleImport(), handleInputChange(), parseAndPreview(), resetState() (+8 more)

### Community 21 - "Community 21"
Cohesion: 0.13
Nodes (4): handleKeyDown(), handleSendMessage(), handleToggleConnection(), WebSocketClient

### Community 22 - "Community 22"
Cohesion: 0.19
Nodes (14): getInstalledPlugins(), installPlugin(), saveInstalledPlugins(), togglePlugin(), uninstallPlugin(), updateLocalFilePlugin(), runPluginPostResponseScripts(), runPluginPreRequestScripts() (+6 more)

### Community 23 - "Community 23"
Cohesion: 0.14
Nodes (11): none, read(), append_bounded_chunk(), build_client(), execute_http_request(), ExecuteHttpRequest, ExecuteHttpResponse, HeaderEntry (+3 more)

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
Cohesion: 0.23
Nodes (8): applyBulk(), cancelInlineEdit(), commitInlineEdit(), enterBulk(), handleEditingRowBlur(), handleGlobalToggle(), parseBulkText(), toBulkText()

### Community 28 - "Community 28"
Cohesion: 0.23
Nodes (8): applyBulk(), cancelInlineEdit(), commitInlineEdit(), enterBulk(), handleEditingRowBlur(), handleGlobalToggle(), parseBulkText(), toBulkText()

### Community 29 - "Community 29"
Cohesion: 0.22
Nodes (9): ffi_local_storage_status(), ffi_request_auth_modes(), AppContract, check_for_update(), local_storage_status(), LocalStorageStatus, request_auth_modes(), UpdateCheckPreview (+1 more)

### Community 30 - "Community 30"
Cohesion: 0.2
Nodes (2): handleGeneratePayload(), generateSampleMessageJson()

### Community 31 - "Community 31"
Cohesion: 0.27
Nodes (1): SocketIOClient

### Community 33 - "Community 33"
Cohesion: 0.31
Nodes (5): LayoutControls(), detectSystemLanguage(), getResolvedLanguage(), t(), useI18n()

### Community 34 - "Community 34"
Cohesion: 0.25
Nodes (2): loadActiveSessionId(), loadChatSessions()

### Community 35 - "Community 35"
Cohesion: 0.43
Nodes (2): NSLock, UniffiHandleMap

### Community 36 - "Community 36"
Cohesion: 0.29
Nodes (2): applyAutocomplete(), handleKeyDown()

### Community 37 - "Community 37"
Cohesion: 0.43
Nodes (4): addPlatformEntries(), downloadUrl(), findFileInDir(), readSignature()

### Community 38 - "Community 38"
Cohesion: 0.4
Nodes (2): hashPassword(), verifyPassword()

### Community 39 - "Community 39"
Cohesion: 0.4
Nodes (2): getRoute(), parseRoute()

### Community 40 - "Community 40"
Cohesion: 0.6
Nodes (3): DeveloperToolsSupport.ColorResource, DeveloperToolsSupport.ImageResource, ResourceBundleClass

### Community 41 - "Community 41"
Cohesion: 0.5
Nodes (2): extractPathVariablesFromUrl(), syncPathVariablesWithUrl()

### Community 42 - "Community 42"
Cohesion: 0.6
Nodes (3): read(), readApp(), readSource()

### Community 43 - "Community 43"
Cohesion: 0.4
Nodes (1): MockStorage

### Community 46 - "Community 46"
Cohesion: 0.83
Nodes (3): CLISection(), DownloadSection(), useLatestVersion()

### Community 47 - "Community 47"
Cohesion: 0.67
Nodes (2): read(), readSource()

### Community 49 - "Community 49"
Cohesion: 0.67
Nodes (2): read(), readSource()

### Community 50 - "Community 50"
Cohesion: 0.67
Nodes (2): read(), readSource()

### Community 51 - "Community 51"
Cohesion: 0.67
Nodes (2): read(), readSource()

### Community 53 - "Community 53"
Cohesion: 0.67
Nodes (2): read(), readSource()

### Community 54 - "Community 54"
Cohesion: 0.67
Nodes (2): read(), readSource()

### Community 55 - "Community 55"
Cohesion: 0.67
Nodes (2): read(), readSource()

### Community 60 - "Community 60"
Cohesion: 0.67
Nodes (2): App, KobeanRESTApp

### Community 61 - "Community 61"
Cohesion: 1.0
Nodes (2): read(), readSource()

### Community 64 - "Community 64"
Cohesion: 1.0
Nodes (2): read(), readSource()

### Community 66 - "Community 66"
Cohesion: 1.0
Nodes (2): read(), readSource()

### Community 68 - "Community 68"
Cohesion: 1.0
Nodes (2): read(), readSource()

### Community 69 - "Community 69"
Cohesion: 1.0
Nodes (2): read(), readSource()

### Community 74 - "Community 74"
Cohesion: 1.0
Nodes (2): read(), readSource()

### Community 76 - "Community 76"
Cohesion: 1.0
Nodes (2): read(), readSource()

### Community 92 - "Community 92"
Cohesion: 1.0
Nodes (1): persistence::WorkspaceSummary

## Knowledge Gaps
- **248 isolated node(s):** `OpenApiExportResult`, `MockRoute`, `MockRequestLog`, `MockServerStatus`, `PersistenceStatus` (+243 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 16`** (50 nodes): `AppState`, `.applyMutatedScriptRequest()`, `.authorizeOAuth2ForActiveTab()`, `.bootstrap()`, `.buildEnvironmentVariableMap()`, `.buildMergedVariableMapForAuth()`, `.cancelActiveTab()`, `.cancelAllInFlight()`, `.clearHistory()`, `.closeActiveTab()`, `.closeTab()`, `.createCollection()`, `.createEnvironment()`, `.createFolder()`, `.createNewTab()`, `.createRequestInFolder()`, `.createWorkspace()`, `.deleteCollection()`, `.deleteEnvironment()`, `.deleteFolder()`, `.deleteRequest()`, `.deleteVariable()`, `.exportWorkspaceToFile()`, `.externalizeAuthSecrets()`, `.focusURLBar()`, `.init()`, `.loadHistory()`, `.loadScriptsForTab()`, `.openRequest()`, `.persistScriptEnvironmentChanges()`, `.persistScriptsForRequest()`, `.refreshOAuth2ForActiveTab()`, `.refreshWorkspace()`, `.renameCollection()`, `.renameEnvironment()`, `.renameFolder()`, `.resolveAuthSecretValue()`, `.resolveVariables()`, `.saveActiveTab()`, `.saveSettings()`, `.saveVariable()`, `.secretValueRequiringExternalization()`, `.selectEnvironment()`, `.sendActiveTab()`, `.switchWorkspace()`, `.syncPathVariablesForActiveTab()`, `.toggleSplitOrientation()`, `.updateActiveRequest()`, `.updateTab()`, `AppState.swift`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (30 nodes): `WorkspaceStorageService`, `.addHistoryEntry()`, `.addRequest()`, `.clearHistory()`, `.constructor()`, `.convertOpenApiSpec()`, `.convertPostmanCollection()`, `.createCollection()`, `.createDefaultData()`, `.createEnvironment()`, `.createFolder()`, `.deleteEnvironment()`, `.deleteItem()`, `.duplicateRequest()`, `.exportAllCollections()`, `.getActiveEnvironment()`, `.getActiveEnvironmentName()`, `.getAllRequests()`, `.getCollections()`, `.getEnvironments()`, `.getHistory()`, `.importCollection()`, `.loadFromDisk()`, `.resolveLocation()`, `.saveToDisk()`, `.setActiveEnvironment()`, `.updateCollection()`, `.updateEnvironment()`, `.updateFolder()`, `.updateRequest()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (17 nodes): `MockServerViewModel`, `.addRoute()`, `.clearRequestLog()`, `.deleteRoute()`, `.extractPath()`, `.importRoutes()`, `.init()`, `.loadRoutes()`, `.mockRoute()`, `.refreshAll()`, `.refreshRequestLog()`, `.refreshStatus()`, `.setRoutes()`, `.startServer()`, `.stopServer()`, `.syncRoutesToServer()`, `.toggleServer()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (10 nodes): `handleAddMetadataRow()`, `handleCopyResponse()`, `handleGeneratePayload()`, `handlePrettifyJson()`, `handleRemoveMetadataRow()`, `handleUpdateMetadataRow()`, `generateSampleMessageJson()`, `parseProtoSchema()`, `GrpcPanel.tsx`, `proto-parser.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (10 nodes): `SocketIOClient`, `.connect()`, `.constructor()`, `.disconnect()`, `.emit()`, `.getSocket()`, `.getStatus()`, `.getUrl()`, `.setStatus()`, `socketio-client.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (9 nodes): `loadActiveSessionId()`, `loadChatSessions()`, `loadKnowledgeBase()`, `loadMcpServers()`, `saveActiveSessionId()`, `saveChatSessions()`, `saveKnowledgeBase()`, `saveMcpServers()`, `ai-chat-store.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (8 nodes): `NSLock`, `.withLock()`, `UniffiHandleMap`, `.clone()`, `.doInsert()`, `.get()`, `.insert()`, `.remove()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (8 nodes): `applyAutocomplete()`, `checkAutocomplete()`, `handleKeyDown()`, `handlePointerDownOutside()`, `if()`, `renderHighlightedText()`, `updateRect()`, `VariableInput.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (6 nodes): `generateSalt()`, `hasFile()`, `hashPassword()`, `collection-lock-contract.test.mjs`, `read()`, `verifyPassword()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (5 nodes): `App.tsx`, `site.ts`, `App()`, `getRoute()`, `parseRoute()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (5 nodes): `extractPathVariablesFromUrl()`, `path-variables-contract.test.mjs`, `read()`, `resolvePathVariablesInUrl()`, `syncPathVariablesWithUrl()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (5 nodes): `MockStorage`, `.getActiveEnvironment()`, `.getActiveEnvironmentName()`, `resolveString()`, `variable-resolver.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (4 nodes): `hasFile()`, `persistence-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (4 nodes): `hasFile()`, `docs-site-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (4 nodes): `hasFile()`, `rest-client-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (4 nodes): `hasFile()`, `universal-import-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (4 nodes): `hasFile()`, `local-only-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (4 nodes): `hasFile()`, `api-auth-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (4 nodes): `hasFile()`, `import-export-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (3 nodes): `App`, `KobeanRESTApp`, `KobeanRESTApp.swift`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (3 nodes): `variable-resolution-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (3 nodes): `history-viewer-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (3 nodes): `multiple-workspace-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (3 nodes): `environment-editor-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (3 nodes): `download-docs-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 74`** (3 nodes): `auto-update-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 76`** (3 nodes): `settings-contract.test.mjs`, `read()`, `readSource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 92`** (2 nodes): `persistence::WorkspaceSummary`, `.from()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `normalize_graphql_body()` connect `Community 4` to `Community 0`, `Community 1`?**
  _High betweenness centrality (0.136) - this node is a cross-community bridge._
- **Why does `ok` connect `Community 0` to `Community 2`, `Community 4`, `Community 23`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Are the 104 inferred relationships involving `ok` (e.g. with `export_openapi_30_spec()` and `import_openapi_30_spec()`) actually correct?**
  _`ok` has 104 INFERRED edges - model-reasoned connections that need verification._
- **Are the 9 inferred relationships involving `ensure_database()` (e.g. with `persistence_round_trip_and_secret_redaction()` and `openapi_export_and_mcp_list_collections()`) actually correct?**
  _`ensure_database()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Are the 47 inferred relationships involving `String` (e.g. with `normalize_graphql_body()` and `uniffiTraitInterfaceCall()`) actually correct?**
  _`String` has 47 INFERRED edges - model-reasoned connections that need verification._
- **What connects `OpenApiExportResult`, `MockRoute`, `MockRequestLog` to the rest of the system?**
  _248 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._