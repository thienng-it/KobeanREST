export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS" | "CUSTOM";

export type ApiAuthMode = "none" | "basic" | "bearer" | "apiKey" | "oauth2" | "ntlm" | "kerberos";

export interface AuthConfig {
  username?: string;
  password?: string;
  token?: string;
  keyName?: string;
  keyValue?: string;
  placement?: "header" | "query";
  // OAuth 2.0 fields
  grantType?: "client_credentials" | "password";
  accessTokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  audience?: string;
}

export interface Script {
  id: string;
  entityId: string;
  entityType: 'collection' | 'folder' | 'request';
  scriptType: 'pre' | 'post';
  content: string;
  position: number;
}

export interface SavedRequest {
  id: string;
  name: string;
  method: HttpMethod;
  /** When method === "CUSTOM", this holds the actual HTTP method string (e.g. "TRACE", "QUERY"). */
  customMethod?: string;
  url: string;
  folderId: string;
  authMode: ApiAuthMode;
  authConfig: AuthConfig;
  headers: Array<{ key: string; value: string; enabled: boolean }>;
  body: string;
  bodyMimeType: string;
  bodyForm: Array<{ key: string; value: string; enabled: boolean }>;
  timeoutMs: number;
  followRedirects: boolean;
  variables?: ScopedVariable[];
}

export interface EnvironmentVariable {
  key: string;
  value: string;
  secret?: boolean;
  secretRef?: string;
}

/** A variable scoped to a collection, folder, or request entity. */
export interface ScopedVariable {
  key: string;
  value: string;
  secret?: boolean;
  secretRef?: string;
}

export type ScopedVariableEntityType = "collection" | "folder" | "request";

export interface FolderSummary {
  id: string;
  name: string;
  authMode?: ApiAuthMode;
  authConfig?: AuthConfig;
  collectionId?: string;
  parentId?: string;
  timeoutMs?: number;
  followRedirects?: boolean;
  variables?: ScopedVariable[];
}

export interface CollectionSummary {
  id: string;
  name: string;
  authMode?: ApiAuthMode;
  authConfig?: AuthConfig;
  variables?: ScopedVariable[];
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  activeEnvironment: string;
  environments: Array<{
    name: string;
    variables: EnvironmentVariable[];
  }>;
  folders: FolderSummary[];
  requests: SavedRequest[];
  collections?: CollectionSummary[];
}

export interface HistoryEntry {
  id: number;
  requestId: string;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  sizeBytes: number;
  createdAt: string;
}

export interface AppSettings {
  updateChecksEnabled: boolean;
  theme: "system" | "light" | "dark" | "matrix" | "cyberpunk" | "warm";
  exportRedactionEnabled: boolean;
  diagnosticsRedactionEnabled: boolean;
  offlineBehavior: "silent" | "notice";
  timeoutMs?: number;
  followRedirects?: boolean;
}

export interface UpdateStatus {
  enabled: boolean;
  lastCheckedLabel: string;
  channel: "stable" | "preview";
}

export interface UpdateCheckPreview {
  enabledByDefault: boolean;
  requiresAccount: boolean;
  metadata: string;
  releaseReady: boolean;
  message: string;
}

export interface ExecuteHttpRequest {
  method: string;
  url: string;
  headers: Array<{ key: string; value: string; enabled: boolean }>;
  body?: string;
  bodyMimeType?: string;
  bodyForm?: Array<{ key: string; value: string; enabled: boolean }>;
  timeoutMs: number;
  followRedirects: boolean;
}

export interface ExecuteHttpResponse {
  status: number;
  statusText: string;
  headers: Array<{ key: string; value: string; enabled: boolean }>;
  bodyText?: string;
  bodyBase64?: string;
  durationMs: number;
  dnsMs: number;
  connectMs: number;
  tlsMs: number;
  requestMs: number;
  sizeBytes: number;
  contentType?: any;
}
