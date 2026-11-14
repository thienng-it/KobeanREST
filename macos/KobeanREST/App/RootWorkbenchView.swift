import SwiftUI

struct RootWorkbenchView: View {
    @Bindable var appState: AppState
    @State private var columnVisibility: NavigationSplitViewVisibility = .all

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            SidebarView(appState: appState)
                .navigationSplitViewColumnWidth(min: 220, ideal: 260, max: 340)
        } detail: {
            if appState.isLoadingWorkspace && appState.workspace == nil {
                VStack(spacing: 10) {
                    ProgressView()
                    Text("Loading workspace…")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = appState.workspaceError, appState.workspace == nil {
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 28))
                        .foregroundStyle(.red)
                    Text("Unable to Open Workspace")
                        .font(.system(size: 15, weight: .semibold))
                    Text(error)
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 420)
                    Button("Retry") {
                        Task { await appState.bootstrap() }
                    }
                    .buttonStyle(.borderedProminent)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                WorkbenchView(appState: appState)
            }
        }
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                environmentPicker
                Button {
                    appState.isEnvironmentSheetPresented = true
                } label: {
                    Label("Environments", systemImage: "key.horizontal")
                }
                .help("Manage Environments & Keychain Secrets")

                Button {
                    appState.isImportSheetPresented = true
                } label: {
                    Label("Import", systemImage: "square.and.arrow.down.on.square")
                }
                .help("Import cURL, Postman, OpenAPI, Insomnia, or HAR")

                toolsMenu

                Button {
                    appState.toggleSplitOrientation()
                } label: {
                    Label(
                        appState.splitOrientation == .horizontal ? "Vertical Split" : "Horizontal Split",
                        systemImage: appState.splitOrientation == .horizontal
                            ? "rectangle.split.1x2"
                            : "rectangle.split.2x1"
                    )
                }
                .help("Toggle Split Layout (⌘\\)")
            }
        }
        .sheet(isPresented: $appState.isEnvironmentSheetPresented) {
            EnvironmentManagerView(appState: appState)
        }
        .sheet(isPresented: $appState.isImportSheetPresented) {
            ImportSheetView(appState: appState)
        }
        .sheet(isPresented: $appState.isRunnerSheetPresented) {
            if let workspace = appState.workspace {
                CollectionRunnerSheetView(bridge: appState.bridge, workspace: workspace)
            }
        }
        .sheet(isPresented: $appState.isMockServerSheetPresented) {
            MockServerSheetView(
                collections: appState.workspace?.collections ?? [],
                folders: appState.workspace?.folders ?? [],
                requests: appState.workspace?.requests ?? []
            )
        }
        .sheet(isPresented: $appState.isMcpSheetPresented) {
            McpToolsSheetView(dataDirectoryURL: appState.bridge.dataDirectoryURL)
        }
        .preferredColorScheme(preferredColorScheme)
        .task {
            if appState.workspace == nil {
                await appState.bootstrap()
            }
        }
    }

    @ViewBuilder
    private var environmentPicker: some View {
        let environments = appState.workspace?.environments ?? []
        let activeName = appState.workspace?.activeEnvironment ?? ""

        Menu {
            if !activeName.isEmpty {
                Button("No Environment") {
                    Task { await appState.selectEnvironment(name: "") }
                }
                Divider()
            }
            ForEach(environments) { env in
                Button {
                    Task { await appState.selectEnvironment(name: env.name) }
                } label: {
                    HStack {
                        Text(env.name)
                        if env.name == activeName {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
            Divider()
            Button("Manage Environments…") {
                appState.isEnvironmentSheetPresented = true
            }
        } label: {
            Label(
                activeName.isEmpty ? "No Environment" : activeName,
                systemImage: "globe"
            )
        }
        .help("Select Active Environment")
    }

    private var toolsMenu: some View {
        Menu {
            Button {
                appState.isRunnerSheetPresented = true
            } label: {
                Label("Collection Runner", systemImage: "play.rectangle.on.rectangle")
            }
            .disabled(appState.workspace == nil)

            Button {
                appState.isMockServerSheetPresented = true
            } label: {
                Label("Mock Server", systemImage: "server.rack")
            }

            Button {
                appState.isMcpSheetPresented = true
            } label: {
                Label("MCP Tools", systemImage: "cpu")
            }

            Divider()

            Button {
                Task { await appState.exportWorkspaceToFile() }
            } label: {
                Label("Export Workspace JSON…", systemImage: "square.and.arrow.up")
            }
            .disabled(appState.workspace == nil)
        } label: {
            Label("Tools", systemImage: "wrench.and.screwdriver")
        }
        .help("Collection Runner, Mock Server, MCP Tools & Workspace Export")
    }

    private var preferredColorScheme: ColorScheme? {
        switch appState.settings.theme {
        case "light": return .light
        case "dark": return .dark
        default: return nil
        }
    }
}
