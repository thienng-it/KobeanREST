import React, { useEffect, useRef, useState } from "react";
import type { EnvironmentVariable, ScopedVariableEntityType } from "../types";

export type EnvVarScope =
  | { type: "environment"; envName: string }
  | { type: "collection"; entityId: string; entityName: string }
  | { type: "folder"; entityId: string; entityName: string }
  | { type: "request"; entityId: string; entityName: string };

export interface SetEnvVarModalProps {
  open: boolean;
  selectedText: string;
  environments: Array<{ name: string; variables: EnvironmentVariable[] }>;
  activeEnvironment: string;
  requestId?: string;
  requestName?: string;
  folderId?: string;
  folderName?: string;
  collectionId?: string;
  collectionName?: string;
  onConfirm: (scope: EnvVarScope, varName: string, value: string) => void;
  onClose: () => void;
}

type ScopeKind = "environment" | "collection" | "folder" | "request";

export function SetEnvVarModal({
  open,
  selectedText,
  environments,
  activeEnvironment,
  requestId,
  requestName,
  folderId,
  folderName,
  collectionId,
  collectionName,
  onConfirm,
  onClose,
}: SetEnvVarModalProps) {
  const [varName, setVarName] = useState("");
  const [value, setValue] = useState(selectedText);
  const [scopeKind, setScopeKind] = useState<ScopeKind>("environment");
  const [selectedEnv, setSelectedEnv] = useState(activeEnvironment);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setVarName("");
      setValue(selectedText);
      setSelectedEnv(activeEnvironment);
      setScopeKind(requestId ? "request" : folderId ? "folder" : collectionId ? "collection" : "environment");
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [open, selectedText, activeEnvironment, requestId, folderId, collectionId]);

  if (!open) return null;

  const availableScopes: { kind: ScopeKind; label: string; desc: string }[] = [
    { kind: "environment", label: "Environment", desc: `Active: ${selectedEnv || "none"}` },
    ...(collectionId && collectionName ? [{ kind: "collection" as ScopeKind, label: "Collection", desc: collectionName }] : []),
    ...(folderId && folderName ? [{ kind: "folder" as ScopeKind, label: "Folder", desc: folderName }] : []),
    ...(requestId && requestName ? [{ kind: "request" as ScopeKind, label: "Request", desc: requestName }] : []),
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = varName.trim();
    if (!trimmedName) return;

    let scope: EnvVarScope;
    if (scopeKind === "environment") {
      if (!selectedEnv) return;
      scope = { type: "environment", envName: selectedEnv };
    } else if (scopeKind === "collection" && collectionId && collectionName) {
      scope = { type: "collection", entityId: collectionId, entityName: collectionName };
    } else if (scopeKind === "folder" && folderId && folderName) {
      scope = { type: "folder", entityId: folderId, entityName: folderName };
    } else if (scopeKind === "request" && requestId && requestName) {
      scope = { type: "request", entityId: requestId, entityName: requestName };
    } else {
      return;
    }

    onConfirm(scope, trimmedName, value);
    onClose();
  };

  const scopeIconMap: Record<ScopeKind, string> = {
    environment: "🌍",
    collection: "📁",
    folder: "🗂️",
    request: "📄",
  };

  return (
    <div
      className="modal-overlay"
      style={{ alignItems: "flex-start", paddingTop: "80px" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="modal"
        style={{ width: "min(460px, 94vw)", maxWidth: "min(460px, 94vw)", padding: 0, overflow: "hidden" }}
      >
        {/* Header */}
        <div style={{
          padding: "22px 24px 18px",
          borderBottom: "1px solid var(--color-border)",
          background: "radial-gradient(circle at 8% 0%, rgba(37, 99, 235, 0.1), transparent 40%), var(--color-surface-muted)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "12px",
        }}>
          <div>
            <span style={{ display: "block", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-muted)", marginBottom: "4px" }}>
              New Variable
            </span>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--color-text)", letterSpacing: "-0.03em" }}>
              Set as Environment Variable
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ all: "unset", cursor: "pointer", display: "grid", placeItems: "center", width: "32px", height: "32px", borderRadius: "10px", color: "var(--color-muted)", flexShrink: 0 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Scope selector */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--color-text-soft)", marginBottom: "8px" }}>
                Scope
              </label>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {availableScopes.map(({ kind, label, desc }) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setScopeKind(kind)}
                    style={{
                      all: "unset",
                      cursor: "pointer",
                      padding: "6px 12px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: 600,
                      border: `1.5px solid ${scopeKind === kind ? "var(--color-text-active)" : "var(--color-border)"}`,
                      background: scopeKind === kind ? "var(--color-shadow-tint)" : "transparent",
                      color: scopeKind === kind ? "var(--color-text-active)" : "var(--color-text-soft)",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      transition: "all 0.15s",
                    }}
                    title={desc}
                  >
                    <span>{scopeIconMap[kind]}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              {scopeKind !== "environment" && (
                <p style={{ margin: "6px 0 0", fontSize: "11px", color: "var(--color-muted)" }}>
                  Will be saved to {scopeKind}: <strong style={{ color: "var(--color-text-soft)" }}>
                    {scopeKind === "collection" ? collectionName : scopeKind === "folder" ? folderName : requestName}
                  </strong>
                </p>
              )}
            </div>

            {/* Environment picker — only shown for env scope */}
            {scopeKind === "environment" && (
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--color-text-soft)", marginBottom: "6px" }}>
                  Environment
                </label>
                <select
                  value={selectedEnv}
                  onChange={(e) => setSelectedEnv(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface)",
                    color: "var(--color-text)",
                    fontSize: "13px",
                    outline: "none",
                  }}
                >
                  {environments.map((env) => (
                    <option key={env.name} value={env.name}>{env.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Variable name */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--color-text-soft)", marginBottom: "6px" }}>
                Variable Name
              </label>
              <input
                ref={nameInputRef}
                type="text"
                value={varName}
                onChange={(e) => setVarName(e.target.value)}
                placeholder="e.g. auth_token"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                required
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1.5px solid var(--color-border)",
                  background: "var(--color-surface)",
                  color: "var(--color-text)",
                  fontSize: "13px",
                  outline: "none",
                  fontFamily: "ui-monospace, monospace",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-text-active)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
              />
            </div>

            {/* Value */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--color-text-soft)", marginBottom: "6px" }}>
                Value
              </label>
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1.5px solid var(--color-border)",
                  background: "var(--color-surface)",
                  color: "var(--color-text)",
                  fontSize: "13px",
                  outline: "none",
                  fontFamily: "ui-monospace, monospace",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-text-active)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
              />
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: "14px 24px 20px",
            display: "flex",
            gap: "8px",
            justifyContent: "flex-end",
            borderTop: "1px solid var(--color-border)",
          }}>
            <button
              type="button"
              className="ghost-button"
              onClick={onClose}
              style={{ minHeight: "36px", padding: "0 16px" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!varName.trim() || (scopeKind === "environment" && !selectedEnv)}
              style={{
                minHeight: "36px",
                padding: "0 18px",
                border: 0,
                borderRadius: "8px",
                background: "linear-gradient(135deg, var(--color-text-active), #1d4ed8)",
                color: "#fff",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                opacity: (!varName.trim() || (scopeKind === "environment" && !selectedEnv)) ? 0.5 : 1,
                transition: "opacity 0.15s",
              }}
            >
              Save Variable
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
