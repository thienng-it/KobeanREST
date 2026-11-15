import SwiftUI
import UniformTypeIdentifiers

struct WorkbenchView: View {
    @Bindable var appState: AppState
    @FocusState private var isURLFocused: Bool
    @State private var tabDragState = TabDragState()

    var body: some View {
        VStack(spacing: 0) {
            tabStrip
            Divider()

            if let tab = appState.activeTab {
                requestToolbar(tab: tab)
                Divider()
                splitContent(tab: tab)
            } else {
                emptyWorkbenchView
            }
        }
        .onChange(of: appState.urlFocusTrigger) { _, _ in
            isURLFocused = true
        }
        .sheet(isPresented: $appState.isSnippetSheetPresented) {
            if let tab = appState.activeTab {
                SnippetSheetView(
                    request: tab.request,
                    customMethod: tab.customMethod.isEmpty ? nil : tab.customMethod
                )
            }
        }
    }

    @MainActor
    private final class TabDragState {
        var draggingTabID: UUID?
        var lastSwappedTargetID: UUID?
        var lastSwapAt: Date = .distantPast
        var lastMovedToEndAt: Date = .distantPast

        func begin(tabID: UUID) {
            draggingTabID = tabID
            lastSwappedTargetID = nil
            lastSwapAt = .distantPast
            lastMovedToEndAt = .distantPast
        }

        func reset() {
            draggingTabID = nil
            lastSwappedTargetID = nil
            lastSwapAt = .distantPast
            lastMovedToEndAt = .distantPast
        }
    }

    private struct TabDropDelegate: DropDelegate {
        /// `nil` targets the trailing end of the tab strip.
        let targetTabID: UUID?
        let appState: AppState
        let dragState: TabDragState

        func validateDrop(info: DropInfo) -> Bool {
            MainActor.assumeIsolated {
                dragState.draggingTabID != nil
            }
        }

        func dropUpdated(info: DropInfo) -> DropProposal? {
            MainActor.assumeIsolated {
                dragState.draggingTabID != nil
                    ? DropProposal(operation: .move)
                    : DropProposal(operation: .forbidden)
            }
        }

        func dropEntered(info: DropInfo) {
            MainActor.assumeIsolated {
                guard let draggedID = dragState.draggingTabID,
                      draggedID != targetTabID else {
                    return
                }
                let now = Date()
                if let targetTabID {
                    if dragState.lastSwappedTargetID == targetTabID,
                       now.timeIntervalSince(dragState.lastSwapAt) < 0.22 {
                        return
                    }
                    dragState.lastSwappedTargetID = targetTabID
                    dragState.lastSwapAt = now
                    withAnimation(.easeInOut(duration: 0.15)) {
                        appState.moveTab(fromID: draggedID, toID: targetTabID)
                    }
                } else {
                    guard now.timeIntervalSince(dragState.lastMovedToEndAt) >= 0.22 else { return }
                    dragState.lastMovedToEndAt = now
                    dragState.lastSwappedTargetID = nil
                    withAnimation(.easeInOut(duration: 0.15)) {
                        appState.moveTabToEnd(id: draggedID)
                    }
                }
            }
        }

        func performDrop(info: DropInfo) -> Bool {
            MainActor.assumeIsolated {
                let accepted = dragState.draggingTabID != nil
                dragState.reset()
                return accepted
            }
        }
    }

    // MARK: - Multi-Tab Strip

    private var tabStrip: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 4) {
                HStack(spacing: 2) {
                    ForEach(appState.tabs) { tab in
                        tabItem(tab)
                    }
                }
                newTabButton
                Spacer(minLength: 0)
                    .contentShape(Rectangle())
                    .onDrop(of: [.plainText], delegate: TabDropDelegate(
                        targetTabID: nil,
                        appState: appState,
                        dragState: tabDragState
                    ))
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 5)

            HStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 2) {
                            ForEach(appState.tabs) { tab in
                                tabItem(tab)
                                    .id(tab.id)
                            }
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 5)
                    }
                    .onChange(of: appState.selectedTabID) { _, selectedID in
                        guard let selectedID else { return }
                        withAnimation(.easeInOut(duration: 0.15)) {
                            proxy.scrollTo(selectedID, anchor: .trailing)
                        }
                    }
                }

                Divider()
                    .frame(height: 18)

                newTabButton
                    .padding(.horizontal, 4)
            }
        }
        .frame(height: 36)
        .background(Color(nsColor: .controlBackgroundColor))
    }

    private var newTabButton: some View {
        Button {
            appState.createNewTab()
        } label: {
            Image(systemName: "plus")
                .font(.system(size: 11, weight: .semibold))
                .frame(width: 24, height: 24)
                .contentShape(Rectangle())
        }
        .buttonStyle(.borderless)
        .help("New Request Tab (⌘T)")
        .accessibilityLabel("New Request Tab")
    }

    private func tabItem(_ tab: RequestTab) -> some View {
        let isSelected = tab.id == appState.selectedTabID
        return HStack(spacing: 6) {
            MethodBadge(method: tab.request.method)
            Text(tab.title)
                .font(.system(size: 12, weight: isSelected ? .semibold : .regular))
                .lineLimit(1)
                .frame(maxWidth: 160, alignment: .leading)

            if tab.isDirty {
                Circle()
                    .fill(Color.accentColor)
                    .frame(width: 6, height: 6)
            }

            Button {
                appState.closeTab(id: tab.id)
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            .help("Close Tab (⌘W)")
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(
            isSelected ? Color(nsColor: .textBackgroundColor) : Color.clear,
            in: RoundedRectangle(cornerRadius: 6)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 6)
                .stroke(isSelected ? Color.primary.opacity(0.12) : Color.clear, lineWidth: 1)
        )
        .contentShape(Rectangle())
        .onTapGesture {
            tabDragState.reset()
            appState.selectedTabID = tab.id
        }
        .onDrag {
            tabDragState.begin(tabID: tab.id)
            return NSItemProvider(object: tab.id.uuidString as NSString)
        }
        .onDrop(of: [.plainText], delegate: TabDropDelegate(
            targetTabID: tab.id,
            appState: appState,
            dragState: tabDragState
        ))
    }

    // MARK: - URL Bar

    private func requestToolbar(tab: RequestTab) -> some View {
        let isLoading: Bool = {
            if case .loading = tab.responseState { return true }
            return false
        }()

        let tabID = tab.id

        let methodBinding = Binding<String>(
            get: { tab.request.method },
            set: { newMethod in
                appState.updateTab(id: tabID) {
                    guard $0.request.method != newMethod else { return }
                    $0.request.method = newMethod
                    $0.isDirty = true
                }
            }
        )

        let urlBinding = Binding<String>(
            get: { tab.request.url },
            set: { newURL in
                var changed = false
                appState.updateTab(id: tabID) {
                    guard $0.request.url != newURL else { return }
                    $0.request.url = newURL
                    $0.isDirty = true
                    changed = true
                }
                if changed && appState.selectedTabID == tabID {
                    Task { await appState.syncPathVariablesForActiveTab() }
                }
            }
        )

        let customMethodBinding = Binding<String>(
            get: { tab.customMethod },
            set: { newCustom in
                appState.updateTab(id: tabID) {
                    guard $0.customMethod != newCustom else { return }
                    $0.customMethod = newCustom
                }
            }
        )

        let nameBinding = Binding<String>(
            get: { tab.request.name },
            set: { newName in
                appState.updateTab(id: tabID) {
                    guard $0.request.name != newName else { return }
                    $0.request.name = newName
                    $0.isDirty = true
                }
            }
        )

        let pathVarCount = tab.request.pathVariables?.count ?? 0

        return VStack(spacing: 6) {
            HStack(spacing: 8) {
                Picker("Method", selection: methodBinding) {
                    ForEach(HTTPMethod.allCases) { method in
                        Text(method.rawValue)
                            .foregroundStyle(method.color)
                            .tag(method.rawValue)
                    }
                }
                .labelsHidden()
                .frame(width: 96)

                if tab.request.method == HTTPMethod.custom.rawValue {
                    TextField("METHOD", text: customMethodBinding)
                        .textFieldStyle(.roundedBorder)
                        .font(.system(size: 12, weight: .semibold, design: .monospaced))
                        .frame(width: 90)
                }

                HStack(spacing: 6) {
                    TextField("https://api.example.com/v1/users/:id", text: urlBinding)
                        .id(tab.id)
                        .textFieldStyle(.plain)
                        .font(.system(size: 12.5, design: .monospaced))
                        .focused($isURLFocused)
                        .onSubmit {
                            appState.sendActiveTab()
                        }

                    if pathVarCount > 0 {
                        Text(":\(pathVarCount)")
                            .font(.system(size: 10.5, weight: .semibold, design: .monospaced))
                            .monospacedDigit()
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.primary.opacity(0.07), in: Capsule())
                            .help("\(pathVarCount) path parameter(s) detected")
                    }
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 6))
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(isURLFocused ? Color.accentColor : Color.primary.opacity(0.12), lineWidth: 1)
                )

                if isLoading {
                    Button {
                        appState.cancelActiveTab()
                    } label: {
                        Label("Cancel", systemImage: "stop.fill")
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.regular)
                } else {
                    Button {
                        appState.sendActiveTab()
                    } label: {
                        Label("Send", systemImage: "paperplane.fill")
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.regular)
                }

                Button {
                    Task { await appState.saveActiveTab() }
                } label: {
                    Label("Save", systemImage: "square.and.arrow.down")
                }
                .buttonStyle(.bordered)
                .disabled(!tab.isDirty && tab.isPersisted)
                .help("Save Request (⌘S)")

                Button {
                    appState.isSnippetSheetPresented = true
                } label: {
                    Label("Code Snippet", systemImage: "chevron.left.forwardslash.chevron.right")
                }
                .buttonStyle(.bordered)
                .help("Generate Code Snippet (cURL, Python, JS, Swift, HTTPie, Go)")
            }

            HStack(spacing: 8) {
                Text("Name:")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.secondary)
                TextField("Request name", text: nameBinding)
                    .id(tab.id)
                    .textFieldStyle(.plain)
                    .font(.system(size: 11.5, weight: .medium))
                    .frame(maxWidth: 280)
                Spacer()
                if let statusMsg = appState.statusMessage {
                    Text(statusMsg)
                        .font(.system(size: 11))
                        .foregroundStyle(.orange)
                        .lineLimit(1)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color(nsColor: .windowBackgroundColor))
    }

    // MARK: - Split Inspector + Response

    @ViewBuilder
    private func splitContent(tab: RequestTab) -> some View {
        let responseTabBinding = Binding<ResponseInspectorTab>(
            get: { tab.responseInspectorTab },
            set: { newTab in
                appState.updateTab(id: tab.id) { $0.responseInspectorTab = newTab }
            }
        )

        if tab.request.method.uppercased() == "WS" {
            WebSocketWorkbenchView(url: tab.request.url, headers: tab.request.headers)
        } else if appState.splitOrientation == .horizontal {
            HSplitView {
                requestInspector(tab: tab)
                    .frame(minWidth: 340, minHeight: 240)
                ResponseInspectorView(
                    responseState: tab.responseState,
                    selectedTab: responseTabBinding,
                    autoWrap: appState.settings.responseAutoWrap ?? true,
                    testResults: tab.testResults,
                    scriptLogs: tab.scriptLogs,
                    onCancel: { appState.cancelActiveTab() },
                    onRetry: { appState.sendActiveTab() }
                )
                .frame(minWidth: 340, minHeight: 240)
            }
        } else {
            VSplitView {
                requestInspector(tab: tab)
                    .frame(minWidth: 340, minHeight: 200)
                ResponseInspectorView(
                    responseState: tab.responseState,
                    selectedTab: responseTabBinding,
                    autoWrap: appState.settings.responseAutoWrap ?? true,
                    testResults: tab.testResults,
                    scriptLogs: tab.scriptLogs,
                    onCancel: { appState.cancelActiveTab() },
                    onRetry: { appState.sendActiveTab() }
                )
                .frame(minWidth: 340, minHeight: 200)
            }
        }
    }

    // MARK: - Request Inspector

    private func requestInspector(tab: RequestTab) -> some View {
        let inspectorBinding = Binding<RequestInspectorTab>(
            get: { tab.inspectorTab },
            set: { newTab in
                appState.updateTab(id: tab.id) { $0.inspectorTab = newTab }
            }
        )

        return VStack(spacing: 0) {
            HStack {
                Picker("Request Inspector", selection: inspectorBinding) {
                    ForEach(RequestInspectorTab.allCases) { section in
                        Text(sectionTitle(section, tab: tab)).tag(section)
                    }
                }
                .pickerStyle(.segmented)
                .labelsHidden()
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(nsColor: .controlBackgroundColor))

            Divider()

            Group {
                switch tab.inspectorTab {
                case .params:
                    paramsEditor(tab: tab)
                case .headers:
                    headersEditor(tab: tab)
                case .auth:
                    authEditor(tab: tab)
                case .body:
                    bodyEditor(tab: tab)
                case .scripts:
                    scriptsEditor(tab: tab)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(nsColor: .textBackgroundColor))
        }
    }

    private func sectionTitle(_ tabKind: RequestInspectorTab, tab: RequestTab) -> String {
        switch tabKind {
        case .params:
            let count = tab.request.decodedQueryParams.count + (tab.request.pathVariables?.count ?? 0)
            return count > 0 ? "Params (\(count))" : "Params"
        case .headers:
            let count = tab.request.headers.filter(\.enabled).count
            return count > 0 ? "Headers (\(count))" : "Headers"
        case .auth:
            return tab.request.authMode == "none" ? "Auth" : "Auth •"
        case .body:
            return tab.request.body.isEmpty ? "Body" : "Body •"
        case .scripts:
            return (!tab.preScript.isEmpty || !tab.postScript.isEmpty) ? "Scripts •" : "Scripts"
        }
    }

    // MARK: - Params Editor (Query + Path)

    private func paramsEditor(tab: RequestTab) -> some View {
        let queryParams = tab.request.decodedQueryParams
        let pathVars = tab.request.pathVariables ?? []

        return ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Query Parameters")
                            .font(.system(size: 12.5, weight: .semibold))
                        Spacer()
                        Button {
                            var entries = queryParams
                            entries.append(HeaderEntry(key: "", value: "", enabled: true))
                            updateQueryParamsAndURL(entries)
                        } label: {
                            Label("Add Param", systemImage: "plus")
                                .font(.system(size: 11.5))
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                    }

                    if queryParams.isEmpty {
                        Text("No query parameters. Click Add Param or append ?key=value to the URL.")
                            .font(.system(size: 11.5))
                            .foregroundStyle(.secondary)
                    } else {
                        KeyValueRowsEditor(
                            entries: queryParams,
                            keyPlaceholder: "Parameter",
                            valuePlaceholder: "Value",
                            onChange: { updated in
                                updateQueryParamsAndURL(updated)
                            }
                        )
                    }
                }

                Divider()

                VStack(alignment: .leading, spacing: 8) {
                    Text("Path Variables")
                        .font(.system(size: 12.5, weight: .semibold))

                    if pathVars.isEmpty {
                        Text("Include :id or {id} in the URL path to populate path parameters.")
                            .font(.system(size: 11.5))
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(Array(pathVars.enumerated()), id: \.element.id) { idx, entry in
                            HStack(spacing: 8) {
                                Toggle("", isOn: Binding(
                                    get: { entry.enabled },
                                    set: { enabled in
                                        appState.updateActiveRequest { req in
                                            var list = req.pathVariables ?? []
                                            guard idx < list.count else { return }
                                            list[idx].enabled = enabled
                                            req.pathVariables = list
                                        }
                                    }
                                ))
                                .toggleStyle(.checkbox)
                                .labelsHidden()

                                Text(":\(entry.key)")
                                    .font(.system(size: 12, weight: .semibold, design: .monospaced))
                                    .frame(width: 140, alignment: .leading)

                                TextField("Value", text: Binding(
                                    get: { entry.value },
                                    set: { val in
                                        appState.updateActiveRequest { req in
                                            var list = req.pathVariables ?? []
                                            guard idx < list.count else { return }
                                            list[idx].value = val
                                            req.pathVariables = list
                                        }
                                    }
                                ))
                                .textFieldStyle(.roundedBorder)
                                .font(.system(size: 12, design: .monospaced))
                            }
                        }
                    }
                }
            }
            .padding(12)
        }
    }

    private func updateQueryParamsAndURL(_ entries: [HeaderEntry]) {
        appState.updateActiveRequest { req in
            req.setQueryParams(entries)
            let baseURL = req.url.split(separator: "?", maxSplits: 1, omittingEmptySubsequences: false).first.map(String.init) ?? req.url
            let activePairs = entries.filter { $0.enabled && !$0.key.isEmpty }
            if activePairs.isEmpty {
                req.url = baseURL
            } else {
                let query = activePairs
                    .map { "\($0.key)=\($0.value)" }
                    .joined(separator: "&")
                req.url = "\(baseURL)?\(query)"
            }
        }
    }

    // MARK: - Headers Editor

    private func headersEditor(tab: RequestTab) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Request Headers")
                        .font(.system(size: 12.5, weight: .semibold))
                    Spacer()
                    Button {
                        appState.updateActiveRequest { req in
                            req.headers.append(HeaderEntry(key: "", value: "", enabled: true))
                        }
                    } label: {
                        Label("Add Header", systemImage: "plus")
                            .font(.system(size: 11.5))
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }

                if tab.request.headers.isEmpty {
                    Text("No custom headers configured.")
                        .font(.system(size: 11.5))
                        .foregroundStyle(.secondary)
                } else {
                    KeyValueRowsEditor(
                        entries: tab.request.headers,
                        keyPlaceholder: "Header",
                        valuePlaceholder: "Value",
                        onChange: { updated in
                            appState.updateActiveRequest { $0.headers = updated }
                        }
                    )
                }
            }
            .padding(12)
        }
    }

    // MARK: - Auth Editor

    private func authEditor(tab: RequestTab) -> some View {
        let mode = AuthMode.from(tab.request.authMode)
        let config = tab.request.decodedAuthConfig

        let modeBinding = Binding<AuthMode>(
            get: { mode },
            set: { newMode in
                appState.updateActiveRequest { $0.authMode = newMode.rawValue }
            }
        )

        func updateConfig(_ mutate: @escaping (inout AuthConfig) -> Void) {
            appState.updateActiveRequest { req in
                var cfg = req.decodedAuthConfig
                mutate(&cfg)
                req.setAuthConfig(cfg)
            }
        }

        return Form {
            Picker("Auth Mode", selection: modeBinding) {
                ForEach(AuthMode.allCases) { item in
                    Text(item.displayName).tag(item)
                }
            }

            switch mode {
            case .none:
                Text("Inherits authentication from parent folder or collection, or sends unauthenticated.")
                    .font(.system(size: 11.5))
                    .foregroundStyle(.secondary)

            case .basic:
                TextField("Username", text: Binding(
                    get: { config.username ?? "" },
                    set: { v in updateConfig { $0.username = v } }
                ))
                .font(.system(size: 12, design: .monospaced))
                SecureField("Password", text: Binding(
                    get: { config.password ?? "" },
                    set: { v in updateConfig { $0.password = v } }
                ))
                .font(.system(size: 12, design: .monospaced))

            case .bearer:
                TextField("Bearer Token (supports {{var}})", text: Binding(
                    get: { config.token ?? "" },
                    set: { v in updateConfig { $0.token = v } }
                ))
                .font(.system(size: 12, design: .monospaced))

            case .apikey:
                TextField("Key Name", text: Binding(
                    get: { config.keyName ?? "" },
                    set: { v in updateConfig { $0.keyName = v } }
                ))
                .font(.system(size: 12, design: .monospaced))

                TextField("Key Value", text: Binding(
                    get: { config.keyValue ?? "" },
                    set: { v in updateConfig { $0.keyValue = v } }
                ))
                .font(.system(size: 12, design: .monospaced))

                Picker("Placement", selection: Binding(
                    get: { config.placement ?? "header" },
                    set: { v in updateConfig { $0.placement = v } }
                )) {
                    Text("Header").tag("header")
                    Text("Query Parameter").tag("query")
                }

            case .oauth2:
                Picker("Grant Type", selection: Binding(
                    get: { config.grantType ?? "authorization_code" },
                    set: { v in updateConfig { $0.grantType = v } }
                )) {
                    Text("Authorization Code (PKCE)").tag("authorization_code")
                    Text("Client Credentials").tag("client_credentials")
                    Text("Password Credentials").tag("password_credentials")
                }

                if (config.grantType ?? "authorization_code") == "authorization_code" {
                    TextField("Authorization URL", text: Binding(
                        get: { config.authUrl ?? "" },
                        set: { v in updateConfig { $0.authUrl = v } }
                    ))
                    .font(.system(size: 12, design: .monospaced))

                    TextField("Redirect URI", text: Binding(
                        get: { config.redirectUri ?? "kobeanrest://oauth/callback" },
                        set: { v in updateConfig { $0.redirectUri = v } }
                    ), prompt: Text("kobeanrest://oauth/callback"))
                    .font(.system(size: 12, design: .monospaced))
                }

                TextField("Access Token URL", text: Binding(
                    get: { config.accessTokenUrl ?? "" },
                    set: { v in updateConfig { $0.accessTokenUrl = v } }
                ))
                .font(.system(size: 12, design: .monospaced))

                TextField("Client ID", text: Binding(
                    get: { config.clientId ?? "" },
                    set: { v in updateConfig { $0.clientId = v } }
                ))
                .font(.system(size: 12, design: .monospaced))

                SecureField("Client Secret", text: Binding(
                    get: { config.clientSecret ?? "" },
                    set: { v in updateConfig { $0.clientSecret = v } }
                ))
                .font(.system(size: 12, design: .monospaced))

                if config.grantType == "password_credentials" {
                    TextField("Username", text: Binding(
                        get: { config.username ?? "" },
                        set: { v in updateConfig { $0.username = v } }
                    ))
                    .font(.system(size: 12, design: .monospaced))

                    SecureField("Password", text: Binding(
                        get: { config.password ?? "" },
                        set: { v in updateConfig { $0.password = v } }
                    ))
                    .font(.system(size: 12, design: .monospaced))
                }

                TextField("Scope", text: Binding(
                    get: { config.scope ?? "" },
                    set: { v in updateConfig { $0.scope = v } }
                ))
                .font(.system(size: 12, design: .monospaced))

                TextField("Access Token", text: Binding(
                    get: { config.token ?? "" },
                    set: { v in updateConfig { $0.token = v } }
                ))
                .font(.system(size: 12, design: .monospaced))

                TextField("Refresh Token", text: Binding(
                    get: { config.refreshToken ?? "" },
                    set: { v in updateConfig { $0.refreshToken = v.isEmpty ? nil : v } }
                ))
                .font(.system(size: 12, design: .monospaced))

                if let expiresAt = config.expiresAt {
                    let expiryDate = Date(timeIntervalSince1970: Double(expiresAt) / 1000.0)
                    HStack {
                        Text("Token Expires")
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text(expiryDate, style: .relative)
                            .font(.system(size: 11.5, design: .monospaced))
                            .foregroundStyle(expiryDate > Date() ? Color.secondary : Color.orange)
                    }
                    .font(.system(size: 11.5))
                }

                HStack(spacing: 10) {
                    if (config.grantType ?? "authorization_code") == "authorization_code" {
                        Button {
                            Task { await appState.authorizeOAuth2ForActiveTab() }
                        } label: {
                            Label("Authorize with Browser", systemImage: "safari")
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(appState.isAuthorizingOAuth)
                    }

                    Button {
                        Task {
                            if let refresh = config.refreshToken, !refresh.isEmpty {
                                await appState.refreshOAuth2ForActiveTab()
                            } else {
                                await appState.authorizeOAuth2ForActiveTab()
                            }
                        }
                    } label: {
                        Label("Fetch / Refresh Token", systemImage: "arrow.clockwise")
                    }
                    .buttonStyle(.bordered)
                    .disabled(
                        appState.isAuthorizingOAuth ||
                        ((config.grantType ?? "authorization_code") == "authorization_code" && (config.refreshToken?.isEmpty ?? true))
                    )

                    if appState.isAuthorizingOAuth {
                        ProgressView()
                            .controlSize(.small)
                    }
                }
            }
        }
        .formStyle(.grouped)
    }

    // MARK: - Body Editor

    private func bodyEditor(tab: RequestTab) -> some View {
        let mime = BodyMimeType.from(tab.request.bodyMimeType)

        let mimeBinding = Binding<BodyMimeType>(
            get: { mime },
            set: { newMime in
                appState.updateActiveRequest { $0.bodyMimeType = newMime.rawValue }
            }
        )

        let bodyBinding = Binding<String>(
            get: { tab.request.body },
            set: { newBody in
                appState.updateActiveRequest { $0.body = newBody }
            }
        )

        return VStack(spacing: 0) {
            HStack(spacing: 10) {
                Picker("Body Type", selection: mimeBinding) {
                    ForEach(BodyMimeType.allCases) { item in
                        Text(item.displayName).tag(item)
                    }
                }
                .labelsHidden()
                .frame(width: 170)

                Spacer()

                if mime == .json {
                    Button("Format JSON") {
                        formatBodyJSON(tab.request.body)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                } else if mime == .graphql {
                    Button("Introspection Query") {
                        appState.updateActiveRequest { $0.body = GraphQLQuery.introspectionQuery }
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(nsColor: .underPageBackgroundColor))

            Divider()

            switch mime {
            case .none:
                Text("This request has no body.")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

            case .formUrlEncoded, .multipartFormData:
                ScrollView {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Form Fields")
                                .font(.system(size: 12.5, weight: .semibold))
                            Spacer()
                            Button {
                                var entries = tab.request.decodedBodyForm
                                entries.append(HeaderEntry(key: "", value: "", enabled: true))
                                appState.updateActiveRequest { $0.setBodyForm(entries) }
                            } label: {
                                Label("Add Field", systemImage: "plus")
                                    .font(.system(size: 11.5))
                            }
                            .buttonStyle(.bordered)
                            .controlSize(.small)
                        }

                        KeyValueRowsEditor(
                            entries: tab.request.decodedBodyForm,
                            keyPlaceholder: "Field",
                            valuePlaceholder: "Value",
                            onChange: { updated in
                                appState.updateActiveRequest { $0.setBodyForm(updated) }
                            }
                        )
                    }
                    .padding(12)
                }

            default:
                TextEditor(text: bodyBinding)
                    .font(.system(size: 12.5, design: .monospaced))
                    .scrollContentBackground(.hidden)
                    .padding(6)
            }
        }
    }

    private func formatBodyJSON(_ raw: String) {
        guard let data = raw.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data),
              JSONSerialization.isValidJSONObject(obj),
              let pretty = try? JSONSerialization.data(withJSONObject: obj, options: [.prettyPrinted, .sortedKeys]),
              let formatted = String(data: pretty, encoding: .utf8) else {
            return
        }
        appState.updateActiveRequest { $0.body = formatted }
    }

    private func scriptsEditor(tab: RequestTab) -> some View {
        let preBinding = Binding<String>(
            get: { tab.preScript },
            set: { newValue in
                appState.updateTab(id: tab.id) { target in
                    target.preScript = newValue
                    target.isDirty = true
                }
            }
        )

        let postBinding = Binding<String>(
            get: { tab.postScript },
            set: { newValue in
                appState.updateTab(id: tab.id) { target in
                    target.postScript = newValue
                    target.isDirty = true
                }
            }
        )

        return VSplitView {
            VStack(spacing: 0) {
                HStack(spacing: 8) {
                    Label("Pre-Request Script (kb.* / pm.*)", systemImage: "play.square")
                        .font(.system(size: 11.5, weight: .semibold))
                    Spacer()
                    Button("Insert Example") {
                        let snippet = """
                        // Runs before the HTTP request is dispatched
                        kb.request.setHeader("X-Request-Time", new Date().toISOString());
                        console.log("Sending", kb.request.method, kb.request.url);
                        """
                        appState.updateTab(id: tab.id) { target in
                            target.preScript = target.preScript.isEmpty
                                ? snippet
                                : "\(target.preScript)\n\n\(snippet)"
                            target.isDirty = true
                        }
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color(nsColor: .underPageBackgroundColor))

                Divider()

                TextEditor(text: preBinding)
                    .font(.system(size: 12, design: .monospaced))
                    .scrollContentBackground(.hidden)
                    .padding(6)
            }
            .frame(minHeight: 110)

            VStack(spacing: 0) {
                HStack(spacing: 8) {
                    Label("Post-Response Test Script", systemImage: "checkmark.seal")
                        .font(.system(size: 11.5, weight: .semibold))
                    Spacer()
                    Button("Insert Example") {
                        let snippet = """
                        // Runs after the HTTP response is received
                        pm.test("Status is 2xx", function () {
                          pm.expect(pm.response.code).to.be.within(200, 299);
                        });
                        """
                        appState.updateTab(id: tab.id) { target in
                            target.postScript = target.postScript.isEmpty
                                ? snippet
                                : "\(target.postScript)\n\n\(snippet)"
                            target.isDirty = true
                        }
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color(nsColor: .underPageBackgroundColor))

                Divider()

                TextEditor(text: postBinding)
                    .font(.system(size: 12, design: .monospaced))
                    .scrollContentBackground(.hidden)
                    .padding(6)
            }
            .frame(minHeight: 110)
        }
    }

    private var emptyWorkbenchView: some View {
        VStack(spacing: 12) {
            Image(systemName: "arrow.left.arrow.right.square")
                .font(.system(size: 32, weight: .light))
                .foregroundStyle(.secondary)
            Text("No Request Open")
                .font(.system(size: 15, weight: .semibold))
            Text("Select a request from the sidebar or create a new tab (⌘T).")
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
            Button("New Request Tab") {
                appState.createNewTab()
            }
            .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct KeyValueRowsEditor: View {
    let entries: [HeaderEntry]
    let keyPlaceholder: String
    let valuePlaceholder: String
    let onChange: ([HeaderEntry]) -> Void

    var body: some View {
        VStack(spacing: 6) {
            ForEach(Array(entries.enumerated()), id: \.element.id) { idx, entry in
                HStack(spacing: 8) {
                    Toggle("", isOn: Binding(
                        get: { entry.enabled },
                        set: { val in
                            var copy = entries
                            guard idx < copy.count else { return }
                            copy[idx].enabled = val
                            onChange(copy)
                        }
                    ))
                    .toggleStyle(.checkbox)
                    .labelsHidden()

                    TextField(keyPlaceholder, text: Binding(
                        get: { entry.key },
                        set: { val in
                            var copy = entries
                            guard idx < copy.count else { return }
                            copy[idx].key = val
                            onChange(copy)
                        }
                    ))
                    .textFieldStyle(.roundedBorder)
                    .font(.system(size: 12, design: .monospaced))
                    .frame(minWidth: 120)

                    TextField(valuePlaceholder, text: Binding(
                        get: { entry.value },
                        set: { val in
                            var copy = entries
                            guard idx < copy.count else { return }
                            copy[idx].value = val
                            onChange(copy)
                        }
                    ))
                    .textFieldStyle(.roundedBorder)
                    .font(.system(size: 12, design: .monospaced))

                    Button(role: .destructive) {
                        var copy = entries
                        guard idx < copy.count else { return }
                        copy.remove(at: idx)
                        onChange(copy)
                    } label: {
                        Image(systemName: "trash")
                            .font(.system(size: 11))
                    }
                    .buttonStyle(.borderless)
                }
                .frame(height: 26)
            }
        }
    }
}
