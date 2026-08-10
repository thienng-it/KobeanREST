# KobeanREST — VS Code Extension

> **A fast, local-first REST API client inside your IDE.** Send HTTP requests, manage collections, run scripts, and test APIs — all without an account or cloud sync.

[![Version](https://img.shields.io/visual-studio-marketplace/v/thienng-it.kobeanrest?color=3b82f6&style=flat-square)](https://marketplace.visualstudio.com/items?itemName=thienng-it.kobeanrest)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/thienng-it.kobeanrest?color=22c55e&style=flat-square)](https://marketplace.visualstudio.com/items?itemName=thienng-it.kobeanrest)
[![License](https://img.shields.io/github/license/thienng-it/KobeanREST?color=10b981&style=flat-square)](../LICENSE)

---

## ✨ Features

### 🚀 Full-Featured API Client in Your Editor
- **Send HTTP requests** directly from `.http` files with a single click
- **Embedded UI Panel** — full KobeanREST interface as a VS Code webview
- **Collection management** — organize requests into collections and folders
- **Environment variables** — switch between Dev/Staging/Production instantly
- **Request history** — grouped by date with replay capability

### 📝 Rich `.http` File Support
- **Syntax highlighting** — methods, URLs, headers, variables, and JSON bodies
- **CodeLens actions** — "▶ Send Request", "📋 Copy as cURL", "⚡ Generate Code"
- **IntelliSense** — auto-complete HTTP methods, headers, MIME types, and `{{variables}}`
- **Hover information** — see resolved variable values and header documentation
- **Real-time diagnostics** — URL validation, unresolved variables, missing headers
- **Clickable URLs** — click any URL to open in browser

### 🔐 Local-First & Secure
- **No account required** — no login, no cloud, no telemetry
- **OS keychain secrets** — sensitive data stored in your system's secure storage
- **Workspace-local storage** — all data in `.kobeanrest/` alongside your project

### 🛠️ Developer Productivity
- **Code snippet generation** — cURL, JavaScript, Python, Go, Java
- **Pre/Post request scripts** — Postman-compatible `pm.*` API
- **Collection runner** — execute entire collections sequentially
- **Import/Export** — Postman, OpenAPI, and KobeanREST native formats

---

## 📋 Quick Start

### 1. Create an `.http` file

```http
### Get all users
GET https://jsonplaceholder.typicode.com/users
Accept: application/json

### Create a new user
POST https://jsonplaceholder.typicode.com/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}
```

### 2. Click "▶ Send Request" above any request block

### 3. View the response with timing breakdown, headers, and formatted body

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|:---------|:-------|
| `Cmd+Alt+R` / `Ctrl+Alt+R` | Send Request (in `.http` file) |
| `Cmd+Alt+N` / `Ctrl+Alt+N` | New Request |
| `Cmd+Alt+K` / `Ctrl+Alt+K` | Open KobeanREST Panel |

---

## 🔧 Configuration

| Setting | Default | Description |
|:--------|:--------|:------------|
| `kobeanrest.defaultTimeout` | `30000` | Default request timeout (ms) |
| `kobeanrest.followRedirects` | `true` | Follow HTTP redirects |
| `kobeanrest.maxHistoryEntries` | `500` | Max history entries retained |
| `kobeanrest.proxy` | `""` | HTTP proxy URL |
| `kobeanrest.validateCertificates` | `true` | Validate SSL/TLS certificates |
| `kobeanrest.responsePreviewMaxSize` | `5242880` | Max response body display size |

---

## 📁 `.http` File Syntax

```http
# File-level variables
@baseUrl = https://api.example.com
@token = your-api-token

### Named request with variables
# @name getUsers
GET {{baseUrl}}/users
Authorization: Bearer {{token}}
Accept: application/json

### POST with JSON body
POST {{baseUrl}}/users
Content-Type: application/json

{
  "name": "{{$randomString}}",
  "email": "{{$randomEmail}}",
  "created": "{{$isoTimestamp}}"
}
```

### Dynamic Variables

| Variable | Description |
|:---------|:------------|
| `{{$timestamp}}` | Unix timestamp (seconds) |
| `{{$isoTimestamp}}` | ISO 8601 timestamp |
| `{{$guid}}` / `{{$uuid}}` | Random UUID |
| `{{$randomInt}}` | Random integer (0-999) |
| `{{$randomEmail}}` | Random email address |
| `{{$randomString}}` | Random hex string |
| `{{$randomBoolean}}` | Random true/false |

---

## 🆚 Comparison

| Feature | **KobeanREST** | Thunder Client | REST Client |
|:--------|:---------------|:---------------|:------------|
| GUI Interface | ✅ Full webview | ✅ | ❌ |
| `.http` File Support | ✅ | ❌ | ✅ |
| CodeLens Actions | ✅ | ❌ | ✅ |
| IntelliSense | ✅ | ❌ | ✅ |
| Collection Runner | ✅ | Pro only | ❌ |
| Pre/Post Scripts | ✅ | Pro only | ❌ |
| Code Generation | ✅ 5 languages | Limited | ✅ |
| Local-First (No Account) | ✅ | ✅ | ✅ |
| OS Keychain Secrets | ✅ | ❌ | ❌ |
| Open Source | ✅ MIT | ❌ | ✅ |
| Price | **Free** | Freemium | Free |

---

## 📄 License

[MIT](../LICENSE) — Created by [Joseph Thien](https://github.com/thienng-it) and [Kobenguyent](https://github.com/kobenguyent).
