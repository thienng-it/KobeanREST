import SwiftUI

struct EnvironmentManagerView: View {
    @Bindable var appState: AppState
    @Environment(\.dismiss) private var dismiss

    @State private var selectedEnvironmentName: String = ""
    @State private var newEnvironmentName: String = ""
    @State private var newVarKey: String = ""
    @State private var newVarValue: String = ""
    @State private var newVarIsSecret: Bool = false
    @State private var newVarMasked: Bool = false
    @State private var isAddingEnvironment: Bool = false

    private var environments: [EnvironmentSummary] {
        appState.workspace?.environments ?? []
    }

    private var activeEnvironment: EnvironmentSummary? {
        environments.first(where: { $0.name == selectedEnvironmentName }) ?? environments.first
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()

            HSplitView {
                environmentListPane
                    .frame(minWidth: 180, idealWidth: 200, maxWidth: 240)
                variablesPane
                    .frame(minWidth: 420)
            }
        }
        .frame(width: 720, height: 500)
        .onAppear {
            if selectedEnvironmentName.isEmpty {
                selectedEnvironmentName = appState.workspace?.activeEnvironment ?? environments.first?.name ?? ""
            }
        }
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Environments & Keychain Secrets")
                    .font(.system(size: 15, weight: .semibold))
                Text("Secret variables are stored in macOS Keychain (service: KobeanREST), never in SQLite.")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("Done") { dismiss() }
                .keyboardShortcut(.cancelAction)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    private var environmentListPane: some View {
        VStack(spacing: 0) {
            List(environments, selection: $selectedEnvironmentName) { env in
                HStack {
                    Text(env.name)
                        .font(.system(size: 12.5, weight: env.name == appState.workspace?.activeEnvironment ? .semibold : .regular))
                    Spacer()
                    if env.name == appState.workspace?.activeEnvironment {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 11))
                            .foregroundStyle(Color.accentColor)
                    }
                }
                .tag(env.name)
                .contextMenu {
                    Button("Set Active") {
                        Task { await appState.selectEnvironment(name: env.name) }
                    }
                    Divider()
                    Button("Delete", role: .destructive) {
                        Task {
                            await appState.deleteEnvironment(name: env.name)
                            if selectedEnvironmentName == env.name {
                                selectedEnvironmentName = appState.workspace?.environments.first?.name ?? ""
                            }
                        }
                    }
                }
            }
            .listStyle(.sidebar)

            Divider()

            if isAddingEnvironment {
                HStack(spacing: 6) {
                    TextField("Name", text: $newEnvironmentName)
                        .textFieldStyle(.roundedBorder)
                        .font(.system(size: 12))
                        .onSubmit { createEnv() }
                    Button("Add") { createEnv() }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.small)
                }
                .padding(8)
            } else {
                HStack {
                    Button {
                        isAddingEnvironment = true
                    } label: {
                        Label("New Environment", systemImage: "plus")
                            .font(.system(size: 12))
                    }
                    .buttonStyle(.borderless)
                    Spacer()
                }
                .padding(8)
            }
        }
    }

    @ViewBuilder
    private var variablesPane: some View {
        if let env = activeEnvironment {
            VStack(spacing: 0) {
                HStack {
                    Text(env.name)
                        .font(.system(size: 13, weight: .semibold))
                    Spacer()
                    if env.name != appState.workspace?.activeEnvironment {
                        Button("Set Active") {
                            Task { await appState.selectEnvironment(name: env.name) }
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                    } else {
                        Text("Active")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.green)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color(nsColor: .controlBackgroundColor))

                Divider()

                List {
                    ForEach(env.variables) { variable in
                        HStack(spacing: 8) {
                            Text(variable.key)
                                .font(.system(size: 12, weight: .medium, design: .monospaced))
                                .frame(width: 150, alignment: .leading)

                            if variable.secret || variable.secretRef != nil {
                                HStack(spacing: 4) {
                                    Image(systemName: "key.fill")
                                        .font(.system(size: 10))
                                        .foregroundStyle(.orange)
                                    Text(variable.secretRef ?? EnvironmentVariable.redactedPlaceholder)
                                        .font(.system(size: 11, design: .monospaced))
                                        .foregroundStyle(.secondary)
                                        .lineLimit(1)
                                        .truncationMode(.middle)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                            } else {
                                Text(variable.masked ? String(repeating: "•", count: max(4, min(12, variable.value.count))) : variable.value)
                                    .font(.system(size: 12, design: .monospaced))
                                    .foregroundStyle(.secondary)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }

                            Button(role: .destructive) {
                                Task {
                                    await appState.deleteVariable(environmentName: env.name, variable: variable)
                                }
                            } label: {
                                Image(systemName: "trash")
                                    .font(.system(size: 11))
                            }
                            .buttonStyle(.borderless)
                        }
                        .padding(.vertical, 2)
                    }
                }

                Divider()

                addVariableBar(for: env.name)
            }
        } else {
            VStack(spacing: 8) {
                Text("No Environments")
                    .font(.system(size: 13, weight: .semibold))
                Text("Create an environment on the left to manage variables and Keychain secrets.")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func addVariableBar(for envName: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                TextField("KEY", text: $newVarKey)
                    .textFieldStyle(.roundedBorder)
                    .font(.system(size: 12, design: .monospaced))
                    .frame(width: 150)

                if newVarIsSecret || newVarMasked {
                    SecureField("Secret value", text: $newVarValue)
                        .textFieldStyle(.roundedBorder)
                        .font(.system(size: 12, design: .monospaced))
                } else {
                    TextField("Value", text: $newVarValue)
                        .textFieldStyle(.roundedBorder)
                        .font(.system(size: 12, design: .monospaced))
                }

                Button("Save") {
                    let key = newVarKey
                    let value = newVarValue
                    let isSecret = newVarIsSecret
                    let isMasked = newVarMasked
                    newVarKey = ""
                    newVarValue = ""
                    Task {
                        await appState.saveVariable(
                            environmentName: envName,
                            key: key,
                            value: value,
                            isSecret: isSecret,
                            masked: isMasked
                        )
                    }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
                .disabled(newVarKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }

            HStack(spacing: 16) {
                Toggle("Store in macOS Keychain", isOn: $newVarIsSecret)
                    .toggleStyle(.checkbox)
                    .font(.system(size: 11.5))
                if !newVarIsSecret {
                    Toggle("Mask value", isOn: $newVarMasked)
                        .toggleStyle(.checkbox)
                        .font(.system(size: 11.5))
                }
                Spacer()
            }
        }
        .padding(12)
        .background(Color(nsColor: .controlBackgroundColor))
    }

    private func createEnv() {
        let name = newEnvironmentName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        newEnvironmentName = ""
        isAddingEnvironment = false
        selectedEnvironmentName = name
        Task { await appState.createEnvironment(name: name) }
    }
}
