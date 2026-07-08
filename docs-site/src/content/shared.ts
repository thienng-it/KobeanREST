import type { ReactNode } from "react";

export interface DocsSection {
  id: string;
  title: string;
  intro?: string;
  body?: ReactNode;
  items?: string[];
}

export interface DocsPageContent {
  eyebrow: string;
  title: string;
  description: string;
  sections: DocsSection[];
}

export const commands = {
  install: "npm install",
  test: "npm test",
  build: "npm run build",
  nativeCheck: "source /Users/josephnguyen/.cargo/env && npm run check:native",
  cargoFmt: "source /Users/josephnguyen/.cargo/env && cargo fmt --manifest-path src-tauri/Cargo.toml -- --check",
  releaseCheck: "npm run check:release",
  secretsCheck: "npm run check:secrets",
};
