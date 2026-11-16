import Foundation
import Testing
@testable import KobeanREST

// MARK: - Test Doubles

private final class MockUpdateHTTPTransport: UpdateHTTPTransport, @unchecked Sendable {
    struct RecordedRequest: Sendable {
        let url: URL?
        let method: String?
        let headers: [String: String]
    }

    private let lock = NSLock()
    private var _requests: [RecordedRequest] = []
    private let handler: @Sendable (URLRequest) throws -> (Data, HTTPURLResponse)

    init(handler: @escaping @Sendable (URLRequest) throws -> (Data, HTTPURLResponse)) {
        self.handler = handler
    }

    var requests: [RecordedRequest] {
        lock.withLock { _requests }
    }

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        let recorded = RecordedRequest(
            url: request.url,
            method: request.httpMethod,
            headers: request.allHTTPHeaderFields ?? [:]
        )
        lock.withLock { _requests.append(recorded) }
        return try handler(request)
    }
}

private final class MockUpdateService: UpdateServiceProtocol, @unchecked Sendable {
    var checkOutcome: Result<UpdateCheckOutcome, any Error>
    private let lock = NSLock()
    private var _checkCalls: [(currentVersion: String, etag: String?, force: Bool)] = []

    init(outcome: Result<UpdateCheckOutcome, any Error>) {
        self.checkOutcome = outcome
    }

    var checkCalls: [(currentVersion: String, etag: String?, force: Bool)] {
        lock.withLock { _checkCalls }
    }

    func checkForUpdates(
        currentVersion: String,
        etag: String?,
        force: Bool
    ) async throws -> UpdateCheckOutcome {
        lock.withLock {
            _checkCalls.append((currentVersion: currentVersion, etag: etag, force: force))
        }
        return try checkOutcome.get()
    }

    func downloadAsset(
        from urlString: String,
        assetName: String?,
        onProgress: @escaping @Sendable (Double) -> Void
    ) async throws -> URL {
        onProgress(1.0)
        return FileManager.default.temporaryDirectory.appendingPathComponent(assetName ?? "update.dmg")
    }

    func installAndRelaunch(downloadedFile: URL, currentBundlePath: String) throws {}
}

// MARK: - UpdateService & SemanticVersion Tests

@Suite("Native macOS Software Update Service")
struct UpdateServiceTests {
    @Test("SemanticVersion normalizes tags and compares versions accurately")
    func semanticVersionComparison() {
        #expect(SemanticVersion.normalize("v0.4.0") == "0.4.0")
        #expect(SemanticVersion.normalize("  V1.2.3 ") == "1.2.3")
        #expect(SemanticVersion.compare("0.4.1", "0.4.0") == 1)
        #expect(SemanticVersion.compare("0.4.0", "0.4.0") == 0)
        #expect(SemanticVersion.compare("0.3.9", "0.4.0") == -1)
        #expect(SemanticVersion.compare("1.0.0", "1.0.0-beta.1") == 1)
        #expect(SemanticVersion.compare("1.0.0-beta.1", "1.0.0") == -1)
        #expect(SemanticVersion.isNewerVersion("v0.5.0", than: "0.4.0") == true)
        #expect(SemanticVersion.isNewerVersion("v0.4.0", than: "0.4.0") == false)
    }

    @Test("pickBestNativeAsset prioritizes native macOS DMG/ZIP over Tauri or non-macOS assets")
    func picksBestNativeMacOSAsset() {
        let assets = [
            GitHubReleaseAsset(
                name: "KobeanREST_0.5.0_x64_en-US.msi",
                browser_download_url: "https://github.com/thienng-it/KobeanREST/releases/download/v0.5.0/KobeanREST_0.5.0_x64_en-US.msi",
                size: 12_000_000
            ),
            GitHubReleaseAsset(
                name: "KobeanREST_0.5.0_universal.dmg",
                browser_download_url: "https://github.com/thienng-it/KobeanREST/releases/download/v0.5.0/KobeanREST_0.5.0_universal.dmg",
                size: 18_000_000
            ),
            GitHubReleaseAsset(
                name: "KobeanREST-macOS-Native.dmg",
                browser_download_url: "https://github.com/thienng-it/KobeanREST/releases/download/v0.5.0/KobeanREST-macOS-Native.dmg",
                size: 9_500_000
            ),
            GitHubReleaseAsset(
                name: "KobeanREST-macOS-Native.zip",
                browser_download_url: "https://github.com/thienng-it/KobeanREST/releases/download/v0.5.0/KobeanREST-macOS-Native.zip",
                size: 8_900_000
            ),
        ]

        let picked = UpdateService.pickBestNativeAsset(from: assets, arch: "arm64")
        #expect(picked?.name == "KobeanREST-macOS-Native.zip")
    }

    @Test("pickBestNativeAsset rejects untrusted download hosts")
    func rejectsUntrustedDownloadHosts() {
        let untrusted = [
            GitHubReleaseAsset(
                name: "KobeanREST-macOS-Native.dmg",
                browser_download_url: "https://evil.example.com/KobeanREST-macOS-Native.dmg",
                size: 9_500_000
            ),
            GitHubReleaseAsset(
                name: "KobeanREST-macOS-Native.zip",
                browser_download_url: "http://github.com/thienng-it/KobeanREST/releases/download/v0.5.0/KobeanREST-macOS-Native.zip",
                size: 8_900_000
            ),
        ]
        #expect(UpdateService.pickBestNativeAsset(from: untrusted) == nil)
    }

    @Test("checkForUpdates detects a newer GitHub Release and extracts native asset metadata")
    func checkForUpdatesDetectsNewerRelease() async throws {
        let payload = """
        {
          "tag_name": "v0.5.0",
          "name": "KobeanREST v0.5.0",
          "body": "### Highlights\\n- Native macOS auto-update support",
          "html_url": "https://github.com/thienng-it/KobeanREST/releases/tag/v0.5.0",
          "published_at": "2026-11-16T12:00:00Z",
          "assets": [
            {
              "name": "KobeanREST-macOS-Native.dmg",
              "browser_download_url": "https://github.com/thienng-it/KobeanREST/releases/download/v0.5.0/KobeanREST-macOS-Native.dmg",
              "size": 10485760
            }
          ]
        }
        """

        let transport = MockUpdateHTTPTransport { request in
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: "HTTP/1.1",
                headerFields: ["ETag": "\"etag-050\""]
            )!
            return (Data(payload.utf8), response)
        }

        let service = UpdateService(transport: transport)
        let outcome = try await service.checkForUpdates(currentVersion: "0.4.0", etag: nil, force: false)

        guard case .updateAvailable(let update) = outcome else {
            Issue.record("Expected .updateAvailable, got \(outcome)")
            return
        }

        #expect(update.currentVersion == "0.4.0")
        #expect(update.latestVersion == "0.5.0")
        #expect(update.releaseName == "KobeanREST v0.5.0")
        #expect(update.asset?.name == "KobeanREST-macOS-Native.dmg")
        #expect(update.etag == "\"etag-050\"")
        #expect(transport.requests.first?.headers["Accept"] == "application/vnd.github+json")
    }

    @Test("checkForUpdates reports upToDate when installed version matches or exceeds latest release")
    func checkForUpdatesReportsUpToDate() async throws {
        let payload = """
        {
          "tag_name": "v0.4.0",
          "name": "KobeanREST v0.4.0",
          "body": "Current release",
          "html_url": "https://github.com/thienng-it/KobeanREST/releases/tag/v0.4.0",
          "assets": []
        }
        """

        let transport = MockUpdateHTTPTransport { request in
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: "HTTP/1.1",
                headerFields: nil
            )!
            return (Data(payload.utf8), response)
        }

        let service = UpdateService(transport: transport)
        let outcome = try await service.checkForUpdates(currentVersion: "0.4.0", etag: nil, force: false)

        guard case .upToDate(let current, let latest, _, _, _, _, _, _) = outcome else {
            Issue.record("Expected .upToDate, got \(outcome)")
            return
        }
        #expect(current == "0.4.0")
        #expect(latest == "0.4.0")
    }

    @Test("checkForUpdates handles HTTP 304 Not Modified with ETag")
    func checkForUpdatesHandlesNotModified() async throws {
        let transport = MockUpdateHTTPTransport { request in
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 304,
                httpVersion: "HTTP/1.1",
                headerFields: ["ETag": "\"etag-cached\""]
            )!
            return (Data(), response)
        }

        let service = UpdateService(transport: transport)
        let outcome = try await service.checkForUpdates(currentVersion: "0.4.0", etag: "\"etag-cached\"", force: false)
        #expect(outcome == .notModified(etag: "\"etag-cached\""))
        #expect(transport.requests.first?.headers["If-None-Match"] == "\"etag-cached\"")
    }

    @Test("buildInstallerScript strips quarantine xattr and applies ad-hoc codesign")
    func installerScriptContainsQuarantineAndCodesignCommands() {
        let script = UpdateService.buildInstallerScript(
            downloadedFile: "/tmp/KobeanREST-macOS-Native.dmg",
            targetAppPath: "/Applications/KobeanREST.app",
            workDir: "/tmp"
        )
        #expect(script.contains("xattr -cr \"$TARGET_APP\""))
        #expect(script.contains("codesign --force --deep --sign - \"$TARGET_APP\""))
        #expect(script.contains("hdiutil attach"))
        #expect(script.contains("ditto -x -k"))
    }

    @Test("AppState gates automatic update checks on settings.updateChecksEnabled and always allows manual checks")
    @MainActor
    func appStateAutomaticVsManualUpdateCheckGating() async throws {
        let tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("kobeanrest-update-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let update = AvailableAppUpdate(
            currentVersion: "0.4.0",
            latestVersion: "0.5.0",
            releaseName: "KobeanREST v0.5.0",
            releaseNotes: "New native release",
            releaseURL: "https://github.com/thienng-it/KobeanREST/releases/tag/v0.5.0",
            asset: GitHubReleaseAsset(
                name: "KobeanREST-macOS-Native.dmg",
                browser_download_url: "https://github.com/thienng-it/KobeanREST/releases/download/v0.5.0/KobeanREST-macOS-Native.dmg",
                size: 1024
            )
        )
        let mockUpdater = MockUpdateService(outcome: .success(.updateAvailable(update)))
        let bridge = CoreBridge(dataDirectoryURL: tempDir)
        let appState = AppState(
            bridge: bridge,
            updateService: mockUpdater,
            currentAppVersion: "0.4.0"
        )

        // Default settings have updateChecksEnabled == false -> automatic check is skipped
        #expect(appState.settings.updateChecksEnabled == false)
        await appState.checkForUpdates(manual: false)
        #expect(mockUpdater.checkCalls.isEmpty)
        #expect(appState.availableUpdate == nil)

        // Manual check runs regardless of updateChecksEnabled
        await appState.checkForUpdates(manual: true)
        #expect(mockUpdater.checkCalls.count == 1)
        #expect(appState.availableUpdate?.latestVersion == "0.5.0")
        #expect(appState.isUpdateSheetPresented == true)
        #expect(appState.shouldShowUpdateBanner == true)

        appState.dismissUpdateBanner()
        #expect(appState.shouldShowUpdateBanner == false)
    }
}
