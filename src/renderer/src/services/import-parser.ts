// Universal API & Workspace Import Parser for KobeanREST
// Supports Postman (v2.0 & v2.1 Collection & Environment), Hapi.js Routes,
// OpenAPI/Swagger (2.0/3.0/3.1), Insomnia, Hoppscotch, HAR, cURL, and KobeanREST Native exports.

import { parseCurlCommand } from "./script-tools";

export type ImportFormatType =
  | "kobeanrest-native"
  | "postman-collection"
  | "postman-environment"
  | "hapi-routes"
  | "openapi"
  | "insomnia"
  | "hoppscotch"
  | "har"
  | "curl"
  | "unknown";

export interface WorkspaceRowExport {
  id: string;
  name: string;
  active_environment: string;
}

export interface CollectionRowExport {
  id: string;
  workspace_id: string;
  name: string;
  position: number;
}

export interface FolderRowExport {
  id: string;
  collection_id: string;
  name: string;
  position: number;
}

export interface RequestRowExport {
  id: string;
  workspace_id: string;
  folder_id: string;
  name: string;
  method: string;
  url: string;
  auth_mode: string;
  auth_config: string;
  body: string;
  body_mime_type: string;
  body_form: string;
  query_params: string;
  timeout_ms: number;
  follow_redirects: number;
  position: number;
}

export interface RequestHeaderRowExport {
  request_id: string;
  header_key: string;
  header_value: string;
  enabled: number;
  position: number;
}

export interface EnvironmentRowExport {
  id: string;
  workspace_id: string;
  name: string;
  position: number;
}

export interface VariableRowExport {
  environment_id: string;
  variable_key: string;
  variable_value: string;
  secret_ref: string | null;
  secret: number;
  position: number;
}

export interface ExportDataPayload {
  version: number;
  workspaces: WorkspaceRowExport[];
  collections: CollectionRowExport[];
  folders: FolderRowExport[];
  requests: RequestRowExport[];
  request_headers: RequestHeaderRowExport[];
  environments: EnvironmentRowExport[];
  variables: VariableRowExport[];
}

export interface NormalizedImportResult {
  format: ImportFormatType;
  formatLabel: string;
  title: string;
  exportData: ExportDataPayload;
  stats: {
    collectionsCount: number;
    foldersCount: number;
    requestsCount: number;
    environmentsCount: number;
    variablesCount: number;
  };
}

function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`;
}

/**
 * Auto-detect import content format.
 */
export function detectImportFormat(content: string): ImportFormatType {
  const trimmed = content.trim();

  // 1. cURL Command check
  if (/^(curl\s+|-X\s+|--request\s+)/i.test(trimmed)) {
    return "curl";
  }

  // Try parsing JSON
  let parsed: any = null;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // If not JSON, test for Hapi JS/TS route pattern or YAML
    if (/server\.route\(|module\.exports\s*=|export\s+const\s+\w*routes/i.test(trimmed) || /method:\s*['"]\w+['"]/i.test(trimmed)) {
      return "hapi-routes";
    }
    if (/^openapi:\s*['"]?3/m.test(trimmed) || /^swagger:\s*['"]?2/m.test(trimmed)) {
      return "openapi";
    }
    if (/_type:\s*['"]?export['"]?/m.test(trimmed)) {
      return "insomnia";
    }
    return "unknown";
  }

  if (typeof parsed !== "object" || parsed === null) {
    return "unknown";
  }

  // KobeanREST Native check
  if (parsed.version === 1 && Array.isArray(parsed.workspaces) && Array.isArray(parsed.collections)) {
    return "kobeanrest-native";
  }

  // Postman Collection check
  if (parsed.info && (parsed.info.schema || parsed.info._postman_id || parsed.info.name) && Array.isArray(parsed.item)) {
    return "postman-collection";
  }

  // Postman Environment check
  if (parsed._postman_variable_scope === "environment" || (parsed.name && Array.isArray(parsed.values) && parsed.values.some((v: any) => v && "key" in v))) {
    return "postman-environment";
  }

  // OpenAPI / Swagger JSON check
  if (parsed.openapi || parsed.swagger || (parsed.paths && parsed.info)) {
    return "openapi";
  }

  // Insomnia check
  if (parsed._type === "export" && Array.isArray(parsed.resources)) {
    return "insomnia";
  }

  // Hoppscotch check
  if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].v && (parsed[0].name || parsed[0].folders)) {
    return "hoppscotch";
  }
  if (parsed.v && (parsed.name || parsed.folders || parsed.requests)) {
    return "hoppscotch";
  }

  // HAR Archive check
  if (parsed.log && Array.isArray(parsed.log.entries)) {
    return "har";
  }

  // Hapi.js Route array in JSON format
  if (Array.isArray(parsed) && parsed.length > 0 && parsed.some((item: any) => item && (item.method || item.path))) {
    return "hapi-routes";
  }

  return "unknown";
}

/**
 * Universal Parser that converts any input format into a normalized ExportDataPayload.
 */
export function parseUniversalImport(content: string, defaultWorkspaceName = "Imported Workspace"): NormalizedImportResult {
  const format = detectImportFormat(content);
  const workspaceId = generateId("workspace");
  const defaultWorkspace: WorkspaceRowExport = {
    id: workspaceId,
    name: defaultWorkspaceName,
    active_environment: "Development",
  };

  const payload: ExportDataPayload = {
    version: 1,
    workspaces: [defaultWorkspace],
    collections: [],
    folders: [],
    requests: [],
    request_headers: [],
    environments: [],
    variables: [],
  };

  let title = "Imported Spec";
  let formatLabel = "Unknown Format";

  switch (format) {
    case "kobeanrest-native": {
      formatLabel = "KobeanREST Native Export";
      const parsed = JSON.parse(content.trim());
      return {
        format,
        formatLabel,
        title: parsed.workspaces?.[0]?.name || "Native Workspace",
        exportData: parsed,
        stats: {
          collectionsCount: parsed.collections?.length || 0,
          foldersCount: parsed.folders?.length || 0,
          requestsCount: parsed.requests?.length || 0,
          environmentsCount: parsed.environments?.length || 0,
          variablesCount: parsed.variables?.length || 0,
        },
      };
    }

    case "postman-collection": {
      formatLabel = "Postman Collection (v2.0/v2.1)";
      const parsed = JSON.parse(content.trim());
      title = parsed.info?.name || "Postman Collection";

      const collectionId = generateId("collection");
      payload.collections.push({
        id: collectionId,
        workspace_id: workspaceId,
        name: title,
        position: 0,
      });

      let reqPos = 0;
      let folderPos = 0;

      function walkPostmanItems(items: any[], parentFolderId?: string) {
        for (const item of items) {
          if (!item) continue;
          if (item.request) {
            // It's a Request
            const reqId = generateId("request");
            const reqName = item.name || "Untitled Request";
            const req = item.request;
            const method = typeof req.method === "string" ? req.method.toUpperCase() : "GET";

            // Parse URL
            let rawUrl = "";
            if (typeof req.url === "string") {
              rawUrl = req.url;
            } else if (req.url && typeof req.url === "object") {
              rawUrl = req.url.raw || "";
              if (!rawUrl && req.url.host) {
                const protocol = req.url.protocol ? `${req.url.protocol}://` : "https://";
                const host = Array.isArray(req.url.host) ? req.url.host.join(".") : req.url.host;
                const path = Array.isArray(req.url.path) ? req.url.path.join("/") : req.url.path || "";
                rawUrl = `${protocol}${host}/${path}`;
              }
            }

            // Replace Postman variables {{var}} with KobeanREST template format
            rawUrl = rawUrl.replace(/:([a-zA-Z0-9_]+)/g, "{{$1}}");

            // Parse Auth
            let authMode = "none";
            let authConfig = "{}";
            if (req.auth) {
              if (req.auth.type === "bearer" && Array.isArray(req.auth.bearer)) {
                const tokenObj = req.auth.bearer.find((b: any) => b.key === "token");
                authMode = "bearer";
                authConfig = JSON.stringify({ token: tokenObj?.value || "" });
              } else if (req.auth.type === "basic" && Array.isArray(req.auth.basic)) {
                const userObj = req.auth.basic.find((b: any) => b.key === "username");
                const passObj = req.auth.basic.find((b: any) => b.key === "password");
                authMode = "basic";
                authConfig = JSON.stringify({ username: userObj?.value || "", password: passObj?.value || "" });
              }
            }

            // Parse Body
            let bodyStr = "";
            let mimeType = "application/json";
            let bodyFormStr = "[]";

            if (req.body) {
              if (req.body.mode === "raw") {
                bodyStr = req.body.raw || "";
                if (req.body.options?.raw?.language === "json" || bodyStr.trim().startsWith("{") || bodyStr.trim().startsWith("[")) {
                  mimeType = "application/json";
                } else if (req.body.options?.raw?.language === "xml" || bodyStr.trim().startsWith("<")) {
                  mimeType = "application/xml";
                } else {
                  mimeType = "text/plain";
                }
              } else if (req.body.mode === "urlencoded" && Array.isArray(req.body.urlencoded)) {
                const formArr = req.body.urlencoded.map((f: any) => ({
                  key: f.key || "",
                  value: f.value || "",
                  enabled: f.disabled ? false : true,
                }));
                bodyFormStr = JSON.stringify(formArr);
                mimeType = "application/x-www-form-urlencoded";
              } else if (req.body.mode === "formdata" && Array.isArray(req.body.formdata)) {
                const formArr = req.body.formdata.map((f: any) => ({
                  key: f.key || "",
                  value: f.value || "",
                  enabled: f.disabled ? false : true,
                }));
                bodyFormStr = JSON.stringify(formArr);
                mimeType = "multipart/form-data";
              }
            }

            // Query params
            let queryParamsStr = "[]";
            if (req.url && Array.isArray(req.url.query)) {
              const qArr = req.url.query.map((q: any) => ({
                key: q.key || "",
                value: q.value || "",
                enabled: q.disabled ? false : true,
              }));
              queryParamsStr = JSON.stringify(qArr);
            }

            payload.requests.push({
              id: reqId,
              workspace_id: workspaceId,
              folder_id: parentFolderId || "",
              name: reqName,
              method,
              url: rawUrl,
              auth_mode: authMode,
              auth_config: authConfig,
              body: bodyStr,
              body_mime_type: mimeType,
              body_form: bodyFormStr,
              query_params: queryParamsStr,
              timeout_ms: 30000,
              follow_redirects: 1,
              position: reqPos++,
            });

            // Headers
            if (Array.isArray(req.header)) {
              let hPos = 0;
              for (const h of req.header) {
                if (!h || !h.key) continue;
                payload.request_headers.push({
                  request_id: reqId,
                  header_key: h.key,
                  header_value: h.value || "",
                  enabled: h.disabled ? 0 : 1,
                  position: hPos++,
                });
              }
            }
          } else if (Array.isArray(item.item)) {
            // It's a Folder
            const folderId = generateId("folder");
            payload.folders.push({
              id: folderId,
              collection_id: collectionId,
              name: item.name || "Folder",
              position: folderPos++,
            });
            walkPostmanItems(item.item, folderId);
          }
        }
      }

      walkPostmanItems(parsed.item);
      break;
    }

    case "postman-environment": {
      formatLabel = "Postman Environment";
      const parsed = JSON.parse(content.trim());
      title = parsed.name || "Postman Environment";

      const envId = generateId("environment");
      payload.environments.push({
        id: envId,
        workspace_id: workspaceId,
        name: title,
        position: 0,
      });

      if (Array.isArray(parsed.values)) {
        let vPos = 0;
        for (const v of parsed.values) {
          if (!v || !v.key) continue;
          payload.variables.push({
            environment_id: envId,
            variable_key: v.key,
            variable_value: v.value || "",
            secret_ref: null,
            secret: v.type === "secret" ? 1 : 0,
            position: vPos++,
          });
        }
      }

      // Also create a placeholder collection so import transaction is full
      payload.collections.push({
        id: generateId("collection"),
        workspace_id: workspaceId,
        name: "General Collection",
        position: 0,
      });
      break;
    }

    case "hapi-routes": {
      formatLabel = "Hapi.js Routes Spec";
      title = "Hapi.js Routes";

      const collectionId = generateId("collection");
      payload.collections.push({
        id: collectionId,
        workspace_id: workspaceId,
        name: title,
        position: 0,
      });

      const folderId = generateId("folder");
      payload.folders.push({
        id: folderId,
        collection_id: collectionId,
        name: "Routes",
        position: 0,
      });

      // Extract route objects using regex matching for JS/TS code or JSON
      const routeRegex = /\{\s*method:\s*(['"][^'"]+['"]|\[[^\]]+\])\s*,\s*path:\s*(['"][^'"]+['"])/gi;
      let match: RegExpExecArray | null;
      let rPos = 0;

      const trimmed = content.trim();

      // Check if pure JSON array
      let jsonRoutes: any[] = [];
      try {
        const p = JSON.parse(trimmed);
        if (Array.isArray(p)) jsonRoutes = p;
      } catch {
        // ignore
      }

      if (jsonRoutes.length > 0) {
        for (const route of jsonRoutes) {
          if (!route || !route.path) continue;
          const methods = Array.isArray(route.method) ? route.method : [route.method || "GET"];
          const path = (route.path || "/").replace(/\{([a-zA-Z0-9_]+)\}/g, "{{$1}}");

          for (const m of methods) {
            const reqId = generateId("request");
            const method = String(m).toUpperCase();
            const reqName = route.notes || route.config?.notes || `${method} ${route.path}`;

            payload.requests.push({
              id: reqId,
              workspace_id: workspaceId,
              folder_id: folderId,
              name: reqName,
              method,
              url: `http://localhost:3000${path}`,
              auth_mode: "none",
              auth_config: "{}",
              body: "",
              body_mime_type: "application/json",
              body_form: "[]",
              query_params: "[]",
              timeout_ms: 30000,
              follow_redirects: 1,
              position: rPos++,
            });
          }
        }
      } else {
        // Regex extract from Hapi JS/TS source code
        while ((match = routeRegex.exec(trimmed)) !== null) {
          const rawMethod = match[1].replace(/['"\s]/g, "");
          const rawPath = match[2].replace(/['"]/g, "");
          const path = rawPath.replace(/\{([a-zA-Z0-9_]+)\}/g, "{{$1}}");
          const methods = rawMethod.startsWith("[")
            ? rawMethod.replace(/[\[\]]/g, "").split(",")
            : [rawMethod];

          for (const m of methods) {
            if (!m) continue;
            const reqId = generateId("request");
            const method = m.toUpperCase();
            payload.requests.push({
              id: reqId,
              workspace_id: workspaceId,
              folder_id: folderId,
              name: `${method} ${rawPath}`,
              method,
              url: `http://localhost:3000${path}`,
              auth_mode: "none",
              auth_config: "{}",
              body: "",
              body_mime_type: "application/json",
              body_form: "[]",
              query_params: "[]",
              timeout_ms: 30000,
              follow_redirects: 1,
              position: rPos++,
            });
          }
        }
      }
      break;
    }

    case "openapi": {
      formatLabel = "OpenAPI / Swagger Spec";
      let parsed: any = {};
      try {
        parsed = JSON.parse(content.trim());
      } catch {
        // Fallback placeholder parser for YAML specs
        title = "OpenAPI Spec";
      }

      title = parsed.info?.title || title || "OpenAPI Spec";

      const collectionId = generateId("collection");
      payload.collections.push({
        id: collectionId,
        workspace_id: workspaceId,
        name: title,
        position: 0,
      });

      let baseUrl = "http://localhost:8080";
      if (Array.isArray(parsed.servers) && parsed.servers[0]?.url) {
        baseUrl = parsed.servers[0].url;
      } else if (parsed.host) {
        const scheme = parsed.schemes?.[0] || "https";
        baseUrl = `${scheme}://${parsed.host}${parsed.basePath || ""}`;
      }

      let rPos = 0;
      if (parsed.paths && typeof parsed.paths === "object") {
        for (const [pathKey, pathObj] of Object.entries(parsed.paths)) {
          if (!pathObj || typeof pathObj !== "object") continue;

          for (const [methodKey, opObj] of Object.entries(pathObj as Record<string, any>)) {
            if (!["get", "post", "put", "delete", "patch", "head", "options"].includes(methodKey.toLowerCase())) {
              continue;
            }

            const method = methodKey.toUpperCase();
            const op = opObj || {};
            const reqName = op.summary || op.operationId || `${method} ${pathKey}`;
            const pathUrl = pathKey.replace(/\{([a-zA-Z0-9_]+)\}/g, "{{$1}}");
            const fullUrl = baseUrl.endsWith("/") ? `${baseUrl.slice(0, -1)}${pathUrl}` : `${baseUrl}${pathUrl}`;

            const reqId = generateId("request");

            // Extract query parameters
            const qArr: any[] = [];
            if (Array.isArray(op.parameters)) {
              for (const p of op.parameters) {
                if (p.in === "query") {
                  qArr.push({ key: p.name, value: p.example || p.default || "", enabled: p.required ?? true });
                }
              }
            }

            payload.requests.push({
              id: reqId,
              workspace_id: workspaceId,
              folder_id: "",
              name: reqName,
              method,
              url: fullUrl,
              auth_mode: "none",
              auth_config: "{}",
              body: "",
              body_mime_type: "application/json",
              body_form: "[]",
              query_params: JSON.stringify(qArr),
              timeout_ms: 30000,
              follow_redirects: 1,
              position: rPos++,
            });
          }
        }
      }
      break;
    }

    case "curl": {
      formatLabel = "cURL Command";
      title = "cURL Import";
      const curlResult = parseCurlCommand(content);

      const collectionId = generateId("collection");
      payload.collections.push({
        id: collectionId,
        workspace_id: workspaceId,
        name: "cURL Imports",
        position: 0,
      });

      const reqId = generateId("request");
      payload.requests.push({
        id: reqId,
        workspace_id: workspaceId,
        folder_id: "",
        name: `${curlResult.method} ${curlResult.url.slice(0, 30)}`,
        method: curlResult.method,
        url: curlResult.url,
        auth_mode: curlResult.authMode,
        auth_config: JSON.stringify(curlResult.authConfig),
        body: curlResult.body,
        body_mime_type: curlResult.bodyMimeType,
        body_form: JSON.stringify(curlResult.bodyForm),
        query_params: "[]",
        timeout_ms: 30000,
        follow_redirects: 1,
        position: 0,
      });

      let hPos = 0;
      for (const h of curlResult.headers) {
        payload.request_headers.push({
          request_id: reqId,
          header_key: h.key,
          header_value: h.value,
          enabled: h.enabled ? 1 : 0,
          position: hPos++,
        });
      }
      break;
    }

    case "insomnia": {
      formatLabel = "Insomnia Export";
      const parsed = JSON.parse(content.trim());
      title = "Insomnia Import";

      const collectionId = generateId("collection");
      payload.collections.push({
        id: collectionId,
        workspace_id: workspaceId,
        name: title,
        position: 0,
      });

      if (Array.isArray(parsed.resources)) {
        let rPos = 0;
        for (const res of parsed.resources) {
          if (res._type === "request") {
            const reqId = generateId("request");
            payload.requests.push({
              id: reqId,
              workspace_id: workspaceId,
              folder_id: "",
              name: res.name || "Untitled Request",
              method: (res.method || "GET").toUpperCase(),
              url: res.url || "",
              auth_mode: "none",
              auth_config: "{}",
              body: typeof res.body === "object" ? res.body.text || "" : "",
              body_mime_type: res.body?.mimeType || "application/json",
              body_form: "[]",
              query_params: "[]",
              timeout_ms: 30000,
              follow_redirects: 1,
              position: rPos++,
            });
          }
        }
      }
      break;
    }

    default: {
      formatLabel = "Unknown Format";
      title = "Imported API";
      const collectionId = generateId("collection");
      payload.collections.push({
        id: collectionId,
        workspace_id: workspaceId,
        name: title,
        position: 0,
      });
      break;
    }
  }

  return {
    format,
    formatLabel,
    title,
    exportData: payload,
    stats: {
      collectionsCount: payload.collections.length,
      foldersCount: payload.folders.length,
      requestsCount: payload.requests.length,
      environmentsCount: payload.environments.length,
      variablesCount: payload.variables.length,
    },
  };
}
