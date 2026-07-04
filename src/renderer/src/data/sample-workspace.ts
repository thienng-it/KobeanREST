import type { WorkspaceSummary } from "../types";

export const authModes = ["None", "Basic Auth", "Bearer Token", "API Key", "OAuth 2.0"] as const;

export const sampleWorkspace: WorkspaceSummary = {
  name: "Local Workspace",
  activeEnvironment: "Development",
  environments: [
    {
      name: "Development",
      variables: [
        { key: "baseUrl", value: "https://api.example.local" },
        {
          key: "token",
          value: "[secret stored outside SQLite]",
          secret: true,
          secretRef: "kobeanrest://secrets/development/token",
        },
      ],
    },
    {
      name: "Production",
      variables: [
        { key: "baseUrl", value: "https://api.example.com" },
        {
          key: "token",
          value: "[secret stored outside SQLite]",
          secret: true,
          secretRef: "kobeanrest://secrets/production/token",
        },
      ],
    },
  ],
  folders: [
    { id: "folder-system", name: "System" },
    { id: "folder-users-api", name: "Users API" },
    { id: "folder-orders-api", name: "Orders API" },
  ],
  requests: [
    {
      id: "req-health",
      name: "Health check",
      method: "GET",
      url: "{{baseUrl}}/health",
      folderId: "folder-system",
      authMode: "none",
      authConfig: {},
      headers: [{ key: "Accept", value: "application/json", enabled: true }],
      body: "",
      timeoutMs: 30_000,
      followRedirects: true,
    },
    {
      id: "req-profile",
      name: "Fetch profile",
      method: "GET",
      url: "{{baseUrl}}/v1/profile",
      folderId: "folder-users-api",
      authMode: "bearer",
      authConfig: { token: "{{token}}" },
      headers: [{ key: "Authorization", value: "Bearer {{token}}", enabled: true }],
      body: "",
      timeoutMs: 30_000,
      followRedirects: true,
    },
    {
      id: "req-create-order",
      name: "Create order",
      method: "POST",
      url: "{{baseUrl}}/v1/orders",
      folderId: "folder-orders-api",
      authMode: "apiKey",
      authConfig: { keyName: "X-API-Key", keyValue: "{{token}}", placement: "header" },
      headers: [
        { key: "Content-Type", value: "application/json", enabled: true },
        { key: "X-API-Key", value: "{{token}}", enabled: true },
      ],
      body: '{\n  "sku": "kobean-rest-pro",\n  "quantity": 1\n}',
      timeoutMs: 30_000,
      followRedirects: true,
    },
  ],
};
