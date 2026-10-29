import { MessageBody } from './MessageBody';
import { avatarDataUrl } from './avatar';
import gptAvatar from '../assets/gpt-avatar.svg';
import { Select } from './Select';
/**
 * 本机会话列表与逐轮明细。目录、筛选条件和当前会话各自刷新，过期响应不覆盖新选择。
 */
import { useLanguage } from './use-language';
import { t, getLanguage } from '../electron/i18n';
import { memo, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import type { TokenCatalog, TokenSession, TokenCounts, DailyStats } from '../electron/types';
import { filterSessions, type DateFilter } from './session-filter';
const count = (value: number | null | undefined) =>
  value == null ? '—' : value.toLocaleString(getLanguage());
const compactFormatter = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 2,
});
const compactCount = (value: number | null | undefined) =>
  value == null ? '—' : compactFormatter.format(value);
const date = (value: string | number | null) =>
  value
    ? new Date(value).toLocaleString(getLanguage(), {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : t('时间未知');

// 附件包装保留在展开的原文中；列表摘要优先展示用户的实际请求。
const messagePreview = (text: string | undefined) =>
  text
    ?.split(/(?:^|\n)## My request:\s*\n/)
    .at(-1)
    ?.replace(/<\/?image\b[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim() || t('用户消息未记录');

const catalogs = new Map<string, TokenCatalog>();
const details = new Map<string, TokenSession>();
const scopes = new Map<string, DailyStats>();
const remember = <T,>(map: Map<string, T>, key: string, value: T) => {
  if (map.size >= 8) map.delete(map.keys().next().value!);
  map.set(key, value);
};
export const TokenDetails = memo(function TokenDetails({
  sessionPath,
  watchedSessionId,
  initialSessionId = '',
  account = '',
}: {
  sessionPath: string;
  watchedSessionId: string;
  initialSessionId?: string;
  account?: string;
}) {
  const language = useLanguage();
  const statusNames = {
    running: t('进行中'),
    completed: t('已完成'),
    interrupted: t('已中断'),
    unknown: t('未结束'),
  };
  const [catalog, setCatalog] = useState<TokenCatalog | undefined>(() => catalogs.get(sessionPath));
  const [selected, setSelected] = useState(initialSessionId);
  const [scope, setScope] = useState<DailyStats>();
  const [storedDetail, setDetail] = useState<TokenSession>();
  const [listBusy, setListBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(100);
  const [turnPage, setTurnPage] = useState(0);
  const [openedTurn, setOpenedTurn] = useState<string | null>(null);
  const drawer = useRef<HTMLDialogElement>(null);
  const drawerBackdropPressed = useRef(false);
  useEffect(() => {
    setTurnPage(0);
    setOpenedTurn(null);
  }, [selected, sessionPath]);
  const [project, setProject] = useState('*');
  const [period, setPeriod] = useState<DateFilter>('all');
  const [filterNow, setFilterNow] = useState(Date.now());
  const visibleSessions = useMemo(
    () => filterSessions(catalog?.sessions ?? [], query, project, period, new Date(filterNow)),
    [catalog, query, project, period, filterNow],
  );
  const projects = useMemo(
    () =>
      [
        ...new Map([
          ...(catalog?.projects ?? []).map((project) => [project.id, project.name] as const),
          ...(catalog?.sessions ?? []).map(
            (session) =>
              [
                session.project ?? '',
                session.projectName || session.project || t('未分类'),
              ] as const,
          ),
        ]).entries(),
      ].sort((a, b) => {
        const rank = ([id, label]: [string, string]) =>
          !id ? 2 : /^(?:\/|[a-z]:[\\/]|\\\\)/i.test(label) ? 1 : 0;
        return rank(a) - rank(b) || a[1].localeCompare(b[1], getLanguage());
      }),
    [catalog, language],
  );
  useEffect(() => {
    const timer = setInterval(() => setFilterNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (catalog)
      setSelected((previous) =>
        visibleSessions.some((session) => session.id === previous) ? previous : '',
      );
  }, [catalog, visibleSessions]);
  const clearFilters = () => {
    setQuery('');
    setProject('*');
    setPeriod('all');
  };
  const detail =
    storedDetail?.id === selected && visibleSessions.some((session) => session.id === selected)
      ? storedDetail
      : undefined;
  const currentTurnPage = Math.min(
    turnPage,
    Math.max(0, Math.ceil((detail?.turns.length ?? 0) / 30) - 1),
  );
  const activeTurn = detail?.turns.find((turn) => turn.id === openedTurn);
  useEffect(() => {
    const dialog = drawer.current;
    if (activeTurn && dialog && !dialog.open) dialog.showModal();
    if (!activeTurn && dialog?.open) dialog.close();
  }, [activeTurn]);
  const panelScroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panelScroll.current?.scrollTo({ top: 0, left: 0 });
  }, [selected, currentTurnPage]);
  const catalogRequest = useRef(0);
  const selectLatest = useRef(!initialSessionId);
  const mounted = useRef(true);
  const loadingDetail = useRef(false);
  const loadCatalog = useCallback(
    async (force = false) => {
      const request = ++catalogRequest.current;
      setListBusy(true);
      setError('');
      try {
        const next = await window.pulse!.tokenCatalog(force);
        if (!mounted.current || catalogRequest.current !== request) return;
        remember(catalogs, sessionPath, next);
        setCatalog(next);
        const fallback = selectLatest.current ? (next.sessions[0]?.id ?? '') : '';
        selectLatest.current = false;
        setSelected((previous) =>
          next.sessions.some((session) => session.id === previous) ? previous : fallback,
        );
      } catch {
        if (mounted.current && catalogRequest.current === request)
          setError('无法读取聊天列表，请检查会话目录和访问权限');
      } finally {
        if (mounted.current && catalogRequest.current === request) setListBusy(false);
      }
    },
    [sessionPath],
  );
  useEffect(() => {
    mounted.current = true;
    setCatalog(catalogs.get(sessionPath));
    selectLatest.current = !initialSessionId;
    setSelected(initialSessionId);
    setDetail(undefined);
    setProject('*');
    void loadCatalog(false);
    return () => {
      mounted.current = false;
      catalogRequest.current++;
    };
  }, [sessionPath, loadCatalog, initialSessionId]);
  useEffect(() => {
    let current = true;
    let request = 0;
    loadingDetail.current = false;
    setDetail(details.get(`${sessionPath}|${selected}`));
    if (!selected) {
      setBusy(false);
      return;
    }
    const read = async () => {
      if (loadingDetail.current) return;
      loadingDetail.current = true;
      const sequence = ++request;
      setBusy(true);
      try {
        const next = await window.pulse!.tokenSession(selected);
        if (current && sequence === request) {
          remember(details, `${sessionPath}|${selected}`, next);
          setDetail(next);
          setError('');
        }
      } catch (failure) {
        if (current && sequence === request)
          setError(
            failure instanceof Error
              ? failure.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
              : t('读取统计失败，请重试'),
          );
      } finally {
        if (current && sequence === request) {
          loadingDetail.current = false;
          setBusy(false);
        }
      }
    };
    void read();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void read();
    }, 15000);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [selected, reload, sessionPath]);
  const scopeIds = useMemo(() => visibleSessions.map((session) => session.id), [visibleSessions]);
  useEffect(() => {
    if (selected || !catalog) return;
    let current = true,
      running = false;
    const scopeKey = JSON.stringify([sessionPath, scopeIds]);
    setScope(scopes.get(scopeKey));
    const read = async () => {
      if (running) return;
      running = true;
      setBusy(true);
      try {
        const next = await window.pulse!.scopeUsage(scopeIds);
        if (current) {
          remember(scopes, scopeKey, next);
          setScope(next);
          setError('');
        }
      } catch {
        if (current) setError('无法汇总项目用量，请刷新重试');
      } finally {
        running = false;
        if (current) setBusy(false);
      }
    };
    void read();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void read();
    }, 30000);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [selected, scopeIds, catalog, reload, sessionPath]);
  const refresh = async () => {
    await loadCatalog(true);
    if (mounted.current) setReload((value) => value + 1);
  };
  const chooseDirectory = () => {
    void window.pulse!.action('choose-sessions').catch(() => {
      if (mounted.current) setError('无法打开目录选择器，请稍后重试');
    });
  };
  const resetDirectory = () => {
    void window.pulse!.settings({ sessionPath: '' }).catch(() => {
      if (mounted.current) setError('恢复默认目录失败，请重试');
    });
  };
  const track = (id: string) => {
    void window.pulse!.settings({ watchedSessionId: id }).catch(() => {
      if (mounted.current) setError('设置悬浮窗跟踪失败，请重试');
    });
  };
  const totals = detail?.turns.reduce<{
    count: number;
    tokens: number;
  }>(
    (sum, turn) => {
      if (turn.tokens?.total != null) {
        sum.count++;
        sum.tokens += turn.tokens.total;
      }
      return sum;
    },
    { count: 0, tokens: 0 },
  );
  const columns: {
    key: keyof TokenCounts;
    label: string;
    title: string;
  }[] = [
    { key: 'input', label: t('输入'), title: t('包含上下文、工具结果及缓存输入') },
    { key: 'cachedInput', label: t('缓存输入'), title: t('已计入输入 Token，不重复加总') },
    { key: 'output', label: t('输出'), title: t('模型输出 Token') },
    {
      key: 'reasoning',
      label: t('推理'),
      title: t('已计入输出 Token，不重复加总；未提供时显示 —'),
    },
    { key: 'total', label: t('合计'), title: t('采用记录中的总量，不将缓存和推理重复相加') },
  ];
  return (
    <section className="token-details" aria-label={t('Token 明细')}>
      <div className="token-scope">
        <span>{t('本机历史记录')}</span>
        <p>{t('按轮次统计，一轮可能包含多次模型调用。历史记录不按当前登录账号筛选。')}</p>
      </div>
      <div className="chat-filters">
        <label>
          {t('搜索聊天')}
          <input
            type="search"
            aria-label={t('搜索聊天')}
            placeholder={t('搜索标题或项目路径')}
            maxLength={100}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          {t('项目')}
          <Select
            aria-label={t('筛选项目')}
            value={project}
            onValueChange={(value) => {
              setProject(value);
              setSelected('');
            }}
          >
            <option value="*">{t('全部项目')}</option>
            {projects.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label>
          {t('更新时间')}
          <Select
            aria-label={t('筛选更新时间')}
            value={period}
            onValueChange={(value) => setPeriod(value as DateFilter)}
          >
            <option value="all">{t('全部时间')}</option>
            <option value="today">{t('今天')}</option>
            <option value="7d">{t('近 7 天')}</option>
            <option value="30d">{t('近 30 天')}</option>
          </Select>
        </label>
        <button disabled={listBusy} onClick={() => void refresh()}>
          {listBusy ? t('读取中…') : t('刷新记录')}
        </button>
      </div>
      <div className="filter-result">
        <span>{t('匹配 {0} 条聊天', [visibleSessions.length])}</span>
        {(query || project !== '*' || period !== 'all') && (
          <button onClick={clearFilters}>{t('清空筛选')}</button>
        )}
      </div>
      <div className="token-controls">
        <span className="background-status" role="status">
          {listBusy || busy ? t('正在后台更新，可继续查看已有记录') : ''}
        </span>
      </div>
      <div className="token-workspace">
        <aside className="token-session-list" aria-label={t('选择聊天')}>
          <button
            className={!selected ? 'active' : ''}
            aria-pressed={!selected}
            onClick={() => setSelected('')}
          >
            {t('全部匹配聊天的总用量')}
          </button>
          {visibleSessions.slice(0, visibleCount).map((session) => (
            <button
              className={
                selected === session.id ? 'active token-session-option' : 'token-session-option'
              }
              data-id={session.id}
              aria-pressed={selected === session.id}
              title={session.title}
              onClick={() => {
                setSelected(session.id);
                setError('');
              }}
              key={session.id}
            >
              <b>{session.title}</b>
              <small>
                {session.projectName || t('未分类')} · {date(session.updatedAt)}
              </small>
            </button>
          ))}
          {visibleSessions.length > visibleCount && (
            <button onClick={() => setVisibleCount((count) => count + 100)}>
              {t('显示更多会话')}
            </button>
          )}
          {listBusy && !catalog && (
            <p className="token-loading" role="status">
              {t('正在读取聊天…')}
            </p>
          )}
        </aside>
        <div className="token-detail-panel" aria-busy={busy} ref={panelScroll}>
          {busy && (selected ? !detail : !scope) && (
            <div className="token-content-loading" role="status">
              <span className="token-loading-line" />
              <span>{selected ? t('正在读取轮次…') : t('正在汇总项目用量…')}</span>
              <div className="token-skeleton" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
            </div>
          )}
          {selected && (
            <header className="token-detail-heading">
              <div className="token-heading-name">
                <h2
                  className="token-selected-title"
                  title={visibleSessions.find((session) => session.id === selected)?.title}
                >
                  {visibleSessions.find((session) => session.id === selected)?.title ||
                    t('匹配聊天总用量')}
                </h2>
                <span>
                  {detail
                    ? t('{0} 轮对话，{1} 轮有统计', [detail.turns.length, totals?.count ?? 0])
                    : t('正在读取轮次…')}
                </span>
              </div>
              {selected && (
                <strong
                  className="token-heading-total"
                  title={`${count(totals?.count ? totals.tokens : null)} Token`}
                >
                  {totals?.count ? compactCount(totals.tokens) : '—'}
                  <small>Token</small>
                </strong>
              )}
              <button
                className="token-pin"
                aria-label={t('固定跟踪此聊天')}
                title={t(
                  watchedSessionId === selected ? '悬浮窗已固定跟踪当前聊天' : '固定跟踪此聊天',
                )}
                aria-pressed={!!selected && watchedSessionId === selected}
                disabled={!selected || watchedSessionId === selected}
                onClick={() => track(selected)}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden="true"
                >
                  <path d="m16 3 5 5-4 1-4 5v3l-2 2-3-5-5-3 2-2h3l5-4zM8 16l-5 5" />
                </svg>
              </button>
              {watchedSessionId && (
                <button className="token-unpin" onClick={() => track('')}>
                  {t('恢复自动跟随')}
                </button>
              )}
            </header>
          )}
          {error && (
            <div className="alert" role="alert">
              {t(error ?? '')}
            </div>
          )}
          {!listBusy && catalog && !catalog.sessions.length ? (
            <div className="empty">
              <h2>{t('未找到本地聊天记录')}</h2>
              <p>{t('请先在本机使用 Codex，或选择包含 rollout JSONL 文件的 sessions 目录。')}</p>
              <button onClick={chooseDirectory}>{t('选择会话目录')}</button>
            </div>
          ) : catalog && !visibleSessions.length ? (
            <div className="empty">
              <h2>{t('没有匹配的聊天')}</h2>
              <p>{t('尝试其他关键词、项目或更新时间。')}</p>
              <button onClick={clearFilters}>{t('清空筛选条件')}</button>
            </div>
          ) : (
            <>
              {!selected && (
                <div
                  className={`token-summary ${busy && (selected ? !detail : !scope) ? 'loading-summary' : ''}`}
                >
                  <div>
                    <span>
                      {selected
                        ? t('当前聊天已记录用量')
                        : project === '*'
                          ? t('匹配聊天总用量')
                          : t('当前项目总用量')}
                    </span>
                    <strong
                      title={`${count(selected ? (totals?.count ? totals.tokens : null) : scope?.tokens.total)} Token`}
                    >
                      {selected
                        ? totals?.count
                          ? compactCount(totals.tokens)
                          : '—'
                        : compactCount(scope?.tokens.total)}
                      <small>Token</small>
                    </strong>
                  </div>
                  <p>
                    {!selected
                      ? scope
                        ? t('{0} 条聊天，{1} 轮有统计', [visibleSessions.length, scope.turnCount])
                        : t('正在汇总项目用量…')
                      : detail
                        ? t('{0} 轮对话，{1} 轮有统计', [detail.turns.length, totals?.count ?? 0])
                        : t('正在读取轮次…')}
                    <span>{t('缓存输入已含在输入中，推理已含在输出中。')}</span>
                  </p>
                </div>
              )}
              {!selected && scope && (
                <div className="daily-metrics">
                  {columns
                    .filter((column) => column.key !== 'total')
                    .map((column) => (
                      <section key={column.key}>
                        <span>{column.label}</span>
                        <strong title={`${count(scope.tokens[column.key])} Token`}>
                          {compactCount(scope.tokens[column.key])}
                        </strong>
                      </section>
                    ))}
                </div>
              )}
              {!selected &&
                scope?.warnings.map((warning) => (
                  <p className="token-warning" key={t(warning ?? '')}>
                    {t(warning ?? '')}
                  </p>
                ))}
              {detail?.warnings.map((warning) => (
                <p className="token-warning" key={t(warning ?? '')}>
                  {t(warning ?? '')}
                </p>
              ))}
              {selected && (
                <div className="token-table-scroll">
                  <table className="token-table token-turn-list">
                    <caption className="sr-only">{t('每轮对话的 Token 用量')}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('消息 / 轮次')}</th>
                        {columns
                          .filter((column) => ['input', 'output', 'total'].includes(column.key))
                          .map((column) => (
                            <th
                              scope="col"
                              key={column.key}
                              title={column.title}
                              data-metric={column.key}
                            >
                              {column.label}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {!detail ? (
                        <tr>
                          <td colSpan={4}>{error ? t('未能读取统计') : t('正在加载统计…')}</td>
                        </tr>
                      ) : !detail.turns.length ? (
                        <tr>
                          <td colSpan={4}>{t('这条聊天尚无可识别的轮次记录')}</td>
                        </tr>
                      ) : (
                        [...detail.turns]
                          .reverse()
                          .slice(currentTurnPage * 30, currentTurnPage * 30 + 30)
                          .map((turn) => (
                            <tr
                              className="token-turn"
                              key={turn.id}
                              onClick={() => setOpenedTurn(turn.id)}
                            >
                              <th scope="row">
                                <button
                                  className="turn-open"
                                  aria-haspopup="dialog"
                                  onClick={() => setOpenedTurn(turn.id)}
                                  title={messagePreview(
                                    turn.messages.find((message) => message.role === 'user')?.text,
                                  ).slice(0, 300)}
                                >
                                  <span className="turn-message-preview">
                                    {messagePreview(
                                      turn.messages.find((message) => message.role === 'user')
                                        ?.text,
                                    )}
                                  </span>
                                  <span className="turn-list-meta">
                                    {t('第 {0} 轮 ', [turn.number])} · {statusNames[turn.status]} ·{' '}
                                    {date(turn.startedAt)}
                                    {turn.model ? ` / ${turn.model}` : ''}
                                  </span>
                                  {(!turn.tokens || !turn.complete) && (
                                    <span className="token-warning">
                                      {turn.tokens ? t('统计不完整') : t('暂无统计')}
                                    </span>
                                  )}
                                </button>
                              </th>
                              {columns
                                .filter((column) =>
                                  ['input', 'output', 'total'].includes(column.key),
                                )
                                .map((column) => (
                                  <td
                                    key={column.key}
                                    data-metric={column.key}
                                    title={turn.tokens ? undefined : t('该轮没有 Token 统计')}
                                  >
                                    {count(turn.tokens?.[column.key])}
                                  </td>
                                ))}
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {selected && (detail?.turns.length ?? 0) > 30 && (
                <footer className="turn-pagination">
                  <span>
                    {t('第 {0} / {1} 页 · 共 {2} 条', [
                      currentTurnPage + 1,
                      Math.ceil((detail?.turns.length ?? 0) / 30),
                      detail?.turns.length ?? 0,
                    ])}
                  </span>
                  <div>
                    <button
                      disabled={currentTurnPage === 0}
                      onClick={() => setTurnPage(currentTurnPage - 1)}
                    >
                      {t('上一页')}
                    </button>
                    <button
                      disabled={(currentTurnPage + 1) * 30 >= (detail?.turns.length ?? 0)}
                      onClick={() => setTurnPage(currentTurnPage + 1)}
                    >
                      {t('下一页')}
                    </button>
                  </div>
                </footer>
              )}
            </>
          )}
        </div>
      </div>
      <dialog
        ref={drawer}
        className="token-message-drawer"
        aria-labelledby="turn-drawer-title"
        onClose={(event) => {
          if (event.target === event.currentTarget) setOpenedTurn(null);
        }}
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          drawerBackdropPressed.current =
            event.target === event.currentTarget &&
            (event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom);
        }}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            drawerBackdropPressed.current &&
            event.target === event.currentTarget &&
            (event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom)
          )
            event.currentTarget.close();
        }}
      >
        {activeTurn && (
          <>
            <header className="turn-drawer-header">
              <div>
                <h2 id="turn-drawer-title">
                  {t('第 {0} 轮 ', [activeTurn.number])}
                  <small>{statusNames[activeTurn.status]}</small>
                </h2>
                <p>
                  {date(activeTurn.startedAt)}
                  {activeTurn.model ? ` / ${activeTurn.model}` : ''}
                </p>
              </div>
              <button autoFocus aria-label={t('关闭')} onClick={() => drawer.current?.close()}>
                ×
              </button>
            </header>
            <div className="turn-drawer-body">
              <dl className="turn-drawer-metrics">
                {columns.map((column) => (
                  <div key={column.key}>
                    <dt title={column.title}>{column.label}</dt>
                    <dd title={count(activeTurn.tokens?.[column.key])}>
                      {compactCount(activeTurn.tokens?.[column.key])}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="note">{t('缓存输入已含在输入中，推理已含在输出中。')}</p>
              <div className="message-thread">
                <p className="note">{t('上方 Token 是整轮合计，不能分摊为每个气泡的精确消耗。')}</p>
                {activeTurn.messages.length ? (
                  activeTurn.messages.map((message, index) => (
                    <section
                      className={`chat-message ${message.role} ${index > 0 && activeTurn.messages[index - 1].role === message.role ? 'continued' : ''}`}
                      key={`${message.role}-${index}`}
                    >
                      <div
                        className="message-avatar"
                        title={
                          message.role === 'user'
                            ? t('你')
                            : message.phase === 'commentary'
                              ? t('助手 · 进度说明')
                              : 'GPT'
                        }
                      >
                        <img
                          src={message.role === 'user' ? avatarDataUrl(account) : gptAvatar}
                          alt={message.role === 'user' ? t('你') : 'GPT'}
                          width="28"
                          height="28"
                        />
                      </div>
                      <div className={`message-bubble ${message.role}`}>
                        <MessageBody
                          text={message.text}
                          user={message.role === 'user'}
                          sessionId={selected}
                        />
                        {message.truncated && (
                          <p className="token-warning">
                            {t('内容过长，仅显示本次加载的前 {0} 个字符', [
                              message.text.length.toLocaleString(),
                            ])}
                          </p>
                        )}
                      </div>
                    </section>
                  ))
                ) : (
                  <p className="empty">{t('此轮没有可读取的消息正文')}</p>
                )}
              </div>
            </div>
          </>
        )}
      </dialog>
      <div className="token-source">
        <span title={catalog?.root}>
          {t('来源：{0}', [catalog?.root || sessionPath || t('本机 Codex sessions')])}
        </span>
        <button onClick={chooseDirectory}>{t('选择目录')}</button>
        {sessionPath && <button onClick={resetDirectory}>{t('恢复默认')}</button>}
      </div>
      <p className="note">
        {t(
          '已过滤识别出的内部审核及子会话。消息正文仅在本机内存中读取和显示，不上传、不另存文件。每 15 秒更新当前聊天。{0}{1}',
          [
            catalog?.limited ? t('部分记录无法访问，聊天数量和用量可能不完整。') : '',
            detail ? t('最近读取：{0}', [date(detail.updatedAt)]) : '',
          ],
        )}
      </p>
    </section>
  );
});
