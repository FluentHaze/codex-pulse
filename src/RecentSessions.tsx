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
    setCatalog(undefined);
    setError(false);
    void window.pulse
      ?.tokenCatalog()
      .then((value) => {
        if (current) setCatalog(value);
      })
      .catch(() => {
        if (current) setError(true);
      });
    return () => {
      current = false;
    };
  }, [sessionPath]);
  return (
    <section className="recent-sessions">
      <h2>{t('最近的本机聊天')}</h2>
      {catalog?.sessions.slice(0, 3).map((session) => (
        <button onClick={() => onSelect(session.id)} key={session.id}>
          <b>{session.title}</b>
          <small>{session.projectName || t('未分类')}</small>
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
      {catalog && !catalog.sessions.length && <p>{t('未找到本地聊天记录')}</p>}
      <button className="recent-all" onClick={() => onSelect('')}>
        {t('查看全部会话')}
      </button>
    </section>
  );
}
