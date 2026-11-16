import AppKit
import SwiftUI

struct UpdateNotificationBanner: View {
    @Bindable var appState: AppState
    let update: AvailableAppUpdate

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "arrow.down.circle.fill")
                .font(.system(size: 14))
                .foregroundStyle(.green)

            Text("New release available: **KobeanREST v\(update.latestVersion)** (installed: v\(appState.currentAppVersion))")
                .font(.system(size: 12))
                .lineLimit(1)

            if case .downloading(let progress) = appState.updateDownloadState {
                ProgressView(value: progress, total: 1.0)
                    .frame(width: 110)
                Text("\(Int(progress * 100))%")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if case .ready = appState.updateDownloadState {
                Button {
                    appState.installReadyUpdate()
                } label: {
                    Label("Install & Relaunch", systemImage: "arrow.triangle.2.circlepath")
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
                .controlSize(.small)
            } else {
                Button {
                    Task { await appState.downloadAndInstallUpdate() }
                } label: {
                    Label("Update Now", systemImage: "arrow.down.to.line")
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
                .disabled(isDownloading)
            }

            Button("Release Notes…") {
                appState.isUpdateSheetPresented = true
            }
            .controlSize(.small)

            Button("Later") {
                appState.dismissUpdateBanner()
            }
            .controlSize(.small)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Color.accentColor.opacity(0.12))
    }

    private var isDownloading: Bool {
        if case .downloading = appState.updateDownloadState { return true }
        return false
    }
}

struct UpdateSheetView: View {
    @Bindable var appState: AppState
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let hasUpdate = appState.isUpdateAvailable
        let latestVersion = appState.availableUpdate?.latestVersion ?? appState.latestKnownVersion
        let asset = appState.availableUpdate?.asset ?? appState.latestReleaseAsset
        let releaseName = appState.availableUpdate?.releaseName ?? appState.latestReleaseName ?? "Release Notes"
        let releaseNotes = appState.availableUpdate?.releaseNotes ?? appState.latestReleaseNotes

        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                Image(systemName: hasUpdate ? "arrow.down.circle.fill" : "checkmark.seal.fill")
                    .font(.system(size: 26))
                    .foregroundStyle(hasUpdate ? .green : .accentColor)

                VStack(alignment: .leading, spacing: 2) {
                    Text(hasUpdate ? "New Version Available" : "Software Update")
                        .font(.title3.weight(.semibold))
                    Text("Source: GitHub Releases (thienng-it/KobeanREST)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Button {
                    Task { await appState.checkForUpdates(manual: true) }
                } label: {
                    if appState.isCheckingForUpdates {
                        ProgressView().controlSize(.small)
                    } else {
                        Label("Check Now", systemImage: "arrow.triangle.2.circlepath")
                    }
                }
                .controlSize(.small)
                .disabled(appState.isCheckingForUpdates)
            }

            Divider()

            HStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("INSTALLED VERSION")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text("v\(appState.currentAppVersion)")
                        .font(.system(size: 15, weight: .bold, design: .monospaced))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(10)
                .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))

                Image(systemName: "arrow.right")
                    .foregroundStyle(.secondary)

                VStack(alignment: .leading, spacing: 4) {
                    Text("LATEST GITHUB RELEASE")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text(latestVersion.map { "v\($0)" } ?? (appState.isCheckingForUpdates ? "Checking…" : "v\(appState.currentAppVersion)"))
                        .font(.system(size: 15, weight: .bold, design: .monospaced))
                        .foregroundStyle(hasUpdate ? .green : .primary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(10)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(hasUpdate ? Color.green.opacity(0.12) : Color.secondary.opacity(0.08))
                )
            }

            if let err = appState.updateCheckError {
                Label(err, systemImage: "exclamationmark.triangle.fill")
                    .font(.caption)
                    .foregroundStyle(.red)
            }

            if let asset {
                HStack(spacing: 6) {
                    Image(systemName: "shippingbox.fill")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text("Asset: \(asset.name)")
                        .font(.system(size: 11, design: .monospaced))
                    if asset.size > 0 {
                        Text("(\(ByteCountFormatter.string(fromByteCount: asset.size, countStyle: .file)))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    if let checkedAt = appState.lastUpdateCheckDate {
                        Text("Checked \(checkedAt, style: .relative) ago")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(releaseName)
                        .font(.subheadline.weight(.semibold))
                    Spacer()
                    Button("View on GitHub ↗") {
                        appState.openReleasePage()
                    }
                    .buttonStyle(.link)
                    .font(.caption)
                }

                ScrollView {
                    Text(
                        (releaseNotes?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false)
                            ? releaseNotes!
                            : (hasUpdate
                                ? "A new release of KobeanREST is available on GitHub Releases."
                                : "You are running the latest version of KobeanREST (v\(appState.currentAppVersion)).")
                    )
                    .font(.system(size: 11.5, design: .monospaced))
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(10)
                }
                .frame(minHeight: 130, maxHeight: 200)
                .background(Color.secondary.opacity(0.07), in: RoundedRectangle(cornerRadius: 8))
            }

            switch appState.updateDownloadState {
            case .idle:
                EmptyView()
            case .downloading(let progress):
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("Downloading update from GitHub Releases…")
                            .font(.caption.weight(.medium))
                        Spacer()
                        Text("\(Int(progress * 100))%")
                            .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    }
                    ProgressView(value: progress, total: 1.0)
                }
            case .ready(let fileURL):
                Label("Downloaded \(fileURL.lastPathComponent) — ready to install & relaunch!", systemImage: "checkmark.circle.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.green)
            case .failed(let msg):
                Label(msg, systemImage: "xmark.octagon.fill")
                    .font(.caption)
                    .foregroundStyle(.red)
            }

            Divider()

            HStack(spacing: 8) {
                if hasUpdate {
                    Button("Remind Me Later") {
                        appState.dismissUpdateBanner()
                        dismiss()
                    }
                    .controlSize(.small)
                }

                Spacer()

                Button("Close") {
                    dismiss()
                }
                .keyboardShortcut(.cancelAction)

                if hasUpdate {
                    if case .ready = appState.updateDownloadState {
                        Button {
                            appState.installReadyUpdate()
                        } label: {
                            Label("Install & Relaunch Now", systemImage: "arrow.triangle.2.circlepath")
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.green)
                        .keyboardShortcut(.defaultAction)
                    } else {
                        Button {
                            Task { await appState.downloadAndInstallUpdate() }
                        } label: {
                            Label("Download & Install Update", systemImage: "arrow.down.to.line")
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(isDownloading)
                        .keyboardShortcut(.defaultAction)
                    }
                }
            }
        }
        .padding(18)
        .frame(width: 580)
    }

    private var isDownloading: Bool {
        if case .downloading = appState.updateDownloadState { return true }
        return false
    }
}
