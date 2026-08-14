import type { KbPlugin } from '../types';

const STORAGE_KEY = 'kb_installed_plugins';

export function getInstalledPlugins(): KbPlugin[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveInstalledPlugins(plugins: KbPlugin[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plugins));
}

export function installPlugin(plugin: KbPlugin): KbPlugin[] {
  const installed = getInstalledPlugins();
  const existing = installed.findIndex(p => p.id === plugin.id);
  const entry = { ...plugin, installedAt: Date.now(), enabled: true };
  if (existing >= 0) installed[existing] = entry;
  else installed.push(entry);
  saveInstalledPlugins(installed);
  return installed;
}

export function uninstallPlugin(pluginId: string): KbPlugin[] {
  const updated = getInstalledPlugins().filter(p => p.id !== pluginId);
  saveInstalledPlugins(updated);
  return updated;
}

export function togglePlugin(pluginId: string, enabled: boolean): KbPlugin[] {
  const updated = getInstalledPlugins().map(p =>
    p.id === pluginId ? { ...p, enabled } : p
  );
  saveInstalledPlugins(updated);
  return updated;
}

export function updateLocalFilePlugin(pluginId: string, fields: Partial<KbPlugin>): KbPlugin[] {
  const updated = getInstalledPlugins().map(p =>
    p.id === pluginId ? { ...p, ...fields } : p
  );
  saveInstalledPlugins(updated);
  return updated;
}

export const BUILTIN_PLUGINS: KbPlugin[] = [
  {
    id: 'uuid-injector',
    name: 'UUID Request ID',
    description: 'Auto-injects a unique X-Request-ID header into every request if one is not already set. Helps with tracing and debugging in distributed systems.',
    author: 'KobeanREST',
    category: 'utility',
    version: '1.0.0',
    tags: ['uuid', 'headers', 'tracing'],
    source: 'builtin',
    enabled: false,
    preRequestScript: `// UUID Injector — auto-add X-Request-ID if not present
if (!kb.request.getHeader('X-Request-ID')) {
  kb.request.setHeader('X-Request-ID', crypto.randomUUID());
}`,
  },
  {
    id: 'response-time-logger',
    name: 'Response Time Logger',
    description: 'Logs response time after every request with color-coded severity: green under 200ms, yellow under 1s, red above 1s. Threshold values are configurable via environment variables.',
    author: 'KobeanREST',
    category: 'logging',
    version: '1.0.0',
    tags: ['performance', 'logging', 'monitoring'],
    source: 'builtin',
    enabled: false,
    postResponseScript: `// Response Time Logger
const ms = kb.response.durationMs;
const warn = Number(kb.environment.get('PLUGIN_WARN_MS') || 200);
const err  = Number(kb.environment.get('PLUGIN_ERR_MS')  || 1000);
if (ms < warn) {
  console.log('[ResponseTimeLogger] ✅ ' + ms + 'ms — fast');
} else if (ms < err) {
  console.warn('[ResponseTimeLogger] ⚠️ ' + ms + 'ms — slow');
} else {
  console.error('[ResponseTimeLogger] 🔴 ' + ms + 'ms — very slow (threshold: ' + err + 'ms)');
}`,
  },
  {
    id: 'timestamp-auth',
    name: 'Timestamp + Nonce Auth',
    description: 'Adds X-Timestamp and X-Nonce headers to each request. Useful for APIs that require timestamp-based request signing to prevent replay attacks.',
    author: 'KobeanREST',
    category: 'auth',
    version: '1.0.0',
    tags: ['security', 'nonce', 'timestamp', 'anti-replay'],
    source: 'builtin',
    enabled: false,
    preRequestScript: `// Timestamp + Nonce Auth
kb.request.setHeader('X-Timestamp', new Date().toISOString());
kb.request.setHeader('X-Nonce', crypto.randomUUID().replace(/-/g, ''));`,
  },
  {
    id: 'hmac-signer',
    name: 'HMAC-SHA256 Signer',
    description: 'Signs each request with an HMAC-SHA256 signature using a secret from the environment variable HMAC_SECRET. Sets the Authorization header in the format: HMAC-SHA256 <signature>.',
    author: 'KobeanREST',
    category: 'auth',
    version: '1.0.0',
    tags: ['hmac', 'security', 'signing', 'sha256'],
    source: 'builtin',
    enabled: false,
    preRequestScript: `// HMAC-SHA256 Signer
const secret = kb.environment.get('HMAC_SECRET');
if (secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(kb.request.method + '|' + kb.request.url + '|' + new Date().toISOString().slice(0, 13));
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  kb.request.setHeader('Authorization', 'HMAC-SHA256 ' + b64);
} else {
  console.warn('[HmacSigner] Set HMAC_SECRET environment variable to enable signing.');
}`,
  },
  {
    id: 'rate-limit-checker',
    name: 'Rate Limit Checker',
    description: 'After each response, checks the X-RateLimit-Remaining header and logs a warning when remaining calls drop below the PLUGIN_RATE_WARN threshold (default: 10).',
    author: 'KobeanREST',
    category: 'testing',
    version: '1.0.0',
    tags: ['rate-limit', 'monitoring', 'api'],
    source: 'builtin',
    enabled: false,
    postResponseScript: `// Rate Limit Checker
const remaining = kb.response.headers.find(h => h.key.toLowerCase() === 'x-ratelimit-remaining')?.value;
if (remaining !== undefined) {
  const threshold = Number(kb.environment.get('PLUGIN_RATE_WARN') || 10);
  const val = Number(remaining);
  if (val <= threshold) {
    console.warn('[RateLimitChecker] ⚠️ Only ' + val + ' API calls remaining (threshold: ' + threshold + ')');
  } else {
    console.log('[RateLimitChecker] Rate limit OK — ' + val + ' calls remaining');
  }
}`,
  },
  {
    id: 'json-extractor',
    name: 'JSON Response Extractor',
    description: 'Extracts values from JSON responses and stores them as environment variables. Configure extraction paths via PLUGIN_EXTRACT_<envKey>=<dot.path> environment variables (e.g. PLUGIN_EXTRACT_ACCESS_TOKEN=data.token).',
    author: 'KobeanREST',
    category: 'transform',
    version: '1.0.0',
    tags: ['json', 'extract', 'environment', 'chaining'],
    source: 'builtin',
    enabled: false,
    postResponseScript: `// JSON Response Extractor
try {
  const body = kb.response.json();
  const prefix = 'PLUGIN_EXTRACT_';
  // Walk environment vars to find extraction rules
  // Rules are env vars like: PLUGIN_EXTRACT_MY_TOKEN = data.access_token
  // This plugin reads all vars starting with the prefix and extracts matching paths
  const rules = Object.entries(kb.variables)
    .filter(([k]) => k.startsWith(prefix))
    .map(([k, path]) => ({ envKey: k.slice(prefix.length), path }));
  for (const { envKey, path } of rules) {
    const parts = path.split('.');
    let val = body;
    for (const part of parts) { val = val?.[part]; }
    if (val !== undefined && val !== null) {
      kb.environment.set(envKey, String(val));
      console.log('[JsonExtractor] Set ' + envKey + ' = ' + String(val).slice(0, 60));
    }
  }
} catch(e) { /* Not JSON response */ }`,
  },
  {
    id: 'status-asserter',
    name: 'Status Code Asserter',
    description: 'Automatically asserts that the HTTP response status matches the expected code. Set PLUGIN_EXPECT_STATUS in your environment (e.g. 200, 201, 204). Logs a test pass/fail to the console.',
    author: 'KobeanREST',
    category: 'testing',
    version: '1.0.0',
    tags: ['testing', 'assertions', 'status'],
    source: 'builtin',
    enabled: false,
    postResponseScript: `// Status Code Asserter
const expected = Number(kb.environment.get('PLUGIN_EXPECT_STATUS') || 200);
const actual = kb.response.status;
if (actual === expected) {
  console.log('[StatusAsserter] ✅ Status ' + actual + ' matches expected ' + expected);
} else {
  console.error('[StatusAsserter] ❌ Expected status ' + expected + ' but got ' + actual);
}`,
  },
  {
    id: 'request-logger',
    name: 'Request Logger',
    description: 'Logs outgoing request details (method, URL, and headers) to the console before each request is sent. Useful for debugging request configuration issues.',
    author: 'KobeanREST',
    category: 'logging',
    version: '1.0.0',
    tags: ['logging', 'debug', 'headers'],
    source: 'builtin',
    enabled: false,
    preRequestScript: `// Request Logger
console.log('[RequestLogger] →', kb.request.method, kb.request.url);
for (const h of kb.request.headers.filter(h => h.enabled)) {
  console.log('[RequestLogger]   ' + h.key + ': ' + h.value);
}`,
  },

  // ─── Additional testing plugins ────────────────────────────────────────────

  {
    id: 'content-type-asserter',
    name: 'Content-Type Asserter',
    description: 'Asserts that the response Content-Type header matches the expected value. Set PLUGIN_EXPECT_CONTENT_TYPE in your environment (e.g. application/json). Logs a pass/fail result.',
    author: 'KobeanREST',
    category: 'testing',
    version: '1.0.0',
    tags: ['content-type', 'assertions', 'headers', 'testing'],
    source: 'builtin',
    enabled: false,
    postResponseScript: `// Content-Type Asserter
const expected = kb.environment.get('PLUGIN_EXPECT_CONTENT_TYPE') || 'application/json';
const actual = kb.response.headers.find(h => h.key.toLowerCase() === 'content-type')?.value ?? '';
if (actual.includes(expected)) {
  console.log('[ContentTypeAsserter] ✅ Content-Type OK: ' + actual);
} else {
  console.error('[ContentTypeAsserter] ❌ Expected Content-Type to include "' + expected + '" but got "' + actual + '"');
}`,
  },

  {
    id: 'json-schema-validator',
    name: 'JSON Schema Validator',
    description: 'Validates that the JSON response contains required top-level fields. Set PLUGIN_REQUIRED_FIELDS to a comma-separated list (e.g. id,name,email). Logs pass/fail per field.',
    author: 'KobeanREST',
    category: 'testing',
    version: '1.0.0',
    tags: ['schema', 'json', 'validation', 'testing'],
    source: 'builtin',
    enabled: false,
    postResponseScript: `// JSON Schema Validator (required fields check)
const fieldsStr = kb.environment.get('PLUGIN_REQUIRED_FIELDS') || '';
if (!fieldsStr) {
  console.warn('[SchemaValidator] Set PLUGIN_REQUIRED_FIELDS (e.g. id,name,email) to enable.');
} else {
  try {
    const body = kb.response.json();
    const fields = fieldsStr.split(',').map(f => f.trim()).filter(Boolean);
    let passed = 0, failed = 0;
    for (const field of fields) {
      const exists = body !== null && typeof body === 'object' && field in body;
      if (exists) {
        console.log('[SchemaValidator] ✅ Field present: ' + field);
        passed++;
      } else {
        console.error('[SchemaValidator] ❌ Missing field: ' + field);
        failed++;
      }
    }
    console.log('[SchemaValidator] ' + passed + '/' + fields.length + ' fields present.');
  } catch(e) {
    console.error('[SchemaValidator] Response is not valid JSON.');
  }
}`,
  },

  {
    id: 'response-size-guard',
    name: 'Response Size Guard',
    description: 'Warns if the response body exceeds a size threshold. Set PLUGIN_MAX_SIZE_KB (default: 500KB). Helps catch unexpectedly large payloads that may indicate pagination issues.',
    author: 'KobeanREST',
    category: 'testing',
    version: '1.0.0',
    tags: ['performance', 'size', 'pagination', 'testing'],
    source: 'builtin',
    enabled: false,
    postResponseScript: `// Response Size Guard
const maxKb = Number(kb.environment.get('PLUGIN_MAX_SIZE_KB') || 500);
const sizeKb = kb.response.sizeBytes / 1024;
if (sizeKb > maxKb) {
  console.error('[SizeGuard] ❌ Response is ' + sizeKb.toFixed(1) + 'KB — exceeds limit of ' + maxKb + 'KB');
} else {
  console.log('[SizeGuard] ✅ Response size OK: ' + sizeKb.toFixed(1) + 'KB (limit: ' + maxKb + 'KB)');
}`,
  },

  {
    id: 'pagination-detector',
    name: 'Pagination Detector',
    description: 'After each response, scans for common pagination fields (next, nextPage, next_cursor, Link header) and logs their values. Useful for understanding paginated API responses.',
    author: 'KobeanREST',
    category: 'testing',
    version: '1.0.0',
    tags: ['pagination', 'cursor', 'inspection', 'testing'],
    source: 'builtin',
    enabled: false,
    postResponseScript: `// Pagination Detector
const linkHeader = kb.response.headers.find(h => h.key.toLowerCase() === 'link')?.value;
if (linkHeader) console.log('[Pagination] Link header: ' + linkHeader);
try {
  const body = kb.response.json();
  const candidates = ['next', 'nextPage', 'next_page', 'nextCursor', 'next_cursor', 'cursor', 'after', 'page_token'];
  let found = false;
  for (const key of candidates) {
    if (body && typeof body === 'object' && key in body && body[key]) {
      console.log('[Pagination] Found "' + key + '": ' + JSON.stringify(body[key]));
      found = true;
    }
  }
  if (!found && !linkHeader) console.log('[Pagination] No pagination signals detected.');
} catch(e) { /* Not JSON */ }`,
  },

  {
    id: 'error-inspector',
    name: 'Error Body Inspector',
    description: 'When a 4xx or 5xx response is received, automatically logs the full error body structure to the console. Makes debugging API errors much faster.',
    author: 'KobeanREST',
    category: 'testing',
    version: '1.0.0',
    tags: ['errors', 'debugging', '4xx', '5xx', 'testing'],
    source: 'builtin',
    enabled: false,
    postResponseScript: `// Error Body Inspector
const status = kb.response.status;
if (status >= 400) {
  console.error('[ErrorInspector] 🔴 HTTP ' + status + ' error response:');
  try {
    const body = kb.response.json();
    // Log common error fields
    const errorFields = ['error', 'message', 'detail', 'details', 'description', 'code', 'reason', 'errors'];
    for (const field of errorFields) {
      if (body && field in body) {
        console.error('[ErrorInspector]   ' + field + ': ' + JSON.stringify(body[field]));
      }
    }
    if (!errorFields.some(f => body && f in body)) {
      console.error('[ErrorInspector]   body: ' + JSON.stringify(body).slice(0, 500));
    }
  } catch(e) {
    console.error('[ErrorInspector]   body (text): ' + kb.response.text().slice(0, 500));
  }
}`,
  },

  {
    id: 'required-headers-checker',
    name: 'Required Response Headers',
    description: 'Checks that specified response headers are present. Set PLUGIN_REQUIRED_HEADERS to a comma-separated list (e.g. X-Request-ID,Cache-Control,ETag). Logs pass/fail per header.',
    author: 'KobeanREST',
    category: 'testing',
    version: '1.0.0',
    tags: ['headers', 'assertions', 'security', 'testing'],
    source: 'builtin',
    enabled: false,
    postResponseScript: `// Required Response Headers Checker
const headersStr = kb.environment.get('PLUGIN_REQUIRED_HEADERS') || '';
if (!headersStr) {
  console.warn('[HeadersChecker] Set PLUGIN_REQUIRED_HEADERS (e.g. X-Request-ID,Cache-Control) to enable.');
} else {
  const required = headersStr.split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
  const present = new Set(kb.response.headers.map(h => h.key.toLowerCase()));
  let passed = 0;
  for (const h of required) {
    if (present.has(h)) {
      console.log('[HeadersChecker] ✅ Header present: ' + h);
      passed++;
    } else {
      console.error('[HeadersChecker] ❌ Missing header: ' + h);
    }
  }
  console.log('[HeadersChecker] ' + passed + '/' + required.length + ' headers present.');
}`,
  },

  {
    id: 'token-expiry-checker',
    name: 'JWT Expiry Inspector',
    description: 'Decodes the JWT in the Authorization header (without signature verification) and logs its expiry time and remaining TTL. Warns when the token expires within 5 minutes.',
    author: 'KobeanREST',
    category: 'auth',
    version: '1.0.0',
    tags: ['jwt', 'auth', 'token', 'expiry', 'security'],
    source: 'builtin',
    enabled: false,
    preRequestScript: `// JWT Expiry Inspector
const auth = kb.request.getHeader('Authorization') || '';
const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
if (!token) return;
try {
  const parts = token.split('.');
  if (parts.length !== 3) return;
  const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  if (!payload.exp) { console.log('[JwtExpiry] Token has no exp claim.'); return; }
  const now = Math.floor(Date.now() / 1000);
  const ttl = payload.exp - now;
  const sub = payload.sub || payload.email || '(unknown)';
  if (ttl < 0) {
    console.error('[JwtExpiry] ❌ Token EXPIRED ' + Math.abs(ttl) + 's ago. Subject: ' + sub);
  } else if (ttl < 300) {
    console.warn('[JwtExpiry] ⚠️ Token expires in ' + ttl + 's (' + new Date(payload.exp * 1000).toISOString() + '). Subject: ' + sub);
  } else {
    console.log('[JwtExpiry] ✅ Token valid for ' + Math.floor(ttl/60) + 'm. Subject: ' + sub);
  }
} catch(e) { console.warn('[JwtExpiry] Could not decode token: ' + e.message); }`,
  },

  {
    id: 'response-latency-percentiles',
    name: 'Latency Tracker',
    description: 'Tracks response times across requests and logs a rolling P50/P95 summary every 10 requests. Stores history in sessionStorage. Useful for spotting performance regressions during manual testing.',
    author: 'KobeanREST',
    category: 'logging',
    version: '1.0.0',
    tags: ['performance', 'latency', 'p95', 'statistics'],
    source: 'builtin',
    enabled: false,
    postResponseScript: `// Latency Tracker (rolling P50/P95)
const KEY = 'kb_plugin_latency_history';
const raw = sessionStorage.getItem(KEY);
const history = raw ? JSON.parse(raw) : [];
history.push(kb.response.durationMs);
if (history.length > 100) history.shift();
sessionStorage.setItem(KEY, JSON.stringify(history));
const sorted = [...history].sort((a, b) => a - b);
const p50 = sorted[Math.floor(sorted.length * 0.5)];
const p95 = sorted[Math.floor(sorted.length * 0.95)];
const avg = Math.round(history.reduce((a, b) => a + b, 0) / history.length);
console.log('[LatencyTracker] n=' + history.length + ' | avg=' + avg + 'ms | P50=' + p50 + 'ms | P95=' + p95 + 'ms');`,
  },

  {
    id: 'env-variable-dumper',
    name: 'Environment Variable Dumper',
    description: 'Dumps all current environment variables to the console before the request is sent. Useful for debugging variable resolution issues in complex environments.',
    author: 'KobeanREST',
    category: 'logging',
    version: '1.0.0',
    tags: ['environment', 'variables', 'debug', 'logging'],
    source: 'builtin',
    enabled: false,
    preRequestScript: `// Environment Variable Dumper
const vars = kb.variables;
const keys = Object.keys(vars);
if (keys.length === 0) {
  console.log('[EnvDumper] No environment variables set.');
} else {
  console.log('[EnvDumper] Active environment variables (' + keys.length + '):');
  for (const key of keys.sort()) {
    const val = vars[key];
    // Mask likely secrets
    const isSensitive = /token|secret|password|key|auth|credential/i.test(key);
    console.log('[EnvDumper]   ' + key + ' = ' + (isSensitive ? '***' : String(val).slice(0, 80)));
  }
}`,
  },

  {
    id: 'deprecated-fields-scanner',
    name: 'Deprecated Fields Scanner',
    description: 'Scans the JSON response for fields listed in PLUGIN_DEPRECATED_FIELDS (comma-separated). Warns if any deprecated fields are present in the response — useful for API migration testing.',
    author: 'KobeanREST',
    category: 'testing',
    version: '1.0.0',
    tags: ['deprecation', 'migration', 'api', 'testing'],
    source: 'builtin',
    enabled: false,
    postResponseScript: `// Deprecated Fields Scanner
const fieldsStr = kb.environment.get('PLUGIN_DEPRECATED_FIELDS') || '';
if (!fieldsStr) {
  console.warn('[DeprecatedScanner] Set PLUGIN_DEPRECATED_FIELDS (e.g. legacyId,old_name) to enable.');
} else {
  try {
    const body = kb.response.json();
    const deprecated = fieldsStr.split(',').map(f => f.trim()).filter(Boolean);
    const flatten = (obj, prefix = '') => {
      const keys = [];
      for (const [k, v] of Object.entries(obj || {})) {
        keys.push(prefix ? prefix + '.' + k : k);
        if (v && typeof v === 'object' && !Array.isArray(v)) keys.push(...flatten(v, prefix ? prefix + '.' + k : k));
      }
      return keys;
    };
    const allKeys = flatten(body);
    let found = 0;
    for (const dep of deprecated) {
      if (allKeys.some(k => k === dep || k.endsWith('.' + dep))) {
        console.warn('[DeprecatedScanner] ⚠️ Deprecated field found: ' + dep);
        found++;
      }
    }
    if (found === 0) console.log('[DeprecatedScanner] ✅ No deprecated fields detected.');
  } catch(e) { /* Not JSON */ }
}`,
  },

  {
    id: 'response-time-budget',
    name: 'Response Time Budget',
    description: 'Fails the test if the response time exceeds a strict budget. Set PLUGIN_TIME_BUDGET_MS in your environment (default: 500ms). Unlike the logger, this one clearly marks failures for SLA testing.',
    author: 'KobeanREST',
    category: 'testing',
    version: '1.0.0',
    tags: ['sla', 'performance', 'budget', 'testing'],
    source: 'builtin',
    enabled: false,
    postResponseScript: `// Response Time Budget (SLA assertion)
const budget = Number(kb.environment.get('PLUGIN_TIME_BUDGET_MS') || 500);
const actual = kb.response.durationMs;
if (actual <= budget) {
  console.log('[TimeBudget] ✅ ' + actual + 'ms ≤ budget of ' + budget + 'ms');
} else {
  const over = actual - budget;
  console.error('[TimeBudget] ❌ ' + actual + 'ms — exceeded budget by ' + over + 'ms (budget: ' + budget + 'ms)');
}`,
  },
];

