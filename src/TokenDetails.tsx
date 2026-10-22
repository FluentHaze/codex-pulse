import { Fragment, memo, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import type { TokenCatalog, TokenSession, TokenCounts, DailyStats } from '../electron/types';
import { filterSessions, type DateFilter } from './session-filter';

const count = (value: number | null | undefined) => value == null ? '—' : value.toLocaleString('zh-CN');
const date = (value: string | number | null) => value ? new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '时间未知';
const statusNames = { running: '进行中', completed: '已完成', interrupted: '已中断', unknown: '未结束' };
export const TokenDetails = memo(function TokenDetails({ sessionPath, watchedSessionId }: { sessionPath: string; watchedSessionId: string }) {
  const [catalog, setCatalog] = useState<TokenCatalog>();
  const [selected, setSelected] = useState('');
  const [scope, setScope] = useState<DailyStats>();
  const [storedDetail, setDetail] = useState<TokenSession>();
  const [listBusy, setListBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState(''); const [project, setProject] = useState('*'); const [period, setPeriod] = useState<DateFilter>('all');
  const [filterNow, setFilterNow] = useState(Date.now());
  const visibleSessions = useMemo(() => filterSessions(catalog?.sessions ?? [], query, project, period, new Date(filterNow)), [catalog, query, project, period, filterNow]);
  const projects = useMemo(() => [...new Map([...(catalog?.projects ?? []).map(project => [project.id, project.name] as const), ...(catalog?.sessions ?? []).map(session => [session.project ?? '', session.projectName || session.project || '未分类'] as const)]).entries()].sort((a, b) => a[1].localeCompare(b[1], 'zh-CN')), [catalog]);
  useEffect(() => { const timer = setInterval(() => setFilterNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (catalog) setSelected(previous => visibleSessions.some(session => session.id === previous) ? previous : ''); }, [catalog, visibleSessions]);
  const clearFilters = () => { setQuery(''); setProject('*'); setPeriod('all'); };
  const detail = storedDetail?.id === selected && visibleSessions.some(session => session.id === selected) ? storedDetail : undefined;
  const catalogRequest = useRef(0);
  const mounted = useRef(true);
  const loadingDetail = useRef(false);
  const loadCatalog = useCallback(async (force = false) => {
    const request = ++catalogRequest.current;
    setListBusy(true); setError('');
    try {
      const next = await window.pulse!.tokenCatalog(force);
      if (!mounted.current || catalogRequest.current !== request) return;
      setCatalog(next); setSelected(previous => next.sessions.some(session => session.id === previous) ? previous : '');
    } catch { if (mounted.current && catalogRequest.current === request) setError('无法读取聊天列表，请检查会话目录和访问权限'); }
    finally { if (mounted.current && catalogRequest.current === request) setListBusy(false); }
  }, []);
  useEffect(() => { mounted.current = true; setCatalog(undefined); setSelected(''); setDetail(undefined); setProject('*'); void loadCatalog(true); return () => { mounted.current = false; catalogRequest.current++; }; }, [sessionPath, loadCatalog]);
  useEffect(() => {
    let current = true;
    let request = 0;
    loadingDetail.current = false;
    setDetail(undefined);
    if (!selected) { setBusy(false); return; }
    const read = async () => {
      if (loadingDetail.current) return;
      loadingDetail.current = true;
      const sequence = ++request;
      setBusy(true);
      try { const next = await window.pulse!.tokenSession(selected); if (current && sequence === request) { setDetail(next); setError(''); } }
      catch (failure) { if (current && sequence === request) setError(failure instanceof Error ? failure.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : '读取统计失败，请重试'); }
      finally { if (current && sequence === request) { loadingDetail.current = false; setBusy(false); } }
    };
    void read();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void read(); }, 15_000);
    return () => { current = false; clearInterval(timer); };
  }, [selected, reload, sessionPath]);
  const scopeIds = useMemo(() => visibleSessions.map(session => session.id), [visibleSessions]);
  useEffect(() => {
    if (selected || !catalog) return;
    let current = true, running = false;
    setScope(undefined);
    const read = async () => {
      if (running) return; running = true; setBusy(true);
      try { const next = await window.pulse!.scopeUsage(scopeIds); if (current) { setScope(next); setError(''); } }
      catch { if (current) setError('无法汇总项目用量，请刷新重试'); }
      finally { running = false; if (current) setBusy(false); }
    };
    void read(); const timer = setInterval(() => { if (document.visibilityState === 'visible') void read(); }, 30000);
    return () => { current = false; clearInterval(timer); };
  }, [selected, scopeIds, catalog, reload, sessionPath]);
  const refresh = async () => { await loadCatalog(true); if (mounted.current) setReload(value => value + 1); };
  const chooseDirectory = () => { void window.pulse!.action('choose-sessions').catch(() => { if (mounted.current) setError('无法打开目录选择器，请稍后重试'); }); };
  const resetDirectory = () => { void window.pulse!.settings({ sessionPath: '' }).catch(() => { if (mounted.current) setError('恢复默认目录失败，请重试'); }); };
  const track = (id: string) => { void window.pulse!.settings({ watchedSessionId: id }).catch(() => { if (mounted.current) setError('设置悬浮窗跟踪失败，请重试'); }); };
  const totals = detail?.turns.reduce<{ count: number; tokens: number }>((sum, turn) => { if (turn.tokens?.total != null) { sum.count++; sum.tokens += turn.tokens.total; } return sum; }, { count: 0, tokens: 0 });
  const columns: { key: keyof TokenCounts; label: string; title: string }[] = [
    { key: 'input', label: '输入', title: '包含上下文、工具结果及缓存输入' },
    { key: 'cachedInput', label: '缓存输入', title: '已计入输入 Token，不重复加总' },
    { key: 'output', label: '输出', title: '模型输出 Token' },
    { key: 'reasoning', label: '推理', title: '已计入输出 Token，不重复加总；未提供时显示 —' },
    { key: 'total', label: '合计', title: '采用记录中的总量，不将缓存和推理重复相加' }
  ];
  return <section className="token-details" aria-label="Token 明细">
    <div className="token-scope"><span>本机历史记录</span><p>按轮次统计，一轮可能包含多次模型调用。历史记录不按当前登录账号筛选。</p></div>
    <div className="chat-filters"><label>搜索聊天<input type="search" aria-label="搜索聊天" placeholder="搜索标题或项目路径" maxLength={100} value={query} onChange={event => setQuery(event.target.value)}/></label><label>项目<select aria-label="筛选项目" value={project} onChange={event => { setProject(event.target.value); setSelected(''); }}><option value="*">全部项目</option>{projects.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>更新时间<select aria-label="筛选更新时间" value={period} onChange={event => setPeriod(event.target.value as DateFilter)}><option value="all">全部时间</option><option value="today">今天</option><option value="7d">近 7 天</option><option value="30d">近 30 天</option></select></label></div>
    <div className="filter-result"><span>匹配 {visibleSessions.length} 条聊天</span>{(query || project !== '*' || period !== 'all') && <button onClick={clearFilters}>清空筛选</button>}</div>
    <div className="token-controls"><label htmlFor="token-session">选择聊天</label><select id="token-session" value={selected} disabled={listBusy || !visibleSessions.length} onChange={event => setSelected(event.target.value)}><option value="">{project === '*' ? '全部匹配聊天的总用量' : '当前项目全部匹配聊天的总用量'}</option>{!visibleSessions.length && <option value="">{listBusy ? '正在读取聊天…' : '没有匹配聊天'}</option>}{visibleSessions.map(session => <option value={session.id} key={session.id}>{session.title}（{date(session.updatedAt)}）</option>)}</select><button disabled={listBusy || busy} onClick={() => void refresh()}>{listBusy || busy ? '读取中…' : '刷新记录'}</button></div>
    <div className="token-tracking"><span>{watchedSessionId ? watchedSessionId === selected ? '悬浮窗已固定跟踪当前聊天' : '悬浮窗正固定跟踪其他聊天' : '悬浮窗自动跟随本机最近更新的聊天'}</span><button disabled={!selected || watchedSessionId === selected} onClick={() => track(selected)}>固定跟踪此聊天</button>{watchedSessionId && <button onClick={() => track('')}>恢复自动跟随</button>}</div>
    {error && <div className="alert" role="alert">{error}</div>}
    {!listBusy && catalog && !catalog.sessions.length ? <div className="empty"><h2>未找到本地聊天记录</h2><p>请先在本机使用 Codex，或选择包含 rollout JSONL 文件的 sessions 目录。</p><button onClick={chooseDirectory}>选择会话目录</button></div> : catalog && !visibleSessions.length ? <div className="empty"><h2>没有匹配的聊天</h2><p>尝试其他关键词、项目或更新时间。</p><button onClick={clearFilters}>清空筛选条件</button></div> : <>
      <div className="token-summary"><div><span>{selected ? '当前聊天已记录用量' : project === '*' ? '匹配聊天总用量' : '当前项目总用量'}</span><strong>{selected ? totals?.count ? count(totals.tokens) : '—' : count(scope?.tokens.total)}<small>Token</small></strong></div><p>{!selected ? scope ? `${visibleSessions.length} 条聊天，${scope.turnCount} 轮有统计` : '正在汇总项目用量…' : detail ? `${detail.turns.length} 轮对话，${totals?.count ?? 0} 轮有统计` : '正在读取轮次…'}<span>缓存输入已含在输入中，推理已含在输出中。</span></p></div>
      {!selected && scope && <div className="daily-metrics">{columns.filter(column => column.key !== 'total').map(column => <section key={column.key}><span>{column.label}</span><strong>{count(scope.tokens[column.key])}</strong></section>)}</div>}
      {!selected && scope?.warnings.map(warning => <p className="token-warning" key={warning}>{warning}</p>)}
      {detail?.warnings.map(warning => <p className="token-warning" key={warning}>{warning}</p>)}
      {selected && <div className="token-table-scroll"><table className="token-table"><caption className="sr-only">每轮对话的 Token 用量</caption><thead><tr><th scope="col">消息 / 轮次</th>{columns.map(column => <th scope="col" key={column.key} title={column.title}>{column.label}</th>)}</tr></thead><tbody>{!detail ? <tr><td colSpan={6}>{error ? '未能读取统计' : '正在加载统计…'}</td></tr> : !detail.turns.length ? <tr><td colSpan={6}>这条聊天尚无可识别的轮次记录</td></tr> : [...detail.turns].reverse().map(turn => <Fragment key={turn.id}><tr><th scope="row"><span className="turn-message-preview" title={turn.messages.find(message => message.role === 'user')?.text.slice(0, 300)}>{turn.messages.find(message => message.role === 'user')?.text || '用户消息未记录'}</span><span className="turn-caption">第 {turn.number} 轮 <em>{statusNames[turn.status]}</em></span><small>{date(turn.startedAt)}{turn.model ? ` / ${turn.model}` : ''}</small>{(!turn.tokens || !turn.complete) && <small className="token-warning">{turn.tokens ? '统计不完整' : '暂无统计'}</small>}</th>{columns.map(column => <td key={column.key} title={turn.tokens ? undefined : '该轮没有 Token 统计'}>{count(turn.tokens?.[column.key])}</td>)}</tr><tr className="message-detail"><td colSpan={6}>{turn.messages.length ? <details><summary>查看第 {turn.number} 轮消息（{turn.messages.length} 条）</summary><div className="message-thread"><p className="note">上方 Token 是整轮合计，不能分摊为每个气泡的精确消耗。图片仅显示附件标记。</p>{turn.messages.map((message, index) => <section className={`message-bubble ${message.role}`} key={`${message.role}-${index}`}><h3>{message.role === 'user' ? '你' : message.phase === 'commentary' ? '助手 · 进度说明' : '助手'}</h3><pre>{message.text}</pre>{message.truncated && <p className="token-warning">内容过长，仅显示本次加载的前 {message.text.length.toLocaleString()} 个字符</p>}</section>)}</div></details> : <span className="message-unavailable">此轮没有可读取的消息正文</span>}</td></tr></Fragment>)}</tbody></table></div>}
    </>}
    <div className="token-source"><span title={catalog?.root}>来源：{catalog?.root || sessionPath || '本机 Codex sessions'}</span><button onClick={chooseDirectory}>选择目录</button>{sessionPath && <button onClick={resetDirectory}>恢复默认</button>}</div>
    <p className="note">已过滤识别出的内部审核及子会话。消息正文仅在本机内存中读取和显示，不上传、不另存文件。每 15 秒更新当前聊天。{catalog?.limited ? '部分记录无法访问，聊天数量和用量可能不完整。' : ''}{detail ? `最近读取：${date(detail.updatedAt)}` : ''}</p>
  </section>;
});
