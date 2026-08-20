import { RefreshCw, X } from "lucide-react";
import type { AppSettings, UpdateStatus } from "../types";
import { CustomSelect } from "./CustomSelect";
import { useI18n, SUPPORTED_LANGUAGES } from "../services/i18n";

export interface SettingsModalProps {
  open: boolean;
  appSettings: AppSettings;
  databasePath: string;
  updateStatus: UpdateStatus;
  onClose: () => void;
  onSettingsChange: (fields: Partial<AppSettings>) => void;
  onCheckForUpdates: () => void;
  onSave: () => void;
}

export function SettingsModal({
  open,
  appSettings,
  databasePath,
  updateStatus,
  onClose,
  onSettingsChange,
  onCheckForUpdates,
  onSave,
}: SettingsModalProps) {
  const { t, setLanguage } = useI18n();

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("settings.title")}
      onClick={onClose}
    >
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <div>
            <span className="settings-kicker">{t("settings.preferences")}</span>
            <h2>{t("settings.title")}</h2>
            <p>{t("settings.subtitle")}</p>
          </div>
          <button className="settings-close" type="button" aria-label={t("common.close")} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="settings-content">
          <section className="settings-section">
            <div className="settings-section-heading">
              <h3>{t("settings.sectionGeneral")}</h3>
              <p>{t("settings.sectionGeneralDesc")}</p>
            </div>
            <label className="settings-row">
              <span>
                <strong>{t("settings.updateChecks")}</strong>
                <small>{t("settings.updateChecksDesc")}</small>
              </span>
              <input
                type="checkbox"
                checked={appSettings.updateChecksEnabled}
                onChange={(e) => onSettingsChange({ updateChecksEnabled: e.target.checked })}
              />
            </label>
            <label className="settings-row">
              <span>
                <strong>{t("settings.autoSave")}</strong>
                <small>{t("settings.autoSaveDesc")}</small>
              </span>
              <input
                type="checkbox"
                checked={appSettings.autoSaveEnabled ?? false}
                onChange={(e) => onSettingsChange({ autoSaveEnabled: e.target.checked })}
              />
            </label>
            <label className="settings-field" style={{ alignItems: "center" }}>
              <span>{t("settings.theme")}</span>
              <CustomSelect
                value={appSettings.theme}
                onChange={(val) => onSettingsChange({ theme: val as AppSettings["theme"] })}
                options={[
                  { value: "system", label: t("settings.themeSystem") },
                  { value: "light", label: t("settings.themeLight") },
                  { value: "dark", label: t("settings.themeDark") },
                  { value: "warm", label: t("settings.themeWarm") },
                  { value: "matrix", label: t("settings.themeMatrix") },
                  { value: "cyberpunk", label: t("settings.themeCyberpunk") }
                ]}
              />
            </label>
            <label className="settings-field" style={{ alignItems: "center" }}>
              <span>{t('settings.layoutMode')}</span>
              <CustomSelect
                value={appSettings.layoutMode || "stacked"}
                onChange={(val) => onSettingsChange({ layoutMode: val as AppSettings["layoutMode"] })}
                options={[
                  { value: "stacked", label: t('settings.layoutStacked') },
                  { value: "split", label: t('settings.layoutSplit') },
                ]}
              />
            </label>
            <label className="settings-field" style={{ alignItems: "center" }}>
              <span>{t('settings.uiDensity')}</span>
              <CustomSelect
                value={appSettings.uiDensity || "comfortable"}
                onChange={(val) => onSettingsChange({ uiDensity: val as AppSettings["uiDensity"] })}
                options={[
                  { value: "comfortable", label: t('settings.densityComfortable') },
                  { value: "compact", label: t('settings.densityCompact') },
                ]}
              />
            </label>
            <label className="settings-field" style={{ alignItems: "center" }}>
              <span>{t('settings.language')}</span>
              <CustomSelect
                value={appSettings.language || "system"}
                onChange={(val) => {
                  const newLang = val as AppSettings["language"];
                  onSettingsChange({ language: newLang });
                  if (newLang) setLanguage(newLang);
                }}
                options={SUPPORTED_LANGUAGES.map(l => ({ value: l.code, label: l.name }))}
              />
            </label>
            <div className="settings-field">
              <span>{t("settings.dataLocation")}</span>
              <code className="settings-path">{databasePath}</code>
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-heading">
              <h3>{t('settings.responseViewer')}</h3>
              <p>{t('settings.responseViewerDesc')}</p>
            </div>
            <label className="settings-row">
              <span>
                <strong>{t('settings.responseAutoWrap')}</strong>
                <small>{t('settings.responseAutoWrapDesc')}</small>
              </span>
              <input
                type="checkbox"
                checked={appSettings.responseAutoWrap ?? true}
                onChange={(e) => onSettingsChange({ responseAutoWrap: e.target.checked })}
              />
            </label>
            <label className="settings-row">
              <span>
                <strong>{t('settings.responseAutoCollapse')}</strong>
                <small>{t('settings.responseAutoCollapseDesc')}</small>
              </span>
              <input
                type="checkbox"
                checked={appSettings.responseAutoCollapse ?? false}
                onChange={(e) => onSettingsChange({ responseAutoCollapse: e.target.checked })}
              />
            </label>
          </section>

          <section className="settings-section">
            <div className="settings-section-heading">
              <h3>{t('settings.developerQuotes')}</h3>
              <p>{t('settings.developerQuotesDesc')}</p>
            </div>
            <label className="settings-row">
              <span>
                <strong>{t('settings.developerQuotes')}</strong>
                <small>{t('settings.developerQuotesDesc')}</small>
              </span>
              <input
                type="checkbox"
                checked={appSettings.quotesEnabled ?? true}
                onChange={(e) => onSettingsChange({ quotesEnabled: e.target.checked })}
              />
            </label>
          </section>

          <section className="settings-section">
            <div className="settings-section-heading">
              <h3>{t("settings.sectionPrivacy")}</h3>
              <p>{t("settings.sectionPrivacyDesc")}</p>
            </div>
            <label className="settings-row">
              <span>
                <strong>{t("settings.exportRedaction")}</strong>
                <small>{t("settings.exportRedactionDesc")}</small>
              </span>
              <input
                type="checkbox"
                checked={appSettings.exportRedactionEnabled}
                onChange={(e) => onSettingsChange({ exportRedactionEnabled: e.target.checked })}
              />
            </label>
            <label className="settings-row">
              <span>
                <strong>{t("settings.diagnosticsRedaction")}</strong>
                <small>{t("settings.diagnosticsRedactionDesc")}</small>
              </span>
              <input
                type="checkbox"
                checked={appSettings.diagnosticsRedactionEnabled}
                onChange={(e) => onSettingsChange({ diagnosticsRedactionEnabled: e.target.checked })}
              />
            </label>
          </section>

          <section className="settings-section">
            <div className="settings-section-heading">
              <h3>{t("settings.updates")}</h3>
              <p>{t("settings.updatesDesc")}</p>
            </div>
            <label className="settings-field" style={{ alignItems: "center" }}>
              <span>{t("settings.offlineBehavior")}</span>
              <CustomSelect
                value={appSettings.offlineBehavior}
                onChange={(val) => onSettingsChange({ offlineBehavior: val as AppSettings["offlineBehavior"] })}
                options={[
                  { value: "silent", label: t("settings.offlineSilent") },
                  { value: "notice", label: t("settings.offlineNotice") }
                ]}
              />
            </label>
            <div className="settings-status">{updateStatus.lastCheckedLabel}</div>
          </section>

          <section className="settings-section">
            <div className="settings-section-heading">
              <h3>{t("settings.sectionNetwork")}</h3>
              <p>{t("settings.sectionNetworkDesc")}</p>
            </div>
            <label className="settings-row">
              <span>
                <strong>{t("settings.defaultTimeout")}</strong>
                <small>{t("settings.defaultTimeoutDesc")}</small>
              </span>
              <input
                className="settings-number"
                type="number"
                value={appSettings.timeoutMs}
                onChange={(e) => onSettingsChange({ timeoutMs: parseInt(e.target.value) || 30000 })}
              />
            </label>
            <label className="settings-row">
              <span>
                <strong>{t("settings.defaultFollowRedirects")}</strong>
                <small>{t("settings.defaultFollowRedirectsDesc")}</small>
              </span>
              <input
                type="checkbox"
                checked={appSettings.followRedirects}
                onChange={(e) => onSettingsChange({ followRedirects: e.target.checked })}
              />
            </label>
          </section>

          <section className="settings-section">
            <h3>{t("settings.aboutAttribution")}</h3>
            <p style={{ fontSize: "12px", color: "var(--color-muted)", margin: 0, lineHeight: 1.5 }}>
              {t("settings.aboutDesc")}
            </p>
          </section>
        </div>

        <div className="settings-footer">
          <button
            type="button"
            className="ghost-button"
            onClick={() => void onCheckForUpdates()}
          >
            <RefreshCw size={14} />
            {t("settings.checkNow")}
          </button>
          <div className="settings-footer-actions">
            <button className="modal-cancel" type="button" onClick={onClose}>
              {t("common.cancel")}
            </button>
            <button className="modal-confirm" type="button" onClick={() => void onSave()}>
              {t("settings.saveSettings")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
