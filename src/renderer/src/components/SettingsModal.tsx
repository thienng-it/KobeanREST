import { RefreshCw, X } from "lucide-react";
import type { AppSettings, UpdateStatus } from "../types";

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
            <label className="settings-field">
              <span>Theme</span>
              <select
                className="settings-control"
                value={appSettings.theme}
                onChange={(e) => onSettingsChange({ theme: e.target.value as AppSettings["theme"] })}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <div className="settings-field">
              <span>Data location</span>
              <code className="settings-path">{databasePath}</code>
            </div>
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
            <label className="settings-field">
              <span>Offline behavior</span>
              <select
                className="settings-control"
                value={appSettings.offlineBehavior}
                onChange={(e) => onSettingsChange({ offlineBehavior: e.target.value as AppSettings["offlineBehavior"] })}
              >
                <option value="silent">Stay quiet when offline</option>
                <option value="notice">Show a notice when update checks fail</option>
              </select>
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
