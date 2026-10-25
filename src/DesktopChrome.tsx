import { useLanguage } from './use-language';
import { t, getLanguage } from '../electron/i18n';
import { useEffect, useRef, useState } from 'react';
import './desktop-chrome.css';
import { BrandIcon } from './BrandIcon';
export function DesktopChrome() {
    const language = useLanguage();
    const [menus, setMenus] = useState<string[]>([]), [open, setOpen] = useState(''), [error, setError] = useState('');
    const mounted = useRef(false);
    useEffect(() => {
        mounted.current = true;
        void window.pulse?.windowMenus().then(value => { if (mounted.current)
            setMenus(value); }).catch(() => { if (mounted.current)
            setError("菜单读取失败，请重启应用"); });
        return () => { mounted.current = false; };
    }, [language]);
    return <div className="desktop-chrome"><div className="desktop-title"><span className="desktop-title-icon" aria-hidden="true"><BrandIcon /></span><span>Codex Pulse</span></div><div className="desktop-menu" role="toolbar" aria-label={t("应用菜单")}>
    {menus.map(label => <button key={label} aria-haspopup="menu" aria-expanded={open === label} onClick={event => {
                if (open)
                    return;
                const rect = event.currentTarget.getBoundingClientRect();
                setOpen(label);
                setError('');
                void window.pulse?.windowMenu(label, rect.left, rect.bottom).catch(() => { if (mounted.current)
                    setError("菜单打开失败，请重试"); }).finally(() => { if (mounted.current)
                    setOpen(''); });
            }} onKeyDown={event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
                    return;
                const buttons = Array.from(event.currentTarget.parentElement!.querySelectorAll('button'));
                const index = buttons.indexOf(event.currentTarget);
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
                event.preventDefault();
                buttons[next]?.focus();
            }}>{label}</button>)}
    {error && <span className="desktop-menu-error" role="status">{t(error ?? '')}</span>}
  </div></div>;
}
