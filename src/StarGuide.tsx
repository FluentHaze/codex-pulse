import { useEffect, useRef, useState } from 'react';
import { t } from '../electron/i18n';
import { useLanguage } from './use-language';

export function GitHubIcon() {
  return (
    <svg className="github-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.73 1.16 1.73 1.16 1 1.72 2.62 1.22 3.26.93.1-.72.4-1.22.71-1.5-2.5-.29-5.13-1.25-5.13-5.54 0-1.22.44-2.22 1.16-3-.12-.28-.5-1.42.11-2.96 0 0 .95-.3 3.08 1.15a10.7 10.7 0 0 1 5.6 0c2.14-1.45 3.08-1.15 3.08-1.15.62 1.54.23 2.68.12 2.96.72.78 1.15 1.78 1.15 3 0 4.3-2.63 5.25-5.14 5.53.41.35.77 1.03.77 2.08v3.1c0 .3.2.65.78.54A11.2 11.2 0 0 0 12 .8Z" />
    </svg>
  );
}

export function ExternalLinkIcon() {
  return (
    <svg
      className="github-external"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 4h6v6m0-6L10 14M10 5H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-5" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1Z" />
    </svg>
  );
}

export function StarGuide() {
  useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    let checking = false;
    const timer = setInterval(() => {
      // 等主界面稳定且无其他弹窗时再领取本机唯一一次引导。
      const show = async () => {
        if (checking || !document.hasFocus() || document.querySelector('dialog[open]')) return;
        checking = true;
        try {
          const claimed = await window.pulse?.claimStarGuide();
          clearInterval(timer);
          if (alive && claimed) {
            dialog.current?.showModal();
            dialog.current?.focus();
          }
        } finally {
          checking = false;
        }
      };
      void show().catch(() => {});
    }, 1500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  const close = () => dialog.current?.close();
  const openGitHub = async () => {
    if (busy.current) return;
    busy.current = true;
    setOpening(true);
    setError(false);
    try {
      await window.pulse?.action('github');
      close();
    } catch {
      setError(true);
    } finally {
      busy.current = false;
      setOpening(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      tabIndex={-1}
      className="star-guide"
      aria-labelledby="star-guide-title"
      aria-describedby="star-guide-description"
    >
      <button className="star-guide-close" aria-label={t('关闭')} onClick={close}>
        ×
      </button>
      <div className="star-guide-mark">
        <StarIcon />
      </div>
      <h2 id="star-guide-title">{t('喜欢 Pulse 吗？')}</h2>
      <p id="star-guide-description">
        {t('如果它让你的工作更轻松，')}
        <br />
        {t('欢迎在 GitHub 点个 Star，支持项目继续成长。')}
      </p>
      <div className="star-guide-repository">
        <GitHubIcon />
        <span>FluentHaze / codex-pulse</span>
      </div>
      <button className="star-guide-primary" onClick={() => void openGitHub()} disabled={opening}>
        <StarIcon />
        {t('去 GitHub 点个 Star')}
        <ExternalLinkIcon />
      </button>
      <button className="star-guide-skip" onClick={close}>
        {t('跳过')}
      </button>
      {error && <p role="alert">{t('无法打开 GitHub，请重试')}</p>}
    </dialog>
  );
}
