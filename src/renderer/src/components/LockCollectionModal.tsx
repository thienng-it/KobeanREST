import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Eye, EyeOff, ShieldCheck, ShieldAlert, KeyRound, X, AlertCircle } from 'lucide-react';
import type { CollectionLockConfig } from '../types';

export type LockModalMode = 'lock' | 'unlock' | 'remove-lock';

export interface LockCollectionModalProps {
  open: boolean;
  mode: LockModalMode;
  collectionId: string;
  collectionName: string;
  lockConfig?: CollectionLockConfig | null;
  onClose: () => void;
  onSetLock: (collectionId: string, password: string, hint?: string) => Promise<void>;
  onUnlock: (collectionId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  onRemoveLock: (collectionId: string, password: string) => Promise<{ success: boolean; error?: string }>;
}

export function LockCollectionModal({
  open,
  mode,
  collectionId,
  collectionName,
  lockConfig,
  onClose,
  onSetLock,
  onUnlock,
  onRemoveLock,
}: LockCollectionModalProps) {
  const [activeMode, setActiveMode] = useState<LockModalMode>(mode);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hint, setHint] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setActiveMode(mode);
      setPassword('');
      setConfirmPassword('');
      setHint(lockConfig?.hint || '');
      setError(null);
      setShowPassword(false);
      setIsSubmitting(false);
    }
  }, [open, mode, lockConfig]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password.trim()) {
      setError('Please enter a PIN or password.');
      return;
    }

    if (activeMode === 'lock') {
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please re-enter.');
        return;
      }
      if (password.length < 3) {
        setError('Password must be at least 3 characters.');
        return;
      }

      setIsSubmitting(true);
      try {
        await onSetLock(collectionId, password, hint);
        onClose();
      } catch (err: any) {
        setError(err?.message || 'Failed to set lock.');
      } finally {
        setIsSubmitting(false);
      }
    } else if (activeMode === 'unlock') {
      setIsSubmitting(true);
      try {
        const res = await onUnlock(collectionId, password);
        if (res.success) {
          onClose();
        } else {
          setError(res.error || 'Incorrect PIN or password.');
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to unlock collection.');
      } finally {
        setIsSubmitting(false);
      }
    } else if (activeMode === 'remove-lock') {
      setIsSubmitting(true);
      try {
        const res = await onRemoveLock(collectionId, password);
        if (res.success) {
          onClose();
        } else {
          setError(res.error || 'Incorrect PIN or password.');
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to remove lock.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`${activeMode === 'lock' ? 'Lock' : activeMode === 'unlock' ? 'Unlock' : 'Remove Lock'} ${collectionName}`}
      onClick={onClose}
      style={{ zIndex: 10000 }}
    >
      <div
        className="modal settings-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '440px',
          maxWidth: '92vw',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          borderRadius: '12px',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.35)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor:
                  activeMode === 'lock'
                    ? 'rgba(59, 130, 246, 0.12)'
                    : activeMode === 'unlock'
                    ? 'rgba(16, 185, 129, 0.12)'
                    : 'rgba(239, 68, 68, 0.12)',
                color:
                  activeMode === 'lock'
                    ? 'var(--color-primary, #3b82f6)'
                    : activeMode === 'unlock'
                    ? 'var(--color-status-2xx, #10b981)'
                    : 'var(--color-status-error, #ef4444)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {activeMode === 'lock' ? <Lock size={18} /> : activeMode === 'unlock' ? <KeyRound size={18} /> : <Unlock size={18} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>
                {activeMode === 'lock'
                  ? 'Lock Collection'
                  : activeMode === 'unlock'
                  ? 'Unlock Collection'
                  : 'Remove Collection Lock'}
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                {collectionName}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="settings-close"
            aria-label="Close"
            onClick={onClose}
            style={{ all: 'unset', cursor: 'pointer', color: 'var(--color-text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-soft)', lineHeight: 1.4 }}>
            {activeMode === 'lock'
              ? 'Protect this collection with a secret PIN or password. Requests and folders inside cannot be accessed without unlocking.'
              : activeMode === 'unlock'
              ? `Enter the PIN or password to unlock "${collectionName}" for this session.`
              : `Enter the current PIN or password to permanently remove passcode lock from "${collectionName}".`}
          </p>

          {/* Hint Notice */}
          {activeMode === 'unlock' && lockConfig?.hint && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: 'var(--color-surface-muted)',
                border: '1px solid var(--color-border)',
                fontSize: '12px',
                color: 'var(--color-text-muted)',
              }}
            >
              <ShieldCheck size={14} color="var(--color-primary)" />
              <span>
                <strong>Hint:</strong> {lockConfig.hint}
              </span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--color-status-error)',
                fontSize: '12px',
                color: 'var(--color-status-error)',
              }}
            >
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* Password / PIN Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-soft)' }}>
              {mode === 'lock' ? 'New PIN / Passphrase' : 'PIN / Passphrase'}
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter PIN or password…"
                autoFocus
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '8px 36px 8px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface-muted)',
                  color: 'var(--color-text)',
                  fontSize: '13px',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                style={{
                  all: 'unset',
                  position: 'absolute',
                  right: '10px',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                }}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Confirm Password (Lock Mode Only) */}
          {activeMode === 'lock' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-soft)' }}>
                Confirm PIN / Passphrase
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter PIN or password…"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface-muted)',
                  color: 'var(--color-text)',
                  fontSize: '13px',
                }}
              />
            </div>
          )}

          {/* Optional Hint (Lock Mode Only) */}
          {activeMode === 'lock' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-soft)' }}>
                Password Hint (Optional)
              </label>
              <input
                type="text"
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                placeholder="e.g. My team project code"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface-muted)',
                  color: 'var(--color-text)',
                  fontSize: '13px',
                }}
              />
            </div>
          )}

          {/* Mode Switching Helper */}
          {activeMode === 'unlock' && (
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', paddingTop: '4px' }}>
              Want to remove PIN protection?{' '}
              <button
                type="button"
                onClick={() => {
                  setActiveMode('remove-lock');
                  setError(null);
                }}
                style={{
                  all: 'unset',
                  color: 'var(--color-status-error, #ef4444)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontWeight: 500,
                }}
              >
                Remove passcode lock permanently
              </button>
            </div>
          )}

          {activeMode === 'remove-lock' && (
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', paddingTop: '4px' }}>
              Just want temporary access?{' '}
              <button
                type="button"
                onClick={() => {
                  setActiveMode('unlock');
                  setError(null);
                }}
                style={{
                  all: 'unset',
                  color: 'var(--color-primary, #3b82f6)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontWeight: 500,
                }}
              >
                Unlock for this session instead
              </button>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button
              type="button"
              className="ghost-button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{ padding: '6px 14px', fontSize: '13px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`send-button ${activeMode === 'remove-lock' ? 'danger-button' : ''}`}
              disabled={isSubmitting || !password.trim()}
              style={{
                padding: '6px 16px',
                fontSize: '13px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                ...(activeMode === 'remove-lock' ? { backgroundColor: 'var(--color-status-error)' } : {}),
              }}
            >
              {activeMode === 'lock' ? (
                <>
                  <Lock size={14} /> Set Lock
                </>
              ) : activeMode === 'unlock' ? (
                <>
                  <Unlock size={14} /> Unlock Collection
                </>
              ) : (
                <>
                  <Unlock size={14} /> Remove Passcode Lock
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * In-place lock gate displayed when an active tab belongs to a locked collection.
 */
export function LockedCollectionGate({
  collectionName,
  hint,
  onUnlock,
  onRemoveLock,
}: {
  collectionName: string;
  hint?: string;
  onUnlock: (password: string) => Promise<{ success: boolean; error?: string }>;
  onRemoveLock?: () => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await onUnlock(password);
      if (!res.success) {
        setError(res.error || 'Incorrect PIN or password.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to unlock.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="locked-collection-gate"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        padding: '32px',
        textAlign: 'center',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '16px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          color: 'var(--color-status-error, #ef4444)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
        }}
      >
        <Lock size={28} />
      </div>

      <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: 'var(--color-text)' }}>
        Collection is Locked
      </h2>
      <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--color-text-muted)', maxWidth: '380px' }}>
        This request belongs to <strong>{collectionName}</strong>, which is protected with a PIN/password. Unlock to view and execute.
      </p>

      {hint && (
        <div
          style={{
            marginBottom: '16px',
            padding: '6px 12px',
            borderRadius: '6px',
            backgroundColor: 'var(--color-surface-muted)',
            border: '1px solid var(--color-border)',
            fontSize: '12px',
            color: 'var(--color-text-muted)',
          }}
        >
          💡 <strong>Hint:</strong> {hint}
        </div>
      )}

      {error && (
        <div
          style={{
            marginBottom: '16px',
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--color-status-error)',
            fontSize: '12px',
            color: 'var(--color-status-error)',
          }}
        >
          {error}
        </div>
      )}

      <form
        onSubmit={handleUnlockSubmit}
        style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '340px' }}
      >
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter PIN to unlock…"
            autoFocus
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '8px 36px 8px 10px',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface-muted)',
              color: 'var(--color-text)',
              fontSize: '13px',
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            style={{
              all: 'unset',
              position: 'absolute',
              right: '10px',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
            }}
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        <button
          type="submit"
          className="send-button"
          disabled={isSubmitting || !password.trim()}
          style={{ padding: '8px 16px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Unlock size={14} /> Unlock
        </button>
      </form>

      {onRemoveLock && (
        <button
          type="button"
          onClick={onRemoveLock}
          style={{
            all: 'unset',
            marginTop: '16px',
            fontSize: '12px',
            color: 'var(--color-status-error, #ef4444)',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Permanently remove passcode lock…
        </button>
      )}
    </div>
  );
}
