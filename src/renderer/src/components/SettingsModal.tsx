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
      aria-label="App settings"
      onClick={onClose}
    >
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <div>
            <span className="settings-kicker">Preferences</span>
            <h2>App settings</h2>
            <p>Control startup checks, privacy defaults, and request behavior.</p>
          </div>
          <button className="settings-close" type="button" aria-label="Close settings" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="settings-content">
          <section className="settings-section">
            <div className="settings-section-heading">
              <h3>General</h3>
              <p>Launch behavior and appearance.</p>
            </div>
            <label className="settings-row">
              <span>
                <strong>Update checks after launch</strong>
                <small>Look for signed app updates automatically when KobeanREST starts.</small>
              </span>
              <input
                type="checkbox"
                checked={appSettings.updateChecksEnabled}
                onChange={(e) => onSettingsChange({ updateChecksEnabled: e.target.checked })}
              />
            </label>
            <label className="settings-row">
              <span>
                <strong>Auto-save requests</strong>
                <small>Automatically save changes to requests without needing to press Save.</small>
              </span>
              <input
                type="checkbox"
                checked={appSettings.autoSaveEnabled ?? false}
                onChange={(e) => onSettingsChange({ autoSaveEnabled: e.target.checked })}
              />
            </label>
            <label className="settings-field" style={{ alignItems: "center" }}>
              <span>Theme</span>
              <CustomSelect
                value={appSettings.theme}
                onChange={(val) => onSettingsChange({ theme: val as AppSettings["theme"] })}
                options={[
                  { value: "system", label: "System" },
                  { value: "light", label: "Glass: Light" },
                  { value: "dark", label: "Glass: Dark" },
                  { value: "warm", label: "Glass: Warm / Sunset" },
                  { value: "matrix", label: "Neon: Matrix" },
                  { value: "cyberpunk", label: "Neon: Cyberpunk" }
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
                  if (newLang && newLang !== "system") setLanguage(newLang);
                }}
                options={SUPPORTED_LANGUAGES.map(l => ({ value: l.code, label: l.name }))}
              />
            </label>
            <div className="settings-field">
              <span>Data location</span>
              <code className="settings-path">{databasePath}</code>
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-heading">
              <h3>Response Viewer</h3>
              <p>Configure JSON formatting, line wrapping, and code folding.</p>
            </div>
            <label className="settings-row">
              <span>
                <strong>Auto-wrap lines</strong>
                <small>Wrap long lines automatically in response JSON and text viewers.</small>
              </span>
              <input
                type="checkbox"
                checked={appSettings.responseAutoWrap ?? true}
                onChange={(e) => onSettingsChange({ responseAutoWrap: e.target.checked })}
              />
            </label>
            <label className="settings-row">
              <span>
                <strong>Auto-collapse JSON</strong>
                <small>Automatically collapse/fold nested JSON objects and arrays when a response loads.</small>
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
              <h3>Privacy</h3>
              <p>Keep exported files and diagnostics safe by default.</p>
            </div>
            <label className="settings-row">
              <span>
                <strong>Export redaction</strong>
                <small>Remove secret values from exported workspace data.</small>
              </span>
              <input
                type="checkbox"
                checked={appSettings.exportRedactionEnabled}
                onChange={(e) => onSettingsChange({ exportRedactionEnabled: e.target.checked })}
              />
            </label>
            <label className="settings-row">
              <span>
                <strong>Diagnostics redaction</strong>
                <small>Sanitize URLs, headers, and tokens from error reports.</small>
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
              <h3>Updates</h3>
              <p>Choose how the app behaves when update checks cannot reach the network.</p>
            </div>
            <label className="settings-field" style={{ alignItems: "center" }}>
              <span>Offline behavior</span>
              <CustomSelect
                value={appSettings.offlineBehavior}
                onChange={(val) => onSettingsChange({ offlineBehavior: val as AppSettings["offlineBehavior"] })}
                options={[
                  { value: "silent", label: "Stay quiet when offline" },
                  { value: "notice", label: "Show a notice when update checks fail" }
                ]}
              />
            </label>
            <div className="settings-status">{updateStatus.lastCheckedLabel}</div>
          </section>

          <section className="settings-section">
            <div className="settings-section-heading">
              <h3>Network defaults</h3>
              <p>Defaults applied to newly created requests.</p>
            </div>
            <label className="settings-row">
              <span>
                <strong>Default timeout</strong>
                <small>Maximum request duration in milliseconds.</small>
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
                <strong>Default follow redirects</strong>
                <small>Automatically follow HTTP redirects for new requests.</small>
              </span>
              <input
                type="checkbox"
                checked={appSettings.followRedirects}
                onChange={(e) => onSettingsChange({ followRedirects: e.target.checked })}
              />
            </label>
          </section>

          <section className="settings-section">
            <h3>About & Attribution</h3>
            <p style={{ fontSize: "12px", color: "var(--color-muted)", margin: 0, lineHeight: 1.5 }}>
              KobeanREST is a local-first desktop API client. Built with ❤️ by <strong>josephThien</strong>.
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
            Check now
          </button>
          <div className="settings-footer-actions">
            <button className="modal-cancel" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="modal-confirm" type="button" onClick={() => void onSave()}>
              Save settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
