import type { ApiAuthMode, AuthConfig, ScopedVariable } from "../types";

// ---------------------------------------------------------------------------
// Postman Collection v2.0/v2.1 Types
// ---------------------------------------------------------------------------

interface PostmanInfo {
  name: string;
  postmanId?: string;
  schema?: string;
}

interface PostmanVariable {
  key: string;
  value?: string;
  type?: string;
  description?: string;
  disabled?: boolean;
}

interface PostmanUrl {
  raw?: string;
  protocol?: string;
  host?: string[];
  port?: string;
  path?: string[];
  query?: Array<{ key: string; value: string; disabled?: boolean }>;
  variable?: PostmanVariable[];
}

interface PostmanHeader {
  key: string;
  value: string;
  disabled?: boolean;
  description?: string;
}

interface PostmanBody {
  mode?: "raw" | "urlencoded" | "formdata" | "file" | "graphql";
  raw?: string;
  urlencoded?: Array<{ key: string; value?: string; disabled?: boolean; type?: string; description?: string }>;
  formdata?: Array<{
    key: string;
    value?: string;
    type?: string;
    src?: string | string[];
    uuid?: string;
    disabled?: boolean;
    description?: string;
  }>;
  file?: { src?: string; content?: string };
  graphql?: { query?: string; variables?: string };
  options?: { raw?: { language?: string } };
}

interface PostmanAuth {
  type: string;
  apikey?: Array<{ key: string; value: string }>;
  basic?: Array<{ key: string; value: string }>;
  bearer?: Array<{ key: string; value: string }>;
  oauth2?: Array<{ key: string; value: string }>;
}

interface PostmanScript {
  type?: string;
  exec?: string[] | string;
}

interface PostmanEvent {
  listen: "prerequest" | "test";
  script?: PostmanScript;
  disabled?: boolean;
}

interface PostmanItem {
  name: string;
  request?: PostmanRequest | string;
  response?: unknown[];
  event?: PostmanEvent[];
  variable?: PostmanVariable[];
  item?: PostmanItem[];
  auth?: PostmanAuth;
}

interface PostmanRequest {
  method?: string;
  url?: PostmanUrl | string;
  header?: PostmanHeader[];
  body?: PostmanBody;
  auth?: PostmanAuth;
}

interface PostmanCollection {
  info: PostmanInfo;
  item: PostmanItem[];
  event?: PostmanEvent[];
  variable?: PostmanVariable[];
  auth?: PostmanAuth;
}

// ---------------------------------------------------------------------------
// Postman Environment Types
// ---------------------------------------------------------------------------

interface PostmanEnvironment {
  name: string;
  values: Array<{
    key: string;
    value: string;
    enabled?: boolean;
    type?: string;
  }>;
  _postman_variable_scope?: string;
  _postman_exported_at?: string;
  _postman_exported_using?: string;
}

// ---------------------------------------------------------------------------
// Import Result Types
// ---------------------------------------------------------------------------

export interface PostmanCollectionImportResult {
  collectionName: string;
  collectionVariables: ScopedVariable[];
  collectionPreScript?: string;
  collectionPostScript?: string;
  collectionAuthMode?: ApiAuthMode;
  collectionAuthConfig?: AuthConfig;
  folders: Array<{
    id: string;
    name: string;
    parentId?: string;
    variables: ScopedVariable[];
    authMode?: ApiAuthMode;
    authConfig?: AuthConfig;
    preScript?: string;
    postScript?: string;
  }>;
  requests: Array<{
    id: string;
    name: string;
    folderId?: string;
    method: string;
    url: string;
    headers: Array<{ key: string; value: string; enabled: boolean }>;
    queryParams: Array<{ key: string; value: string; enabled: boolean }>;
    body: string;
    bodyMimeType: string;
    bodyForm: Array<{ key: string; value: string; enabled: boolean }>;
    authMode: ApiAuthMode;
    authConfig: AuthConfig;
    variables: ScopedVariable[];
    preScript?: string;
    postScript?: string;
  }>;
}

export interface PostmanEnvironmentImportResult {
  name: string;
  variables: Array<{ key: string; value: string; secret: boolean }>;
}

// ---------------------------------------------------------------------------
// Script Conversion: pm.* → kb.*
// ---------------------------------------------------------------------------

/**
 * Prepare a Postman pm.* script for KobeanREST.
 *
 * NOTE: KobeanREST now natively supports the Postman `pm.*` API at runtime:
 * - pm.request, pm.response, pm.environment, pm.collectionVariables, pm.variables
 * - pm.test, pm.expect (compatible with Chai-style assertions)
 * - pm.sendRequest (implemented using fetch)
 * - pm.cookies (stub with warning, not persisted)
 * - pm.info, pm.globals, pm.iterationData (stubs)
 *
 * Dynamic variables like {{$guid}}, {{$timestamp}}, {{$randomInt}} are also
 * natively resolved at runtime (see variables.ts DYNAMIC_VARIABLES).
 *
 * This function now only adds an informational header comment.
 */
export function convertPostmanScript(scriptContent: string, context: "pre" | "post"): string {
  if (!scriptContent.trim()) return "";

  // Postman pm.* API is natively supported at runtime.
  // No conversion needed - just add an informational header.
  if (!scriptContent.trim().startsWith("// Imported from Postman")) {
    return `// Imported from Postman ${context === "pre" ? "pre-request" : "test"} script
// KobeanREST natively supports the Postman pm.* API at runtime.
// pm.request, pm.response, pm.environment, pm.collectionVariables, pm.variables
// pm.test, pm.expect, pm.sendRequest are all available.
${scriptContent}`;
  }

  return scriptContent;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function isRequestItem(item: PostmanItem): boolean {
  // If it has 'request' property or no 'item' property, it's a request
  return item.request !== undefined || item.item === undefined;
}

function buildUrlFromObject(url: PostmanUrl): string {
  if (url.raw) return url.raw;

  let result = "";
  if (url.protocol) result += `${url.protocol}://`;
  if (url.host) result += url.host.join(".");
  if (url.port) result += `:${url.port}`;
  if (url.path) result += "/" + url.path.join("/");

  const queryParts = (url.query || [])
    .filter((q) => !q.disabled)
    .map((q) => `${encodeURIComponent(q.key)}=${encodeURIComponent(q.value)}`);
  if (queryParts.length > 0) result += `?${queryParts.join("&")}`;

  return result;
}

function convertPostmanAuth(auth?: PostmanAuth, fallbackMode: ApiAuthMode = "none"): { mode: ApiAuthMode; config: AuthConfig } {
  if (!auth) return { mode: fallbackMode, config: {} };

  const type = auth.type;
  if (type === "noauth") return { mode: "none", config: {} };

  switch (type) {
    case "basic": {
      const username = auth.basic?.find((a) => a.key === "username")?.value || "";
      const password = auth.basic?.find((a) => a.key === "password")?.value || "";
      return { mode: "basic", config: { username, password } };
    }
    case "bearer": {
      const token = auth.bearer?.find((a) => a.key === "token")?.value || "";
      return { mode: "bearer", config: { token } };
    }
    case "apikey": {
      const keyName = auth.apikey?.find((a) => a.key === "key")?.value || "";
      const keyValue = auth.apikey?.find((a) => a.key === "value")?.value || "";
      return { mode: "apiKey", config: { keyName, keyValue, placement: "header" } };
    }
    case "oauth2": {
      const accessTokenUrl = auth.oauth2?.find((a) => a.key === "accessTokenUrl")?.value || "";
      const clientId = auth.oauth2?.find((a) => a.key === "clientId")?.value || "";
      const clientSecret = auth.oauth2?.find((a) => a.key === "clientSecret")?.value || "";
      const scope = auth.oauth2?.find((a) => a.key === "scope")?.value || "";
      const audience = auth.oauth2?.find((a) => a.key === "audience")?.value || "";
      const authUrl = auth.oauth2?.find((a) => a.key === "authUrl")?.value || "";
      const username = auth.oauth2?.find((a) => a.key === "username")?.value || "";
      const password = auth.oauth2?.find((a) => a.key === "password")?.value || "";

      let grantType: "client_credentials" | "password_credentials" | "authorization_code" = "client_credentials";
      const postmanGrantType = auth.oauth2?.find((a) => a.key === "grant_type")?.value;
      if (postmanGrantType === "password_credentials" || postmanGrantType === "password") {
        grantType = "password_credentials";
      } else if (postmanGrantType === "authorization_code") {
        grantType = "authorization_code";
      }

      return {
        mode: "oauth2",
        config: { grantType, accessTokenUrl, authUrl, clientId, clientSecret, scope, audience, username, password },
      };
    }
    default:
      return { mode: "none", config: {} };
  }
}

function extractEvents(events?: PostmanEvent[]): { pre?: string; post?: string } {
  if (!events || events.length === 0) return {};

  let preScript = "";
  let postScript = "";

  for (const event of events) {
    if (event.disabled) continue;

    let scriptContent = "";
    if (event.script) {
      if (typeof event.script.exec === "string") {
        scriptContent = event.script.exec;
      } else if (Array.isArray(event.script.exec)) {
        scriptContent = event.script.exec.join("\n");
      }
    }

    if (!scriptContent.trim()) continue;

    if (event.listen === "prerequest") {
      const converted = convertPostmanScript(scriptContent, "pre");
      if (converted.trim()) {
        preScript = preScript ? preScript + "\n\n" + converted : converted;
      }
    } else if (event.listen === "test") {
      const converted = convertPostmanScript(scriptContent, "post");
      if (converted.trim()) {
        postScript = postScript ? postScript + "\n\n" + converted : converted;
      }
    }
  }

  return {
    pre: preScript.trim() || undefined,
    post: postScript.trim() || undefined,
  };
}

function convertVariables(variables?: PostmanVariable[]): ScopedVariable[] {
  if (!variables) return [];
  return variables
    .filter((v) => !v.disabled)
    .map((v) => ({
      key: v.key,
      value: v.value ?? "",
    }));
}

// ---------------------------------------------------------------------------
// Collection Parser
// ---------------------------------------------------------------------------

export function parsePostmanCollection(json: string): PostmanCollectionImportResult {
  const collection: PostmanCollection = JSON.parse(json);

  const folders: PostmanCollectionImportResult["folders"] = [];
  const requests: PostmanCollectionImportResult["requests"] = [];

  // Process collection-level auth
  const collectionAuth = convertPostmanAuth(collection.auth, "none");

  // Process collection-level events
  const collectionScripts = extractEvents(collection.event);

  // Process items recursively
  function processItems(items: PostmanItem[], parentFolderId?: string) {
    for (const item of items) {
      let itemAuth: { mode: ApiAuthMode; config: AuthConfig };
      if (item.request && typeof item.request === "object" && item.request.auth) {
        itemAuth = convertPostmanAuth(item.request.auth);
      } else if (item.auth) {
        itemAuth = convertPostmanAuth(item.auth);
      } else {
        itemAuth = { mode: "none", config: {} };
      }

      if (isRequestItem(item)) {
        // This is a request
        const reqId = generateId("req");

        let method = "GET";
        let url = "";
        const headers: Array<{ key: string; value: string; enabled: boolean }> = [];
        let body = "";
        let bodyMimeType = "text/plain";
        const bodyForm: Array<{ key: string; value: string; enabled: boolean }> = [];
        const queryParams: Array<{ key: string; value: string; enabled: boolean }> = [];

        let req: PostmanRequest;
        if (typeof item.request === "string") {
          url = item.request;
          req = { method: "GET", url: item.request };
        } else if (item.request) {
          req = item.request;

          method = req.method?.toUpperCase() || "GET";

          // URL
          if (typeof req.url === "string") {
            url = req.url;
          } else if (req.url) {
            url = buildUrlFromObject(req.url);
            // Extract query params from URL object
            if (req.url.query) {
              for (const q of req.url.query) {
                queryParams.push({ key: q.key || "", value: q.value ?? "", enabled: !q.disabled });
              }
            }
          }

          // Headers
          if (req.header) {
            for (const h of req.header) {
              headers.push({ key: h.key || "", value: h.value ?? "", enabled: !h.disabled });
              // Detect Content-Type for body
              if (!h.disabled && h.key.toLowerCase() === "content-type") {
                bodyMimeType = h.value.split(";")[0].trim();
              }
            }
          }

          // Body
          if (req.body) {
            switch (req.body.mode) {
              case "raw":
                body = req.body.raw || "";
                if (req.body.options?.raw?.language === "json") {
                  bodyMimeType = "application/json";
                }
                break;
              case "urlencoded":
                if (req.body.urlencoded) {
                  const params = new URLSearchParams();
                  for (const f of req.body.urlencoded) {
                    const val = f.value ?? "";
                    if (!f.disabled) {
                      params.append(f.key || "", val);
                    }
                    bodyForm.push({ key: f.key || "", value: val, enabled: !f.disabled });
                  }
                  body = params.toString();
                  bodyMimeType = "application/x-www-form-urlencoded";
                }
                break;
              case "formdata":
                if (req.body.formdata) {
                  const formData = req.body.formdata.map((f) => {
                    let val = f.value !== undefined && f.value !== null ? f.value : "";
                    if (val === "" && f.src) {
                      val = Array.isArray(f.src) ? f.src.join(", ") : String(f.src);
                    }
                    return {
                      key: f.key || "",
                      value: val,
                      type: f.type ?? (f.src ? "file" : "text"),
                      src: f.src,
                      disabled: f.disabled,
                    };
                  });
                  body = JSON.stringify(formData, null, 2);
                  bodyMimeType = "multipart/form-data";
                  for (const f of req.body.formdata) {
                    let val = f.value !== undefined && f.value !== null ? f.value : "";
                    if (val === "" && f.src) {
                      val = Array.isArray(f.src) ? f.src.join(", ") : String(f.src);
                    }
                    bodyForm.push({ key: f.key || "", value: val, enabled: !f.disabled });
                  }
                }
                break;
              case "file":
                bodyMimeType = "application/octet-stream";
                if (req.body.file?.src) {
                  const src = req.body.file.src;
                  const fileName = src.split("/").pop()?.split("\\").pop() || src;
                  body = JSON.stringify({ type: "file", fileName, fileSize: 0, fileType: "application/octet-stream", base64: "" }, null, 2);
                }
                break;
              case "graphql":
                if (req.body.graphql) {
                  body = JSON.stringify({
                    query: req.body.graphql.query || "",
                    variables: req.body.graphql.variables || "",
                  }, null, 2);
                  bodyMimeType = "application/graphql";
                }
                break;
            }
          }
        } else {
          // No request - skip (this shouldn't happen based on isRequestItem check)
          continue;
        }

        // Events/scripts
        const scripts = extractEvents(item.event);

        // Variables
        const variables = convertVariables(item.variable);

        requests.push({
          id: reqId,
          name: item.name || "Unnamed Request",
          folderId: parentFolderId,
          method,
          url,
          headers,
          queryParams,
          body,
          bodyMimeType,
          bodyForm,
          authMode: itemAuth.mode,
          authConfig: itemAuth.config,
          variables,
          preScript: scripts.pre,
          postScript: scripts.post,
        });
      } else {
        // This is a folder
        const folderId = generateId("folder");
        const folderScripts = extractEvents(item.event);
        const folderVariables = convertVariables(item.variable);

        folders.push({
          id: folderId,
          name: item.name || "Unnamed Folder",
          parentId: parentFolderId,
          variables: folderVariables,
          authMode: itemAuth.mode,
          authConfig: itemAuth.config,
          preScript: folderScripts.pre,
          postScript: folderScripts.post,
        });

        // Process nested items
        if (item.item) {
          processItems(item.item, folderId);
        }
      }
    }
  }

  processItems(collection.item, undefined);

  return {
    collectionName: collection.info.name || "Imported Collection",
    collectionVariables: convertVariables(collection.variable),
    collectionPreScript: collectionScripts.pre,
    collectionPostScript: collectionScripts.post,
    collectionAuthMode: collectionAuth.mode,
    collectionAuthConfig: collectionAuth.config,
    folders,
    requests,
  };
}

// ---------------------------------------------------------------------------
// Environment Parser
// ---------------------------------------------------------------------------

export function parsePostmanEnvironment(json: string): PostmanEnvironmentImportResult {
  const env: PostmanEnvironment = JSON.parse(json);

  const variables: PostmanEnvironmentImportResult["variables"] = [];

  if (env.values) {
    for (const v of env.values) {
      if (v.enabled !== false) {
        variables.push({
          key: v.key,
          value: v.value,
          secret: v.type === "secret",
        });
      }
    }
  }

  return {
    name: env.name || "Imported Environment",
    variables,
  };
}

// ---------------------------------------------------------------------------
// Detection Helpers
// ---------------------------------------------------------------------------

export function isPostmanCollection(json: string): boolean {
  try {
    const parsed = JSON.parse(json);
    // Check for Postman collection identifiers
    if (parsed.info && parsed.item && Array.isArray(parsed.item)) {
      // Has info and item array - likely Postman
      if (parsed.info._postman_id || parsed.info.schema) {
        // Explicit Postman schema or ID
        return true;
      }
      // Check for common Postman patterns
      if (parsed.variable !== undefined || parsed.event !== undefined) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function isPostmanEnvironment(json: string): boolean {
  try {
    const parsed = JSON.parse(json);
    // Postman environment has 'values' array and often scope identifier
    if (Array.isArray(parsed.values) && parsed.name) {
      if (parsed._postman_variable_scope) {
        return true;
      }
      // Check if values array has Postman-like structure
      if (parsed.values.length > 0 && parsed.values[0].key !== undefined) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}
