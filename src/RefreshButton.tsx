import { useEffect, useRef, useState } from 'react';
import { t } from '../electron/i18n';
import { RefreshIcon } from './RefreshIcon';
import './refresh-button.css';

export function RefreshButton({
  busy,
  error,
  updatedAt,
  onClick,
  label,
  iconOnly = false,
  className = '',
}: {
  busy: boolean;
  error?: string;
  updatedAt?: number;
  onClick(): void;
  label: string;
  iconOnly?: boolean;
  className?: string;
}) {
  const [success, setSuccess] = useState(false);
  const pending = useRef<{ updatedAt?: number; started: boolean } | null>(null);

  useEffect(() => {
    if (error && !busy) {
      pending.current = null;
      setSuccess(false);
      return;
    }
    const request = pending.current;
    if (!request) return;
    if (busy) {
      request.started = true;
      return;
    }
    if (updatedAt !== request.updatedAt) {
      pending.current = null;
      setSuccess(true);
    } else if (request.started) {
      // An unchanged result must not turn a later background update into success.
      pending.current = null;
    }
  }, [busy, error, updatedAt]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(false), 1400);
    return () => clearTimeout(timer);
  }, [success]);

  const completed = success && !error;
  return (
    <button
      className={`refresh-button${iconOnly ? ' refresh-button-icon-only' : ''} ${className}`}
      data-state={busy ? 'busy' : completed ? 'success' : 'idle'}
      disabled={busy}
      aria-busy={busy}
      aria-label={label}
      title={completed && !busy ? t('刷新完成') : label}
      onClick={() => {
        pending.current = { updatedAt, started: false };
        setSuccess(false);
        onClick();
      }}
    >
      <span className="refresh-button-icon" aria-hidden="true">
        {completed && !busy ? '✓' : <RefreshIcon />}
      </span>
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}
