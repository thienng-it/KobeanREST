import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Square,
  Send,
  Trash2,
  Download,
  Filter,
  Search,
  Radio,
  Check,
  Copy,
  ChevronRight,
  ChevronDown,
  ArrowDownLeft,
  ArrowUpRight,
  Zap,
  Clock,
  Sparkles,
  Settings2,
  MessageSquare,
  ListFilter,
  Plus
} from 'lucide-react';
import type { HttpMethod, SavedRequest, ScopedVariable, WsConnectionStatus, WsMessagePacket } from '../types';
import { MethodSelector } from './MethodSelector';
import { VariableInput } from './VariableInput';
import { WebSocketClient } from '../services/websocket-client';
import { SocketIOClient } from '../services/socketio-client';
import { formatBytes } from '../response-utils';

interface WebSocketPanelProps {
  draftRequest: SavedRequest;
  activeVars?: ScopedVariable[];
  onUpdateDraft: (fields: Partial<SavedRequest> | ((prev: SavedRequest) => Partial<SavedRequest>)) => void;
  onSaveRequest: () => void;
}

export function WebSocketPanel({
  draftRequest,
  activeVars = [],
  onUpdateDraft,
  onSaveRequest,
}: WebSocketPanelProps) {
  const isSocketIO = draftRequest.method === 'SOCKET.IO';

  // Connection State
  const [status, setStatus] = useState<WsConnectionStatus>('disconnected');
  const [statusDetail, setStatusDetail] = useState<string>('');
  const [uptimeSeconds, setUptimeSeconds] = useState<number>(0);

  // Message Packets Stream
  const [packets, setPackets] = useState<WsMessagePacket[]>([]);
  const [selectedPacketId, setSelectedPacketId] = useState<string | null>(null);

  // Filter & Search
  const [filterText, setFilterText] = useState<string>('');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'incoming' | 'outgoing' | 'system'>('all');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);

  // Composer State
  const [messageText, setMessageText] = useState<string>('{\n  "message": "Hello from KobeanREST!"\n}');
  const [messageFormat, setMessageFormat] = useState<'json' | 'text'>('json');
  const [socketioEvent, setSocketioEvent] = useState<string>('message');
  const [expectAck, setExpectAck] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'message' | 'handshake' | 'events'>('message');

  // Handshake & Sub-protocols
  const [protocolsInput, setProtocolsInput] = useState<string>('');
  const [socketioPath, setSocketioPath] = useState<string>('/socket.io');
  const [socketioTransports, setSocketioTransports] = useState<string>('websocket,polling');
  const [socketioAuthJson, setSocketioAuthJson] = useState<string>('{}');

  // Socket.IO Custom Event Listeners
  const [customEventListeners, setCustomEventListeners] = useState<string[]>(['message', 'chat', 'notification']);
  const [newEventListenerName, setNewEventListenerName] = useState<string>('');

  // Copy Feedback
  const [copiedPacketId, setCopiedPacketId] = useState<string | null>(null);

  // Clients refs
  const wsClientRef = useRef<WebSocketClient | null>(null);
  const socketioClientRef = useRef<SocketIOClient | null>(null);
  const packetsEndRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<any>(null);

  // Initialize client callbacks
  useEffect(() => {
    wsClientRef.current = new WebSocketClient({
      onStatusChange: (newStatus, detail) => {
        setStatus(newStatus);
        if (detail) setStatusDetail(detail);
      },
      onPacket: (pkt) => {
        setPackets((prev) => [...prev, pkt]);
      },
    });

    socketioClientRef.current = new SocketIOClient({
      onStatusChange: (newStatus, detail) => {
        setStatus(newStatus);
        if (detail) setStatusDetail(detail);
      },
      onPacket: (pkt) => {
        setPackets((prev) => [...prev, pkt]);
      },
    });

    return () => {
      wsClientRef.current?.disconnect();
      socketioClientRef.current?.disconnect();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Connection timer
  useEffect(() => {
    if (status === 'connected') {
      setUptimeSeconds(0);
      timerRef.current = setInterval(() => {
        setUptimeSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setUptimeSeconds(0);
    }
  }, [status]);

  // Auto-scroll message stream
  useEffect(() => {
    if (autoScroll && packetsEndRef.current) {
      packetsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [packets, autoScroll]);

  // Variable resolution for URL
  const resolvedUrl = useMemo(() => {
    let u = draftRequest.url || '';
    if (activeVars && activeVars.length > 0) {
      for (const v of activeVars) {
        if (v.key && v.value) {
          u = u.split(`{{${v.key}}}`).join(v.value);
        }
      }
    }
    return u;
  }, [draftRequest.url, activeVars]);

  // Format uptime string
  const uptimeDisplay = useMemo(() => {
    const mins = Math.floor(uptimeSeconds / 60).toString().padStart(2, '0');
    const secs = (uptimeSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }, [uptimeSeconds]);

  // Metrics
  const metrics = useMemo(() => {
    let incoming = 0;
    let outgoing = 0;
    let totalBytes = 0;
    for (const p of packets) {
      if (p.direction === 'incoming') incoming++;
      if (p.direction === 'outgoing') outgoing++;
      totalBytes += p.size;
    }
    return { incoming, outgoing, totalBytes };
  }, [packets]);

  // Filtered Packets
  const filteredPackets = useMemo(() => {
    return packets.filter((p) => {
      if (directionFilter !== 'all' && p.direction !== directionFilter) {
        return false;
      }
      if (filterText.trim()) {
        const query = filterText.toLowerCase();
        const matchesData = p.data.toLowerCase().includes(query);
        const matchesEvent = p.eventName?.toLowerCase().includes(query);
        if (!matchesData && !matchesEvent) return false;
      }
      return true;
    });
  }, [packets, directionFilter, filterText]);

  // Handle Connect / Disconnect Toggle
  const handleToggleConnection = () => {
    if (status === 'connected' || status === 'connecting') {
      if (isSocketIO) {
        socketioClientRef.current?.disconnect();
      } else {
        wsClientRef.current?.disconnect();
      }
    } else {
      if (!resolvedUrl.trim()) {
        setStatus('error');
        setStatusDetail('Please enter a valid WebSocket / Socket.IO URL.');
        return;
      }

      if (isSocketIO) {
        let authObj: any = undefined;
        try {
          if (socketioAuthJson.trim()) {
            authObj = JSON.parse(socketioAuthJson);
          }
        } catch {
          // ignore
        }

        const transportsArray = socketioTransports
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter((t): t is 'websocket' | 'polling' => t === 'websocket' || t === 'polling');

        socketioClientRef.current?.connect(resolvedUrl, {
          path: socketioPath.trim() || '/socket.io',
          transports: transportsArray.length > 0 ? transportsArray : ['websocket', 'polling'],
          auth: authObj,
        });
      } else {
        const protocols = protocolsInput
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean);
        wsClientRef.current?.connect(resolvedUrl, protocols);
      }
    }
  };

  // Handle Send Message / Emit Event
  const handleSendMessage = () => {
    if (status !== 'connected') return;

    if (isSocketIO) {
      const event = socketioEvent.trim() || 'message';
      socketioClientRef.current?.emit(event, messageText, expectAck);
    } else {
      wsClientRef.current?.send(messageText);
    }
  };

  // Handle Enter shortcut in textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Prettify JSON in Composer
  const handlePrettifyComposer = () => {
    try {
      const parsed = JSON.parse(messageText);
      setMessageText(JSON.stringify(parsed, null, 2));
      setMessageFormat('json');
    } catch {
      // not valid JSON
    }
  };

  // Apply quick snippet
  const handleApplySnippet = (snippet: { event?: string; payload: string }) => {
    if (snippet.event) setSocketioEvent(snippet.event);
    setMessageText(snippet.payload);
  };

  // Copy Packet Content
  const handleCopyPacket = (pkt: WsMessagePacket) => {
    navigator.clipboard.writeText(pkt.data);
    setCopiedPacketId(pkt.id);
    setTimeout(() => setCopiedPacketId(null), 1500);
  };

  // Export Stream
  const handleExportStream = () => {
    const blob = new Blob([JSON.stringify(packets, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `websocket-stream-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Add custom listener for Socket.IO
  const handleAddEventListener = () => {
    const trimmed = newEventListenerName.trim();
    if (trimmed && !customEventListeners.includes(trimmed)) {
      setCustomEventListeners((prev) => [...prev, trimmed]);
      setNewEventListenerName('');
    }
  };

  return (
    <div className="websocket-panel-root" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', gap: '8px', minHeight: 0, overflow: 'hidden' }}>
      {/* Top Address & Connection Bar */}
      <div className="request-command-bar">
        <MethodSelector
          method={draftRequest.method}
          customMethod={draftRequest.customMethod}
          onChange={(m, customVal) => {
            onUpdateDraft({ method: m, customMethod: customVal });
          }}
        />

        <VariableInput
          value={draftRequest.url || ''}
          onChange={(e) => onUpdateDraft({ url: e.target.value })}
          placeholder={isSocketIO ? "http://localhost:3000 or https://api.example.com" : "ws://localhost:8080/ws or wss://echo.websocket.events"}
          activeVariables={activeVars}
          aria-label="Request URL"
          containerClassName="request-command-input"
          className="request-command-input-field"
          containerStyle={{ flex: 1 }}
        />

        <button
          type="button"
          onClick={handleToggleConnection}
          className={`send-button request-send-button ${status === 'connected' ? 'danger-button' : ''}`}
          style={{
            minWidth: '110px',
            gap: '6px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...(status === 'connected' ? { backgroundColor: 'var(--color-status-error)' } : status === 'connecting' ? { backgroundColor: 'var(--color-status-warning)' } : {})
          }}
        >
          {status === 'connected' ? (
            <>
              <Square size={15} fill="#fff" /> Disconnect
            </>
          ) : status === 'connecting' ? (
            <>
              <Radio size={15} className="animate-spin" /> Connecting
            </>
          ) : (
            <>
              <Play size={15} fill="#fff" /> Connect
            </>
          )}
        </button>
      </div>

      {/* Status & Stats Bar */}
      <div className="websocket-status-bar" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 16px',
        fontSize: '11px',
        backgroundColor: 'var(--color-surface-muted)',
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 700,
            color: status === 'connected' ? 'var(--color-status-2xx)' : status === 'connecting' ? 'var(--color-status-warning)' : status === 'error' ? 'var(--color-status-error)' : 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: status === 'connected' ? 'var(--color-status-2xx)' : status === 'connecting' ? 'var(--color-status-warning)' : status === 'error' ? 'var(--color-status-error)' : 'var(--color-border-strong)',
              display: 'inline-block',
              boxShadow: status === 'connected' ? '0 0 8px var(--color-status-2xx)' : 'none'
            }} />
            {status}
          </span>
          {status === 'connected' && (
            <span style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} /> {uptimeDisplay}
            </span>
          )}
          {statusDetail && (
            <span style={{ color: 'var(--color-text-muted)', maxWidth: '350px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {statusDetail}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--color-text-muted)' }}>
          <span><ArrowUpRight size={12} style={{ display: 'inline', color: 'var(--color-accent)' }} /> <strong>{metrics.outgoing}</strong> Sent</span>
          <span><ArrowDownLeft size={12} style={{ display: 'inline', color: 'var(--color-status-2xx)' }} /> <strong>{metrics.incoming}</strong> Received</span>
          <span><strong>{formatBytes(metrics.totalBytes)}</strong> Transferred</span>
        </div>
      </div>

      {/* Main Split Area */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Left Side: Message Composer & Settings */}
        <div style={{ flex: '0 0 45%', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--color-border)', minWidth: '320px', padding: '12px', gap: '12px' }}>
          {/* Navigation Tabs */}
          <div className="tab-row" role="tablist" aria-label="WebSocket configuration">
            <button
              type="button"
              role="tab"
              className={activeTab === 'message' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('message')}
            >
              <MessageSquare size={13} style={{ marginRight: '6px' }} /> Message
            </button>
            <button
              type="button"
              role="tab"
              className={activeTab === 'handshake' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('handshake')}
            >
              <Settings2 size={13} style={{ marginRight: '6px' }} /> Settings &amp; Handshake
            </button>
            {isSocketIO && (
              <button
                type="button"
                role="tab"
                className={activeTab === 'events' ? 'tab active' : 'tab'}
                onClick={() => setActiveTab('events')}
              >
                <ListFilter size={13} style={{ marginRight: '6px' }} /> Listeners ({customEventListeners.length})
              </button>
            )}
          </div>

          {/* Tab 1: Message Composer */}
          {activeTab === 'message' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {isSocketIO && (
                <div style={{ marginBottom: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>
                      Event Name
                    </label>
                    <input
                      type="text"
                      value={socketioEvent}
                      onChange={(e) => setSocketioEvent(e.target.value)}
                      placeholder="e.g. message, chat, join-room"
                      style={{
                        width: '100%',
                        fontSize: '12px',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--color-input-bg)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)'
                      }}
                    />
                  </div>
                  <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '18px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={expectAck}
                      onChange={(e) => setExpectAck(e.target.checked)}
                    />
                    Expect ACK
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div className="script-type-segment" style={{ margin: 0 }}>
                  <button
                    type="button"
                    className={`script-type-option ${messageFormat === 'json' ? 'active' : ''}`}
                    onClick={() => setMessageFormat('json')}
                    style={{ fontSize: '11px', padding: '2px 8px' }}
                  >
                    JSON
                  </button>
                  <button
                    type="button"
                    className={`script-type-option ${messageFormat === 'text' ? 'active' : ''}`}
                    onClick={() => setMessageFormat('text')}
                    style={{ fontSize: '11px', padding: '2px 8px' }}
                  >
                    Plain Text
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  {messageFormat === 'json' && (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={handlePrettifyComposer}
                      style={{ fontSize: '11px', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      title="Format JSON"
                    >
                      <Sparkles size={11} /> Format
                    </button>
                  )}
                </div>
              </div>

              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter message payload to send..."
                style={{
                  flex: 1,
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  padding: '10px',
                  backgroundColor: 'var(--color-input-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '6px',
                  color: 'var(--color-text)',
                  resize: 'none',
                  outline: 'none',
                  minHeight: '120px'
                }}
              />

              {/* Quick Snippets & Send Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', alignSelf: 'center', marginRight: '4px' }}>
                    Presets:
                  </span>
                  {!isSocketIO ? (
                    <>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => handleApplySnippet({ payload: '{"type":"ping"}' })}
                        style={{ fontSize: '10px', padding: '2px 6px' }}
                      >
                        Ping
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => handleApplySnippet({ payload: '{\n  "action": "subscribe",\n  "channel": "feed"\n}' })}
                        style={{ fontSize: '10px', padding: '2px 6px' }}
                      >
                        Subscribe
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => handleApplySnippet({ event: 'join-room', payload: '{\n  "roomId": "main-channel"\n}' })}
                        style={{ fontSize: '10px', padding: '2px 6px' }}
                      >
                        Join Room
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => handleApplySnippet({ event: 'chat', payload: '{\n  "text": "Hello World!"\n}' })}
                        style={{ fontSize: '10px', padding: '2px 6px' }}
                      >
                        Chat
                      </button>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={status !== 'connected'}
                  className="primary-button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    fontWeight: 700,
                    fontSize: '12px',
                    opacity: status === 'connected' ? 1 : 0.5,
                    cursor: status === 'connected' ? 'pointer' : 'not-allowed'
                  }}
                  title="Send message (Cmd+Enter / Ctrl+Enter)"
                >
                  <Send size={13} /> Send
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Settings & Handshake */}
          {activeTab === 'handshake' && (
            <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
              {!isSocketIO ? (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>
                    WebSocket Sub-protocols
                  </label>
                  <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                    Comma-separated subprotocols requested during the WebSocket opening handshake (e.g. <code>graphql-ws, mqtt</code>).
                  </p>
                  <input
                    type="text"
                    value={protocolsInput}
                    onChange={(e) => setProtocolsInput(e.target.value)}
                    placeholder="e.g. graphql-transport-ws, soap"
                    style={{
                      width: '100%',
                      fontSize: '12px',
                      padding: '8px 10px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--color-input-bg)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)'
                    }}
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>
                      Socket.IO Path
                    </label>
                    <input
                      type="text"
                      value={socketioPath}
                      onChange={(e) => setSocketioPath(e.target.value)}
                      placeholder="/socket.io"
                      style={{
                        width: '100%',
                        fontSize: '12px',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--color-input-bg)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>
                      Transports
                    </label>
                    <input
                      type="text"
                      value={socketioTransports}
                      onChange={(e) => setSocketioTransports(e.target.value)}
                      placeholder="websocket,polling"
                      style={{
                        width: '100%',
                        fontSize: '12px',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--color-input-bg)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>
                      Handshake Auth Object (JSON)
                    </label>
                    <textarea
                      value={socketioAuthJson}
                      onChange={(e) => setSocketioAuthJson(e.target.value)}
                      placeholder='{"token": "Bearer 1234"}'
                      rows={4}
                      style={{
                        width: '100%',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        padding: '8px 10px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--color-input-bg)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                        resize: 'none'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Listeners */}
          {activeTab === 'events' && isSocketIO && (
            <div style={{ padding: '16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>
                Active Event Listeners
              </label>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                KobeanREST listens for all wildcard events automatically. You can register specific events to track them.
              </p>

              <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                <input
                  type="text"
                  value={newEventListenerName}
                  onChange={(e) => setNewEventListenerName(e.target.value)}
                  placeholder="New event name..."
                  style={{
                    flex: 1,
                    fontSize: '12px',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--color-input-bg)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddEventListener();
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddEventListener}
                  className="secondary-button"
                  style={{ padding: '0 10px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                >
                  <Plus size={13} /> Add
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {customEventListeners.map((evtName) => {
                  const count = packets.filter((p) => p.eventName === evtName).length;
                  return (
                    <div
                      key={evtName}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 10px',
                        backgroundColor: 'var(--color-surface-muted)',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    >
                      <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{evtName}</span>
                      <span style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        backgroundColor: count > 0 ? 'rgba(16, 185, 129, 0.15)' : 'var(--color-surface)',
                        color: count > 0 ? 'var(--color-status-2xx)' : 'var(--color-text-muted)',
                        fontWeight: 700
                      }}>
                        {count} packets
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Real-time Message Stream */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          {/* Stream Toolbar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderBottom: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            flexShrink: 0,
            gap: '8px'
          }}>
            {/* Filter Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, maxWidth: '280px' }}>
              <Search size={13} style={{ color: 'var(--color-text-muted)' }} />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter messages or events..."
                style={{
                  width: '100%',
                  fontSize: '11px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--color-input-bg)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)'
                }}
              />
            </div>

            {/* Direction Filter Pills */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['all', 'incoming', 'outgoing', 'system'] as const).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => setDirectionFilter(dir)}
                  className={directionFilter === dir ? 'ghost-button active' : 'ghost-button'}
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    textTransform: 'capitalize',
                    fontWeight: 600
                  }}
                >
                  {dir}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                />
                Auto-scroll
              </label>

              <button
                type="button"
                onClick={handleExportStream}
                className="ghost-button"
                title="Export Message Stream (JSON)"
                style={{ padding: '4px' }}
                disabled={packets.length === 0}
              >
                <Download size={13} />
              </button>

              <button
                type="button"
                onClick={() => setPackets([])}
                className="ghost-button"
                title="Clear Stream"
                style={{ padding: '4px' }}
                disabled={packets.length === 0}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Packet Timeline List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {filteredPackets.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)', gap: '8px' }}>
                <Radio size={32} opacity={0.4} />
                <span style={{ fontSize: '13px' }}>
                  {packets.length === 0 ? 'No messages sent or received yet.' : 'No messages match current filter.'}
                </span>
                <span style={{ fontSize: '11px' }}>
                  {status === 'connected' ? 'Ready to send and receive live packets.' : 'Connect to a WebSocket or Socket.IO server to begin.'}
                </span>
              </div>
            ) : (
              filteredPackets.map((pkt) => {
                const isSelected = selectedPacketId === pkt.id;
                const dateStr = new Date(pkt.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 } as any);

                return (
                  <div
                    key={pkt.id}
                    onClick={() => setSelectedPacketId(isSelected ? null : pkt.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      backgroundColor: isSelected ? 'var(--color-surface)' : 'var(--color-surface-muted)',
                      border: isSelected ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {/* Header Row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        {pkt.direction === 'incoming' ? (
                          <span style={{ color: 'var(--color-status-2xx)', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 700, fontSize: '11px' }}>
                            <ArrowDownLeft size={13} /> IN
                          </span>
                        ) : pkt.direction === 'outgoing' ? (
                          <span style={{ color: 'var(--color-accent)', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 700, fontSize: '11px' }}>
                            <ArrowUpRight size={13} /> OUT
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 700, fontSize: '11px' }}>
                            <Zap size={13} /> SYS
                          </span>
                        )}

                        {pkt.eventName && (
                          <span style={{
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            fontSize: '11px',
                            backgroundColor: 'rgba(147, 51, 234, 0.12)',
                            color: '#a855f7',
                            padding: '1px 6px',
                            borderRadius: '4px'
                          }}>
                            {pkt.eventName}
                          </span>
                        )}

                        <span style={{
                          fontFamily: 'monospace',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          color: 'var(--color-text)'
                        }}>
                          {pkt.data.length > 80 ? `${pkt.data.slice(0, 80)}...` : pkt.data}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {pkt.size > 0 && <span>{formatBytes(pkt.size)}</span>}
                        <span>{dateStr}</span>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyPacket(pkt);
                          }}
                          title="Copy payload"
                          style={{ padding: '2px 4px' }}
                        >
                          {copiedPacketId === pkt.id ? <Check size={12} color="var(--color-status-2xx)" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Detail View */}
                    {isSelected && (
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
                        <pre style={{
                          margin: 0,
                          padding: '8px',
                          backgroundColor: 'var(--color-input-bg)',
                          borderRadius: '4px',
                          fontFamily: 'monospace',
                          fontSize: '11px',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          maxHeight: '260px',
                          overflowY: 'auto'
                        }}>
                          {pkt.data}
                        </pre>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '6px' }}>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMessageText(pkt.data);
                              if (pkt.eventName) setSocketioEvent(pkt.eventName);
                              setActiveTab('message');
                            }}
                            style={{ fontSize: '11px', padding: '3px 8px' }}
                          >
                            Load into Composer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={packetsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
