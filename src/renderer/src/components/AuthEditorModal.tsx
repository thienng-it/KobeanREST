import { X } from "lucide-react";
import type { ApiAuthMode, AuthConfig, EnvironmentVariable } from "../types";
import { AuthEditorForm, type AuthDraft } from "./AuthEditorForm";
import { useI18n } from '../services/i18n';

export type AuthEditorTarget = { id: string; type: "collection" | "folder" } | null;

export interface AuthEditorModalProps {
  open: boolean;
  target: AuthEditorTarget;
  draft: AuthDraft;
  activeVars: EnvironmentVariable[];
  onClose: () => void;
  onDraftChange: (draft: AuthDraft) => void;
  onSave: () => void;
}

export function AuthEditorModal({
  open,
  target,
  draft,
  activeVars,
  onClose,
  onDraftChange,
  onSave,
}: AuthEditorModalProps) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t('auth.editorAria')}
      onClick={onClose}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "500px", maxWidth: "90vw", display: "flex", flexDirection: "column", gap: "16px" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "16px" }}>
            {t('auth.authenticationFor')} {target?.type === "folder" ? t('auth.folder') : t('auth.collection')}
          </h2>
          <button type="button" onClick={onClose} style={{ all: "unset", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        <AuthEditorForm
          draft={draft}
          activeVars={activeVars}
          onDraftChange={onDraftChange}
        />

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
          <button className="modal-cancel" type="button" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="modal-confirm" type="button" onClick={onSave}>
            {t('auth.saveAuth')}
          </button>
        </div>
      </div>
    </div>
  );
}
