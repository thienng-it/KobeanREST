import { X } from "lucide-react";
import { useI18n } from "../../services/i18n";

export interface RunnerHeaderProps {
  title: string;
  scopeType: "folder" | "collection";
  isRunning: boolean;
  onClose: () => void;
}

export function RunnerHeader({ title, scopeType, isRunning, onClose }: RunnerHeaderProps) {
  const { t } = useI18n();
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "var(--color-text)" }}>
          {t('runner.collectionRunner')}: {title}
        </h2>
        <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
          {t('runner.scope')}: {scopeType}
        </span>
      </div>
      <button
        type="button"
        className="btn-icon"
        onClick={onClose}
        disabled={isRunning}
        aria-label={t('runner.closeRunner')}
        style={{ all: "unset", cursor: isRunning ? "not-allowed" : "pointer", padding: "4px" }}
      >
        <X size={18} />
      </button>
    </div>
  );
}
