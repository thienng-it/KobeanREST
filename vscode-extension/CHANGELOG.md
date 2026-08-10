# Changelog

All notable changes to the KobeanREST VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0] - 2026-08-08

### Added
- Full VS Code extension with Activity Bar sidebar
- `.http` and `.rest` file language support with TextMate grammar
- Syntax highlighting for HTTP methods, URLs, headers, variables, and JSON bodies
- CodeLens actions: "▶ Send Request", "📋 Copy as cURL", "⚡ Generate Code"
- IntelliSense for HTTP methods, headers, MIME types, and environment variables
- Hover information showing resolved variable values and header documentation
- Real-time diagnostics: URL validation, unresolved variables, missing Content-Type
- Clickable URL links in `.http` files
- Node.js HTTP engine with DNS/Connect/TLS timing breakdown
- Collection Explorer tree view in sidebar with method-colored icons
- History tree view grouped by date (Today, Yesterday, This Week, Older)
- Response Viewer panel with timing grid, headers table, and formatted JSON
- Environment variable resolution with `{{variableName}}` syntax
- 8 dynamic variables: `$timestamp`, `$isoTimestamp`, `$guid`, `$uuid`, `$randomInt`, `$randomEmail`, `$randomString`, `$randomBoolean`
- Sandboxed pre/post request script execution with `pm.*` API
- Code snippet generation in cURL, JavaScript, Python, Go, and Java
- Auth support: Basic, Bearer, API Key, OAuth 2.0
- OS keychain secret storage via VS Code SecretStorage API
- JSON-file workspace persistence in `.kobeanrest/` directory
- Import support for Postman, OpenAPI, and KobeanREST formats
- Embedded full KobeanREST React UI as a webview panel
- Strict Content Security Policy with nonce-based script loading
- Theme synchronization with VS Code dark/light/high-contrast themes
- 15 registered commands with keyboard shortcuts
- GitHub Actions CI/CD pipeline for automated build, test, and publish
- Contract tests validating extension structure and security
- 25 unit tests for HTTP parser and variable resolver
