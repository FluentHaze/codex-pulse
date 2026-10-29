import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** A transient overlay indicates scroll position without reserving layout space. */
export function ScrollIndicator() {
  const [indicator, setIndicator] = useState<{
    left: number;
    top: number;
    height: number;
    visible: boolean;
    host: HTMLElement;
  } | null>(null);
  useEffect(() => {
    let frame = 0;
    let hide: ReturnType<typeof setTimeout>;
    let remove: ReturnType<typeof setTimeout>;
    const scroll = (event: Event) => {
      const target = event.target === document ? document.scrollingElement : event.target;
      if (!(target instanceof HTMLElement)) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const root = target === document.scrollingElement;
        const rect = root ? { left: 0, top: 0, right: innerWidth } : target.getBoundingClientRect();
        const viewport = root ? innerHeight : target.clientHeight;
        const range = target.scrollHeight - viewport;
        if (range <= 1 || viewport < 40 || !target.isConnected) return;
        const height = Math.min(
          viewport - 8,
          Math.max(24, (viewport * viewport) / target.scrollHeight),
        );
        const host = target.closest<HTMLDialogElement>('dialog[open]') ?? document.body;
        setIndicator({
          left: rect.right - 6,
          top:
            rect.top +
            (root ? 0 : target.clientTop) +
            4 +
            Math.max(0, Math.min(1, target.scrollTop / range)) * (viewport - height - 8),
          height,
          host,
          visible: true,
        });
        clearTimeout(hide);
        clearTimeout(remove);
        hide = setTimeout(() => {
          setIndicator((value) => (value ? { ...value, visible: false } : null));
          remove = setTimeout(() => setIndicator(null), 260);
        }, 700);
      });
    };
    const dismiss = () => {
      setIndicator(null);
    };
    document.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', dismiss);
    document.addEventListener('close', dismiss, true);
    return () => {
      document.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', dismiss);
      document.removeEventListener('close', dismiss, true);
      cancelAnimationFrame(frame);
      clearTimeout(hide);
      clearTimeout(remove);
    };
  }, []);
  return indicator
    ? createPortal(
        <div
          aria-hidden="true"
          className={`scroll-position-indicator ${indicator.visible ? 'visible' : ''}`}
          style={{ left: indicator.left, top: indicator.top, height: indicator.height }}
        />,
        indicator.host,
      )
    : null;
}
