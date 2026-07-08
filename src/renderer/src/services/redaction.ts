function redactText(text: string): string {
  return text
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/g, "$1 [redacted]")
    .replace(/((?:authorization|cookie|x-api-key)\s*[:=]\s*)([^\r\n,;]+)/gi, "$1[redacted]")
    .replace(
      /([?&](?:api[_-]?key|token|access_token|refresh_token|secret|password|client_secret)=)([^&#\s]+)/gi,
      "$1[redacted]",
    )
    .replace(
      /((?:api[_-]?key|token|secret|password|client_secret)\s*[:=]\s*["']?)([^"',\s}]+)/gi,
      "$1[redacted]",
    );
}

export function redactDiagnosticError(error: unknown): string {
  if (error instanceof Error) {
    return redactText(`${error.name}: ${error.message}`);
  }

  if (typeof error === "string") {
    return redactText(error);
  }

  try {
    return redactText(JSON.stringify(error));
  } catch {
    return redactText(String(error));
  }
}
