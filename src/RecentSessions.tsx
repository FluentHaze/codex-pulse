import { useEffect, useState } from 'react';
import { t, getLanguage } from '../electron/i18n';
import type { TokenCatalog } from '../electron/types';
import { useLanguage } from './use-language';

export function RecentSessions({
  sessionPath,
  onSelect,
}: {
  sessionPath: string;
  onSelect(id: string): void;
}) {
  useLanguage();
  const [catalog, setCatalog] = useState<TokenCatalog>();
  const [error, setError] = useState(false);
  useEffect(() => {
    let current = true;
    let running = false;
    setCatalog(undefined);
    setError(false);
    const read = async () => {
      if (running) return;
      running = true;
      try {
        const value = await window.pulse!.tokenCatalog();
        if (current) {
          setCatalog(value);
          setError(false);
        }
      } catch {
        if (current) setError(true);
      } finally {
        running = false;
      }
    };
    const readVisible = () => {
      if (document.visibilityState === 'visible') void read();
    };
    void read();
    const timer = setInterval(readVisible, 30000);
    document.addEventListener('visibilitychange', readVisible);
    return () => {
      current = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', readVisible);
    };
  }, [sessionPath]);
  return (
    <section
      className="recent-sessions"
      data-session-count={catalog ? Math.min(3, catalog.sessions.length) : undefined}
    >
      <h2>{t('最近的本机聊天')}</h2>
      {catalog?.sessions.slice(0, 5).map((session) => (
        <button onClick={() => onSelect(session.id)} key={session.id}>
          <b title={session.title}>{session.title}</b>
          <small title={session.projectName}>{session.projectName || t('未分类')}</small>
          <time>
            {new Date(session.updatedAt).toLocaleString(getLanguage(), {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>
        </button>
      ))}
      {!catalog && (
        <p className="background-status" role="status">
          {error ? t('无法读取聊天列表，请检查会话目录和访问权限') : t('正在读取聊天…')}
        </p>
      )}
      {catalog && error && (
        <p className="background-status" role="status">
          {t('无法读取聊天列表，请检查会话目录和访问权限')}
        </p>
      )}
      {catalog && !catalog.sessions.length && <p>{t('未找到本地聊天记录')}</p>}
      <button className="recent-all" onClick={() => onSelect('')}>
        {t('查看全部会话')}
      </button>
    </section>
  );
}
