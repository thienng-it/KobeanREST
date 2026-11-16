import Foundation

// MARK: - Semantic Versioning

public enum SemanticVersion {
    public static let fallbackVersion = "0.4.0"

    public static func currentAppVersion(bundle: Bundle = .main) -> String {
        if let v = bundle.infoDictionary?["CFBundleShortVersionString"] as? String {
            let trimmed = v.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty, !trimmed.contains("$("), !trimmed.contains("__APP_VERSION__") {
                return normalize(trimmed)
            }
        }
        return fallbackVersion
    }

    public static func normalize(_ v: String) -> String {
        var s = v.trimmingCharacters(in: .whitespacesAndNewlines)
        while s.hasPrefix("v") || s.hasPrefix("V") {
            s.removeFirst()
        }
        return s.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    public static func compare(_ a: String, _ b: String) -> Int {
        let na = normalize(a)
        let nb = normalize(b)
        if na == nb { return 0 }
        guard let firstA = na.first, firstA.isNumber,
              let firstB = nb.first, firstB.isNumber else {
            return 0
        }

        // Strip build metadata (+...) before comparing
        let withoutBuildA = String(na.split(separator: "+", maxSplits: 1, omittingEmptySubsequences: false)[0])
        let withoutBuildB = String(nb.split(separator: "+", maxSplits: 1, omittingEmptySubsequences: false)[0])

        let partsA = withoutBuildA.split(separator: "-", maxSplits: 1, omittingEmptySubsequences: false)
        let partsB = withoutBuildB.split(separator: "-", maxSplits: 1, omittingEmptySubsequences: false)
        let coreA = String(partsA[0])
        let coreB = String(partsB[0])
        let preA = partsA.count > 1 ? String(partsA[1]) : nil
        let preB = partsB.count > 1 ? String(partsB[1]) : nil

        var segA = coreA.split(separator: ".").map(String.init)
        var segB = coreB.split(separator: ".").map(String.init)
        while segA.count < segB.count { segA.append("0") }
        while segB.count < segA.count { segB.append("0") }

        for (sa, sb) in zip(segA, segB) {
            let cmp = sa.compare(sb, options: [.numeric, .caseInsensitive])
            if cmp == .orderedAscending { return -1 }
            if cmp == .orderedDescending { return 1 }
        }

        // Stable release is newer than pre-release of the same core version
        if preA == nil && preB != nil { return 1 }
        if preA != nil && preB == nil { return -1 }
        if let pa = preA, let pb = preB {
            let cmp = pa.compare(pb, options: [.numeric, .caseInsensitive])
            if cmp == .orderedAscending { return -1 }
            if cmp == .orderedDescending { return 1 }
        }
        return 0
    }

    public static func isNewerVersion(_ candidate: String, than current: String) -> Bool {
        compare(candidate, current) > 0
    }
}

// MARK: - GitHub Release Models

public struct GitHubReleaseAsset: Codable, Sendable, Equatable, Hashable {
    public var name: String
    public var browser_download_url: String
    public var size: Int64
    public var content_type: String?

    public init(
        name: String,
        browser_download_url: String,
        size: Int64,
        content_type: String? = nil
    ) {
        self.name = name
        self.browser_download_url = browser_download_url
        self.size = size
        self.content_type = content_type
    }
}

public struct GitHubLatestRelease: Codable, Sendable, Equatable {
    public var tag_name: String?
    public var name: String?
    public var body: String?
    public var html_url: String?
    public var published_at: String?
    public var prerelease: Bool?
    public var draft: Bool?
    public var assets: [GitHubReleaseAsset]?

    public init(
        tag_name: String? = nil,
        name: String? = nil,
        body: String? = nil,
        html_url: String? = nil,
        published_at: String? = nil,
        prerelease: Bool? = nil,
        draft: Bool? = nil,
        assets: [GitHubReleaseAsset]? = nil
    ) {
        self.tag_name = tag_name
        self.name = name
        self.body = body
        self.html_url = html_url
        self.published_at = published_at
        self.prerelease = prerelease
        self.draft = draft
        self.assets = assets
    }
}

public struct AvailableAppUpdate: Codable, Sendable, Equatable, Hashable {
    public var currentVersion: String
    public var latestVersion: String
    public var releaseName: String
    public var releaseNotes: String
    public var releaseURL: String
    public var publishedAt: String?
    public var asset: GitHubReleaseAsset?
    public var etag: String?

    public init(
        currentVersion: String,
        latestVersion: String,
        releaseName: String,
        releaseNotes: String,
        releaseURL: String,
        publishedAt: String? = nil,
        asset: GitHubReleaseAsset? = nil,
        etag: String? = nil
    ) {
        self.currentVersion = currentVersion
        self.latestVersion = latestVersion
        self.releaseName = releaseName
        self.releaseNotes = releaseNotes
        self.releaseURL = releaseURL
        self.publishedAt = publishedAt
        self.asset = asset
        self.etag = etag
    }
}

public enum UpdateCheckOutcome: Sendable, Equatable {
    case notModified(etag: String?)
    case upToDate(
        currentVersion: String,
        latestVersion: String,
        releaseName: String?,
        releaseNotes: String?,
        releaseURL: String,
        publishedAt: String?,
        asset: GitHubReleaseAsset?,
        etag: String?
    )
    case updateAvailable(AvailableAppUpdate)
}

public enum UpdateDownloadState: Sendable, Equatable {
    case idle
    case downloading(progress: Double)
    case ready(fileURL: URL)
    case failed(String)
}

public enum UpdateServiceError: LocalizedError, Sendable, Equatable {
    case invalidResponse
    case httpStatus(Int)
    case missingTagName
    case untrustedDownloadURL(String)
    case archiveNotFound(String)

    public var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid response from GitHub Releases API."
        case .httpStatus(let code):
            return "GitHub Releases API returned HTTP \(code)."
        case .missingTagName:
            return "Latest GitHub release is missing tag_name."
        case .untrustedDownloadURL(let reason):
            return "Refused to download update from untrusted URL (\(reason))."
        case .archiveNotFound(let path):
            return "Downloaded update archive not found at \(path)."
        }
    }
}

// MARK: - Transport & Service Protocols

public protocol UpdateHTTPTransport: Sendable {
    func data(for request: URLRequest) async throws -> (Data, URLResponse)
}

extension URLSession: UpdateHTTPTransport {}

public protocol UpdateServiceProtocol: Sendable {
    func checkForUpdates(
        currentVersion: String,
        etag: String?,
        force: Bool
    ) async throws -> UpdateCheckOutcome

    func downloadAsset(
        from urlString: String,
        assetName: String?,
        onProgress: @escaping @Sendable (Double) -> Void
    ) async throws -> URL

    func installAndRelaunch(
        downloadedFile: URL,
        currentBundlePath: String
    ) throws
}

// MARK: - UpdateService Implementation

public struct UpdateService: UpdateServiceProtocol, Sendable {
    public static let repoOwner = "thienng-it"
    public static let repoName = "KobeanREST"
    public static let latestReleaseAPIURL = URL(string: "https://api.github.com/repos/\(repoOwner)/\(repoName)/releases/latest")!
    public static let releasesPageURL = URL(string: "https://github.com/\(repoOwner)/\(repoName)/releases")!
    public static let latestReleasePageURL = URL(string: "https://github.com/\(repoOwner)/\(repoName)/releases/latest")!

    public static let allowedDownloadHosts: Set<String> = [
        "github.com",
        "objects.githubusercontent.com",
        "release-assets.githubusercontent.com"
    ]

    public static var currentArchitecture: String {
        #if arch(arm64)
        return "arm64"
        #elseif arch(x86_64)
        return "x86_64"
        #else
        return "arm64"
        #endif
    }

    private let transport: any UpdateHTTPTransport
    private let apiURL: URL

    public init(
        transport: any UpdateHTTPTransport = URLSession.shared,
        apiURL: URL = UpdateService.latestReleaseAPIURL
    ) {
        self.transport = transport
        self.apiURL = apiURL
    }

    public static func isAllowedDownloadURL(_ urlString: String?) -> Bool {
        guard let urlString,
              let url = URL(string: urlString),
              url.scheme?.lowercased() == "https",
              let host = url.host?.lowercased() else {
            return false
        }
        return allowedDownloadHosts.contains(host)
    }

    public static func isAllowedReleasePageURL(_ urlString: String?) -> Bool {
        guard let urlString,
              let url = URL(string: urlString),
              url.scheme?.lowercased() == "https",
              url.host?.lowercased() == "github.com" else {
            return false
        }
        return true
    }

    /// Picks the best macOS release asset for the Native macOS app, preferring `*-macOS-Native*`
    /// `.dmg` or `.zip` matching the active CPU architecture or universal build before falling back
    /// to generic macOS assets.
    public static func pickBestNativeAsset(
        from assets: [GitHubReleaseAsset]?,
        arch: String = currentArchitecture
    ) -> GitHubReleaseAsset? {
        guard let assets, !assets.isEmpty else { return nil }
        let eligible = assets.filter { asset in
            let lower = asset.name.lowercased()
            return (lower.hasSuffix(".dmg") || lower.hasSuffix(".zip"))
                && !lower.contains("win")
                && !lower.contains("linux")
                && !lower.contains("msi")
                && !lower.contains("nsis")
                && !lower.contains("appimage")
                && isAllowedDownloadURL(asset.browser_download_url)
        }
        guard !eligible.isEmpty else { return nil }

        let archTokens: [String] = (arch == "arm64" || arch == "aarch64")
            ? ["arm64", "aarch64"]
            : ["x86_64", "x64", "amd64"]

        func matchesArch(_ name: String) -> Bool {
            let lower = name.lowercased()
            return archTokens.contains { lower.contains($0) }
        }

        func hasAnyArchToken(_ name: String) -> Bool {
            let lower = name.lowercased()
            return ["arm64", "aarch64", "x86_64", "x64", "amd64"].contains { lower.contains($0) }
        }

        let nativeAssets = eligible.filter {
            let lower = $0.name.lowercased()
            return lower.contains("macos-native") || lower.contains("native-macos")
        }

        // 1. Native macOS arch-specific .zip
        if let match = nativeAssets.first(where: { $0.name.lowercased().hasSuffix(".zip") && matchesArch($0.name) }) {
            return match
        }
        // 2. Native macOS universal/generic .zip
        if let match = nativeAssets.first(where: { $0.name.lowercased().hasSuffix(".zip") && !hasAnyArchToken($0.name) }) {
            return match
        }
        // 3. Native macOS arch-specific .dmg
        if let match = nativeAssets.first(where: { $0.name.lowercased().hasSuffix(".dmg") && matchesArch($0.name) }) {
            return match
        }
        // 4. Native macOS universal/generic .dmg
        if let match = nativeAssets.first(where: { $0.name.lowercased().hasSuffix(".dmg") && !hasAnyArchToken($0.name) }) {
            return match
        }
        // 5. Any native macOS asset
        if let match = nativeAssets.first {
            return match
        }
        // 6. Fallback: universal or arch-specific macOS .dmg or .zip
        if let match = eligible.first(where: { $0.name.lowercased().contains("universal") && $0.name.lowercased().hasSuffix(".dmg") }) {
            return match
        }
        if let match = eligible.first(where: { $0.name.lowercased().hasSuffix(".dmg") && matchesArch($0.name) }) {
            return match
        }
        if let match = eligible.first(where: { $0.name.lowercased().hasSuffix(".zip") && matchesArch($0.name) }) {
            return match
        }
        return eligible.first
    }

    public func checkForUpdates(
        currentVersion: String = SemanticVersion.currentAppVersion(),
        etag: String? = nil,
        force: Bool = false
    ) async throws -> UpdateCheckOutcome {
        var request = URLRequest(url: apiURL)
        request.httpMethod = "GET"
        request.timeoutInterval = 15
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        request.setValue("KobeanREST-Native-macOS/\(SemanticVersion.normalize(currentVersion))", forHTTPHeaderField: "User-Agent")
        if !force, let etag, !etag.isEmpty {
            request.setValue(etag, forHTTPHeaderField: "If-None-Match")
        }

        let (data, response) = try await transport.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw UpdateServiceError.invalidResponse
        }

        let responseETag = http.value(forHTTPHeaderField: "ETag") ?? http.value(forHTTPHeaderField: "etag")
        if http.statusCode == 304 {
            return .notModified(etag: responseETag ?? etag)
        }
        guard (200..<300).contains(http.statusCode) else {
            throw UpdateServiceError.httpStatus(http.statusCode)
        }

        let release = try JSONDecoder().decode(GitHubLatestRelease.self, from: data)
        guard let rawTag = release.tag_name?.trimmingCharacters(in: .whitespacesAndNewlines),
              !rawTag.isEmpty else {
            throw UpdateServiceError.missingTagName
        }

        let normalizedCurrent = SemanticVersion.normalize(currentVersion)
        let normalizedLatest = SemanticVersion.normalize(rawTag)
        let releaseURL = Self.isAllowedReleasePageURL(release.html_url)
            ? release.html_url!
            : Self.releasesPageURL.absoluteString
        let asset = Self.pickBestNativeAsset(from: release.assets)
        let releaseName = (release.name?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false)
            ? release.name!
            : "KobeanREST v\(normalizedLatest)"
        let releaseNotes = (release.body?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false)
            ? release.body!
            : "Release v\(normalizedLatest) is available on GitHub Releases."

        if SemanticVersion.isNewerVersion(normalizedLatest, than: normalizedCurrent) {
            return .updateAvailable(
                AvailableAppUpdate(
                    currentVersion: normalizedCurrent,
                    latestVersion: normalizedLatest,
                    releaseName: releaseName,
                    releaseNotes: releaseNotes,
                    releaseURL: releaseURL,
                    publishedAt: release.published_at,
                    asset: asset,
                    etag: responseETag
                )
            )
        }

        return .upToDate(
            currentVersion: normalizedCurrent,
            latestVersion: normalizedLatest,
            releaseName: releaseName,
            releaseNotes: releaseNotes,
            releaseURL: releaseURL,
            publishedAt: release.published_at,
            asset: asset,
            etag: responseETag
        )
    }

    public func downloadAsset(
        from urlString: String,
        assetName: String?,
        onProgress: @escaping @Sendable (Double) -> Void
    ) async throws -> URL {
        guard Self.isAllowedDownloadURL(urlString), let url = URL(string: urlString) else {
            throw UpdateServiceError.untrustedDownloadURL(urlString)
        }

        let stageDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("kobeanrest-native-update", isDirectory: true)
        try FileManager.default.createDirectory(at: stageDir, withIntermediateDirectories: true)

        let rawFileName = assetName ?? url.lastPathComponent
        let baseComponent = (rawFileName as NSString).lastPathComponent
        let safeFileName = baseComponent.isEmpty ? "KobeanREST-macOS-Native.dmg" : baseComponent
        let destURL = stageDir.appendingPathComponent(safeFileName)
        try? FileManager.default.removeItem(at: destURL)

        var request = URLRequest(url: url)
        request.timeoutInterval = 300
        request.setValue("KobeanREST-Native-macOS-Updater", forHTTPHeaderField: "User-Agent")

        let (bytes, response) = try await URLSession.shared.bytes(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let code = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw UpdateServiceError.httpStatus(code)
        }
        if let finalHost = http.url?.host?.lowercased(), !Self.allowedDownloadHosts.contains(finalHost) {
            throw UpdateServiceError.untrustedDownloadURL(finalHost)
        }

        let expectedLength = http.expectedContentLength
        FileManager.default.createFile(atPath: destURL.path, contents: nil)
        let handle = try FileHandle(forWritingTo: destURL)
        defer { try? handle.close() }

        var buffer = Data()
        buffer.reserveCapacity(65_536)
        var downloaded: Int64 = 0
        var lastReported: Double = -1

        for try await byte in bytes {
            try Task.checkCancellation()
            buffer.append(byte)
            if buffer.count >= 65_536 {
                try handle.write(contentsOf: buffer)
                downloaded += Int64(buffer.count)
                buffer.removeAll(keepingCapacity: true)
                if expectedLength > 0 {
                    let pct = min(1.0, max(0.0, Double(downloaded) / Double(expectedLength)))
                    if pct - lastReported >= 0.01 {
                        lastReported = pct
                        onProgress(pct)
                    }
                }
            }
        }

        if !buffer.isEmpty {
            try handle.write(contentsOf: buffer)
            downloaded += Int64(buffer.count)
            buffer.removeAll()
        }
        onProgress(1.0)
        return destURL
    }

    public func installAndRelaunch(
        downloadedFile: URL,
        currentBundlePath: String = Bundle.main.bundlePath
    ) throws {
        guard FileManager.default.fileExists(atPath: downloadedFile.path) else {
            throw UpdateServiceError.archiveNotFound(downloadedFile.path)
        }

        let targetAppPath: String
        if currentBundlePath.hasSuffix(".app") {
            targetAppPath = currentBundlePath
        } else if FileManager.default.isWritableFile(atPath: "/Applications") {
            targetAppPath = "/Applications/KobeanREST.app"
        } else {
            let userApps = FileManager.default.homeDirectoryForCurrentUser
                .appendingPathComponent("Applications").path
            try? FileManager.default.createDirectory(atPath: userApps, withIntermediateDirectories: true)
            targetAppPath = "\(userApps)/KobeanREST.app"
        }

        let updateDir = downloadedFile.deletingLastPathComponent()
        let scriptURL = updateDir.appendingPathComponent("install-update.sh")
        let script = Self.buildInstallerScript(
            downloadedFile: downloadedFile.path,
            targetAppPath: targetAppPath,
            workDir: updateDir.path
        )
        try Data(script.utf8).write(to: scriptURL, options: .atomic)
        try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: scriptURL.path)

        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: "/bin/bash")
        proc.arguments = [scriptURL.path]
        proc.standardOutput = FileHandle.nullDevice
        proc.standardError = FileHandle.nullDevice
        try proc.run()
    }

    public static func buildInstallerScript(
        downloadedFile: String,
        targetAppPath: String,
        workDir: String
    ) -> String {
        func shQuote(_ s: String) -> String {
            "'" + s.replacingOccurrences(of: "'", with: "'\\''") + "'"
        }
        return """
        #!/usr/bin/env bash
        set -euo pipefail
        sleep 1.2
        ARCHIVE=\(shQuote(downloadedFile))
        TARGET_APP=\(shQuote(targetAppPath))
        STAGE_DIR=\(shQuote(workDir))/extracted-\(UUID().uuidString)
        mkdir -p "$STAGE_DIR"

        EXT="${ARCHIVE##*.}"
        EXT_LOWER="$(echo "$EXT" | tr '[:upper:]' '[:lower:]')"
        MOUNT_POINT=""

        cleanup() {
          if [ -n "$MOUNT_POINT" ] && [ -d "$MOUNT_POINT" ]; then
            hdiutil detach "$MOUNT_POINT" -quiet -force 2>/dev/null || true
          fi
          rm -rf "$STAGE_DIR" 2>/dev/null || true
        }
        trap cleanup EXIT

        if [ "$EXT_LOWER" = "zip" ]; then
          ditto -x -k "$ARCHIVE" "$STAGE_DIR"
          NEW_APP="$(find "$STAGE_DIR" -maxdepth 2 -name "*.app" | head -n 1)"
        elif [ "$EXT_LOWER" = "dmg" ]; then
          MOUNT_POINT="$STAGE_DIR/mnt"
          mkdir -p "$MOUNT_POINT"
          hdiutil attach "$ARCHIVE" -mountpoint "$MOUNT_POINT" -nobrowse -readonly -quiet
          NEW_APP="$(find "$MOUNT_POINT" -maxdepth 2 -name "*.app" | head -n 1)"
        else
          exit 1
        fi

        if [ -z "${NEW_APP:-}" ] || [ ! -d "$NEW_APP" ]; then
          exit 1
        fi

        rm -rf "$TARGET_APP"
        ditto "$NEW_APP" "$TARGET_APP"
        xattr -cr "$TARGET_APP" 2>/dev/null || true
        codesign --force --deep --sign - "$TARGET_APP" 2>/dev/null || true
        open "$TARGET_APP"
        """
    }
}
