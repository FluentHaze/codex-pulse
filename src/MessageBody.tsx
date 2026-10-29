import { useEffect, useRef, useState } from 'react';
import { messageContent } from '../electron/message-content';
import { t } from '../electron/i18n';

export function MessageBody({
  text,
  user,
  sessionId,
}: {
  text: string;
  user: boolean;
  sessionId: string;
}) {
  const content = messageContent(text, user);
  const dialog = useRef<HTMLDialogElement>(null);
  const [preview, setPreview] = useState<{ path: string; data?: string; error?: string } | null>(
    null,
  );
  const sequence = useRef(0);
  useEffect(
    () => () => {
      sequence.current++;
    },
    [sessionId],
  );
  const openImage = async (path: string) => {
    const request = ++sequence.current;
    setPreview({ path });
    dialog.current?.showModal();
    try {
      const data = await window.pulse!.messageImage(sessionId, path);
      if (request === sequence.current) setPreview({ path, data });
    } catch {
      if (request === sequence.current)
        setPreview({ path, error: t('图片不可用，原文件可能已移动或删除') });
    }
  };
  return (
    <>
      {content.text && <pre>{content.text}</pre>}
      {!!content.images.length && (
        <div className="message-attachments">
          {content.images.map((path) => (
            <button key={path} onClick={() => void openImage(path)} title={path}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="8" cy="8" r="1.5" />
                <path d="m3 17 6-6 4 4 3-3 5 5" />
              </svg>
              <span>{path.split(/[\\/]/).at(-1)}</span>
              <small>{t('查看图片')}</small>
            </button>
          ))}
        </div>
      )}
      <dialog
        ref={dialog}
        className="message-image-preview"
        aria-label={t('查看图片')}
        onClose={() => {
          sequence.current++;
          setPreview(null);
        }}
      >
        <header>
          <span>{preview?.path.split(/[\\/]/).at(-1)}</span>
          <button autoFocus onClick={() => dialog.current?.close()} aria-label={t('关闭')}>
            ×
          </button>
        </header>
        <div>
          {preview?.data ? (
            <img
              src={preview.data}
              alt={preview.path.split(/[\\/]/).at(-1)}
              onError={() =>
                setPreview({ path: preview.path, error: t('图片不可用，原文件可能已移动或删除') })
              }
            />
          ) : (
            <p role="status">{preview?.error ?? t('正在读取图片…')}</p>
          )}
        </div>
      </dialog>
    </>
  );
}
