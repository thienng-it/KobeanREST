import Foundation
import Network
import XCTest
import os
#if canImport(KobeanREST)
@testable import KobeanREST
#endif

// MARK: - Deterministic Test Doubles

private final class MockWebSocketTask: WebSocketTaskProtocol, @unchecked Sendable {
    private enum ReceiveItem {
        case payload(WebSocketMessage.Payload)
        case error(any Error)
        case close(code: URLSessionWebSocketTask.CloseCode, reason: Data?)
    }

    private struct State {
        var openCount = 0
        var openError: (any Error)?
        var suspendOpenUntilCancelled = false
        var openWaiter: CheckedContinuation<Void, any Error>?
        var sentPayloads: [WebSocketMessage.Payload] = []
        var sendError: (any Error)?
        var pingCount = 0
        var pingError: (any Error)?
        var cancelCalls: [(code: URLSessionWebSocketTask.CloseCode, reason: Data?)] = []
        var closeCode: URLSessionWebSocketTask.CloseCode = .invalid
        var closeReason: Data?
        var receiveBuffer: [ReceiveItem] = []
        var receiveWaiter: CheckedContinuation<WebSocketMessage.Payload, any Error>?
        var isCancelled = false
    }

    private let lock = OSAllocatedUnfairLock(initialState: State())

    init(
        openError: (any Error)? = nil,
        suspendOpenUntilCancelled: Bool = false,
        sendError: (any Error)? = nil,
        pingError: (any Error)? = nil
    ) {
        self.lock.withLock { state in
            state.openError = openError
            state.suspendOpenUntilCancelled = suspendOpenUntilCancelled
            state.sendError = sendError
            state.pingError = pingError
        }
    }

    var closeCode: URLSessionWebSocketTask.CloseCode {
        lock.withLock { $0.closeCode }
    }

    var closeReason: Data? {
        lock.withLock { $0.closeReason }
    }

    var openCount: Int {
        lock.withLock { $0.openCount }
    }

    var sentPayloads: [WebSocketMessage.Payload] {
        lock.withLock { $0.sentPayloads }
    }

    var pingCount: Int {
        lock.withLock { $0.pingCount }
    }

    var cancelCalls: [(code: URLSessionWebSocketTask.CloseCode, reason: Data?)] {
        lock.withLock { $0.cancelCalls }
    }

    func enqueueReceive(_ payload: WebSocketMessage.Payload) {
        let waiter: CheckedContinuation<WebSocketMessage.Payload, any Error>? = lock.withLock { state in
            if let existing = state.receiveWaiter {
                state.receiveWaiter = nil
                return existing
            }
            state.receiveBuffer.append(.payload(payload))
            return nil
        }
        waiter?.resume(returning: payload)
    }

    func simulateRemoteClose(code: URLSessionWebSocketTask.CloseCode, reason: String?) {
        let reasonData = reason.map { Data($0.utf8) }
        let waiter: CheckedContinuation<WebSocketMessage.Payload, any Error>? = lock.withLock { state in
            state.closeCode = code
            state.closeReason = reasonData
            if let existing = state.receiveWaiter {
                state.receiveWaiter = nil
                return existing
            }
            state.receiveBuffer.append(.close(code: code, reason: reasonData))
            return nil
        }
        waiter?.resume(throwing: URLError(.networkConnectionLost))
    }

    func simulateReceiveError(_ error: any Error) {
        let waiter: CheckedContinuation<WebSocketMessage.Payload, any Error>? = lock.withLock { state in
            if let existing = state.receiveWaiter {
                state.receiveWaiter = nil
                return existing
            }
            state.receiveBuffer.append(.error(error))
            return nil
        }
        waiter?.resume(throwing: error)
    }

    func open() async throws {
        enum OpenAction {
            case succeed
            case fail(any Error)
            case suspend
        }

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
            let action: OpenAction = lock.withLock { state in
                state.openCount += 1
                if state.isCancelled {
                    return .fail(CancellationError())
                }
                if state.suspendOpenUntilCancelled {
                    state.openWaiter = continuation
                    return .suspend
                }
                if let err = state.openError {
                    return .fail(err)
                }
                return .succeed
            }

            switch action {
            case .succeed:
                continuation.resume(returning: ())
            case .fail(let error):
                continuation.resume(throwing: error)
            case .suspend:
                break
            }
        }
    }

    func send(_ message: WebSocketMessage.Payload) async throws {
        let errorToThrow = lock.withLock { state -> (any Error)? in
            if let err = state.sendError {
                return err
            }
            state.sentPayloads.append(message)
            return nil
        }
        if let errorToThrow {
            throw errorToThrow
        }
    }

    func receive() async throws -> WebSocketMessage.Payload {
        enum NextAction {
            case immediatePayload(WebSocketMessage.Payload)
            case immediateError(any Error)
            case suspend
        }

        return try await withCheckedThrowingContinuation { continuation in
            let action: NextAction = lock.withLock { state in
                if state.isCancelled {
                    return .immediateError(CancellationError())
                }
                if !state.receiveBuffer.isEmpty {
                    let item = state.receiveBuffer.removeFirst()
                    switch item {
                    case .payload(let payload):
                        return .immediatePayload(payload)
                    case .error(let error):
                        return .immediateError(error)
                    case .close(let code, let reason):
                        state.closeCode = code
                        state.closeReason = reason
                        return .immediateError(URLError(.networkConnectionLost))
                    }
                }
                state.receiveWaiter = continuation
                return .suspend
            }

            switch action {
            case .immediatePayload(let payload):
                continuation.resume(returning: payload)
            case .immediateError(let error):
                continuation.resume(throwing: error)
            case .suspend:
                break
            }
        }
    }

    func ping() async throws {
        let errorToThrow = lock.withLock { state -> (any Error)? in
            state.pingCount += 1
            return state.pingError
        }
        if let errorToThrow {
            throw errorToThrow
        }
    }

    func cancel(with closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        let (openWaiter, receiveWaiter): (CheckedContinuation<Void, any Error>?, CheckedContinuation<WebSocketMessage.Payload, any Error>?) = lock.withLock { state in
            state.isCancelled = true
            state.closeCode = closeCode
            state.closeReason = reason
            state.cancelCalls.append((closeCode, reason))
            let existingOpen = state.openWaiter
            let existingReceive = state.receiveWaiter
            state.openWaiter = nil
            state.receiveWaiter = nil
            return (existingOpen, existingReceive)
        }
        openWaiter?.resume(throwing: CancellationError())
        receiveWaiter?.resume(throwing: CancellationError())
    }
}

private final class MockWebSocketSessionFactory: WebSocketSessionFactory, @unchecked Sendable {
    private struct State {
        var requests: [URLRequest] = []
        var taskQueue: [MockWebSocketTask]
    }

    private let lock: OSAllocatedUnfairLock<State>

    init(tasks: [MockWebSocketTask] = [MockWebSocketTask()]) {
        self.lock = OSAllocatedUnfairLock(initialState: State(taskQueue: tasks))
    }

    var recordedRequests: [URLRequest] {
        lock.withLock { $0.requests }
    }

    func makeWebSocketTask(with request: URLRequest) -> any WebSocketTaskProtocol {
        lock.withLock { state in
            state.requests.append(request)
            if !state.taskQueue.isEmpty {
                return state.taskQueue.removeFirst()
            }
            return MockWebSocketTask()
        }
    }
}

private enum MockFailure: Error, LocalizedError {
    case boom(String)

    var errorDescription: String? {
        switch self {
        case .boom(let message):
            return message
        }
    }
}

// MARK: - Live Local NWListener WebSocket Server

private final class LocalWebSocketEchoServer: @unchecked Sendable {
    private let queue = DispatchQueue(label: "com.kobeanrest.tests.ws-echo-server")
    private let lock = OSAllocatedUnfairLock(initialState: [String: String]())
    private var listener: NWListener?
    private var connections: [NWConnection] = []

    var capturedHeaders: [String: String] {
        lock.withLock { $0 }
    }

    func start() async throws -> UInt16 {
        let parameters = NWParameters.tcp
        let wsOptions = NWProtocolWebSocket.Options()
        wsOptions.autoReplyPing = true
        wsOptions.setClientRequestHandler(queue) { [weak self] _, headers in
            let parsed = Dictionary(
                headers.map { ($0.name, $0.value) },
                uniquingKeysWith: { _, latest in latest }
            )
            self?.lock.withLock { $0 = parsed }
            return NWProtocolWebSocket.Response(
                status: .accept,
                subprotocol: nil,
                additionalHeaders: nil
            )
        }
        parameters.defaultProtocolStack.applicationProtocols.insert(wsOptions, at: 0)

        let listener = try NWListener(using: parameters, on: .any)
        self.listener = listener

        return try await withCheckedThrowingContinuation { continuation in
            let resumed = OSAllocatedUnfairLock(initialState: false)
            listener.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    let alreadyResumed = resumed.withLock { flag -> Bool in
                        if flag { return true }
                        flag = true
                        return false
                    }
                    guard !alreadyResumed else { return }
                    if let port = listener.port?.rawValue {
                        continuation.resume(returning: port)
                    } else {
                        continuation.resume(throwing: MockFailure.boom("NWListener missing port"))
                    }
                case .failed(let error):
                    let alreadyResumed = resumed.withLock { flag -> Bool in
                        if flag { return true }
                        flag = true
                        return false
                    }
                    if !alreadyResumed {
                        continuation.resume(throwing: error)
                    }
                default:
                    break
                }
            }

            listener.newConnectionHandler = { [weak self] connection in
                self?.handleNewConnection(connection)
            }

            listener.start(queue: queue)
        }
    }

    func stop() {
        listener?.cancel()
        listener = nil
        for connection in connections {
            connection.cancel()
        }
        connections.removeAll()
    }

    private func handleNewConnection(_ connection: NWConnection) {
        connections.append(connection)
        connection.start(queue: queue)
        receiveNext(on: connection)
    }

    private func receiveNext(on connection: NWConnection) {
        connection.receiveMessage { [weak self] content, context, _, error in
            if let context,
               let metadata = context.protocolMetadata(definition: NWProtocolWebSocket.definition) as? NWProtocolWebSocket.Metadata {
                switch metadata.opcode {
                case .text:
                    if let content, let text = String(data: content, encoding: .utf8), text == "__CLOSE_SERVER__" {
                        let closeMeta = NWProtocolWebSocket.Metadata(opcode: .close)
                        closeMeta.closeCode = .protocolCode(.normalClosure)
                        let closeContext = NWConnection.ContentContext(identifier: "ws-close", metadata: [closeMeta])
                        connection.send(
                            content: Data("server-bye".utf8),
                            contentContext: closeContext,
                            isComplete: true,
                            completion: .contentProcessed { _ in
                                connection.cancel()
                            }
                        )
                        return
                    }
                    if let content {
                        let replyMeta = NWProtocolWebSocket.Metadata(opcode: .text)
                        let replyContext = NWConnection.ContentContext(identifier: "ws-text", metadata: [replyMeta])
                        connection.send(content: content, contentContext: replyContext, isComplete: true, completion: .contentProcessed { _ in })
                    }
                case .binary:
                    if let content {
                        let replyMeta = NWProtocolWebSocket.Metadata(opcode: .binary)
                        let replyContext = NWConnection.ContentContext(identifier: "ws-bin", metadata: [replyMeta])
                        connection.send(content: content, contentContext: replyContext, isComplete: true, completion: .contentProcessed { _ in })
                    }
                case .close:
                    connection.cancel()
                    return
                default:
                    break
                }
            }

            if error == nil {
                self?.receiveNext(on: connection)
            }
        }
    }
}

// MARK: - Helpers

private func collectEvents(
    from stream: AsyncStream<WebSocketEvent>,
    count: Int,
    timeoutSeconds: TimeInterval = 3.0
) async throws -> [WebSocketEvent] {
    try await withThrowingTaskGroup(of: [WebSocketEvent].self) { group in
        group.addTask {
            var collected: [WebSocketEvent] = []
            for await event in stream {
                collected.append(event)
                if collected.count >= count {
                    break
                }
            }
            return collected
        }

        group.addTask {
            try await Task.sleep(nanoseconds: UInt64(timeoutSeconds * 1_000_000_000))
            throw MockFailure.boom("Timed out waiting for \(count) WebSocket events")
        }

        let result = try await group.next()!
        group.cancelAll()
        return result
    }
}

// MARK: - Tests

final class WebSocketTests: XCTestCase {

    // MARK: Scheme & URL Validation

    func testConnectRejectsUnsupportedSchemesBeforeCreatingTask() async throws {
        let factory = MockWebSocketSessionFactory()
        let service = WebSocketService(sessionFactory: factory)

        let invalidInputs = [
            "http://example.com/ws",
            "https://example.com/ws",
            "ftp://example.com/ws",
            "file:///tmp/socket",
            "",
            "   ",
            "ws://"
        ]

        for rawURL in invalidInputs {
            do {
                try await service.connect(url: rawURL)
                XCTFail("Expected invalid URL '\(rawURL)' to be rejected")
            } catch let error as WebSocketServiceError {
                switch error {
                case .invalidURL, .unsupportedScheme, .missingHost:
                    break
                default:
                    XCTFail("Unexpected WebSocketServiceError for '\(rawURL)': \(error)")
                }
            }
        }

        XCTAssertTrue(factory.recordedRequests.isEmpty)
        let currentState = await service.state
        XCTAssertEqual(currentState, .disconnected)

        let events = try await collectEvents(from: service.events, count: invalidInputs.count)
        XCTAssertEqual(events.count, invalidInputs.count)
        for event in events {
            guard case .error(let message) = event else {
                XCTFail("Expected .error event, got \(event)")
                continue
            }
            XCTAssertFalse(message.isEmpty)
        }
    }

    func testValidateWebSocketURLAcceptsCaseInsensitiveWSAndWSS() throws {
        let wsURL = try WebSocketService.validateWebSocketURL("  WS://localhost:8080/chat ")
        XCTAssertEqual(wsURL.scheme?.lowercased(), "ws")
        XCTAssertEqual(wsURL.host, "localhost")

        let wssURL = try WebSocketService.validateWebSocketURL("WSS://echo.example.com/v1")
        XCTAssertEqual(wssURL.scheme?.lowercased(), "wss")
        XCTAssertEqual(wssURL.host, "echo.example.com")
    }

    // MARK: Connect, Custom Headers & Handshake Errors

    func testConnectAppliesCustomHeadersAndEmitsConnectedEvent() async throws {
        let mockTask = MockWebSocketTask()
        let factory = MockWebSocketSessionFactory(tasks: [mockTask])
        let service = WebSocketService(sessionFactory: factory)

        try await service.connect(
            url: "wss://socket.example.com/stream?token=1",
            headers: [
                "Authorization": "Bearer secret-token",
                "X-Custom-Header": "kobean-value",
                "   ": "ignored-empty-key"
            ]
        )

        XCTAssertEqual(mockTask.openCount, 1)
        XCTAssertEqual(factory.recordedRequests.count, 1)

        let request = try XCTUnwrap(factory.recordedRequests.first)
        XCTAssertEqual(request.url?.absoluteString, "wss://socket.example.com/stream?token=1")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer secret-token")
        XCTAssertEqual(request.value(forHTTPHeaderField: "X-Custom-Header"), "kobean-value")
        XCTAssertNil(request.value(forHTTPHeaderField: "   "))

        let state = await service.state
        XCTAssertEqual(state, .connected(url: "wss://socket.example.com/stream?token=1"))

        await service.disconnect()

        let events = try await collectEvents(from: service.events, count: 2)
        XCTAssertEqual(events[0], .connected(url: "wss://socket.example.com/stream?token=1"))
        XCTAssertEqual(events[1], .disconnected(code: URLSessionWebSocketTask.CloseCode.normalClosure.rawValue, reason: nil))
    }

    func testConnectThrowsAlreadyConnectedWhenActive() async throws {
        let mockTask = MockWebSocketTask()
        let factory = MockWebSocketSessionFactory(tasks: [mockTask])
        let service = WebSocketService(sessionFactory: factory)

        try await service.connect(url: "ws://localhost:9000")

        do {
            try await service.connect(url: "ws://localhost:9001")
            XCTFail("Expected alreadyConnected error")
        } catch let error as WebSocketServiceError {
            XCTAssertEqual(error, .alreadyConnected)
        }

        await service.disconnect()
    }

    func testConnectHandshakeFailureResetsStateAndEmitsError() async throws {
        let failingTask = MockWebSocketTask(openError: MockFailure.boom("TLS handshake rejected"))
        let recoveryTask = MockWebSocketTask()
        let factory = MockWebSocketSessionFactory(tasks: [failingTask, recoveryTask])
        let service = WebSocketService(sessionFactory: factory)

        do {
            try await service.connect(url: "wss://bad-host.example.com")
            XCTFail("Expected handshake failure")
        } catch let error as WebSocketServiceError {
            XCTAssertEqual(error, .handshakeFailed("TLS handshake rejected"))
        }

        let stateAfterFailure = await service.state
        XCTAssertEqual(stateAfterFailure, .disconnected)

        // Should allow subsequent connection attempt cleanly
        try await service.connect(url: "wss://good-host.example.com")
        let stateAfterRecovery = await service.state
        XCTAssertEqual(stateAfterRecovery, .connected(url: "wss://good-host.example.com"))

        await service.disconnect()

        let events = try await collectEvents(from: service.events, count: 3)
        XCTAssertEqual(events[0], .error("TLS handshake rejected"))
        XCTAssertEqual(events[1], .connected(url: "wss://good-host.example.com"))
        XCTAssertEqual(events[2], .disconnected(code: URLSessionWebSocketTask.CloseCode.normalClosure.rawValue, reason: nil))
    }

    // MARK: Send Text & Binary

    func testSendTextAndBinaryEmitMessageSentEvents() async throws {
        let fixedDate = Date(timeIntervalSince1970: 1_700_000_000)
        let mockTask = MockWebSocketTask()
        let factory = MockWebSocketSessionFactory(tasks: [mockTask])
        let service = WebSocketService(sessionFactory: factory, nowProvider: { fixedDate })

        try await service.connect(url: "wss://echo.example.com")

        let binaryData = Data([0xDE, 0xAD, 0xBE, 0xEF])
        let sentTextMsg = try await service.sendText("hello world")
        let sentBinMsg = try await service.sendData(binaryData)

        XCTAssertEqual(sentTextMsg.direction, .outgoing)
        XCTAssertEqual(sentTextMsg.timestamp, fixedDate)
        XCTAssertEqual(sentTextMsg.payload, .text("hello world"))

        XCTAssertEqual(sentBinMsg.direction, .outgoing)
        XCTAssertEqual(sentBinMsg.timestamp, fixedDate)
        XCTAssertEqual(sentBinMsg.payload, .binary(binaryData))

        XCTAssertEqual(mockTask.sentPayloads, [.text("hello world"), .binary(binaryData)])

        await service.disconnect()

        let events = try await collectEvents(from: service.events, count: 4)
        XCTAssertEqual(events[0], .connected(url: "wss://echo.example.com"))
        XCTAssertEqual(events[1], .messageSent(sentTextMsg))
        XCTAssertEqual(events[2], .messageSent(sentBinMsg))
        XCTAssertEqual(events[3], .disconnected(code: URLSessionWebSocketTask.CloseCode.normalClosure.rawValue, reason: nil))
    }

    func testSendAndPingFailWhenDisconnected() async {
        let service = WebSocketService(sessionFactory: MockWebSocketSessionFactory())

        do {
            try await service.sendText("offline")
            XCTFail("Expected notConnected")
        } catch let error as WebSocketServiceError {
            XCTAssertEqual(error, .notConnected)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }

        do {
            try await service.sendData(Data([1, 2]))
            XCTFail("Expected notConnected")
        } catch let error as WebSocketServiceError {
            XCTAssertEqual(error, .notConnected)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }

        do {
            try await service.ping()
            XCTFail("Expected notConnected")
        } catch let error as WebSocketServiceError {
            XCTAssertEqual(error, .notConnected)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testSendErrorEmitsErrorAndThrowsSendFailed() async throws {
        let mockTask = MockWebSocketTask(sendError: MockFailure.boom("broken pipe"))
        let factory = MockWebSocketSessionFactory(tasks: [mockTask])
        let service = WebSocketService(sessionFactory: factory)

        try await service.connect(url: "ws://localhost:8080")

        do {
            try await service.sendText("fail me")
            XCTFail("Expected sendFailed")
        } catch let error as WebSocketServiceError {
            XCTAssertEqual(error, .sendFailed("broken pipe"))
        }

        await service.disconnect()

        let events = try await collectEvents(from: service.events, count: 3)
        XCTAssertEqual(events[0], .connected(url: "ws://localhost:8080"))
        XCTAssertEqual(events[1], .error("broken pipe"))
        XCTAssertEqual(events[2], .disconnected(code: URLSessionWebSocketTask.CloseCode.normalClosure.rawValue, reason: nil))
    }

    // MARK: Receive Loop & Remote Close / Error

    func testReceiveLoopEmitsIncomingTextBinaryAndCleanRemoteClose() async throws {
        let fixedDate = Date(timeIntervalSince1970: 1_700_000_123)
        let mockTask = MockWebSocketTask()
        let factory = MockWebSocketSessionFactory(tasks: [mockTask])
        let service = WebSocketService(sessionFactory: factory, nowProvider: { fixedDate })

        try await service.connect(url: "wss://stream.example.com")

        let payloadBytes = Data([0x01, 0x02, 0x03])
        mockTask.enqueueReceive(.text("server-hello"))
        mockTask.enqueueReceive(.binary(payloadBytes))
        mockTask.simulateRemoteClose(code: .goingAway, reason: "server-restart")

        let events = try await collectEvents(from: service.events, count: 4)
        XCTAssertEqual(events[0], .connected(url: "wss://stream.example.com"))

        guard case .messageReceived(let msg1) = events[1] else {
            return XCTFail("Expected first messageReceived, got \(events[1])")
        }
        XCTAssertEqual(msg1.direction, .incoming)
        XCTAssertEqual(msg1.timestamp, fixedDate)
        XCTAssertEqual(msg1.payload, .text("server-hello"))

        guard case .messageReceived(let msg2) = events[2] else {
            return XCTFail("Expected second messageReceived, got \(events[2])")
        }
        XCTAssertEqual(msg2.direction, .incoming)
        XCTAssertEqual(msg2.payload, .binary(payloadBytes))

        XCTAssertEqual(
            events[3],
            .disconnected(code: URLSessionWebSocketTask.CloseCode.goingAway.rawValue, reason: "server-restart")
        )

        let finalState = await service.state
        XCTAssertEqual(finalState, .disconnected)
    }

    func testUnexpectedReceiveErrorEmitsErrorAndAbnormalDisconnect() async throws {
        let mockTask = MockWebSocketTask()
        let factory = MockWebSocketSessionFactory(tasks: [mockTask])
        let service = WebSocketService(sessionFactory: factory)

        try await service.connect(url: "wss://drop.example.com")
        mockTask.simulateReceiveError(MockFailure.boom("socket reset by peer"))

        let events = try await collectEvents(from: service.events, count: 3)
        XCTAssertEqual(events[0], .connected(url: "wss://drop.example.com"))
        XCTAssertEqual(events[1], .error("socket reset by peer"))
        XCTAssertEqual(
            events[2],
            .disconnected(
                code: URLSessionWebSocketTask.CloseCode.abnormalClosure.rawValue,
                reason: "socket reset by peer"
            )
        )

        let state = await service.state
        XCTAssertEqual(state, .disconnected)
    }

    // MARK: Ping & Disconnect Lifecycle

    func testPingSuccessAndFailure() async throws {
        let successTask = MockWebSocketTask()
        let failingPingTask = MockWebSocketTask(pingError: MockFailure.boom("pong timeout"))
        let factory = MockWebSocketSessionFactory(tasks: [successTask, failingPingTask])
        let service = WebSocketService(sessionFactory: factory)

        try await service.connect(url: "wss://ping.example.com")
        try await service.ping()
        XCTAssertEqual(successTask.pingCount, 1)
        await service.disconnect(code: .normalClosure, reason: "done")

        try await service.connect(url: "wss://ping.example.com")
        do {
            try await service.ping()
            XCTFail("Expected pingFailed")
        } catch let error as WebSocketServiceError {
            XCTAssertEqual(error, .pingFailed("pong timeout"))
        }
        XCTAssertEqual(failingPingTask.pingCount, 1)
        await service.disconnect()

        let events = try await collectEvents(from: service.events, count: 5)
        XCTAssertEqual(events[0], .connected(url: "wss://ping.example.com"))
        XCTAssertEqual(events[1], .disconnected(code: URLSessionWebSocketTask.CloseCode.normalClosure.rawValue, reason: "done"))
        XCTAssertEqual(events[2], .connected(url: "wss://ping.example.com"))
        XCTAssertEqual(events[3], .error("pong timeout"))
        XCTAssertEqual(events[4], .disconnected(code: URLSessionWebSocketTask.CloseCode.normalClosure.rawValue, reason: nil))
    }

    func testDisconnectIsIdempotentAndPassesCloseCodeAndReason() async throws {
        let mockTask = MockWebSocketTask()
        let factory = MockWebSocketSessionFactory(tasks: [mockTask])
        let service = WebSocketService(sessionFactory: factory)

        try await service.connect(url: "ws://localhost:7000")
        await service.disconnect(code: .goingAway, reason: "user closed tab")
        await service.disconnect(code: .normalClosure, reason: "duplicate")

        XCTAssertEqual(mockTask.cancelCalls.count, 1)
        XCTAssertEqual(mockTask.cancelCalls.first?.code, .goingAway)
        XCTAssertEqual(mockTask.cancelCalls.first?.reason, Data("user closed tab".utf8))

        let events = try await collectEvents(from: service.events, count: 2)
        XCTAssertEqual(events[0], .connected(url: "ws://localhost:7000"))
        XCTAssertEqual(events[1], .disconnected(code: URLSessionWebSocketTask.CloseCode.goingAway.rawValue, reason: "user closed tab"))
    }

    func testDisconnectDuringPendingOpenCancelsHandshakeCleanly() async throws {
        let slowTask = MockWebSocketTask(suspendOpenUntilCancelled: true)
        let factory = MockWebSocketSessionFactory(tasks: [slowTask])
        let service = WebSocketService(sessionFactory: factory)

        let connectTask = Task {
            try await service.connect(url: "wss://slow.example.com")
        }

        // Wait briefly until open() is entered
        for _ in 0..<50 where slowTask.openCount == 0 {
            try await Task.sleep(nanoseconds: 5_000_000)
        }
        await service.disconnect(code: .normalClosure, reason: "aborted")

        do {
            try await connectTask.value
            XCTFail("Expected connect to fail after disconnect during open")
        } catch {
            // CancellationError expected
        }

        let state = await service.state
        XCTAssertEqual(state, .disconnected)
        XCTAssertEqual(slowTask.cancelCalls.count, 1)

        let events = try await collectEvents(from: service.events, count: 1)
        XCTAssertEqual(events[0], .disconnected(code: URLSessionWebSocketTask.CloseCode.normalClosure.rawValue, reason: "aborted"))
    }

    func testMessageSystemDirectionModel() {
        let systemMessage = WebSocketMessage(
            direction: .system,
            payload: .text("Connected to server")
        )
        XCTAssertEqual(systemMessage.direction, .system)
        XCTAssertEqual(systemMessage.payload, .text("Connected to server"))
    }

    // MARK: Live Integration Against Real NWListener (Network.framework)

    func testLiveURLSessionWebSocketTaskAgainstLocalNWListener() async throws {
        let server = LocalWebSocketEchoServer()
        let port = try await server.start()
        defer { server.stop() }

        let service = WebSocketService()
        let urlString = "ws://127.0.0.1:\(port)/ws"
        try await service.connect(
            url: urlString,
            headers: ["X-Kobean-Test": "live-nwlistener"]
        )

        XCTAssertEqual(server.capturedHeaders["X-Kobean-Test"], "live-nwlistener")

        let binaryPayload = Data([0x4B, 0x4F, 0x42, 0x45, 0x41, 0x4E])
        try await service.sendText("ping-echo")
        try await service.sendData(binaryPayload)
        try await service.ping()

        // Wait for .connected + 2 .messageSent + 2 echoed .messageReceived before disconnecting
        let preDisconnectEvents = try await collectEvents(from: service.events, count: 5, timeoutSeconds: 5.0)
        XCTAssertEqual(preDisconnectEvents[0], .connected(url: urlString))

        var receivedTexts: [String] = []
        var receivedBinaries: [Data] = []
        for event in preDisconnectEvents {
            if case .messageReceived(let msg) = event {
                switch msg.payload {
                case .text(let value):
                    receivedTexts.append(value)
                case .binary(let data):
                    receivedBinaries.append(data)
                }
            }
        }

        XCTAssertEqual(receivedTexts, ["ping-echo"])
        XCTAssertEqual(receivedBinaries, [binaryPayload])

        await service.disconnect(code: .normalClosure, reason: "test complete")
        let disconnectEvents = try await collectEvents(from: service.events, count: 1, timeoutSeconds: 3.0)
        XCTAssertEqual(
            disconnectEvents.last,
            .disconnected(code: URLSessionWebSocketTask.CloseCode.normalClosure.rawValue, reason: "test complete")
        )
    }

    func testLiveServerInitiatedCloseAndConnectionRefusedAgainstNWListener() async throws {
        let server = LocalWebSocketEchoServer()
        let port = try await server.start()

        let service = WebSocketService()
        let urlString = "ws://127.0.0.1:\(port)/ws"
        try await service.connect(url: urlString)
        try await service.sendText("__CLOSE_SERVER__")

        // Expect .connected, .messageSent, and server-initiated .disconnected (1000, "server-bye")
        let events = try await collectEvents(from: service.events, count: 3, timeoutSeconds: 5.0)
        XCTAssertEqual(events[0], .connected(url: urlString))
        XCTAssertEqual(
            events[2],
            .disconnected(code: URLSessionWebSocketTask.CloseCode.normalClosure.rawValue, reason: "server-bye")
        )
        let stateAfterServerClose = await service.state
        XCTAssertEqual(stateAfterServerClose, .disconnected)

        // Stop listener and verify connection refused fails handshake cleanly
        server.stop()
        do {
            try await service.connect(url: urlString)
            XCTFail("Expected handshakeFailed after server stopped")
        } catch let error as WebSocketServiceError {
            guard case .handshakeFailed = error else {
                return XCTFail("Expected handshakeFailed, got \(error)")
            }
        }
        let stateAfterRefused = await service.state
        XCTAssertEqual(stateAfterRefused, .disconnected)
    }
}
