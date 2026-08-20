import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { en } from "../locales/en";
import { vi } from "../locales/vi";
import { ja } from "../locales/ja";
import { zhCN } from "../locales/zh-CN";
import { es } from "../locales/es";
import { fr } from "../locales/fr";
import { de } from "../locales/de";
import { ko } from "../locales/ko";

export type SupportedLanguage = "system" | "en" | "vi" | "ja" | "zh-CN" | "es" | "fr" | "de" | "ko";

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag?: string;
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: "system", name: "System Default", nativeName: "Auto" },
  { code: "en", name: "English (US)", nativeName: "English" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "zh-CN", name: "Chinese (Simplified)", nativeName: "简体中文" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "ko", name: "Korean", nativeName: "한국어" },
];

export const DICTIONARIES: Record<string, Record<string, string>> = {
  en,
  vi,
  ja,
  "zh-CN": zhCN,
  zh: zhCN,
  es,
  fr,
  de,
  ko,
};

export function detectSystemLanguage(): "en" | "vi" | "ja" | "zh-CN" | "es" | "fr" | "de" | "ko" {
  try {
    const navLang = (navigator.language || (navigator as any).userLanguage || "en").toLowerCase();
    if (navLang.startsWith("vi")) return "vi";
    if (navLang.startsWith("ja")) return "ja";
    if (navLang.startsWith("zh")) return "zh-CN";
    if (navLang.startsWith("es")) return "es";
    if (navLang.startsWith("fr")) return "fr";
    if (navLang.startsWith("de")) return "de";
    if (navLang.startsWith("ko")) return "ko";
  } catch {
    // fallback
  }
  return "en";
}

let activeLanguage: SupportedLanguage = "system";

export function getActiveLanguage(): SupportedLanguage {
  return activeLanguage;
}

export function getResolvedLanguage(lang: SupportedLanguage = activeLanguage): "en" | "vi" | "ja" | "zh-CN" | "es" | "fr" | "de" | "ko" {
  if (lang === "system" || !lang) {
    return detectSystemLanguage();
  }
  return lang;
}

/**
 * Pure translation function for use anywhere (inside or outside React tree).
 */
export function t(key: string, params?: string | number, langOverride?: SupportedLanguage): string {
  const targetLang = getResolvedLanguage(langOverride || activeLanguage);
  const dict = DICTIONARIES[targetLang] || en;
  let text = dict[key] || en[key as keyof typeof en] || key;

  if (params) {
    for (const [paramKey, paramVal] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{\\s*${paramKey}\\s*\\}`, "g"), String(paramVal));
      text = text.replace(new RegExp(`\\{\\{\\s*${paramKey}\\s*\\}\\}`, "g"), String(paramVal));
    }
  }

  return text;
}

export interface I18nContextValue {
  language: SupportedLanguage;
  resolvedLanguage: "en" | "vi" | "ja" | "zh-CN" | "es" | "fr" | "de" | "ko";
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string, params?: any) => string;
  supportedLanguages: LanguageInfo[];
}

export const I18nContext = createContext<I18nContextValue>({
  language: "system",
  resolvedLanguage: "en",
  setLanguage: () => {},
  t: (k) => t(k),
  supportedLanguages: SUPPORTED_LANGUAGES,
});

export interface I18nProviderProps {
  language?: SupportedLanguage;
  onLanguageChange?: (lang: SupportedLanguage) => void;
  children: React.ReactNode;
}

export function I18nProvider({ language = "system", onLanguageChange, children }: I18nProviderProps) {
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>(language);

  useEffect(() => {
    if (language && language !== currentLang) {
      setCurrentLang(language);
      activeLanguage = language;
    }
  }, [language]);

  const handleSetLanguage = useCallback((newLang: SupportedLanguage) => {
    setCurrentLang(newLang);
    activeLanguage = newLang;
    if (onLanguageChange) {
      onLanguageChange(newLang);
    }
  }, [onLanguageChange]);

  const resolved = useMemo(() => getResolvedLanguage(currentLang), [currentLang]);

  const translate = useCallback((key: string, params?: string | number) => {
    return t(key, params, currentLang);
  }, [currentLang]);

  const value = useMemo<I18nContextValue>(() => ({
    language: currentLang,
    resolvedLanguage: resolved,
    setLanguage: handleSetLanguage,
    t: translate,
    supportedLanguages: SUPPORTED_LANGUAGES,
  }), [currentLang, resolved, handleSetLanguage, translate]);

  return React.createElement(I18nContext.Provider, { value }, children);
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
