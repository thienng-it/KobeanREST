# PRODUCT.md — Design System & Brand Direction (`KobeanREST`)

> Maintained under Impeccable Craft (`Default`) doctrine for the native macOS SwiftUI + AppKit client (`macos/`) and shared KobeanREST desktop surface.

## 1. Product Identity & Audience
- **Kind of Product / Business:** Local-first desktop API client & developer workbench (REST, GraphQL, WebSocket, mock server, collections, environments, and keychain secrets).
- **Primary User & Context:** Backend, platform, and full-stack macOS engineers debugging APIs across long multi-tab sessions alongside Xcode, terminals, and editors.
- **Voice & Tone:** Plain, dense, technical, zero marketing fluff. Labels state exact verbs, status codes, timings, and byte counts.
- **Design Mode:** `Default (Impeccable Craft)` — crisp native macOS workstation ergonomics, macOS HIG windowing (`NavigationSplitView`, unified toolbar, native inspectors, keyboard shortcuts), automatic Light/Dark system vibrancy.

## 2. Typography Scale & Pairing
- **UI & Headings:** Native Apple `SF Pro` (`Font.system(...)`) — Title3 `15pt` Semibold, Section Heading `13pt` Semibold, Body/Controls `13pt` Regular/Medium, Caption/Meta `11pt` Medium.
- **Monospace / Code / URLs / Headers / Payloads:** `SF Mono` (`Font.system(..., design: .monospaced)`) with `.monospacedDigit()` (`tabular-nums`) required on all status badges, latency (`ms`), byte sizes, row indices, and timing breakdowns.
- **Reading Measure:** Inspector documentation & error banners constrained for readability; request/response editors fill pane width cleanly with horizontal scroll rather than awkward wrap.

## 3. Color Tokens (Semantic — macOS Light & Dark)
- **Surface / Ground:** Native system hierarchy (`NSColor.windowBackgroundColor`, `controlBackgroundColor`, `underPageBackgroundColor`, `textBackgroundColor` / macOS sidebar material), avoiding pure `#000000` / `#FFFFFF` slabs.
- **Borders:** Subtle `1px` `Separator` / `Color.primary.opacity(0.10)` hairline dividers; zero heavy drop shadows on panes or cards.
- **Accent & Semantic Status:** System accent (`Color.accentColor`) for primary actions (`Send`, active tab underline); strict semantic colors only for HTTP methods and response states:
  - `GET`: Emerald / Green (`systemGreen`)
  - `POST`: Amber / Orange (`systemOrange`)
  - `PUT` / `PATCH`: Blue (`systemBlue`)
  - `DELETE`: Red (`systemRed`)
  - `2xx`: `systemGreen`, `3xx`: `systemCyan`/`systemTeal`, `4xx`: `systemOrange`, `5xx` / Error: `systemRed`.

## 4. Layout & Rhythm Rules
- **Workbench Structure:** 3-region macOS desktop workspace: Resizable Sidebar (`220pt–340pt`) + Request Workbench / Response Inspector split (`HSplitView` / `VSplitView`, switchable horizontal/vertical).
- **Spacing Scale:** Strict `4pt` / `8pt` grid (`4, 8, 12, 16, 20pt`); compact toolbar row (`36pt–40pt` height), key-value table rows (`26pt–28pt`).
- **Motion Rules:** Subtle `150ms` ease-out state transitions; honor `NSWorkspace.shared.accessibilityDisplayShouldReduceMotion`.

## 5. Project-Specific Anti-Patterns (Hard Bans)
- Never embed WebViews in the main native workbench (except system `ASWebAuthenticationSession` during OAuth2 interactive login).
- Never use neon purple/blue dark-card AI-slop gradients or decorative marketing filler cards.
- Never omit loading (cancellable in-flight progress), empty (actionable quick-create / import button), error (redacted typed diagnostic + retry), and keyboard focus states (`Cmd+Return` Send, `Cmd+T` New Tab, `Cmd+W` Close Tab, `Cmd+L` Focus URL).

