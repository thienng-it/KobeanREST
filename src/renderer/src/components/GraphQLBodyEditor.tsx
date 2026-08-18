import React, { useState, useEffect, useRef } from "react";
import {
  Code2,
  Sliders,
  Sparkles,
  Play,
  RotateCcw,
  Check,
  Search,
  BookOpen,
  Database,
  Layers,
  ChevronRight,
  ChevronDown,
  WandSparkles,
  Copy,
  AlertCircle,
  Download,
  UploadCloud,
  FileText,
  FileCode,
  ArrowRight,
  ExternalLink,
  PlusCircle,
  RefreshCw,
  FolderOpen
} from "lucide-react";
import { BodyEditor } from "./BodyEditor";
import { GraphQLIcon } from "./GraphQLIcon";
import type { EnvironmentVariable, SavedRequest, WorkspaceSummary } from "../types";
import { executeHttpRequest } from "../services/http-client";
import { prepareRequestForExecution } from "../services/request-executor";
import { buildScopedVariableMap } from "../services/variables";
import {
  FULL_INTROSPECTION_QUERY,
  formatTypeRef,
  getBaseTypeName,
  introspectionToSDL,
  parseSDLToSchema,
  generateOperationForField,
  type GraphQLType,
  type GraphQLField,
  type GraphQLSchemaData
} from "../services/graphql-schema";

export interface GraphQLBodyData {
  query: string;
  variables: string;
  operationName?: string;
}

export function parseGraphQLBody(value: string): GraphQLBodyData {
  if (!value || !value.trim()) {
    return {
      query: `# Write your GraphQL query, mutation or subscription here
query GetData {
  __typename
}`,
      variables: "{\n  \n}",
    };
  }

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && ("query" in parsed || "variables" in parsed)) {
      return {
        query: typeof parsed.query === "string" ? parsed.query : "",
        variables: typeof parsed.variables === "string"
          ? parsed.variables
          : (parsed.variables ? JSON.stringify(parsed.variables, null, 2) : "{\n  \n}"),
        operationName: typeof parsed.operationName === "string" ? parsed.operationName : undefined,
      };
    }
  } catch {
    // If not JSON, it's a raw query string
  }

  return {
    query: value,
    variables: "{\n  \n}",
  };
}

export function formatGraphQLQuery(query: string): string {
  if (!query || !query.trim()) return query;

  let inString = false;
  let inComment = false;
  let stringChar = "";
  let cleaned = "";

  for (let i = 0; i < query.length; i++) {
    const char = query[i];
    const prev = i > 0 ? query[i - 1] : "";

    if (inComment) {
      if (char === "\n") {
        inComment = false;
        cleaned += "\n";
      } else {
        cleaned += char;
      }
      continue;
    }

    if (inString) {
      cleaned += char;
      if (char === stringChar && prev !== "\\") {
        inString = false;
      }
      continue;
    }

    if (char === "#" && (i === 0 || /\s/.test(prev))) {
      inComment = true;
      cleaned += char;
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      cleaned += char;
      continue;
    }

    if (char === "{") {
      cleaned += " {\n";
    } else if (char === "}") {
      cleaned += "\n}\n";
    } else if (char === ",") {
      cleaned += ",\n";
    } else {
      cleaned += char;
    }
  }

  const rawLines = cleaned.split("\n");
  const resultLines: string[] = [];
  let indentLevel = 0;

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("}")) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    resultLines.push("  ".repeat(indentLevel) + trimmed);

    if (trimmed.endsWith("{") || (trimmed.includes("{") && !trimmed.endsWith("}"))) {
      indentLevel++;
    }
  }

  return resultLines.join("\n");
}

const GRAPHQL_TEMPLATES = [
  {
    label: "Basic Query",
    query: `query GetItems($limit: Int, $offset: Int) {
  items(limit: $limit, offset: $offset) {
    id
    title
    createdAt
  }
}`,
    variables: `{\n  "limit": 10,\n  "offset": 0\n}`,
  },
  {
    label: "Create Mutation",
    query: `mutation CreateItem($input: CreateItemInput!) {
  createItem(input: $input) {
    id
    title
    success
  }
}`,
    variables: `{\n  "input": {\n    "title": "New item title"\n  }\n}`,
  },
  {
    label: "Schema Introspection",
    query: FULL_INTROSPECTION_QUERY,
    variables: `{\n  \n}`,
  },
];

type TypeCategory = "all" | "query" | "mutation" | "subscription" | "objects" | "inputs" | "enums" | "scalars";

interface GraphQLBodyEditorProps {
  value: string;
  onChange: (value: string) => void;
  variables: EnvironmentVariable[];
  draftRequest?: SavedRequest;
  workspace?: WorkspaceSummary | null;
}

export function GraphQLBodyEditor({
  value,
  onChange,
  variables,
  draftRequest,
  workspace,
}: GraphQLBodyEditorProps) {
  const initial = parseGraphQLBody(value);
  const [query, setQuery] = useState(initial.query);
  const [gqlVariables, setGqlVariables] = useState(initial.variables);
  const [activeTab, setActiveTab] = useState<"query" | "variables" | "schema">("query");

  // Schema state
  const [schemaData, setSchemaData] = useState<GraphQLSchemaData | null>(null);
  const [schemaSDL, setSchemaSDL] = useState<string>("");
  const [schemaViewMode, setSchemaViewMode] = useState<"docs" | "sdl">("docs");
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [schemaFilter, setSchemaFilter] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<TypeCategory>("all");
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [isCopiedSDL, setIsCopiedSDL] = useState(false);

  // Paste SDL Modal state
  const [isPasteSdlOpen, setIsPasteSdlOpen] = useState(false);
  const [pastedSdlText, setPastedSdlText] = useState("");

  // Synchronize internal state when value prop changes externally
  const isUpdatingRef = useRef(false);
  useEffect(() => {
    if (isUpdatingRef.current) {
      isUpdatingRef.current = false;
      return;
    }
    const parsed = parseGraphQLBody(value);
    setQuery(parsed.query);
    setGqlVariables(parsed.variables);
  }, [value]);

  const emitChange = (newQuery: string, newVars: string) => {
    isUpdatingRef.current = true;
    let parsedVars: any = undefined;
    try {
      if (newVars.trim()) parsedVars = JSON.parse(newVars);
    } catch {
      parsedVars = newVars;
    }

    const payload = {
      query: newQuery,
      variables: parsedVars !== undefined ? parsedVars : undefined,
    };
    onChange(JSON.stringify(payload, null, 2));
  };

  const handleQueryChange = (val: string) => {
    setQuery(val);
    emitChange(val, gqlVariables);
  };

  const handleVariablesChange = (val: string) => {
    setGqlVariables(val);
    emitChange(query, val);
  };

  const handleBeautifyQuery = () => {
    const formatted = formatGraphQLQuery(query);
    setQuery(formatted);
    emitChange(formatted, gqlVariables);
  };

  const handleBeautifyVariables = () => {
    try {
      const parsed = JSON.parse(gqlVariables || "{}");
      const formatted = JSON.stringify(parsed, null, 2);
      setGqlVariables(formatted);
      emitChange(query, formatted);
    } catch {
      // ignore JSON parse error
    }
  };

  const handleApplyTemplate = (tpl: typeof GRAPHQL_TEMPLATES[0]) => {
    setQuery(tpl.query);
    setGqlVariables(tpl.variables);
    emitChange(tpl.query, tpl.variables);
  };

  const handleFetchSchema = async () => {
    if (!draftRequest || !workspace) {
      setSchemaError("Endpoint request or workspace context is missing.");
      return;
    }

    setSchemaLoading(true);
    setSchemaError(null);
    try {
      const variableMap = buildScopedVariableMap(workspace, {
        collectionId: workspace.folders.find((f) => f.id === draftRequest.folderId)?.collectionId,
        folderId: draftRequest.folderId,
        request: draftRequest,
      });

      const introspectionReq: SavedRequest = {
        ...draftRequest,
        method: "POST",
        bodyMimeType: "application/graphql",
        body: JSON.stringify({ query: FULL_INTROSPECTION_QUERY }),
      };

      const { request: execReq } = await prepareRequestForExecution(introspectionReq, workspace, variableMap);
      const res = await executeHttpRequest(execReq);

      if (res.bodyText) {
        const json = JSON.parse(res.bodyText);
        if (json.data?.__schema) {
          const schemaObj = json.data.__schema;
          setSchemaData(schemaObj);
          const sdl = introspectionToSDL(schemaObj);
          setSchemaSDL(sdl);
        } else if (json.errors?.length) {
          setSchemaError(json.errors.map((e: any) => e.message).join(", "));
        } else {
          setSchemaError("No schema data returned by endpoint.");
        }
      } else {
        setSchemaError(`Introspection failed with status ${res.status}: ${res.statusText}`);
      }
    } catch (err: any) {
      setSchemaError(err?.message || "Failed to introspect schema");
    } finally {
      setSchemaLoading(false);
    }
  };

  const handleImportSchemaFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      try {
        if (content.trim().startsWith("{")) {
          // JSON Introspection result
          const json = JSON.parse(content);
          const schemaObj = json.data?.__schema || json.__schema || json;
          if (schemaObj.types) {
            setSchemaData(schemaObj);
            setSchemaSDL(introspectionToSDL(schemaObj));
            setSchemaError(null);
            return;
          }
        }
        // GraphQL SDL text
        const parsed = parseSDLToSchema(content);
        setSchemaData(parsed);
        setSchemaSDL(content);
        setSchemaError(null);
      } catch (err: any) {
        setSchemaError("Failed to parse schema file: " + (err.message || String(err)));
      }
    };
    reader.readAsText(file);
  };

  const handleApplyPastedSDL = () => {
    if (!pastedSdlText.trim()) return;
    try {
      if (pastedSdlText.trim().startsWith("{")) {
        const json = JSON.parse(pastedSdlText);
        const schemaObj = json.data?.__schema || json.__schema || json;
        if (schemaObj.types) {
          setSchemaData(schemaObj);
          setSchemaSDL(introspectionToSDL(schemaObj));
          setSchemaError(null);
          setIsPasteSdlOpen(false);
          return;
        }
      }
      const parsed = parseSDLToSchema(pastedSdlText);
      setSchemaData(parsed);
      setSchemaSDL(pastedSdlText);
      setSchemaError(null);
      setIsPasteSdlOpen(false);
    } catch (err: any) {
      setSchemaError("Failed to parse SDL: " + (err.message || String(err)));
    }
  };

  const handleCopySDL = () => {
    if (!schemaSDL) return;
    navigator.clipboard.writeText(schemaSDL);
    setIsCopiedSDL(true);
    setTimeout(() => setIsCopiedSDL(false), 2000);
  };

  const handleDownloadSDL = () => {
    if (!schemaSDL) return;
    const blob = new Blob([schemaSDL], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "schema.graphql";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateQuery = (
    opType: "query" | "mutation" | "subscription",
    field: GraphQLField
  ) => {
    if (!schemaData) return;
    const generated = generateOperationForField(opType, field, schemaData.types || []);
    setQuery(generated.query);
    setGqlVariables(generated.variables);
    emitChange(generated.query, generated.variables);
    setActiveTab("query");
  };

  // Filter types by category & search term
  const allTypes = schemaData?.types ? schemaData.types.filter((t) => !t.name.startsWith("__")) : [];
  const queryTypeName = schemaData?.queryType?.name || "Query";
  const mutationTypeName = schemaData?.mutationType?.name || "Mutation";
  const subscriptionTypeName = schemaData?.subscriptionType?.name || "Subscription";

  const filteredTypes = allTypes.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(schemaFilter.toLowerCase()) ||
      (t.fields && t.fields.some((f) => f.name.toLowerCase().includes(schemaFilter.toLowerCase())));
    if (!matchesSearch) return false;

    if (selectedCategory === "query") return t.name === queryTypeName;
    if (selectedCategory === "mutation") return t.name === mutationTypeName;
    if (selectedCategory === "subscription") return t.name === subscriptionTypeName;
    if (selectedCategory === "objects") return t.kind === "OBJECT" && t.name !== queryTypeName && t.name !== mutationTypeName && t.name !== subscriptionTypeName;
    if (selectedCategory === "inputs") return t.kind === "INPUT_OBJECT";
    if (selectedCategory === "enums") return t.kind === "ENUM";
    if (selectedCategory === "scalars") return t.kind === "SCALAR";
    return true;
  });

  const queryTypeObj = allTypes.find((t) => t.name === queryTypeName);
  const mutationTypeObj = allTypes.find((t) => t.name === mutationTypeName);
  const subscriptionTypeObj = allTypes.find((t) => t.name === subscriptionTypeName);

  const hasVariables = !!gqlVariables && gqlVariables.trim() !== "" && gqlVariables.trim() !== "{}";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", minHeight: 0 }}>
      {/* Sub-header Tabs & Actions Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-surface-muted)",
          flexShrink: 0,
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            type="button"
            className={`tab ${activeTab === "query" ? "active" : ""}`}
            onClick={() => setActiveTab("query")}
            style={{
              padding: "4px 10px",
              fontSize: 12,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <GraphQLIcon size={13} />
            Query
          </button>

          <button
            type="button"
            className={`tab ${activeTab === "variables" ? "active" : ""}`}
            onClick={() => setActiveTab("variables")}
            style={{
              padding: "4px 10px",
              fontSize: 12,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
              position: "relative",
            }}
          >
            <Sliders size={13} style={{ color: "#E10098" }} />
            GraphQL Variables
            {hasVariables && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#E10098",
                  display: "inline-block",
                }}
              />
            )}
          </button>

          <button
            type="button"
            className={`tab ${activeTab === "schema" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("schema");
              if (!schemaData && !schemaLoading) {
                handleFetchSchema();
              }
            }}
            style={{
              padding: "4px 10px",
              fontSize: 12,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <GraphQLIcon size={13} />
            GraphQL Schema
            {schemaData && (
              <span
                style={{
                  fontSize: 10,
                  padding: "1px 5px",
                  borderRadius: 8,
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "#10b981",
                  fontWeight: 700,
                }}
              >
                {allTypes.length}
              </span>
            )}
          </button>
        </div>

        {/* Toolbar actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {activeTab === "query" && (
            <>
              <button
                type="button"
                className="ghost-button"
                onClick={handleBeautifyQuery}
                style={{ padding: "4px 8px", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                title="Beautify and auto-indent GraphQL query"
              >
                <WandSparkles size={12} />
                Prettify Query
              </button>

              {/* Template shortcuts */}
              <div style={{ display: "flex", gap: 4 }}>
                {GRAPHQL_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.label}
                    type="button"
                    className="ghost-button"
                    onClick={() => handleApplyTemplate(tpl)}
                    style={{ padding: "4px 6px", fontSize: 10, borderRadius: 4 }}
                    title={`Apply ${tpl.label} template`}
                  >
                    +{tpl.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {activeTab === "variables" && (
            <button
              type="button"
              className="ghost-button"
              onClick={handleBeautifyVariables}
              style={{ padding: "4px 8px", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
              title="Format JSON variables"
            >
              <WandSparkles size={12} />
              Prettify JSON
            </button>
          )}

          {activeTab === "schema" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {/* Toggle Docs vs SDL */}
              <div style={{ display: "flex", background: "var(--color-surface)", borderRadius: 6, border: "1px solid var(--color-border)", padding: 2 }}>
                <button
                  type="button"
                  onClick={() => setSchemaViewMode("docs")}
                  style={{
                    padding: "3px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 4,
                    border: "none",
                    background: schemaViewMode === "docs" ? "var(--color-surface-hover)" : "transparent",
                    color: schemaViewMode === "docs" ? "var(--color-accent)" : "var(--color-text-muted)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <BookOpen size={12} /> Docs
                </button>
                <button
                  type="button"
                  onClick={() => setSchemaViewMode("sdl")}
                  style={{
                    padding: "3px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 4,
                    border: "none",
                    background: schemaViewMode === "sdl" ? "var(--color-surface-hover)" : "transparent",
                    color: schemaViewMode === "sdl" ? "var(--color-accent)" : "var(--color-text-muted)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <FileCode size={12} /> SDL
                </button>
              </div>

              {/* Import / Paste / Export actions */}
              <label
                className="ghost-button"
                style={{ padding: "4px 8px", fontSize: 11, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}
                title="Load schema from .graphql, .gql, or JSON file"
              >
                <FolderOpen size={12} />
                Load File
                <input
                  type="file"
                  accept=".graphql,.gql,.json"
                  onChange={handleImportSchemaFile}
                  style={{ display: "none" }}
                />
              </label>

              <button
                type="button"
                className="ghost-button"
                onClick={() => setIsPasteSdlOpen(true)}
                style={{ padding: "4px 8px", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                title="Paste SDL Schema Text"
              >
                <FileText size={12} />
                Paste SDL
              </button>

              {schemaSDL && (
                <>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={handleCopySDL}
                    style={{ padding: "4px 8px", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                    title="Copy GraphQL SDL"
                  >
                    {isCopiedSDL ? <Check size={12} style={{ color: "#10b981" }} /> : <Copy size={12} />}
                    {isCopiedSDL ? "Copied" : "Copy SDL"}
                  </button>

                  <button
                    type="button"
                    className="ghost-button"
                    onClick={handleDownloadSDL}
                    style={{ padding: "4px 8px", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                    title="Download schema.graphql"
                  >
                    <Download size={12} />
                    Download
                  </button>
                </>
              )}

              <button
                type="button"
                className="ghost-button"
                onClick={handleFetchSchema}
                disabled={schemaLoading}
                style={{ padding: "4px 8px", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                title="Introspect live GraphQL endpoint"
              >
                <RefreshCw size={12} className={schemaLoading ? "animate-spin" : ""} />
                {schemaLoading ? "Introspecting..." : "Introspect"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tab Panels */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {activeTab === "query" && (
          <div style={{ height: "100%", width: "100%" }}>
            <BodyEditor
              value={query}
              onChange={handleQueryChange}
              variables={variables}
              mimeType="application/javascript"
              placeholder="# Write your GraphQL query or mutation here..."
              height="100%"
              graphqlSchemaTypes={allTypes}
            />
          </div>
        )}

        {activeTab === "variables" && (
          <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "6px 12px", background: "var(--color-surface-hover)", fontSize: 11, color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)" }}>
              Define JSON variables referenced in your GraphQL query with <code>$variableName</code>.
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <BodyEditor
                value={gqlVariables}
                onChange={handleVariablesChange}
                variables={variables}
                mimeType="application/json"
                placeholder='{\n  "key": "value"\n}'
                height="100%"
              />
            </div>
          </div>
        )}

        {activeTab === "schema" && (
          <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", background: "var(--color-surface)", minHeight: 0 }}>
            {schemaLoading && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--color-text-muted)", gap: 8, fontSize: 13 }}>
                <RotateCcw size={16} className="animate-spin" style={{ color: "var(--color-accent)" }} />
                <span>Fetching full GraphQL schema via introspection query...</span>
              </div>
            )}

            {!schemaLoading && schemaError && (
              <div style={{ margin: 16, padding: 14, background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 8, color: "#ef4444", fontSize: 13, display: "flex", gap: 10 }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <strong>Schema Loading Error</strong>
                  <p style={{ marginTop: 4, color: "var(--color-text)", fontSize: 12 }}>{schemaError}</p>
                  <small style={{ color: "var(--color-text-muted)" }}>
                    You can also load an offline schema file (.graphql, .gql, .json) or paste SDL directly using the toolbar buttons above.
                  </small>
                </div>
              </div>
            )}

            {!schemaLoading && !schemaData && !schemaError && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--color-text-muted)", gap: 12 }}>
                <GraphQLIcon size={44} style={{ opacity: 0.85 }} />
                <span style={{ fontSize: 13 }}>No GraphQL schema loaded for this endpoint.</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="primary-button" onClick={handleFetchSchema}>
                    Introspect Endpoint
                  </button>
                  <button type="button" className="ghost-button" onClick={() => setIsPasteSdlOpen(true)}>
                    Paste SDL Text
                  </button>
                </div>
              </div>
            )}

            {!schemaLoading && schemaData && (
              <>
                {schemaViewMode === "sdl" ? (
                  <div style={{ flex: 1, minHeight: 0, padding: 8 }}>
                    <BodyEditor
                      value={schemaSDL}
                      onChange={(newSdl) => {
                        setSchemaSDL(newSdl);
                        try {
                          const parsed = parseSDLToSchema(newSdl);
                          setSchemaData(parsed);
                        } catch {
                          // ignore live edit parse error
                        }
                      }}
                      variables={variables}
                      mimeType="application/javascript"
                      placeholder="# GraphQL SDL schema"
                      height="100%"
                    />
                  </div>
                ) : (
                  <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
                    {/* Left category filter sidebar */}
                    <div
                      style={{
                        width: 180,
                        borderRight: "1px solid var(--color-border)",
                        background: "var(--color-surface-muted)",
                        padding: "10px 8px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        flexShrink: 0,
                      }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", padding: "4px 8px", letterSpacing: "0.5px" }}>
                        Schema Categories
                      </span>

                      {[
                        { id: "all", label: "All Types", count: allTypes.length },
                        { id: "query", label: "Query", count: queryTypeObj?.fields?.length || 0, isOp: true, color: "#3b82f6" },
                        { id: "mutation", label: "Mutation", count: mutationTypeObj?.fields?.length || 0, isOp: true, color: "#10b981" },
                        { id: "subscription", label: "Subscription", count: subscriptionTypeObj?.fields?.length || 0, isOp: true, color: "#8b5cf6" },
                        { id: "objects", label: "Objects", count: allTypes.filter((t) => t.kind === "OBJECT" && t.name !== queryTypeName && t.name !== mutationTypeName && t.name !== subscriptionTypeName).length },
                        { id: "inputs", label: "Inputs", count: allTypes.filter((t) => t.kind === "INPUT_OBJECT").length },
                        { id: "enums", label: "Enums", count: allTypes.filter((t) => t.kind === "ENUM").length },
                        { id: "scalars", label: "Scalars", count: allTypes.filter((t) => t.kind === "SCALAR").length },
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategory(cat.id as TypeCategory)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "6px 8px",
                            fontSize: 12,
                            fontWeight: selectedCategory === cat.id ? 600 : 400,
                            borderRadius: 6,
                            border: "none",
                            background: selectedCategory === cat.id ? "var(--color-surface-hover)" : "transparent",
                            color: selectedCategory === cat.id ? "var(--color-accent)" : "var(--color-text)",
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {cat.color && <span style={{ width: 6, height: 6, borderRadius: "50%", background: cat.color }} />}
                            {cat.label}
                          </span>
                          <span style={{ fontSize: 10, opacity: 0.6 }}>{cat.count}</span>
                        </button>
                      ))}
                    </div>

                    {/* Main Documentation List */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, padding: "12px 16px", overflowY: "auto" }}>
                      {/* Search Bar */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12 }}>
                        <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
                          <Search size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
                          <input
                            type="text"
                            className="input"
                            placeholder="Search types, fields, or arguments..."
                            value={schemaFilter}
                            onChange={(e) => setSchemaFilter(e.target.value)}
                            style={{ paddingLeft: 26, fontSize: 12, width: "100%", height: 30 }}
                          />
                        </div>
                        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                          Showing {filteredTypes.length} of {allTypes.length} types
                        </span>
                      </div>

                      {/* Type List Cards */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {filteredTypes.map((t) => {
                          const isExpanded = expandedType === t.name || filteredTypes.length === 1;
                          const isRootQuery = t.name === queryTypeName;
                          const isRootMutation = t.name === mutationTypeName;
                          const isRootSubscription = t.name === subscriptionTypeName;

                          return (
                            <div
                              key={t.name}
                              style={{
                                border: "1px solid var(--color-border)",
                                borderRadius: 8,
                                background: "var(--color-surface-hover)",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                onClick={() => setExpandedType(isExpanded ? null : t.name)}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  padding: "8px 12px",
                                  cursor: "pointer",
                                  userSelect: "none",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                  <span style={{ fontWeight: 700, fontSize: 13, color: "var(--color-text)" }}>{t.name}</span>
                                  <span
                                    style={{
                                      fontSize: 10,
                                      padding: "1px 6px",
                                      borderRadius: 4,
                                      background:
                                        isRootQuery ? "rgba(59, 130, 246, 0.15)" :
                                        isRootMutation ? "rgba(16, 185, 129, 0.15)" :
                                        isRootSubscription ? "rgba(139, 92, 246, 0.15)" :
                                        t.kind === "INPUT_OBJECT" ? "rgba(245, 158, 11, 0.15)" :
                                        t.kind === "ENUM" ? "rgba(236, 72, 153, 0.15)" :
                                        "rgba(107, 114, 128, 0.15)",
                                      color:
                                        isRootQuery ? "#3b82f6" :
                                        isRootMutation ? "#10b981" :
                                        isRootSubscription ? "#8b5cf6" :
                                        t.kind === "INPUT_OBJECT" ? "#f59e0b" :
                                        t.kind === "ENUM" ? "#ec4899" :
                                        "var(--color-text-muted)",
                                      fontWeight: 600,
                                    }}
                                  >
                                    {isRootQuery ? "ROOT QUERY" : isRootMutation ? "ROOT MUTATION" : isRootSubscription ? "ROOT SUBSCRIPTION" : t.kind}
                                  </span>
                                </div>
                                {t.description && (
                                  <span style={{ fontSize: 11, color: "var(--color-text-muted)", maxWidth: "45%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {t.description}
                                  </span>
                                )}
                              </div>

                              {isExpanded && (
                                <div style={{ padding: "10px 14px 14px 34px", borderTop: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
                                  {t.description && (
                                    <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 10, fontStyle: "italic" }}>
                                      {t.description}
                                    </p>
                                  )}

                                  {/* Fields list */}
                                  {t.fields && t.fields.length > 0 && (
                                    <div style={{ display: "grid", gap: 8 }}>
                                      {t.fields.map((f) => {
                                        const returnBase = getBaseTypeName(f.type);
                                        const isOp = isRootQuery || isRootMutation || isRootSubscription;
                                        const opType = isRootMutation ? "mutation" : isRootSubscription ? "subscription" : "query";

                                        return (
                                          <div
                                            key={f.name}
                                            style={{
                                              padding: "6px 8px",
                                              background: "var(--color-surface-hover)",
                                              borderRadius: 6,
                                              border: "1px solid var(--color-border)",
                                              display: "flex",
                                              flexDirection: "column",
                                              gap: 4,
                                            }}
                                          >
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                              <div style={{ fontSize: 12, display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 4 }}>
                                                <strong style={{ color: "var(--color-accent-light)", fontSize: 13 }}>{f.name}</strong>

                                                {f.args && f.args.length > 0 && (
                                                  <span style={{ color: "var(--color-text-muted)", fontSize: 11 }}>
                                                    (
                                                    {f.args.map((a, i) => (
                                                      <span key={a.name}>
                                                        {i > 0 && ", "}
                                                        <span style={{ color: "var(--color-text)" }}>{a.name}</span>:{" "}
                                                        <span style={{ color: "#8b5cf6" }}>{formatTypeRef(a.type)}</span>
                                                        {a.defaultValue && <span style={{ color: "var(--color-text-muted)" }}> = {a.defaultValue}</span>}
                                                      </span>
                                                    ))}
                                                    )
                                                  </span>
                                                )}

                                                <span style={{ color: "var(--color-text-muted)" }}>:</span>

                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setSchemaFilter(returnBase);
                                                    setExpandedType(returnBase);
                                                  }}
                                                  style={{
                                                    background: "transparent",
                                                    border: "none",
                                                    color: "#10b981",
                                                    fontWeight: 600,
                                                    fontSize: 12,
                                                    cursor: "pointer",
                                                    padding: 0,
                                                    textDecoration: "underline",
                                                  }}
                                                  title={`Jump to ${returnBase} type definition`}
                                                >
                                                  {formatTypeRef(f.type)}
                                                </button>

                                                {f.isDeprecated && (
                                                  <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4, background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", fontWeight: 600 }}>
                                                    DEPRECATED
                                                  </span>
                                                )}
                                              </div>

                                              {/* 1-Click Generate Query Button for Root Operations */}
                                              {isOp && (
                                                <button
                                                  type="button"
                                                  className="ghost-button"
                                                  onClick={() => handleGenerateQuery(opType, f)}
                                                  style={{ padding: "3px 8px", fontSize: 11, display: "flex", alignItems: "center", gap: 4, color: "var(--color-accent)" }}
                                                  title="Generate and insert operation into Query editor"
                                                >
                                                  <PlusCircle size={12} />
                                                  Add to Query
                                                </button>
                                              )}
                                            </div>

                                            {f.description && (
                                              <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                                                {f.description}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Input Fields */}
                                  {t.inputFields && t.inputFields.length > 0 && (
                                    <div style={{ display: "grid", gap: 6 }}>
                                      {t.inputFields.map((field) => (
                                        <div key={field.name} style={{ fontSize: 12, display: "flex", alignItems: "baseline", gap: 6 }}>
                                          <strong style={{ color: "var(--color-text)" }}>{field.name}</strong>:
                                          <span style={{ color: "#f59e0b" }}>{formatTypeRef(field.type)}</span>
                                          {field.defaultValue && <span style={{ color: "var(--color-text-muted)", fontSize: 11 }}>= {field.defaultValue}</span>}
                                          {field.description && <span style={{ color: "var(--color-text-muted)", fontSize: 11, marginLeft: "auto" }}>{field.description}</span>}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Enum Values */}
                                  {t.enumValues && t.enumValues.length > 0 && (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                      {t.enumValues.map((val) => (
                                        <span
                                          key={val.name}
                                          style={{
                                            fontSize: 11,
                                            padding: "2px 8px",
                                            borderRadius: 4,
                                            background: "var(--color-surface-hover)",
                                            border: "1px solid var(--color-border)",
                                            color: "#ec4899",
                                            fontWeight: 600,
                                          }}
                                          title={val.description || undefined}
                                        >
                                          {val.name}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Paste SDL Modal */}
      {isPasteSdlOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setIsPasteSdlOpen(false)}
        >
          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              width: "100%",
              maxWidth: 600,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <GraphQLIcon size={16} />
                <strong style={{ fontSize: 14 }}>Paste GraphQL SDL or Introspection JSON</strong>
              </div>
              <button type="button" className="icon-button" onClick={() => setIsPasteSdlOpen(false)}>
                ✕
              </button>
            </div>

            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                Paste your GraphQL Schema Definition Language (e.g. <code>type Query &#123; ... &#125;</code>) or JSON Introspection payload below:
              </span>
              <textarea
                value={pastedSdlText}
                onChange={(e) => setPastedSdlText(e.target.value)}
                placeholder={`type Query {\n  users(limit: Int): [User!]!\n}\n\ntype User {\n  id: ID!\n  name: String!\n}`}
                style={{
                  width: "100%",
                  height: 240,
                  fontFamily: "monospace",
                  fontSize: 12,
                  padding: 10,
                  borderRadius: 6,
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-input-bg)",
                  color: "var(--color-text)",
                  resize: "vertical",
                }}
              />
            </div>

            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "flex-end", gap: 8, background: "var(--color-surface-muted)" }}>
              <button type="button" className="ghost-button" onClick={() => setIsPasteSdlOpen(false)}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={handleApplyPastedSDL} disabled={!pastedSdlText.trim()}>
                Import Schema
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
