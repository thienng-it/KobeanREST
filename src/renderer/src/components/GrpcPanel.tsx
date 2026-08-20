import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Play,
  Square,
  Sparkles,
  WandSparkles,
  Copy,
  Check,
  Download,
  Trash2,
  Clock,
  Radio,
  FileCode2,
  ListFilter,
  Layers,
  MessageSquare,
  KeyRound,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Shield,
  ShieldAlert,
  Search,
  Upload
} from 'lucide-react';
import type {
  SavedRequest,
  ScopedVariable,
  GrpcProtoSchema,
  GrpcServiceDefinition,
  GrpcMethodDefinition,
  GrpcCallResult,
  GrpcStreamMessage
} from '../types';
import { MethodSelector } from './MethodSelector';
import { VariableInput } from './VariableInput';
import { parseProtoSchema, generateSampleMessageJson, SAMPLE_PROTO_DEFINITIONS } from '../services/proto-parser';
import { executeGrpcCall, GRPC_STATUS_MAP } from '../services/grpc-client';
import { formatBytes } from '../response-utils';
import { useI18n } from '../services/i18n';

interface GrpcPanelProps {
  draftRequest: SavedRequest;
  activeVars?: ScopedVariable[];
  onUpdateDraft: (fields: Partial<SavedRequest> | ((prev: SavedRequest) => Partial<SavedRequest>)) => void;
  onSaveRequest: () => void;
}

export function GrpcPanel({
  draftRequest,
  activeVars = [],
  onUpdateDraft,
  onSaveRequest,
}: GrpcPanelProps) {
  const { t } = useI18n();
  // Connection / RPC State
  const [useTls, setUseTls] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Proto Schema State
  const [protoText, setProtoText] = useState<string>(SAMPLE_PROTO_DEFINITIONS[0].proto);
  const [schema, setSchema] = useState<GrpcProtoSchema>(() => parseProtoSchema(SAMPLE_PROTO_DEFINITIONS[0].proto));

  // Selected Service and Method
  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedMethod, setSelectedMethod] = useState<string>('');

  // Active configuration tabs
  const [activeTab, setActiveTab] = useState<'message' | 'metadata' | 'proto'>('message');

  // Metadata / Custom Headers
  const [metadata, setMetadata] = useState<Array<{ key: string; value: string; enabled: boolean }>>([
    { key: 'authorization', value: 'Bearer {{token}}', enabled: false }
  ]);

  // Request Message Payload
  const [messagePayload, setMessagePayload] = useState<string>(() =>
    generateSampleMessageJson('HelloRequest', schema)
  );

  // Response & Call Results
  const [callResult, setCallResult] = useState<GrpcCallResult | null>(null);
  const [streamMessages, setStreamMessages] = useState<GrpcStreamMessage[]>([]);
  const [copiedResponse, setCopiedResponse] = useState<boolean>(false);
  const [streamFilter, setStreamFilter] = useState<string>('');

  // Parse schema when protoText updates
  useEffect(() => {
    try {
      const parsed = parseProtoSchema(protoText);
      setSchema(parsed);
      if (parsed.services.length > 0) {
        const firstSvc = parsed.services[0];
        setSelectedService(firstSvc.name);
        if (firstSvc.methods.length > 0) {
          setSelectedMethod(firstSvc.methods[0].name);
        }
      }
    } catch {
      // ignore
    }
  }, [protoText]);

  // Available services and methods
  const availableServices = useMemo(() => schema.services, [schema]);

  const currentServiceDef = useMemo(() => {
    return availableServices.find((s) => s.name === selectedService) || availableServices[0];
  }, [availableServices, selectedService]);

  const currentMethodDef = useMemo(() => {
    if (!currentServiceDef) return undefined;
    return currentServiceDef.methods.find((m) => m.name === selectedMethod) || currentServiceDef.methods[0];
  }, [currentServiceDef, selectedMethod]);

  // Variable resolution for URL
  const resolvedUrl = useMemo(() => {
    let u = draftRequest.url || 'localhost:50051';
    if (activeVars && activeVars.length > 0) {
      for (const v of activeVars) {
        if (v.key && v.value) {
          u = u.split(`{{${v.key}}}`).join(v.value);
        }
      }
    }
    return u;
  }, [draftRequest.url, activeVars]);

  // Handle Generate Payload from Schema
  const handleGeneratePayload = () => {
    if (currentMethodDef) {
      const sample = generateSampleMessageJson(currentMethodDef.requestType, schema);
      setMessagePayload(sample);
    }
  };

  // Handle Prettify JSON
  const handlePrettifyJson = () => {
    try {
      const parsed = JSON.parse(messagePayload);
      setMessagePayload(JSON.stringify(parsed, null, 2));
    } catch {
      // ignore
    }
  };

  // Handle Invoke RPC
  const handleInvokeRpc = async () => {
    if (isLoading && abortController) {
      abortController.abort();
      setIsLoading(false);
      return;
    }

    if (!selectedService || !selectedMethod) {
      return;
    }

    const controller = new AbortController();
    setAbortController(controller);
    setIsLoading(true);
    setStreamMessages([]);
    setCallResult(null);

    // Resolve metadata variables
    const resolvedMetadata = metadata.map((m) => {
      let val = m.value;
      for (const v of activeVars) {
        if (v.key && v.value) {
          val = val.split(`{{${v.key}}}`).join(v.value);
        }
      }
      return { key: m.key, value: val, enabled: m.enabled };
    });

    try {
      const result = await executeGrpcCall({
        url: resolvedUrl,
        service: selectedService,
        method: selectedMethod,
        payloadJson: messagePayload,
        metadata: resolvedMetadata,
        useTls,
        onStreamMessage: (msg) => {
          setStreamMessages((prev) => [...prev, msg]);
        },
        signal: controller.signal,
      });

      setCallResult(result);
    } catch (err: any) {
      setCallResult({
        status: 14,
        statusText: '14 UNAVAILABLE',
        durationMs: 0,
        error: err?.message || String(err),
      });
    } finally {
      setIsLoading(false);
      setAbortController(null);
    }
  };

  // Copy response
  const handleCopyResponse = () => {
    if (callResult?.responseBody) {
      navigator.clipboard.writeText(callResult.responseBody);
      setCopiedResponse(true);
      setTimeout(() => setCopiedResponse(false), 1500);
    }
  };

  // Metadata row helpers
  const handleAddMetadataRow = () => {
    setMetadata((prev) => [...prev, { key: '', value: '', enabled: true }]);
  };

  const handleUpdateMetadataRow = (index: number, field: 'key' | 'value' | 'enabled', val: any) => {
    setMetadata((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  const handleRemoveMetadataRow = (index: number) => {
    setMetadata((prev) => prev.filter((_, i) => i !== index));
  };

  // Filtered Stream Messages
  const filteredStreamMessages = useMemo(() => {
    if (!streamFilter.trim()) return streamMessages;
    const q = streamFilter.toLowerCase();
    return streamMessages.filter((m) => m.data.toLowerCase().includes(q));
  }, [streamMessages, streamFilter]);

  return (
    <div className="grpc-panel-root" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', gap: '8px', minHeight: 0, overflow: 'hidden' }}>
      {/* Top Address & Action Bar */}
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
          placeholder="localhost:50051 or grpc.postman-echo.com:443"
          activeVariables={activeVars}
          aria-label="gRPC Server URL"
          containerClassName="request-command-input"
          className="request-command-input-field"
          containerStyle={{ flex: 1 }}
        />

        {/* TLS Toggle */}
        <button
          type="button"
          onClick={() => setUseTls((prev) => !prev)}
          className="ghost-button"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '0 10px',
            height: '40px',
            fontSize: '11px',
            fontWeight: 700,
            color: useTls ? 'var(--color-status-2xx)' : 'var(--color-text-muted)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            backgroundColor: useTls ? 'rgba(16, 185, 129, 0.1)' : 'transparent'
          }}
          title={useTls ? "TLS / SSL Enabled" : "Plaintext Connection"}
        >
          {useTls ? <Shield size={14} color="var(--color-status-2xx)" /> : <ShieldAlert size={14} />}
          {useTls ? 'TLS' : 'Insecure'}
        </button>

        {/* Invoke Button */}
        <button
          type="button"
          onClick={handleInvokeRpc}
          className={`send-button request-send-button ${isLoading ? 'danger-button' : ''}`}
          style={{
            minWidth: '130px',
            gap: '6px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...(isLoading ? { backgroundColor: 'var(--color-status-error)' } : {})
          }}
        >
          {isLoading ? (
            <>
              <Square size={15} fill="#fff" /> {t('grpc.cancel')}
            </>
          ) : (
            <>
              <Play size={15} fill="#fff" /> {t('grpc.invokeRpc')}
            </>
          )}
        </button>
      </div>

      {/* Service & Method Selector Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        fontSize: '12px',
        backgroundColor: 'var(--color-surface-muted)',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        flexShrink: 0,
        gap: '12px'
      }}>
        {/* Service Picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Service:
          </span>
          <select
            value={selectedService}
            onChange={(e) => {
              setSelectedService(e.target.value);
              const svc = availableServices.find((s) => s.name === e.target.value);
              if (svc && svc.methods.length > 0) {
                setSelectedMethod(svc.methods[0].name);
              }
            }}
            style={{
              flex: 1,
              padding: '4px 8px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: 'var(--color-input-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              color: 'var(--color-text)'
            }}
          >
            {availableServices.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Method Picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Method:
          </span>
          <select
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value)}
            style={{
              flex: 1,
              padding: '4px 8px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: 'var(--color-input-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              color: 'var(--color-text)'
            }}
          >
            {currentServiceDef?.methods.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name} ({m.requestType} → {m.responseType})
              </option>
            ))}
          </select>
        </div>

        {/* RPC Type Badge */}
        {currentMethodDef && (
          <span style={{
            fontSize: '10px',
            fontWeight: 800,
            letterSpacing: '0.05em',
            padding: '3px 8px',
            borderRadius: '12px',
            backgroundColor:
              currentMethodDef.rpcType === 'unary' ? 'rgba(99, 102, 241, 0.15)' :
              currentMethodDef.rpcType === 'server-streaming' ? 'rgba(59, 130, 246, 0.15)' :
              currentMethodDef.rpcType === 'client-streaming' ? 'rgba(6, 182, 212, 0.15)' :
              'rgba(16, 185, 129, 0.15)',
            color:
              currentMethodDef.rpcType === 'unary' ? '#818cf8' :
              currentMethodDef.rpcType === 'server-streaming' ? '#60a5fa' :
              currentMethodDef.rpcType === 'client-streaming' ? '#22d3ee' :
              '#34d399',
            textTransform: 'uppercase'
          }}>
            {currentMethodDef.rpcType.replace('-', ' ')}
          </span>
        )}
      </div>

      {/* Main Split Area */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: '10px', overflow: 'hidden' }}>
        {/* Left Side: Configuration Tabs */}
        <div style={{ flex: '0 0 48%', display: 'flex', flexDirection: 'column', minWidth: '320px', gap: '8px' }}>
          {/* Navigation Tabs */}
          <div className="tab-row" role="tablist" aria-label="gRPC configuration">
            <button
              type="button"
              role="tab"
              className={activeTab === 'message' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('message')}
            >
              <MessageSquare size={13} style={{ marginRight: '6px' }} /> {t('grpc.tabMessage')}
            </button>
            <button
              type="button"
              role="tab"
              className={activeTab === 'metadata' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('metadata')}
            >
              <KeyRound size={13} style={{ marginRight: '6px' }} /> {t('grpc.tabMetadata')} ({metadata.filter(m => m.enabled).length})
            </button>
            <button
              type="button"
              role="tab"
              className={activeTab === 'proto' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('proto')}
            >
              <FileCode2 size={13} style={{ marginRight: '6px' }} /> {t('grpc.tabProto')}
            </button>
          </div>

          {/* Tab 1: Request Message */}
          {activeTab === 'message' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '10px', backgroundColor: 'var(--color-surface-muted)', border: '1px solid var(--color-border)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  JSON Payload ({currentMethodDef?.requestType || 'Request'})
                </span>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={handleGeneratePayload}
                    style={{ fontSize: '11px', padding: '2px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Generate default JSON message from Proto definition"
                  >
                    <WandSparkles size={12} /> Generate
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={handlePrettifyJson}
                    style={{ fontSize: '11px', padding: '2px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Format JSON"
                  >
                    <Sparkles size={12} /> Format
                  </button>
                </div>
              </div>

              <textarea
                value={messagePayload}
                onChange={(e) => setMessagePayload(e.target.value)}
                placeholder="Enter JSON message payload..."
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
                  minHeight: '160px'
                }}
              />
            </div>
          )}

          {/* Tab 2: Metadata */}
          {activeTab === 'metadata' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '10px', backgroundColor: 'var(--color-surface-muted)', border: '1px solid var(--color-border)', borderRadius: '12px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  Custom gRPC Metadata / Headers
                </span>
                <button
                  type="button"
                  onClick={handleAddMetadataRow}
                  className="ghost-button"
                  style={{ fontSize: '11px', padding: '2px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={12} /> Add Row
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {metadata.map((m, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="checkbox"
                      checked={m.enabled}
                      onChange={(e) => handleUpdateMetadataRow(idx, 'enabled', e.target.checked)}
                    />
                    <input
                      type="text"
                      value={m.key}
                      onChange={(e) => handleUpdateMetadataRow(idx, 'key', e.target.value)}
                      placeholder="key (e.g. authorization)"
                      style={{
                        flex: 1,
                        fontSize: '11px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--color-input-bg)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)'
                      }}
                    />
                    <input
                      type="text"
                      value={m.value}
                      onChange={(e) => handleUpdateMetadataRow(idx, 'value', e.target.value)}
                      placeholder="value"
                      style={{
                        flex: 1,
                        fontSize: '11px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--color-input-bg)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveMetadataRow(idx)}
                      className="ghost-button"
                      style={{ padding: '4px' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Proto Schema */}
          {activeTab === 'proto' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '10px', backgroundColor: 'var(--color-surface-muted)', border: '1px solid var(--color-border)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
                <select
                  onChange={(e) => {
                    const preset = SAMPLE_PROTO_DEFINITIONS.find((p) => p.label === e.target.value);
                    if (preset) setProtoText(preset.proto);
                  }}
                  style={{
                    fontSize: '11px',
                    padding: '2px 6px',
                    backgroundColor: 'var(--color-input-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '4px',
                    color: 'var(--color-text)'
                  }}
                >
                  <option value="">Presets...</option>
                  {SAMPLE_PROTO_DEFINITIONS.map((p) => (
                    <option key={p.label} value={p.label}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                value={protoText}
                onChange={(e) => setProtoText(e.target.value)}
                placeholder="Paste or write your Protobuf (.proto) schema definition here..."
                style={{
                  flex: 1,
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  padding: '10px',
                  backgroundColor: 'var(--color-input-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '6px',
                  color: 'var(--color-text)',
                  resize: 'none',
                  outline: 'none',
                  minHeight: '160px'
                }}
              />
            </div>
          )}
        </div>

        {/* Right Side: Response & Stream Timeline */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, backgroundColor: 'var(--color-surface-muted)', border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden' }}>
          {/* Response Header Status Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            backgroundColor: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Response
              </span>
              {callResult && (
                <span style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  backgroundColor: callResult.status === 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: callResult.status === 0 ? 'var(--color-status-2xx)' : 'var(--color-status-error)',
                }}>
                  {callResult.statusText}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
              {callResult && (
                <>
                  <span><Clock size={11} style={{ display: 'inline', marginRight: '3px' }} />{callResult.durationMs}ms</span>
                  {callResult.responseBody && (
                    <span>{formatBytes(new Blob([callResult.responseBody]).size)}</span>
                  )}
                </>
              )}
              {callResult?.responseBody && (
                <button
                  type="button"
                  onClick={handleCopyResponse}
                  className="ghost-button"
                  style={{ padding: '2px 6px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  title="Copy Response"
                >
                  {copiedResponse ? <Check size={12} color="var(--color-status-2xx)" /> : <Copy size={12} />}
                  {copiedResponse ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
          </div>

          {/* Response Body or Streaming Timeline */}
          <div style={{ flex: 1, padding: '10px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {!callResult && streamMessages.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)', gap: '8px' }}>
                <Layers size={32} opacity={0.4} />
                <span style={{ fontSize: '13px' }}>Ready to invoke gRPC RPC.</span>
                <span style={{ fontSize: '11px' }}>Select a service and method, configure your message payload, then click Invoke RPC.</span>
              </div>
            ) : callResult?.error ? (
              <div style={{ padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '6px', color: 'var(--color-status-error)', fontSize: '12px' }}>
                <strong>gRPC Call Failed:</strong>
                <pre style={{ margin: '6px 0 0 0', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                  {callResult.error}
                </pre>
              </div>
            ) : (
              <pre style={{
                margin: 0,
                padding: '10px',
                backgroundColor: 'var(--color-input-bg)',
                borderRadius: '6px',
                fontFamily: 'monospace',
                fontSize: '12px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                color: 'var(--color-text)',
                flex: 1,
                overflowY: 'auto'
              }}>
                {callResult?.responseBody || JSON.stringify(streamMessages, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
