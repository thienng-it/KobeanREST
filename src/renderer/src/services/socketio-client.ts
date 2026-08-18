import { io, Socket } from 'socket.io-client';
import type { WsConnectionStatus, WsMessagePacket } from '../types';

export interface SocketIOEventCallbacks {
  onStatusChange: (status: WsConnectionStatus, detail?: string) => void;
  onPacket: (packet: WsMessagePacket) => void;
}

export interface SocketIOClientOptions {
  path?: string;
  transports?: ('websocket' | 'polling')[];
  auth?: Record<string, any>;
  query?: Record<string, string>;
  reconnection?: boolean;
}

export class SocketIOClient {
  private socket: Socket | null = null;
  private status: WsConnectionStatus = 'disconnected';
  private callbacks: SocketIOEventCallbacks;
  private url: string = '';

  constructor(callbacks: SocketIOEventCallbacks) {
    this.callbacks = callbacks;
  }

  public getStatus(): WsConnectionStatus {
    return this.status;
  }

  public getUrl(): string {
    return this.url;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  private setStatus(status: WsConnectionStatus, detail?: string) {
    this.status = status;
    this.callbacks.onStatusChange(status, detail);
  }

  public connect(targetUrl: string, options?: SocketIOClientOptions): void {
    if (this.socket && this.socket.connected) {
      this.disconnect();
    }

    let normalizedUrl = targetUrl.trim();
    if (normalizedUrl.startsWith('ws://')) {
      normalizedUrl = 'http://' + normalizedUrl.slice(5);
    } else if (normalizedUrl.startsWith('wss://')) {
      normalizedUrl = 'https://' + normalizedUrl.slice(6);
    } else if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'http://' + normalizedUrl;
    }

    this.url = normalizedUrl;
    this.setStatus('connecting', `Connecting to ${normalizedUrl}...`);

    try {
      const ioOptions: any = {
        path: options?.path && options.path.trim() ? options.path.trim() : '/socket.io',
        transports: options?.transports && options.transports.length > 0 ? options.transports : ['websocket', 'polling'],
        reconnection: options?.reconnection ?? true,
        timeout: 20000,
      };

      if (options?.auth && Object.keys(options.auth).length > 0) {
        ioOptions.auth = options.auth;
      }
      if (options?.query && Object.keys(options.query).length > 0) {
        ioOptions.query = options.query;
      }

      this.callbacks.onPacket({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        direction: 'system',
        data: `Initiating Socket.IO handshake to ${normalizedUrl} (path: ${ioOptions.path}, transports: ${ioOptions.transports.join(', ')})`,
        size: 0,
        format: 'text',
        eventName: 'handshake',
      });

      this.socket = io(normalizedUrl, ioOptions);

      this.socket.on('connect', () => {
        const id = this.socket?.id ? ` [Socket ID: ${this.socket.id}]` : '';
        this.setStatus('connected', `Connected to ${normalizedUrl}${id}`);
        this.callbacks.onPacket({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          direction: 'system',
          data: `Connected to ${normalizedUrl}${id}`,
          size: 0,
          format: 'text',
          eventName: 'connect',
        });
      });

      // Wildcard incoming event interceptor
      this.socket.onAny((eventName: string, ...args: any[]) => {
        let stringified = '';
        let format: 'text' | 'json' | 'binary' = 'text';
        try {
          if (args.length === 1) {
            stringified = typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0], null, 2);
            format = typeof args[0] === 'object' ? 'json' : 'text';
          } else if (args.length > 1) {
            stringified = JSON.stringify(args, null, 2);
            format = 'json';
          }
        } catch {
          stringified = String(args);
        }

        this.callbacks.onPacket({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          direction: 'incoming',
          data: stringified,
          size: new Blob([stringified]).size,
          format,
          eventName,
        });
      });

      this.socket.on('connect_error', (err: any) => {
        const errMsg = err?.message || String(err);
        this.setStatus('error', errMsg);
        this.callbacks.onPacket({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          direction: 'system',
          data: `Connection Error: ${errMsg}`,
          size: 0,
          format: 'text',
          eventName: 'connect_error',
        });
      });

      this.socket.on('disconnect', (reason: string) => {
        this.setStatus('disconnected', `Disconnected (${reason})`);
        this.callbacks.onPacket({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          direction: 'system',
          data: `Disconnected from ${normalizedUrl} (Reason: ${reason})`,
          size: 0,
          format: 'text',
          eventName: 'disconnect',
        });
      });

      this.socket.on('reconnect_attempt', (attempt: number) => {
        this.callbacks.onPacket({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          direction: 'system',
          data: `Reconnecting attempt #${attempt}...`,
          size: 0,
          format: 'text',
          eventName: 'reconnect_attempt',
        });
      });

    } catch (err: any) {
      const errMsg = err?.message || String(err);
      this.setStatus('error', errMsg);
      this.callbacks.onPacket({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        direction: 'system',
        data: `Failed to initialize Socket.IO client: ${errMsg}`,
        size: 0,
        format: 'text',
        eventName: 'error',
      });
    }
  }

  public emit(eventName: string, payload: any, expectAck: boolean = false): boolean {
    if (!this.socket || !this.socket.connected) {
      this.callbacks.onPacket({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        direction: 'system',
        data: 'Cannot emit event: Socket.IO is not connected.',
        size: 0,
        format: 'text',
        eventName,
      });
      return false;
    }

    try {
      const formattedData = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
      let parsedPayload = payload;
      if (typeof payload === 'string') {
        const trimmed = payload.trim();
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          try {
            parsedPayload = JSON.parse(trimmed);
          } catch {
            parsedPayload = payload;
          }
        }
      }

      if (expectAck) {
        const packetId = crypto.randomUUID();
        this.socket.emit(eventName, parsedPayload, (...ackArgs: any[]) => {
          let ackText = '';
          try {
            ackText = ackArgs.length === 1
              ? (typeof ackArgs[0] === 'string' ? ackArgs[0] : JSON.stringify(ackArgs[0], null, 2))
              : JSON.stringify(ackArgs, null, 2);
          } catch {
            ackText = String(ackArgs);
          }

          this.callbacks.onPacket({
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            direction: 'incoming',
            data: ackText,
            size: new Blob([ackText]).size,
            format: 'json',
            eventName: `${eventName} (ACK)`,
            ackResponse: ackArgs,
          });
        });
      } else {
        this.socket.emit(eventName, parsedPayload);
      }

      this.callbacks.onPacket({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        direction: 'outgoing',
        data: formattedData,
        size: new Blob([formattedData]).size,
        format: typeof parsedPayload === 'object' ? 'json' : 'text',
        eventName,
      });
      return true;
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      this.callbacks.onPacket({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        direction: 'system',
        data: `Emit failed for "${eventName}": ${errMsg}`,
        size: 0,
        format: 'text',
        eventName,
      });
      return false;
    }
  }

  public disconnect(): void {
    if (this.socket) {
      this.setStatus('closing', 'Disconnecting...');
      try {
        this.socket.disconnect();
      } catch {
        // ignore
      }
      this.socket = null;
      this.setStatus('disconnected', 'Disconnected');
    } else {
      this.setStatus('disconnected', 'Disconnected');
    }
  }
}
