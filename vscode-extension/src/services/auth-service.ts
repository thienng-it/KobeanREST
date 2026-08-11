import type { SecretStorageService } from "./secret-storage.js";
import type { VariableResolver } from "./variable-resolver.js";

export type AuthMode =
  | "none"
  | "basic"
  | "bearer"
  | "apiKey"
  | "oauth2"
  | "ntlm"
  | "kerberos";

export interface AuthConfig {
  username?: string;
  password?: string;
  token?: string;
  keyName?: string;
  keyValue?: string;
  placement?: "header" | "query";
  grantType?: "client_credentials" | "password_credentials" | "authorization_code";
  authUrl?: string;
  accessTokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  audience?: string;
}

/**
 * Authentication service matching KobeanREST's auth.ts.
 * Supports Basic, Bearer, API Key, OAuth 2.0 with variable resolution.
 */
export class AuthService {
  constructor(
    _secrets: SecretStorageService,
    private readonly resolver: VariableResolver,
  ) {}

  resolveAuthConfig(
    config: AuthConfig,
    variables: Map<string, string>,
  ): AuthConfig {
    const resolve = (s?: string) =>
      s ? this.resolver.resolveString(s, variables) : s;
    return {
      ...config,
      username: resolve(config.username),
      password: resolve(config.password),
      token: resolve(config.token),
      keyName: resolve(config.keyName),
      keyValue: resolve(config.keyValue),
      clientId: resolve(config.clientId),
      clientSecret: resolve(config.clientSecret),
      accessTokenUrl: resolve(config.accessTokenUrl),
      scope: resolve(config.scope),
      audience: resolve(config.audience),
    };
  }

  applyAuth(
    mode: AuthMode,
    config: AuthConfig,
    url: string,
    headers: Array<{ key: string; value: string; enabled: boolean }>,
  ): { url: string; headers: Array<{ key: string; value: string; enabled: boolean }> } {
    const result = { url, headers: [...headers] };

    switch (mode) {
      case "basic": {
        const encoded = Buffer.from(
          `${config.username ?? ""}:${config.password ?? ""}`,
        ).toString("base64");
        result.headers.push({
          key: "Authorization",
          value: `Basic ${encoded}`,
          enabled: true,
        });
        break;
      }

      case "bearer":
      case "oauth2": {
        if (config.token) {
          result.headers.push({
            key: "Authorization",
            value: `Bearer ${config.token}`,
            enabled: true,
          });
        }
        break;
      }

      case "apiKey": {
        if (config.keyName && config.keyValue) {
          if (config.placement === "query") {
            const separator = result.url.includes("?") ? "&" : "?";
            result.url += `${separator}${encodeURIComponent(config.keyName)}=${encodeURIComponent(config.keyValue)}`;
          } else {
            result.headers.push({
              key: config.keyName,
              value: config.keyValue,
              enabled: true,
            });
          }
        }
        break;
      }

      case "none":
      default:
        break;
    }

    return result;
  }

  redactAuthFromUrl(
    url: string,
    mode: AuthMode,
    config: AuthConfig,
  ): string {
    if (mode === "apiKey" && config.placement === "query" && config.keyValue) {
      return url.replace(
        encodeURIComponent(config.keyValue),
        "REDACTED",
      );
    }
    return url;
  }
}
