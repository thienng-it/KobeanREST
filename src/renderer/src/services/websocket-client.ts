import type { WsConnectionStatus, WsMessagePacket } from '../types';

export interface WebSocketEventCallbacks {
  onStatusChange: (status: WsConnectionStatus, detail?: string) => void;
  onPacket: (packet: WsMessagePacket) => void;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private status: WsConnectionStatus = 'disconnected';
  private callbacks: WebSocketEventCallbacks;
  private url: string = '';

  constructor(callbacks: WebSocketEventCallbacks) {
    this.callbacks = callbacks;
  }

  public getStatus(): WsConnectionStatus {
    return this.status;
  }

  public getUrl(): string {
    return this.url;
  }

  private setStatus(status: WsConnectionStatus, detail?: string) {
    this.status = status;
    this.callbacks.onStatusChange(status, detail);
  }

  public connect(targetUrl: string, protocols?: string[]): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.disconnect(1000, 'Reconnecting');
    }

    let normalizedUrl = targetUrl.trim();
    if (normalizedUrl.startsWith('http://')) {
      normalizedUrl = 'ws://' + normalizedUrl.slice(7);
    } else if (normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'wss://' + normalizedUrl.slice(8);
    } else if (!normalizedUrl.startsWith('ws://') && !normalizedUrl.startsWith('wss://')) {
      normalizedUrl = 'ws://' + normalizedUrl;
    }

    this.url = normalizedUrl;
    this.setStatus('connecting', `Connecting to ${normalizedUrl}...`);

    try {
      const validProtocols = protocols && protocols.length > 0
        ? protocols.map(p => p.trim()).filter(Boolean)
        : undefined;

      this.ws = validProtocols && validProtocols.length > 0
        ? new WebSocket(normalizedUrl, validProtocols)
        : new WebSocket(normalizedUrl);

      this.ws.binaryType = 'arraybuffer';

      this.callbacks.onPacket({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        direction: 'system',
        data: `Connecting to ${normalizedUrl}${validProtocols ? ` (Protocols: ${validProtocols.join(', ')})` : ''}`,
        size: 0,
        format: 'text',
      });

      this.ws.onopen = (evt) => {
        const protocol = this.ws?.protocol ? ` (Protocol: ${this.ws.protocol})` : '';
        this.setStatus('connected', `Connected to ${normalizedUrl}${protocol}`);
        this.callbacks.onPacket({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          direction: 'system',
          data: `Connected to ${normalizedUrl}${protocol}`,
          size: 0,
          format: 'text',
        });
      };

      this.ws.onmessage = (evt: MessageEvent) => {
        let textData = '';
        let format: 'text' | 'json' | 'binary' = 'text';
        let size = 0;

        if (typeof evt.data === 'string') {
          textData = evt.data;
          size = new Blob([evt.data]).size;
          const trimmed = textData.trim();
          if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            try {
              JSON.parse(trimmed);
              format = 'json';
            } catch {
              format = 'text';
            }
          }
        } else if (evt.data instanceof ArrayBuffer) {
          size = evt.data.byteLength;
          format = 'binary';
          const uint8 = new Uint8Array(evt.data);
          try {
            textData = new TextDecoder('utf-8', { fatal: true }).decode(uint8);
            const trimmed = textData.trim();
            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
              JSON.parse(trimmed);
              format = 'json';
            }
          } catch {
            // Hex string representation
            textData = Array.from(uint8)
              .map(b => b.toString(16).padStart(2, '0'))
              .join(' ');
          }
        }

        this.callbacks.onPacket({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          direction: 'incoming',
          data: textData,
          size,
          format,
        });
      };

      this.ws.onerror = (evt) => {
        const errDetail = 'WebSocket connection error';
        this.setStatus('error', errDetail);
        this.callbacks.onPacket({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          direction: 'system',
          data: `Error: ${errDetail}`,
          size: 0,
          format: 'text',
        });
      };

      this.ws.onclose = (evt: CloseEvent) => {
        const reason = evt.reason ? ` (Reason: ${evt.reason})` : '';
        const detail = `Disconnected [Code ${evt.code}]${reason}`;
        this.setStatus('disconnected', detail);
        this.callbacks.onPacket({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          direction: 'system',
          data: `Connection closed: Code ${evt.code}${reason}`,
          size: 0,
          format: 'text',
        });
        this.ws = null;
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      this.setStatus('error', errMsg);
      this.callbacks.onPacket({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        direction: 'system',
        data: `Failed to initiate WebSocket connection: ${errMsg}`,
        size: 0,
        format: 'text',
      });
    }
  }

  public send(payload: string): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.callbacks.onPacket({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        direction: 'system',
        data: 'Cannot send message: WebSocket is not connected.',
        size: 0,
        format: 'text',
      });
      return false;
    }

    try {
      this.ws.send(payload);

      let format: 'text' | 'json' | 'binary' = 'text';
      const trimmed = payload.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          JSON.parse(trimmed);
          format = 'json';
        } catch {
          format = 'text';
        }
      }

      this.callbacks.onPacket({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        direction: 'outgoing',
        data: payload,
        size: new Blob([payload]).size,
        format,
      });
      return true;
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      this.callbacks.onPacket({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        direction: 'system',
        data: `Send failed: ${errMsg}`,
        size: 0,
        format: 'text',
      });
      return false;
    }
  }

  public disconnect(code: number = 1000, reason: string = 'User closed connection'): void {
    if (this.ws) {
      this.setStatus('closing', 'Closing connection...');
      try {
        this.ws.close(code, reason);
      } catch {
        this.ws = null;
        this.setStatus('disconnected', 'Disconnected');
      }
    } else {
      this.setStatus('disconnected', 'Disconnected');
    }
  }
}
