import { useRef } from 'react';
import { quotaWindows, remaining, type State } from '../electron/types';
import { QuotaRing, duration, resetText } from './Quota';

export function Floating({ state, now, dark, popup }: { state: State; now: number; dark: boolean; popup: boolean }) {
  const gesture = useRef({ x: 0, y: 0, dragging: false, moved: false });
  const main = state.buckets.find(bucket => bucket.limitId === 'codex') ?? state.buckets[0];
  const windows = quotaWindows(main), used = state.settings.quotaDisplay === 'used';
  const total = state.live?.tokens?.total;
  const short = total == null ? '—' : total >= 1e6 ? `${+(total / 1e6).toFixed(1)}m` : total >= 1000 ? `${+(total / 1000).toFixed(1)}k` : total.toString();
  const peek = (show: boolean) => { void window.pulse?.peek(show).catch(() => {}); };
  const action = (name: string) => { peek(false); void window.pulse?.action(name).catch(() => {}); };
  const theme = dark ? 'dark' : 'light';
  if (popup) return <div className={`peek-window ${theme}`} onPointerEnter={() => peek(true)} onPointerLeave={() => peek(false)} onFocus={() => peek(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) peek(false); }} onKeyDown={event => { if (event.key === 'Escape') peek(false); }}>
    <header><span className="peek-logo"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12h4l3-7 4 14 3-7h4"/></svg></span><b>Codex 额度</b><span className="plan-badge">{state.plan ?? 'ChatGPT'}</span></header>
    {state.error && <p className="peek-error">{state.error}</p>}
    {windows.length ? windows.map((quota, index) => {
      const left = remaining(quota), value = left === null ? null : used ? 100 - left : left;
      return <section className={`peek-quota ${left === null ? 'muted' : left <= 10 ? 'danger' : left <= 20 ? 'warning' : 'good'}`} key={index}><div><b>{duration(quota)}窗口</b><strong>{value === null ? '暂无数据' : `${+value.toFixed(1)}% ${used ? '已用' : '剩余'}`}</strong></div><div className="peek-progress"><i style={{ width: `${value ?? 0}%` }}/></div><span>{resetText(quota.resetsAt, now)}</span></section>;
    }) : <p className="peek-empty">{state.refreshing ? '正在读取额度…' : '服务端暂未返回额度窗口'}</p>}
    <button className="peek-session" onClick={() => action('tokens')}><span><small>{state.live?.status === 'completed' ? '上轮 Token' : '本轮 Token'}</small><b>{state.live?.title ?? '等待本机聊天记录'}</b></span><strong>{short}</strong></button>
    <footer><span>{state.updatedAt ? `${new Date(state.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 更新` : '尚未更新'}</span><button onClick={() => action('details')}>打开详情 <span aria-hidden="true">↗</span></button></footer>
  </div>;
  return <div className={`floating-rail ${theme}`} aria-label="Codex 竖向悬浮栏"
    onPointerEnter={() => { if (!gesture.current.dragging) peek(true); }}
    onPointerLeave={() => { if (!gesture.current.dragging) peek(false); }}
    onFocus={() => { if (!gesture.current.dragging) peek(true); }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) peek(false); }}
    onKeyDown={event => { if (event.key === 'Escape') peek(false); }}
    onContextMenu={event => { event.preventDefault(); action('menu'); }}
    onPointerDown={event => {
      if (event.button !== 0 || state.settings.locked) return;
      gesture.current = { x: event.screenX, y: event.screenY, dragging: true, moved: false };
      const target = (event.target as Element).closest('button') ?? event.currentTarget;
      target.setPointerCapture(event.pointerId);
      peek(false);
      window.pulse?.drag('start', event.screenX, event.screenY);
    }}
    onPointerMove={event => {
      const current = gesture.current;
      if (!current.dragging) return;
      if (Math.hypot(event.screenX - current.x, event.screenY - current.y) > 4) {
        current.moved = true;
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
      }
      if (current.moved) window.pulse?.drag('move', event.screenX, event.screenY);
    }}
    onPointerUp={event => {
      if (!gesture.current.dragging) return;
      gesture.current.dragging = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      const target = event.target as Element;
      if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
      window.pulse?.drag('end', event.screenX, event.screenY);
    }}
    onPointerCancel={event => { gesture.current.dragging = false; window.pulse?.drag('end', event.screenX, event.screenY); }}
    onLostPointerCapture={event => { if (gesture.current.dragging && event.buttons === 0) { gesture.current.dragging = false; window.pulse?.drag('end', event.screenX, event.screenY); } }}
    onClickCapture={event => { if (gesture.current.moved) { event.preventDefault(); event.stopPropagation(); gesture.current.moved = false; } }}>
    <div className={state.settings.locked ? 'rail-grip locked' : 'rail-grip'} aria-label={state.settings.locked ? '位置已锁定' : '拖动悬浮栏'}><i/><i/><i/></div>
    <div className="rail-rings">{windows.length ? windows.map((quota, index) => <button className="rail-item" key={index} aria-label={`${duration(quota)}额度，点击打开详情`} onClick={() => action('details')}><QuotaRing quota={quota} used={used}/><span>{duration(quota)}</span></button>) : <button className="rail-item rail-unavailable" aria-label="额度暂不可用，打开详情" onClick={() => action('details')}><span className="rail-placeholder">—</span><span>额度</span></button>}</div>
    <button className="rail-token" aria-label={`本轮 ${total?.toLocaleString() ?? '暂无'} Token，打开明细`} onClick={() => action('tokens')}>{short}</button>
  </div>;
}
