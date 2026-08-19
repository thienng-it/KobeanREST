export interface KeyValueItem {
  key: string;
  value: string;
  enabled: boolean;
}

/**
 * Converts a list of key-value items (params or headers) into a bulk text string.
 * Disabled items are prefixed with `// `.
 */
export function keyValueToBulkText(items?: KeyValueItem[]): string {
  if (!items || items.length === 0) return "";
  return items
    .filter((item) => item.key.trim() !== "" || item.value.trim() !== "")
    .map((item) => {
      const line = `${item.key}:${item.value ? " " + item.value : ""}`;
      return item.enabled ? line : `// ${line}`;
    })
    .join("\n");
}

/**
 * Parses a bulk text string into a list of key-value items.
 * Supports delimiters `:` and `=`, and disables items starting with `//` or `#`.
 */
export function parseBulkTextToKeyValue(text: string): KeyValueItem[] {
  const lines = text.split("\n");
  const result: KeyValueItem[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    let enabled = true;
    let content = trimmed;

    if (content.startsWith("//") || content.startsWith("#")) {
      enabled = false;
      content = content.replace(/^(\/\/|#)\s*/, "").trim();
      if (!content) continue;
    }

    const colonIdx = content.indexOf(":");
    const eqIdx = content.indexOf("=");

    let delimIdx = -1;
    if (colonIdx >= 0 && eqIdx >= 0) {
      delimIdx = Math.min(colonIdx, eqIdx);
    } else if (colonIdx >= 0) {
      delimIdx = colonIdx;
    } else if (eqIdx >= 0) {
      delimIdx = eqIdx;
    }

    if (delimIdx >= 0) {
      const key = content.slice(0, delimIdx).trim();
      const value = content.slice(delimIdx + 1).trim();
      result.push({ key, value, enabled });
    } else {
      result.push({ key: content.trim(), value: "", enabled });
    }
  }

  return result;
}

export const paramsToBulkText = keyValueToBulkText;
export const parseBulkParams = parseBulkTextToKeyValue;
export const headersToBulkText = keyValueToBulkText;
export const parseBulkHeaders = parseBulkTextToKeyValue;
