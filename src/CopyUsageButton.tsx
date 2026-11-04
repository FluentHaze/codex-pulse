import { useEffect, useState } from 'react';
import { t } from '../electron/i18n';

/** Shared by the daily summary and turn drawer; copy failures keep the source visible. */
export function CopyUsageButton({ text, disabled }: { text: string; disabled?: boolean }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  useEffect(() => setStatus('idle'), [text]);
  useEffect(() => {
    if (status === 'idle') return;
    const timer = setTimeout(() => setStatus('idle'), 2400);
    return () => clearTimeout(timer);
  }, [status]);
  return (
    <span className="copy-usage">
      <button
        disabled={disabled}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setStatus('copied');
          } catch {
            setStatus('error');
          }
        }}
      >
        {t('复制用量')}
      </button>
      <span role="status">
        {status === 'copied' ? t('已复制') : status === 'error' ? t('复制失败，请重试') : ''}
      </span>
    </span>
  );
}
