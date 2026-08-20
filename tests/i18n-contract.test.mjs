import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");

test("i18n service and dictionary files exist and support 8 languages", () => {
  const languages = ["en", "vi", "ja", "zh-CN", "es", "fr", "de", "ko"];
  
  for (const lang of languages) {
    const exists = existsSync(new URL(`src/renderer/src/locales/${lang}.ts`, root));
    assert.ok(exists, `Locale file src/renderer/src/locales/${lang}.ts should exist`);
    
    const content = read(`src/renderer/src/locales/${lang}.ts`);
    assert.match(content, /common\.save/);
    assert.match(content, /settings\.language/);
    assert.match(content, /runner\.summaryReport/);
  }
});

test("i18n service exposes t, I18nProvider, useI18n, and detectSystemLanguage", () => {
  const i18nService = read("src/renderer/src/services/i18n.ts");

  assert.match(i18nService, /export function t/);
  assert.match(i18nService, /export function useI18n/);
  assert.match(i18nService, /export function I18nProvider/);
  assert.match(i18nService, /export function detectSystemLanguage/);
  assert.match(i18nService, /export const SUPPORTED_LANGUAGES/);
});

test("AppSettings supports language configuration in renderer and backend persistence", () => {
  const types = read("src/renderer/src/types.ts");
  assert.match(types, /language\?: "system" \| "en" \| "vi" \| "ja" \| "zh-CN" \| "es" \| "fr" \| "de" \| "ko"/);

  const localStore = read("src/renderer/src/services/local-store.ts");
  assert.match(localStore, /language: "system"/);

  const persistence = read("src-tauri/src/persistence.rs");
  assert.match(persistence, /pub language: Option<String>/);
  assert.match(persistence, /language: Some\("system"\.to_string\(\)\)/);
});

test("SettingsModal allows user to switch application language", () => {
  const settingsModal = read("src/renderer/src/components/SettingsModal.tsx");

  assert.match(settingsModal, /useI18n/);
  assert.match(settingsModal, /SUPPORTED_LANGUAGES/);
  assert.match(settingsModal, /settings\.language/);
  assert.match(settingsModal, /setLanguage/);
});

test("App wraps root tree with I18nProvider", () => {
  const app = read("src/renderer/src/App.tsx");

  assert.match(app, /import { I18nProvider } from ".\/services\/i18n"/);
  assert.match(app, /<I18nProvider/);
  assert.match(app, /<\/I18nProvider>/);
});
