import { useEffect, useRef, useState } from 'react';

export interface Command { id: string; label: string; hint: string; run(): void }
export function CommandPalette({ open, close, commands }: { open: boolean; close(): void; commands: Command[] }) {
  const dialog = useRef<HTMLDialogElement>(null), input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(''), [selected, setSelected] = useState(0);
  const results = commands.filter(command => `${command.label} ${command.hint}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  useEffect(() => {
    if (open) { setQuery(''); setSelected(0); dialog.current?.showModal(); input.current?.focus(); }
    else dialog.current?.close();
  }, [open]);
  const activeId = results[selected]?.id;
  useEffect(() => { if (open && activeId) dialog.current?.querySelector(`[id="command-${activeId}"]`)?.scrollIntoView({ block: 'nearest' }); }, [open, activeId]);
  const choose = (command: Command) => { close(); command.run(); };
  return <dialog ref={dialog} className="command-dialog" aria-label="快速操作" onCancel={close} onClose={close} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="command-content"><div className="command-search"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input ref={input} role="combobox" aria-label="搜索操作" aria-expanded={open} aria-controls="command-results" aria-activedescendant={results[selected] ? `command-${results[selected].id}` : undefined} autoComplete="off" placeholder="搜索页面或操作…" value={query} onChange={event => { setQuery(event.target.value); setSelected(0); }} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setSelected(index => results.length ? (index + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length : 0); }
      if (event.key === 'Enter' && results[selected]) { event.preventDefault(); choose(results[selected]); }
    }}/><button onClick={close} aria-label="关闭快速操作"><kbd>Esc</kbd></button></div>
    <div className="command-results" id="command-results" role="listbox" aria-label="匹配操作">{results.map((command, index) => <button key={command.id} id={`command-${command.id}`} role="option" aria-selected={selected === index} className={selected === index ? 'active' : ''} onPointerMove={() => setSelected(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(command)}><span>{command.label}<small>{command.hint}</small></span><span aria-hidden="true">↵</span></button>)}{!results.length && <p className="command-empty">没有匹配的操作，试试“额度”或“主题”。</p>}</div><footer><span>↑ ↓ 选择</span><span>Enter 执行</span><span>Esc 关闭</span></footer></div>
  </dialog>;
}
