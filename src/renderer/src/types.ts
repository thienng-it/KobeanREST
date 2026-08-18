export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS" | "WS" | "SOCKET.IO" | "CUSTOM";

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
  bodyForm: Array<{ key: string; value: string; enabled: boolean; type?: "text" | "file" }>;
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

export type PluginCategory = 'auth' | 'transform' | 'testing' | 'utility' | 'logging';
export type PluginSource = 'builtin' | 'local-file';

export interface KbPlugin {
  id: string;
  name: string;
  description: string;
  author: string;
  category: PluginCategory;
  version: string;
  tags: string[];
  source: PluginSource;
  preRequestScript?: string;
  postResponseScript?: string;
  enabled: boolean;
  installedAt?: number;
  // For local-file plugins:
  filePath?: string;
  fileContent?: string; // cached content of the file
}

export type WsConnectionStatus = "disconnected" | "connecting" | "connected" | "closing" | "error";

export interface WsMessagePacket {
  id: string;
  timestamp: number;
  direction: "incoming" | "outgoing" | "system";
  data: string;
  size: number;
  format: "json" | "text" | "binary";
  eventName?: string;
  ackResponse?: any;
}

export interface WsConnectionConfig {
  protocols?: string[];
  headers?: Record<string, string>;
  socketioPath?: string;
  transports?: ("websocket" | "polling")[];
  auth?: Record<string, any>;
  query?: Record<string, string>;
  reconnection?: boolean;
}


