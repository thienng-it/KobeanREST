# Native Readiness

KobeanREST uses Tauri, so local desktop verification requires both the JavaScript toolchain and the Rust/native macOS toolchain.

## Required Tools

- Node.js and npm
- Rust and Cargo through rustup
- Xcode command line tools on macOS

Install Rust with rustup:

```bash
curl -L https://sh.rustup.rs -o /private/tmp/rustup-init.sh
sh /private/tmp/rustup-init.sh -y --profile minimal
```

After installing Rust, restart the shell or load Cargo into the current shell:

```bash
. "$HOME/.cargo/env"
```

## macOS Xcode License

Rust builds on macOS use Apple linker tools. If `cargo check` fails with an Xcode license message, accept the license in a local terminal with admin privileges:

```bash
sudo xcodebuild -license accept
```

Then rerun:

```bash
npm run check:native
```

## Verification Commands

Run the web and contract checks:

```bash
npm test
npm run build
```

Run the native compile check:

```bash
npm run check:native
```

Launch the desktop app in development:

```bash
npm run tauri:dev
```

Build local desktop artifacts:

```bash
npm run tauri:build
```
