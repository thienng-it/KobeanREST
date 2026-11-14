import SwiftUI

struct SettingsView: View {
    @Bindable var appState: AppState
    @State private var storageStatus: FfiLocalStorageStatus?

    var body: some View {
        Form {
            Section("Appearance & Response Viewer") {
                Picker("Theme", selection: Binding(
                    get: { appState.settings.theme },
                    set: { newTheme in
                        var copy = appState.settings
                        copy.theme = newTheme
                        Task { await appState.saveSettings(copy) }
                    }
                )) {
                    Text("System").tag("system")
                    Text("Light").tag("light")
                    Text("Dark").tag("dark")
                }

                Toggle("Wrap long lines in response viewer", isOn: Binding(
                    get: { appState.settings.responseAutoWrap ?? true },
                    set: { wrap in
                        var copy = appState.settings
                        copy.responseAutoWrap = wrap
                        Task { await appState.saveSettings(copy) }
                    }
                ))
            }

            Section("Privacy & Local-Only Storage") {
                Toggle("Redact sensitive headers & tokens on export", isOn: Binding(
                    get: { appState.settings.exportRedactionEnabled },
                    set: { enabled in
                        var copy = appState.settings
                        copy.exportRedactionEnabled = enabled
                        Task { await appState.saveSettings(copy) }
                    }
                ))

                Toggle("Redact diagnostics & logs", isOn: Binding(
                    get: { appState.settings.diagnosticsRedactionEnabled },
                    set: { enabled in
                        var copy = appState.settings
                        copy.diagnosticsRedactionEnabled = enabled
                        Task { await appState.saveSettings(copy) }
                    }
                ))

                LabeledContent("Database Directory") {
                    Text(appState.bridge.dataDirectoryURL.path)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                }

                if let storageStatus {
                    LabeledContent("Database Engine") {
                        Text(storageStatus.database)
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                    }
                    LabeledContent("Secret Storage") {
                        Text(storageStatus.secretStorage)
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .formStyle(.grouped)
        .frame(width: 520, height: 340)
        .task {
            storageStatus = await appState.bridge.localStorageStatus()
        }
    }
}
