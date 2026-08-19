import type { DocsPageContent } from "./shared";

export const productContent: DocsPageContent = {
  eyebrow: "Product",
  title: "A local-first desktop REST, gRPC, WebSocket & GraphQL client.",
  description:
    "KobeanREST is a fast, local-first desktop REST client and multi-protocol workspace without a KobeanREST account, hosted workspace, or required backend service.",
  sections: [
    {
      id: "overview",
      title: "What KobeanREST is",
      intro:
        "KobeanREST is a high-performance desktop API client for REST, gRPC, WebSocket, Socket.IO, and GraphQL endpoints. Users download the app, launch it locally, and build, test, and debug APIs with complete privacy.",
      items: [
        "Native gRPC & Protobuf client supporting Unary, Server-Streaming, Client-Streaming, and Duplex calls with interactive .proto IDL loading, service discovery, and decoded JSON streaming inspector.",
        "Real-time WebSocket & Socket.IO client with bidirectional timeline message streaming, room/namespace handling, event emitters, and payload inspection.",
        "GraphQL Studio with query editor, variable interpolation, schema introspection, and strict GraphQL-over-HTTP spec error detection.",
        "Built-in Local Mock Server (REST & gRPC) with 8 instant starter templates (E-Commerce, OpenAI LLM, DevOps Health, Greeter, Catalog, Echo Streaming) and Protobuf mock generator.",
        "Universal API Importer for cURL, Postman Collections, OpenAPI/Swagger 3.x, Insomnia, HAR, and .http files.",
        "Built-in AI Assistant with multi-session management, Ollama local model support (100% on-device), cloud model adapters (OpenAI, Anthropic, Gemini, Groq, OpenRouter), resizable sidebar, and automatic non-tool fallback retries.",
        "Modular plugin architecture with built-in utilities (UUID injector, HMAC-SHA256 signer, response time logger, rate limit checker, JSON extractor).",
        "Manage URL query parameters (`Params`) with real-time bi-directional synchronization to the URL bar.",
        "Execute entire collections sequentially with comprehensive run history and results tracking.",
        "Monitor automated test results using the built-in QA Dashboard with real-time analytics and telemetry drilldown.",
        "Keep workspace data local by default with OS keychain secret encryption instead of requiring cloud sync.",
      ],
    },
    {
      id: "gallery",
      title: "Feature Gallery",
      intro: "Explore the core capabilities of KobeanREST.",
      body: (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem", marginTop: "1.5rem" }}>
          <div>
            <img src="images/workspaces-hub.png" alt="Workspaces Hub" style={{ width: "100%", borderRadius: "8px", border: "1px solid var(--color-border-subtle)" }} />
            <p style={{ marginTop: "0.5rem", fontSize: "14px", color: "var(--color-text-muted)", fontStyle: "italic" }}>Workspaces Hub: Centralized multi-workspace overview with aggregate KPI analytics, fast switcher, and search filtering.</p>
          </div>
          <div>
            <img src="images/collections-hub.png" alt="Collections Hub" style={{ width: "100%", borderRadius: "8px", border: "1px solid var(--color-border-subtle)" }} />
            <p style={{ marginTop: "0.5rem", fontSize: "14px", color: "var(--color-text-muted)", fontStyle: "italic" }}>Collections Hub: Visual card catalog with folder breakdowns, request totals, and quick access.</p>
          </div>
          <div>
            <img src="images/ai-chat-sidebar.png" alt="AI Chat Assistant" style={{ width: "100%", borderRadius: "8px", border: "1px solid var(--color-border-subtle)" }} />
            <p style={{ marginTop: "0.5rem", fontSize: "14px", color: "var(--color-text-muted)", fontStyle: "italic" }}>AI Assistant: Multi-session coding and API debugging assistant supporting Ollama local models and cloud providers.</p>
          </div>
          <div>
            <img src="images/plugins-catalog.png" alt="Plugins Catalog" style={{ width: "100%", borderRadius: "8px", border: "1px solid var(--color-border-subtle)" }} />
            <p style={{ marginTop: "0.5rem", fontSize: "14px", color: "var(--color-text-muted)", fontStyle: "italic" }}>Plugins Catalog: Extensible sandbox hooks for HMAC signing, UUID injection, and automated assertions.</p>
          </div>
          <div>
            <img src="images/collection-runner.png" alt="Collection Test Runner" style={{ width: "100%", borderRadius: "8px", border: "1px solid var(--color-border-subtle)" }} />
            <p style={{ marginTop: "0.5rem", fontSize: "14px", color: "var(--color-text-muted)", fontStyle: "italic" }}>Collection Runner: Automated multi-request batch test runner with latency telemetry and pass/fail reporting.</p>
          </div>
          <div>
            <img src="images/grpc-panel.png" alt="gRPC & Protobuf Client" style={{ width: "100%", borderRadius: "8px", border: "1px solid var(--color-border-subtle)" }} />
            <p style={{ marginTop: "0.5rem", fontSize: "14px", color: "var(--color-text-muted)", fontStyle: "italic" }}>gRPC & Protobuf Client: Interactive Proto loader, method selector, and decoded streaming response viewer.</p>
          </div>
          <div>
            <img src="images/websocket-panel.png" alt="WebSocket & Socket.IO Streaming" style={{ width: "100%", borderRadius: "8px", border: "1px solid var(--color-border-subtle)" }} />
            <p style={{ marginTop: "0.5rem", fontSize: "14px", color: "var(--color-text-muted)", fontStyle: "italic" }}>WebSocket & Socket.IO: Real-time bi-directional streaming inspector and interactive event emitter.</p>
          </div>
          <div>
            <img src="images/mock-server.png" alt="Local Mock Server & Templates" style={{ width: "100%", borderRadius: "8px", border: "1px solid var(--color-border-subtle)" }} />
            <p style={{ marginTop: "0.5rem", fontSize: "14px", color: "var(--color-text-muted)", fontStyle: "italic" }}>Local Mock Server: Built-in multi-route REST & gRPC server with pre-configured starter templates.</p>
          </div>
          <div>
            <img src="images/environment-editor.png" alt="Environment Editor" style={{ width: "100%", borderRadius: "8px", border: "1px solid var(--color-border-subtle)" }} />
            <p style={{ marginTop: "0.5rem", fontSize: "14px", color: "var(--color-text-muted)", fontStyle: "italic" }}>Local Environment & Variables Editor: Keep secrets safe in your native OS keychain.</p>
          </div>
          <div>
            <img src="images/scripts-tab.png" alt="Pre & Post Request Scripts" style={{ width: "100%", borderRadius: "8px", border: "1px solid var(--color-border-subtle)" }} />
            <p style={{ marginTop: "0.5rem", fontSize: "14px", color: "var(--color-text-muted)", fontStyle: "italic" }}>Pre & Post Request Scripts: Dynamic execution environment with tests, assertions, and live logs.</p>
          </div>
          <div>
            <img src="images/params-tab.png" alt="Interactive Query Params" style={{ width: "100%", borderRadius: "8px", border: "1px solid var(--color-border-subtle)" }} />
            <p style={{ marginTop: "0.5rem", fontSize: "14px", color: "var(--color-text-muted)", fontStyle: "italic" }}>Interactive Query Params: Real-time bi-directional synchronization with the URL bar.</p>
          </div>
          <div>
            <img src="images/history-viewer.png" alt="Request History" style={{ width: "100%", borderRadius: "8px", border: "1px solid var(--color-border-subtle)" }} />
            <p style={{ marginTop: "0.5rem", fontSize: "14px", color: "var(--color-text-muted)", fontStyle: "italic" }}>History Viewer: Detailed logging of past requests and replay functionality.</p>
          </div>
        </div>
      )
    },
    {
      id: "local-first",
      title: "Local-first contract",
      intro:
        "The product boundary is intentionally narrow: KobeanREST has no app-user login, registration flow, hosted identity service, profile, or cloud session.",
      items: [
        "Local workspace data lives in SQLite.",
        "Sensitive values stay outside SQLite through keychain or encrypted vault-style storage.",
        "The app remains usable offline after installation.",
        "Networking happens when the user sends a request or explicitly checks for updates.",
      ],
    },
    {
      id: "privacy",
      title: "Privacy and secrets",
      intro:
        "KobeanREST treats authorization headers, cookies, API keys, URL query values, and request bodies as sensitive surfaces.",
      items: [
        "Exports redact secret variables by default.",
        "History records redacted URLs for auth query parameters.",
        "Diagnostics pass through shared redaction helpers.",
        "SQLite stores secret references and placeholders, not raw secret values.",
      ],
    },
    {
      id: "out-of-scope",
      title: "What is not in scope",
      intro: "The MVP deliberately avoids hosted collaboration features that would change the local-only product contract.",
      items: [
        "KobeanREST user accounts",
        "Cloud sync in the MVP",
        "Team collaboration",
        "Hosted project backend",
        "Runtime plugin marketplace",
      ],
    },
  ],
};
