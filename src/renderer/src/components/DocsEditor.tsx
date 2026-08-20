import React, { useState, useRef, useCallback } from "react";
import { useI18n } from "../services/i18n";
import {
  BookOpen,
  Edit3,
  Eye,
  Columns,
  Copy,
  Check,
  Plus,
  Trash2,
  FileText,
  Code,
  Heading,
  Bold,
  Italic,
  List as ListIcon,
  Table as TableIcon,
  AlertCircle,
  WandSparkles,
  ExternalLink,
} from "lucide-react";

import type { ResponseExample } from "../types";

interface DocsEditorProps {
  description: string;
  onChange: (newDescription: string) => void;
  requestName?: string;
  method?: string;
  url?: string;
  examples?: ResponseExample[];
  onSaveExamples?: (examples: ResponseExample[]) => void;
  activeResponse?: {
    status: number;
    statusText: string;
    headers?: Array<{ key: string; value: string }>;
    bodyText?: string;
    contentType?: string;
  } | null;
}

export const DocsEditor: React.FC<DocsEditorProps> = ({
  description,
  onChange,
  requestName,
  method,
  url,
  examples = [],
  onSaveExamples,
  activeResponse,
}) => {
  const { t } = useI18n();
  const [mode, setMode] = useState<"preview" | "edit" | "split">(
    (description && description.trim() !== "") || examples.length > 0 ? "preview" : "edit"
  );
  const [copied, setCopied] = useState(false);
  const [selectedExampleId, setSelectedExampleId] = useState<string | null>(
    examples.length > 0 ? examples[0].id : null
  );
  const [isAddingExample, setIsAddingExample] = useState(false);
  const [editingExampleId, setEditingExampleId] = useState<string | null>(null);

  // Form state for adding/editing an example
  const [exFormName, setExFormName] = useState("");
  const [exFormCode, setExFormCode] = useState(200);
  const [exFormStatus, setExFormStatus] = useState("OK");
  const [exFormBody, setExFormBody] = useState("");
  const [exFormMime, setExFormMime] = useState("application/json");

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep selected example valid
  const currentExample = examples.find((ex) => ex.id === selectedExampleId) || (examples.length > 0 ? examples[0] : null);

  const handleCopy = useCallback(() => {
    if (!description) return;
    navigator.clipboard.writeText(description);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [description]);

  const insertSnippet = (prefix: string, suffix: string = "", placeholder: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange(description + (description ? "\n\n" : "") + prefix + placeholder + suffix);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selection = textarea.value.substring(start, end) || placeholder;
    const replacement = prefix + selection + suffix;
    const newValue = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);

    onChange(newValue);

    setTimeout(() => {
      textarea.focus();
      const newCursor = start + prefix.length + selection.length + suffix.length;
      textarea.setSelectionRange(newCursor, newCursor);
    }, 0);
  };

  const handleInsertTemplate = () => {
    let template = `# ${requestName || "API Endpoint"}

${method ? `**Method**: \`${method}\`  \n` : ""}${url ? `**URL**: \`${url}\`  \n` : ""}
## Overview
Detailed summary of what this endpoint does and its business context.

## Request Parameters
| Name | In | Type | Required | Description |
| :--- | :--- | :--- | :--- | :--- |
| \`id\` | path / query | string | Yes | Unique resource identifier |

## Request Body
\`\`\`json
{
  "exampleKey": "exampleValue"
}
\`\`\`

## Response
`;

    if (examples.length > 0) {
      examples.forEach((ex) => {
        template += `### ${ex.code} ${ex.status}${ex.name ? ` — ${ex.name}` : ""}\n`;
        const mime = ex.bodyMimeType?.includes("json") || ex.body?.trim().startsWith("{") || ex.body?.trim().startsWith("[")
          ? "json"
          : ex.bodyMimeType?.includes("xml") || ex.body?.trim().startsWith("<")
          ? "xml"
          : "text";
        template += `\`\`\`${mime}\n${ex.body || "{}"}\n\`\`\`\n\n`;
      });
    } else {
      template += `### 200 OK\n\`\`\`json\n{\n  "success": true,\n  "data": {}\n}\n\`\`\`\n\n`;
    }

    template += `> [!NOTE]\n> Authentication is required to access this endpoint.\n`;

    onChange(template);
    setMode("preview");
  };

  const handleSaveActiveResponseAsExample = () => {
    if (!activeResponse || !onSaveExamples) return;
    const isJson = activeResponse.contentType?.includes("json") || activeResponse.bodyText?.trim().startsWith("{") || activeResponse.bodyText?.trim().startsWith("[");
    const mime = isJson ? "application/json" : (activeResponse.contentType || "text/plain");
    const newEx: ResponseExample = {
      id: `example-${Date.now()}`,
      name: `${activeResponse.status} ${activeResponse.statusText || "Response"}`,
      code: activeResponse.status,
      status: activeResponse.statusText || "OK",
      headers: activeResponse.headers || [],
      body: activeResponse.bodyText || "",
      bodyMimeType: mime,
    };
    const updated = [...examples, newEx];
    onSaveExamples(updated);
    setSelectedExampleId(newEx.id);
  };

  const handleStartAddExample = () => {
    setExFormName("");
    setExFormCode(200);
    setExFormStatus("OK");
    setExFormBody('{\n  "message": "success"\n}');
    setExFormMime("application/json");
    setEditingExampleId(null);
    setIsAddingExample(true);
  };

  const handleStartEditExample = (ex: ResponseExample) => {
    setExFormName(ex.name);
    setExFormCode(ex.code);
    setExFormStatus(ex.status);
    setExFormBody(ex.body);
    setExFormMime(ex.bodyMimeType || "application/json");
    setEditingExampleId(ex.id);
    setIsAddingExample(true);
  };

  const handleSaveExampleForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveExamples) return;

    if (editingExampleId) {
      const updated = examples.map((ex) =>
        ex.id === editingExampleId
          ? {
              ...ex,
              name: exFormName.trim() || `${exFormCode} ${exFormStatus}`,
              code: Number(exFormCode) || 200,
              status: exFormStatus.trim() || "OK",
              body: exFormBody,
              bodyMimeType: exFormMime,
            }
          : ex
      );
      onSaveExamples(updated);
    } else {
      const newEx: ResponseExample = {
        id: `example-${Date.now()}`,
        name: exFormName.trim() || `${exFormCode} ${exFormStatus}`,
        code: Number(exFormCode) || 200,
        status: exFormStatus.trim() || "OK",
        headers: [{ key: "Content-Type", value: exFormMime }],
        body: exFormBody,
        bodyMimeType: exFormMime,
      };
      const updated = [...examples, newEx];
      onSaveExamples(updated);
      setSelectedExampleId(newEx.id);
    }
    setIsAddingExample(false);
    setEditingExampleId(null);
  };

  const handleDeleteExample = (exampleId: string) => {
    if (!onSaveExamples) return;
    if (!window.confirm("Are you sure you want to delete this sample response example?")) return;
    const updated = examples.filter((ex) => ex.id !== exampleId);
    onSaveExamples(updated);
    if (selectedExampleId === exampleId) {
      setSelectedExampleId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const handleInsertExampleIntoDoc = (ex: ResponseExample) => {
    const mime = ex.bodyMimeType?.includes("json") || ex.body?.trim().startsWith("{") || ex.body?.trim().startsWith("[")
      ? "json"
      : ex.bodyMimeType?.includes("xml") || ex.body?.trim().startsWith("<")
      ? "xml"
      : "text";
    const snippet = `\n\n### ${ex.code} ${ex.status}${ex.name ? ` — ${ex.name}` : ""}\n\`\`\`${mime}\n${ex.body || "{}"}\n\`\`\`\n`;
    onChange((description || "").trim() + snippet);
  };

  return (
    <div className="docs-editor-container">
      {/* Top Toolbar */}
      <div className="docs-toolbar">
        <div className="docs-toolbar-left">
          <div className="docs-mode-segmented">
            <button
              type="button"
              className={`docs-mode-btn ${mode === "preview" ? "active" : ""}`}
              onClick={() => setMode("preview")}
              title="{t('docs.previewModeTooltip')}"
            >
              <Eye size={13} />
              <span>Preview</span>
            </button>
            <button
              type="button"
              className={`docs-mode-btn ${mode === "edit" ? "active" : ""}`}
              onClick={() => setMode("edit")}
              title="{t('docs.editModeTooltip')}"
            >
              <Edit3 size={13} />
              <span>Edit</span>
            </button>
            <button
              type="button"
              className={`docs-mode-btn ${mode === "split" ? "active" : ""}`}
              onClick={() => setMode("split")}
              title="Split Side-by-Side Mode"
            >
              <Columns size={13} />
              <span>Split</span>
            </button>
          </div>

          {(mode === "edit" || mode === "split") && (
            <div className="docs-quick-tools">
              <span className="docs-tools-divider" />
              <button
                type="button"
                className="docs-tool-btn"
                onClick={() => insertSnippet("### ", "\n", "Heading")}
                title="Heading (H3)"
              >
                <Heading size={13} />
              </button>
              <button
                type="button"
                className="docs-tool-btn"
                onClick={() => insertSnippet("**", "**", "bold text")}
                title="Bold"
              >
                <Bold size={13} />
              </button>
              <button
                type="button"
                className="docs-tool-btn"
                onClick={() => insertSnippet("*", "*", "italic text")}
                title="Italic"
              >
                <Italic size={13} />
              </button>
              <button
                type="button"
                className="docs-tool-btn"
                onClick={() => insertSnippet("`", "`", "code")}
                title="Inline Code"
              >
                <Code size={13} />
              </button>
              <button
                type="button"
                className="docs-tool-btn"
                onClick={() => insertSnippet("```json\n", "\n```\n", '{\n  "key": "value"\n}')}
                title="Code Block"
              >
                <FileText size={13} />
              </button>
              <button
                type="button"
                className="docs-tool-btn"
                onClick={() => insertSnippet("- ", "\n", "List item")}
                title="Bullet List"
              >
                <ListIcon size={13} />
              </button>
              <button
                type="button"
                className="docs-tool-btn"
                onClick={() =>
                  insertSnippet(
                    "| Parameter | Type | Required | Description |\n| :--- | :--- | :--- | :--- |\n| `param1` | string | Yes | description |\n"
                  )
                }
                title="Insert Table"
              >
                <TableIcon size={13} />
              </button>
              <button
                type="button"
                className="docs-tool-btn"
                onClick={() => insertSnippet("> [!NOTE]\n> ", "\n", "Important detail here")}
                title="Insert Callout Note"
              >
                <AlertCircle size={13} />
              </button>
            </div>
          )}
        </div>

        <div className="docs-toolbar-right">
          {(!description || description.trim() === "") && (
            <button
              type="button"
              className="docs-action-btn template-btn"
              onClick={handleInsertTemplate}
              title="Insert standard API documentation template"
            >
              <WandSparkles size={13} />
              <span>Use Template</span>
            </button>
          )}

          {description && description.trim() !== "" && (
            <button
              type="button"
              className="docs-action-btn"
              onClick={handleCopy}
              title="Copy markdown content to clipboard"
            >
              {copied ? <Check size={13} style={{ color: "var(--color-success)" }} /> : <Copy size={13} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          )}

          {description && description.trim() !== "" && (mode === "edit" || mode === "split") && (
            <button
              type="button"
              className="docs-action-btn danger"
              onClick={() => {
                if (window.confirm("Are you sure you want to clear the documentation?")) {
                  onChange("");
                }
              }}
              title="Clear all documentation"
            >
              <Trash2 size={13} />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Body */}
      <div className="docs-content-area">
        {mode === "preview" && (
          <div className="docs-preview-container">
            {description && description.trim() !== "" ? (
              <div className="docs-markdown-body">
                {renderMarkdownContent(description)}
              </div>
            ) : examples.length === 0 ? (
              <div className="docs-empty-state">
                <div className="docs-empty-icon-wrap">
                  <BookOpen size={32} />
                </div>
                <h3>No Documentation Yet</h3>
                <p>
                  Documentation and sample response examples are automatically rendered when importing Postman collections,
                  OpenAPI/Swagger specs, or Insomnia files. You can also write markdown documentation directly.
                </p>
                <div className="docs-empty-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setMode("edit")}
                  >
                    <Edit3 size={14} /> Write Documentation
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleInsertTemplate}
                  >
                    <WandSparkles size={14} /> Use Template
                  </button>
                </div>
              </div>
            ) : null}

            {/* Saved Response Examples Section */}
            {(examples.length > 0 || onSaveExamples) && (
              <div className="docs-examples-section">
                <div className="docs-examples-header">
                  <div className="docs-examples-title-wrap">
                    <h3 className="docs-examples-title">
                      <span>Saved Response Examples</span>
                      {examples.length > 0 && <span className="docs-examples-count-badge">{examples.length}</span>}
                    </h3>
                    <span className="docs-examples-subtitle">Sample responses showing endpoint status codes & payload behaviors</span>
                  </div>
                  <div className="docs-examples-actions">
                    {activeResponse && onSaveExamples && (
                      <button
                        type="button"
                        className="docs-example-action-btn primary"
                        onClick={handleSaveActiveResponseAsExample}
                        title="Save current active response as a sample example"
                      >
                        <Plus size={12} />
                        <span>Save Active Response</span>
                      </button>
                    )}
                    {onSaveExamples && (
                      <button
                        type="button"
                        className="docs-example-action-btn"
                        onClick={handleStartAddExample}
                        title="Add a new sample response example"
                      >
                        <Plus size={12} />
                        <span>Add Example</span>
                      </button>
                    )}
                  </div>
                </div>

                {examples.length > 0 && (
                  <div className="docs-examples-pills-bar">
                    {examples.map((ex) => {
                      const statusClass = ex.code >= 200 && ex.code < 300
                        ? "status-2xx"
                        : ex.code >= 300 && ex.code < 400
                        ? "status-3xx"
                        : ex.code >= 400 && ex.code < 500
                        ? "status-4xx"
                        : "status-5xx";
                      const isActive = currentExample?.id === ex.id;
                      return (
                        <button
                          type="button"
                          key={ex.id}
                          className={`docs-example-pill ${isActive ? "active" : ""}`}
                          onClick={() => setSelectedExampleId(ex.id)}
                        >
                          <span className={`docs-example-pill-badge ${statusClass}`}>{ex.code} {ex.status}</span>
                          <span className="docs-example-pill-name">{ex.name || `${ex.code} Response`}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {currentExample && (
                  <div className="docs-example-card">
                    <div className="docs-example-card-header">
                      <div className="docs-example-card-title-group">
                        <span className={`docs-example-card-badge ${
                          currentExample.code >= 200 && currentExample.code < 300
                            ? "status-2xx"
                            : currentExample.code >= 300 && currentExample.code < 400
                            ? "status-3xx"
                            : currentExample.code >= 400 && currentExample.code < 500
                            ? "status-4xx"
                            : "status-5xx"
                        }`}>
                          {currentExample.code} {currentExample.status}
                        </span>
                        <span className="docs-example-card-name">{currentExample.name}</span>
                        {currentExample.bodyMimeType && (
                          <span className="docs-example-card-mime">{currentExample.bodyMimeType}</span>
                        )}
                      </div>
                      <div className="docs-example-card-actions">
                        <button
                          type="button"
                          className="docs-example-card-btn"
                          onClick={() => handleInsertExampleIntoDoc(currentExample)}
                          title="Insert this response example into the Markdown documentation"
                        >
                          <FileText size={12} />
                          <span>Insert in Markdown</span>
                        </button>
                        {onSaveExamples && (
                          <>
                            <button
                              type="button"
                              className="docs-example-card-btn"
                              onClick={() => handleStartEditExample(currentExample)}
                              title="Edit example details"
                            >
                              <Edit3 size={12} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              className="docs-example-card-btn danger"
                              onClick={() => handleDeleteExample(currentExample.id)}
                              title="Delete sample response example"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {currentExample.headers && currentExample.headers.length > 0 && (
                      <div className="docs-example-headers-box">
                        <div className="docs-example-headers-title">Response Headers:</div>
                        <div className="docs-example-headers-list">
                          {currentExample.headers.map((h, i) => (
                            <div key={i} className="docs-example-header-row">
                              <span className="docs-example-header-key">{h.key}:</span>
                              <span className="docs-example-header-val">{h.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="docs-example-body-wrap">
                      <MarkdownCodeBlock
                        lang={
                          currentExample.bodyMimeType?.includes("json") || currentExample.body?.trim().startsWith("{") || currentExample.body?.trim().startsWith("[")
                            ? "json"
                            : currentExample.bodyMimeType?.includes("xml") || currentExample.body?.trim().startsWith("<")
                            ? "xml"
                            : "text"
                        }
                        code={currentExample.body || "{}"}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {mode === "edit" && (
          <div className="docs-edit-container">
            <textarea
              ref={textareaRef}
              className="docs-markdown-textarea"
              value={description}
              onChange={(e) => onChange(e.target.value)}
              placeholder="# API Documentation\n\nWrite documentation for this endpoint using standard Markdown formatting..."
              spellCheck={false}
              autoFocus
            />
          </div>
        )}

        {mode === "split" && (
          <div className="docs-split-container">
            <div className="docs-split-pane left">
              <textarea
                ref={textareaRef}
                className="docs-markdown-textarea"
                value={description}
                onChange={(e) => onChange(e.target.value)}
                placeholder="# API Documentation\n\nWrite markdown here..."
                spellCheck={false}
              />
            </div>
            <div className="docs-split-divider" />
            <div className="docs-split-pane right">
              <div className="docs-markdown-body">
                {description && description.trim() !== "" ? (
                  renderMarkdownContent(description)
                ) : (
                  <div className="docs-preview-empty-hint">Live preview will appear here as you type...</div>
                )}
              </div>

              {/* Saved Response Examples in Split Mode */}
              {examples.length > 0 && currentExample && (
                <div className="docs-examples-section" style={{ marginTop: "24px" }}>
                  <div className="docs-examples-header">
                    <h3 className="docs-examples-title">
                      <span>Saved Response Examples ({examples.length})</span>
                    </h3>
                  </div>
                  <div className="docs-examples-pills-bar">
                    {examples.map((ex) => (
                      <button
                        type="button"
                        key={ex.id}
                        className={`docs-example-pill ${currentExample.id === ex.id ? "active" : ""}`}
                        onClick={() => setSelectedExampleId(ex.id)}
                      >
                        <span className="docs-example-pill-badge">{ex.code}</span>
                        <span className="docs-example-pill-name">{ex.name || `${ex.code} Response`}</span>
                      </button>
                    ))}
                  </div>
                  <div className="docs-example-card">
                    <div className="docs-example-body-wrap">
                      <MarkdownCodeBlock
                        lang="json"
                        code={currentExample.body || "{}"}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Example Modal */}
      {isAddingExample && (
        <div className="docs-example-modal-backdrop" onClick={() => setIsAddingExample(false)}>
          <div className="docs-example-modal" onClick={(e) => e.stopPropagation()}>
            <div className="docs-example-modal-header">
              <h3>{editingExampleId ? "Edit Response Example" : "New Sample Response Example"}</h3>
              <button
                type="button"
                className="docs-example-modal-close"
                onClick={() => setIsAddingExample(false)}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveExampleForm} className="docs-example-modal-form">
              <div className="docs-example-form-row">
                <div className="docs-example-form-group" style={{ flex: 2 }}>
                  <label>Example Name</label>
                  <input
                    type="text"
                    value={exFormName}
                    onChange={(e) => setExFormName(e.target.value)}
                    placeholder="e.g. 200 OK - Successful Login"
                    required
                  />
                </div>
                <div className="docs-example-form-group" style={{ flex: 1 }}>
                  <label>Status Code</label>
                  <input
                    type="number"
                    value={exFormCode}
                    onChange={(e) => setExFormCode(Number(e.target.value))}
                    placeholder="200"
                    required
                  />
                </div>
                <div className="docs-example-form-group" style={{ flex: 1 }}>
                  <label>Status Text</label>
                  <input
                    type="text"
                    value={exFormStatus}
                    onChange={(e) => setExFormStatus(e.target.value)}
                    placeholder="OK"
                    required
                  />
                </div>
              </div>

              <div className="docs-example-form-row">
                <div className="docs-example-form-group" style={{ flex: 1 }}>
                  <label>Content Type</label>
                  <select
                    value={exFormMime}
                    onChange={(e) => setExFormMime(e.target.value)}
                    className="docs-example-form-select"
                  >
                    <option value="application/json">application/json</option>
                    <option value="application/xml">application/xml</option>
                    <option value="text/plain">text/plain</option>
                    <option value="text/html">text/html</option>
                  </select>
                </div>
              </div>

              <div className="docs-example-form-group">
                <label>Response Body</label>
                <textarea
                  value={exFormBody}
                  onChange={(e) => setExFormBody(e.target.value)}
                  placeholder="{\n  &quot;success&quot;: true\n}"
                  rows={8}
                  className="docs-example-form-textarea"
                />
              </div>

              <div className="docs-example-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setIsAddingExample(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  {editingExampleId ? "Save Changes" : "Add Example"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Markdown Parser & Component Renderer ─────────────────────────────────────

function renderMarkdownContent(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code blocks
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(<MarkdownCodeBlock key={`cb-${i}`} lang={lang} code={codeLines.join("\n")} />);
      i++;
      continue;
    }

    // GitHub-style alerts & blockquotes
    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      let alertType: "NOTE" | "TIP" | "IMPORTANT" | "WARNING" | "CAUTION" | null = null;

      while (i < lines.length && lines[i].startsWith(">")) {
        const clean = lines[i].replace(/^>\s?/, "");
        const alertMatch = clean.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
        if (alertMatch && quoteLines.length === 0) {
          alertType = alertMatch[1].toUpperCase() as any;
        } else {
          quoteLines.push(clean);
        }
        i++;
      }

      if (alertType) {
        nodes.push(
          <div key={`alert-${i}`} className={`markdown-alert alert-${alertType.toLowerCase()}`}>
            <div className="markdown-alert-header">
              <AlertCircle size={14} />
              <span>{alertType}</span>
            </div>
            <div className="markdown-alert-content">
              {quoteLines.map((ql, qIdx) => (
                <p key={qIdx}>{inlineMarkdown(ql)}</p>
              ))}
            </div>
          </div>
        );
      } else {
        nodes.push(
          <blockquote key={`bq-${i}`} className="markdown-blockquote">
            {quoteLines.map((ql, qIdx) => (
              <p key={qIdx}>{inlineMarkdown(ql)}</p>
            ))}
          </blockquote>
        );
      }
      continue;
    }

    // Tables
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }

      if (tableLines.length >= 2) {
        const headerCells = tableLines[0]
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());
        const isDelimiter = tableLines[1].includes("-");
        const bodyLines = isDelimiter ? tableLines.slice(2) : tableLines.slice(1);

        nodes.push(
          <div key={`table-${i}`} className="markdown-table-wrapper">
            <table className="markdown-table">
              <thead>
                <tr>
                  {headerCells.map((h, hIdx) => (
                    <th key={hIdx}>{inlineMarkdown(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyLines.map((rowStr, rIdx) => {
                  const cells = rowStr
                    .split("|")
                    .slice(1, -1)
                    .map((c) => c.trim());
                  return (
                    <tr key={rIdx}>
                      {cells.map((cell, cIdx) => (
                        <td key={cIdx}>{inlineMarkdown(cell)}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // Headings H1 to H4
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      if (level === 1) {
        nodes.push(<h1 key={`h-${i}`} className="markdown-heading h1">{inlineMarkdown(content)}</h1>);
      } else if (level === 2) {
        nodes.push(<h2 key={`h-${i}`} className="markdown-heading h2">{inlineMarkdown(content)}</h2>);
      } else if (level === 3) {
        nodes.push(<h3 key={`h-${i}`} className="markdown-heading h3">{inlineMarkdown(content)}</h3>);
      } else {
        nodes.push(<h4 key={`h-${i}`} className="markdown-heading h4">{inlineMarkdown(content)}</h4>);
      }
      i++;
      continue;
    }

    // Task lists (- [x] or - [ ])
    if (line.match(/^[-*]\s+\[([ xX])\]\s+/)) {
      const items: { checked: boolean; text: string }[] = [];
      while (i < lines.length) {
        const taskMatch = lines[i].match(/^[-*]\s+\[([ xX])\]\s+(.+)/);
        if (!taskMatch) break;
        items.push({ checked: taskMatch[1].toLowerCase() === "x", text: taskMatch[2] });
        i++;
      }
      nodes.push(
        <ul key={`tasks-${i}`} className="markdown-task-list">
          {items.map((item, itemIdx) => (
            <li key={itemIdx} className={item.checked ? "checked" : ""}>
              <input type="checkbox" checked={item.checked} readOnly />
              <span>{inlineMarkdown(item.text)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Unordered lists (- or *)
    if (line.match(/^[-*]\s+/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*]\s+/)) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} className="markdown-list">
          {items.map((it, j) => (
            <li key={j}>{inlineMarkdown(it)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered lists (1. )
    if (line.match(/^\d+\.\s+/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      nodes.push(
        <ol key={`ol-${i}`} className="markdown-ordered-list">
          {items.map((it, j) => (
            <li key={j}>{inlineMarkdown(it)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Horizontal Rule
    if (line.match(/^---+$|^\*\*\*+$/)) {
      nodes.push(<hr key={`hr-${i}`} className="markdown-hr" />);
      i++;
      continue;
    }

    // Empty space
    if (line.trim() === "") {
      nodes.push(<div key={`sp-${i}`} className="markdown-space" />);
      i++;
      continue;
    }

    // Regular paragraph
    nodes.push(
      <p key={`p-${i}`} className="markdown-p">
        {inlineMarkdown(line)}
      </p>
    );
    i++;
  }

  return nodes;
}

function inlineMarkdown(text: string): React.ReactNode {
  // Matches bold-italic, bold, italic, code, links
  const regex = /(\*\*\*.+?\*\*\*|\*\*.+?\*\*|\*.+?\*|`.+?`|\[.+?\]\(.+?\)|~~.+?~~)/g;
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (!part) return null;
    if (part.startsWith("***") && part.endsWith("***")) {
      return (
        <strong key={i}>
          <em>{part.slice(3, -3)}</em>
        </strong>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("~~") && part.endsWith("~~")) {
      return <del key={i}>{part.slice(2, -2)}</del>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="markdown-inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    const linkMatch = part.match(/^\[(.+?)\]\((.+?)\)$/);
    if (linkMatch) {
      return (
        <a
          key={i}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="markdown-link"
        >
          {linkMatch[1]}
          <ExternalLink size={10} style={{ marginLeft: "2px", opacity: 0.7 }} />
        </a>
      );
    }
    return part;
  });
}

function MarkdownCodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const displayLang = lang || "code";

  return (
    <div className="markdown-codeblock-container">
      <div className="markdown-codeblock-header">
        <span className="markdown-codeblock-lang">{displayLang}</span>
        <button
          type="button"
          className="markdown-codeblock-copy-btn"
          onClick={() => {
            navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
          title="Copy code to clipboard"
        >
          {copied ? <Check size={12} style={{ color: "var(--color-success)" }} /> : <Copy size={12} />}
          <span>{copied ? "Copied!" : "Copy"}</span>
        </button>
      </div>
      <pre className="markdown-codeblock-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}
