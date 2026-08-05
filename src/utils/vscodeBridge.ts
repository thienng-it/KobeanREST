declare function acquireVsCodeApi(): {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
};

let vsCodeApiInstance: any = null;

export function getVsCodeApi() {
  if (!vsCodeApiInstance && typeof acquireVsCodeApi === 'function') {
    try {
      vsCodeApiInstance = acquireVsCodeApi();
    } catch {
      // acquireVsCodeApi can only be called once
    }
  }
  return vsCodeApiInstance;
}

export function isVsCodeWebview(): boolean {
  return typeof acquireVsCodeApi === 'function' || getVsCodeApi() !== null;
}

const pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();

if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    const message = event.data;
    if (message && message.requestId && pendingRequests.has(message.requestId)) {
      const { resolve, reject } = pendingRequests.get(message.requestId)!;
      pendingRequests.delete(message.requestId);

      if (message.type === 'httpResponse') {
        resolve(message.payload);
      } else if (message.type === 'httpError') {
        reject(new Error(message.error));
      }
    }
  });
}

export async function executeViaVsCodeProxy(options: {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<any> {
  const api = getVsCodeApi();
  if (!api) {
    throw new Error('VS Code API unavailable in current context');
  }

  const requestId = Math.random().toString(36).substring(2, 11);

  return new Promise((resolve, reject) => {
    pendingRequests.set(requestId, { resolve, reject });
    api.postMessage({
      type: 'executeHttpRequest',
      requestId,
      payload: options,
    });
  });
}
