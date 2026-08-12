export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS" | "CUSTOM";

export interface Tab {
  id: string;
  type: "request" | "folder" | "environment" | "collection";
  entityId: string;
  name: string;
  method?: HttpMethod;
  isDirty?: boolean;
}

export type ApiAuthMode = "none" | "basic" | "bearer" | "apiKey" | "oauth2" | "ntlm" | "kerberos";

export interface AuthConfig {
  username?: string;
  password?: string;
  token?: string;
  keyName?: string;
  keyValue?: string;
  placement?: "header" | "query";
  // OAuth 2.0 fields
  grantType?: "client_credentials" | "password_credentials" | "authorization_code";
  authUrl?: string;
  accessTokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  audience?: string;
  refreshToken?: string;
  expiresAt?: number;
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
  queryParams: Array<{ key: string; value: string; enabled: boolean }>;
  body: string;
  bodyMimeType: string;
  bodyForm: Array<{ key: string; value: string; enabled: boolean }>;
  timeoutMs: number;
  followRedirects: boolean;
  variables?: ScopedVariable[];
  position?: number;
}

export interface EnvironmentVariable {
  key: string;
  value: string;
  secret?: boolean;
  secretRef?: string;
  masked?: boolean;
  color?: string;
}

/** A variable scoped to a collection, folder, or request entity. */
export interface ScopedVariable {
  key: string;
  value: string;
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
  defaultEnvironment?: string;
}

export interface WorkspaceListItem {
  id: string;
  name: string;
}


export interface WorkspaceSummary {
  id: string;
  name: string;
  activeEnvironment: string;
  environments: Array<{
    name: string;
    variables: EnvironmentVariable[];
    color?: string;
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
  runId?: string;
  scopeId?: string;
  scopeName?: string;
  testPassed?: boolean;
  passedTests?: number;
  failedTests?: number;
  testResults?: string;
  responseHeaders?: string | null;
  responseBodyText?: string | null;
  responseBodyBase64?: string | null;
}

export interface HistoryResponsePayload {
  responseHeaders: string | null;
  responseBodyText: string | null;
  responseBodyBase64: string | null;
}

export interface CollectionRunSummary {
  runId: string;
  scopeId: string;
  scopeName: string;
  createdAt: string;
  totalRequests: number;
  passedRequests: number;
  failedRequests: number;
  passedTests?: number;
  failedTests?: number;
  totalDurationMs: number;
}

export interface AppSettings {
  updateChecksEnabled: boolean;
  theme: "system" | "light" | "dark" | "matrix" | "cyberpunk" | "warm";
  exportRedactionEnabled: boolean;
  diagnosticsRedactionEnabled: boolean;
  offlineBehavior: "silent" | "notice";
  timeoutMs?: number;
  followRedirects?: boolean;
  autoSaveEnabled?: boolean;
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
