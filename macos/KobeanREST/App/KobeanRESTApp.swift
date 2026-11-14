import SwiftUI

@main
struct KobeanRESTApp: App {
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootWorkbenchView(appState: appState)
        }
        .defaultSize(width: 1380, height: 880)
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("New Request Tab") {
                    appState.createNewTab()
                }
                .keyboardShortcut("t", modifiers: [.command])

                Button("Close Tab") {
                    appState.closeActiveTab()
                }
                .keyboardShortcut("w", modifiers: [.command])
                .disabled(appState.selectedTabID == nil)

                Divider()

                Button("Save Request") {
                    Task { await appState.saveActiveTab() }
                }
                .keyboardShortcut("s", modifiers: [.command])
                .disabled(appState.activeTab == nil)

                Button("Import…") {
                    appState.isImportSheetPresented = true
                }
                .keyboardShortcut("i", modifiers: [.command, .shift])
            }

            CommandMenu("Request") {
                Button("Send Request") {
                    appState.sendActiveTab()
                }
                .keyboardShortcut(.return, modifiers: [.command])
                .disabled(appState.activeTab == nil)

                Button("Focus URL Bar") {
                    appState.focusURLBar()
                }
                .keyboardShortcut("k", modifiers: [.command])

                Button("Focus URL Bar (Alt)") {
                    appState.focusURLBar()
                }
                .keyboardShortcut("l", modifiers: [.command])

                Divider()

                Button("Toggle Split Orientation") {
                    appState.toggleSplitOrientation()
                }
                .keyboardShortcut("\\", modifiers: [.command])

                Button("Manage Environments…") {
                    appState.isEnvironmentSheetPresented = true
                }
                .keyboardShortcut("e", modifiers: [.command, .shift])
            }
        }

        Settings {
            SettingsView(appState: appState)
        }
    }
}
