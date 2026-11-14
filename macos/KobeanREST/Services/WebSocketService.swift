import Foundation
import os

// MARK: - Domain Models

public struct WebSocketMessage: Identifiable, Sendable, Equatable {
    public enum Direction: String, Sendable, Equatable, Codable, CaseIterable {
        case incoming
        case outgoing
        case system
    }

    public enum Payload: Sendable, Equatable {
        case text(String)
        case binary(Data)
    }

    public let id: UUID
    public let timestamp: Date
    public let direction: Direction
    public let payload: Payload

    public init(
        id: UUID = UUID(),
        timestamp: Date = Date(),
        direction: Direction,
        payload: Payload
    ) {
        self.id = id
        self.timestamp = timestamp
        self.direction = direction
        self.payload = payload
    }
}

public enum WebSocketEvent: Sendable, Equatable {
    case connected(url: String)
    case messageReceived(WebSocketMessage)
    case messageSent(WebSocketMessage)
    case disconnected(code: Int, reason: String?)
    case error(String)
}

public enum WebSocketConnectionState: Sendable, Equatable {
    case disconnected
    case connecting(url: String)
    case connected(url: String)
}

public enum WebSocketServiceError: Error, Sendable, Equatable, LocalizedError {
    case invalidURL(String)
    case unsupportedScheme(String?)
    case missingHost(String)
    case alreadyConnected
    case notConnected
    case handshakeFailed(String)
    case sendFailed(String)
    case receiveFailed(String)
    case pingFailed(String)

    public var errorDescription: String? {
        switch self {
        case .invalidURL(let url):
            return "Invalid WebSocket URL: \(url)"
        case .unsupportedScheme(let scheme):
            return "Unsupported WebSocket scheme '\(scheme ?? "<none>")'. Expected 'ws' or 'wss'."
        case .missingHost(let url):
            return "WebSocket URL is missing a host: \(url)"
        case .alreadyConnected:
            return "WebSocket is already connected or connecting."
        case .notConnected:
            return "WebSocket is not connected."
        case .handshakeFailed(let reason):
            return "WebSocket handshake failed: \(reason)"
        case .sendFailed(let reason):
            return "WebSocket send failed: \(reason)"
        case .receiveFailed(let reason):
            return "WebSocket receive failed: \(reason)"
        case .pingFailed(let reason):
            return "WebSocket ping failed: \(reason)"
        }
    }
}

// MARK: - Injectable Transport Abstractions

public protocol WebSocketTaskProtocol: AnyObject, Sendable {
    var closeCode: URLSessionWebSocketTask.CloseCode { get }
    var closeReason: Data? { get }

    func open() async throws
    func send(_ message: WebSocketMessage.Payload) async throws
    func receive() async throws -> WebSocketMessage.Payload
    func ping() async throws
    func cancel(with closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?)
}

public protocol WebSocketSessionFactory: Sendable {
    func makeWebSocketTask(with request: URLRequest) -> any WebSocketTaskProtocol
}

// MARK: - Production URLSession Implementation

public final class URLSessionWebSocketSessionFactory: WebSocketSessionFactory, Sendable {
    private let configuration: URLSessionConfiguration

    public init(configuration: URLSessionConfiguration = .default) {
        self.configuration = configuration
    }

    public func makeWebSocketTask(with request: URLRequest) -> any WebSocketTaskProtocol {
        URLSessionWebSocketTaskAdapter(request: request, configuration: configuration)
    }
}

private final class URLSessionWebSocketTaskAdapter: WebSocketTaskProtocol, @unchecked Sendable {
    private final class DelegateProxy: NSObject, URLSessionWebSocketDelegate, @unchecked Sendable {
        private struct State {
            var openContinuation: CheckedContinuation<Void, any Error>?
            var closeCode: URLSessionWebSocketTask.CloseCode = .invalid
            var closeReason: Data?
            var isFinished = false
        }

        private let lock = OSAllocatedUnfairLock(initialState: State())

        var closeCode: URLSessionWebSocketTask.CloseCode {
            lock.withLock { $0.closeCode }
        }

        var closeReason: Data? {
            lock.withLock { $0.closeReason }
        }

        func registerOpenContinuation(_ continuation: CheckedContinuation<Void, any Error>) {
            let isAlreadyFinished = lock.withLock { state -> Bool in
                if state.isFinished {
                    return true
                }
                state.openContinuation = continuation
                return false
            }
            if isAlreadyFinished {
                continuation.resume(throwing: CancellationError())
            }
        }

        func markCancelled() {
            lock.withLock { state in
                state.isFinished = true
            }
            resolveOpen(with: .failure(CancellationError()))
        }

        func resolveOpen(with result: Result<Void, any Error>) {
            let continuation: CheckedContinuation<Void, any Error>? = lock.withLock { state in
                let cont = state.openContinuation
                state.openContinuation = nil
                return cont
            }
            switch result {
            case .success:
                continuation?.resume(returning: ())
            case .failure(let error):
                continuation?.resume(throwing: error)
            }
        }

        func urlSession(
            _ session: URLSession,
            webSocketTask: URLSessionWebSocketTask,
            didOpenWithProtocol protocol: String?
        ) {
            resolveOpen(with: .success(()))
        }

        func urlSession(
            _ session: URLSession,
            webSocketTask: URLSessionWebSocketTask,
            didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
            reason: Data?
        ) {
            lock.withLock { state in
                state.closeCode = closeCode
                state.closeReason = reason
            }
            resolveOpen(with: .failure(URLError(.networkConnectionLost)))
        }

        func urlSession(
            _ session: URLSession,
            task: URLSessionTask,
            didCompleteWithError error: (any Error)?
        ) {
            lock.withLock { state in
                state.isFinished = true
                if state.closeCode == .invalid, let wsTask = task as? URLSessionWebSocketTask {
                    state.closeCode = wsTask.closeCode
                    state.closeReason = wsTask.closeReason
                }
            }
            resolveOpen(with: .failure(error ?? URLError(.cannotConnectToHost)))
            session.finishTasksAndInvalidate()
        }
    }

    private let delegateProxy: DelegateProxy
    private let session: URLSession
    private let task: URLSessionWebSocketTask

    init(request: URLRequest, configuration: URLSessionConfiguration) {
        let proxy = DelegateProxy()
        let session = URLSession(configuration: configuration, delegate: proxy, delegateQueue: nil)
        self.delegateProxy = proxy
        self.session = session
        self.task = session.webSocketTask(with: request)
    }

    var closeCode: URLSessionWebSocketTask.CloseCode {
        let proxyCode = delegateProxy.closeCode
        return proxyCode != .invalid ? proxyCode : task.closeCode
    }

    var closeReason: Data? {
        delegateProxy.closeReason ?? task.closeReason
    }

    func open() async throws {
        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                delegateProxy.registerOpenContinuation(continuation)
                task.resume()
            }
        } onCancel: {
            cancel(with: .goingAway, reason: nil)
        }
    }

    func send(_ message: WebSocketMessage.Payload) async throws {
        let urlMessage: URLSessionWebSocketTask.Message = switch message {
        case .text(let text):
            .string(text)
        case .binary(let data):
            .data(data)
        }
        try await task.send(urlMessage)
    }

    func receive() async throws -> WebSocketMessage.Payload {
        let message = try await task.receive()
        switch message {
        case .string(let text):
            return .text(text)
        case .data(let data):
            return .binary(data)
        @unknown default:
            throw WebSocketServiceError.receiveFailed("Unsupported WebSocket message type")
        }
    }

    func ping() async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
            task.sendPing { error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: ())
                }
            }
        }
    }

    func cancel(with closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        delegateProxy.markCancelled()
        task.cancel(with: closeCode, reason: reason)
        session.invalidateAndCancel()
    }
}

// MARK: - WebSocketService

public actor WebSocketService {
    private static let logger = Logger(subsystem: "com.kobeanrest.macos", category: "WebSocketService")

    public nonisolated let events: AsyncStream<WebSocketEvent>
    public private(set) var state: WebSocketConnectionState = .disconnected

    private let sessionFactory: any WebSocketSessionFactory
    private let nowProvider: @Sendable () -> Date
    private let eventContinuation: AsyncStream<WebSocketEvent>.Continuation

    private var activeTask: (any WebSocketTaskProtocol)?
    private var receiveTask: Task<Void, Never>?

    public init(
        sessionFactory: any WebSocketSessionFactory = URLSessionWebSocketSessionFactory(),
        nowProvider: @escaping @Sendable () -> Date = { Date() }
    ) {
        let (stream, continuation) = AsyncStream.makeStream(of: WebSocketEvent.self, bufferingPolicy: .unbounded)
        self.events = stream
        self.eventContinuation = continuation
        self.sessionFactory = sessionFactory
        self.nowProvider = nowProvider
    }

    deinit {
        receiveTask?.cancel()
        activeTask?.cancel(with: .goingAway, reason: nil)
        eventContinuation.finish()
    }

    // MARK: - Validation

    public nonisolated static func validateWebSocketURL(_ urlString: String) throws -> URL {
        let trimmed = urlString.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let parsedURL = URL(string: trimmed) else {
            throw WebSocketServiceError.invalidURL(urlString)
        }
        return try validateWebSocketURL(parsedURL)
    }

    public nonisolated static func validateWebSocketURL(_ url: URL) throws -> URL {
        guard let scheme = url.scheme?.lowercased(), !scheme.isEmpty else {
            throw WebSocketServiceError.unsupportedScheme(url.scheme)
        }
        guard scheme == "ws" || scheme == "wss" else {
            throw WebSocketServiceError.unsupportedScheme(url.scheme)
        }
        guard let host = url.host, !host.isEmpty else {
            throw WebSocketServiceError.missingHost(url.absoluteString)
        }
        return url
    }

    // MARK: - Connection Lifecycle

    public func connect(url urlString: String, headers: [String: String] = [:]) async throws {
        let validatedURL: URL
        do {
            validatedURL = try Self.validateWebSocketURL(urlString)
        } catch {
            let message = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            eventContinuation.yield(.error(message))
            throw error
        }
        try await connect(url: validatedURL, headers: headers)
    }

    public func connect(url: URL, headers: [String: String] = [:]) async throws {
        let validatedURL: URL
        do {
            validatedURL = try Self.validateWebSocketURL(url)
        } catch {
            let message = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            eventContinuation.yield(.error(message))
            throw error
        }

        guard case .disconnected = state, activeTask == nil else {
            throw WebSocketServiceError.alreadyConnected
        }

        var request = URLRequest(url: validatedURL)
        for key in headers.keys.sorted() {
            let trimmedKey = key.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmedKey.isEmpty, let value = headers[key] else { continue }
            request.setValue(value, forHTTPHeaderField: trimmedKey)
        }

        let urlString = validatedURL.absoluteString
        let task = sessionFactory.makeWebSocketTask(with: request)
        state = .connecting(url: urlString)
        activeTask = task

        Self.logger.debug("Opening WebSocket connection to \(urlString, privacy: .private)")

        do {
            try await task.open()
        } catch {
            if activeTask === task {
                activeTask = nil
                state = .disconnected
                let reason = error.localizedDescription
                eventContinuation.yield(.error(reason))
                throw WebSocketServiceError.handshakeFailed(reason)
            }
            // Disconnected concurrently during open()
            throw error
        }

        guard activeTask === task else {
            task.cancel(with: .goingAway, reason: nil)
            throw CancellationError()
        }

        state = .connected(url: urlString)
        eventContinuation.yield(.connected(url: urlString))
        receiveTask = Task { [weak self] in
            await self?.runReceiveLoop(for: task)
        }
    }

    public func disconnect(
        code: URLSessionWebSocketTask.CloseCode = .normalClosure,
        reason: String? = nil
    ) {
        guard let task = activeTask else {
            state = .disconnected
            return
        }

        let pendingReceiveTask = receiveTask
        activeTask = nil
        receiveTask = nil
        state = .disconnected

        pendingReceiveTask?.cancel()
        let reasonData = reason.map { Data($0.utf8) }
        task.cancel(with: code, reason: reasonData)
        eventContinuation.yield(.disconnected(code: code.rawValue, reason: reason))
    }

    // MARK: - Messaging & Heartbeat

    @discardableResult
    public func sendText(_ text: String) async throws -> WebSocketMessage {
        try await sendPayload(.text(text))
    }

    @discardableResult
    public func sendData(_ data: Data) async throws -> WebSocketMessage {
        try await sendPayload(.binary(data))
    }

    public func ping() async throws {
        guard case .connected = state, let task = activeTask else {
            throw WebSocketServiceError.notConnected
        }

        do {
            try await task.ping()
        } catch {
            let reason = error.localizedDescription
            eventContinuation.yield(.error(reason))
            throw WebSocketServiceError.pingFailed(reason)
        }
    }

    // MARK: - Private Helpers

    private func sendPayload(_ payload: WebSocketMessage.Payload) async throws -> WebSocketMessage {
        guard case .connected = state, let task = activeTask else {
            throw WebSocketServiceError.notConnected
        }

        do {
            try await task.send(payload)
            let message = WebSocketMessage(
                timestamp: nowProvider(),
                direction: .outgoing,
                payload: payload
            )
            eventContinuation.yield(.messageSent(message))
            return message
        } catch {
            let reason = error.localizedDescription
            eventContinuation.yield(.error(reason))
            throw WebSocketServiceError.sendFailed(reason)
        }
    }

    private func runReceiveLoop(for task: any WebSocketTaskProtocol) async {
        while !Task.isCancelled, activeTask === task, case .connected = state {
            do {
                let payload = try await task.receive()
                guard !Task.isCancelled, activeTask === task else { break }
                let message = WebSocketMessage(
                    timestamp: nowProvider(),
                    direction: .incoming,
                    payload: payload
                )
                eventContinuation.yield(.messageReceived(message))
            } catch {
                guard activeTask === task else { break }
                handleReceiveFailure(error, for: task)
                break
            }
        }
    }

    private func handleReceiveFailure(_ error: any Error, for task: any WebSocketTaskProtocol) {
        activeTask = nil
        receiveTask = nil
        state = .disconnected

        let closeCode = task.closeCode
        if closeCode != .invalid {
            let reason = task.closeReason.flatMap { String(data: $0, encoding: .utf8) }
            eventContinuation.yield(.disconnected(code: closeCode.rawValue, reason: reason))
        } else {
            let message = error.localizedDescription
            eventContinuation.yield(.error(message))
            eventContinuation.yield(
                .disconnected(
                    code: URLSessionWebSocketTask.CloseCode.abnormalClosure.rawValue,
                    reason: message
                )
            )
        }
    }
}
