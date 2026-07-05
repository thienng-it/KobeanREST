import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = {
  packageJson: "package.json",
  packageLock: "package-lock.json",
  tauriConfig: "src-tauri/tauri.conf.json",
  cargoToml: "src-tauri/Cargo.toml",
  releaseWorkflow: ".github/workflows/release.yml",
  releaseOperations: "docs/release-operations.md",
  releaseQa: "docs/release-qa.md",
};
const placeholderPublicKey = "REPLACE_WITH_TAURI_UPDATER_PUBLIC_KEY_BEFORE_PUBLIC_RELEASE";

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function requireFile(relativePath, findings) {
  if (!existsSync(path.join(root, relativePath))) {
    findings.push(`Missing required release file: ${relativePath}`);
    return false;
  }

  return true;
}

const findings = [];
for (const relativePath of Object.values(files)) {
  requireFile(relativePath, findings);
}

if (findings.length > 0) {
  console.error("check-release-preflight failed:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

const pkg = JSON.parse(read(files.packageJson));
const packageLock = JSON.parse(read(files.packageLock));
const tauriConfig = JSON.parse(read(files.tauriConfig));
const cargoToml = read(files.cargoToml);
const releaseWorkflow = read(files.releaseWorkflow);

const version = pkg.version;
const updater = tauriConfig.plugins?.updater;
const pubkey = updater?.pubkey;
const endpoints = updater?.endpoints ?? [];
const cargoVersionMatch = cargoToml.match(/^version = "([^"]+)"/m);
const cargoVersion = cargoVersionMatch?.[1];

if (tauriConfig.version !== version) {
  findings.push(`src-tauri/tauri.conf.json version ${tauriConfig.version} does not match package.json version ${version}.`);
}

if (cargoVersion !== version) {
  findings.push(`src-tauri/Cargo.toml version ${cargoVersion ?? "missing"} does not match package.json version ${version}.`);
}

if (packageLock.version !== version || packageLock.packages?.[""]?.version !== version) {
  findings.push(`package-lock.json version metadata does not match package.json version ${version}.`);
}

if (!pubkey || pubkey === placeholderPublicKey) {
  findings.push(
    `src-tauri/tauri.conf.json still uses the placeholder public key. Replace ${placeholderPublicKey} before public release.`,
  );
}

if (!endpoints.some((endpoint) => endpoint.includes("latest.json"))) {
  findings.push("src-tauri/tauri.conf.json updater endpoints must include latest.json release metadata.");
}

if (!releaseWorkflow.includes("TAURI_SIGNING_PRIVATE_KEY")) {
  findings.push(".github/workflows/release.yml no longer references TAURI_SIGNING_PRIVATE_KEY.");
}

if (!releaseWorkflow.includes("TAURI_SIGNING_PRIVATE_KEY_PASSWORD")) {
  findings.push(".github/workflows/release.yml no longer references TAURI_SIGNING_PRIVATE_KEY_PASSWORD.");
}

if (!releaseWorkflow.includes("SHA256SUMS.txt")) {
  findings.push(".github/workflows/release.yml no longer publishes SHA256SUMS.txt.");
}

if (findings.length > 0) {
  console.error("check-release-preflight failed:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log(`Release preflight passed for version ${version}.`);
console.log(`Next tag: git tag v${version}`);
console.log("Next push: git push origin <tag>");
