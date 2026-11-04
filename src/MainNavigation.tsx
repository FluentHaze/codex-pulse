import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { t } from '../electron/i18n';
import './main-navigation.css';

interface NavigationItem {
  id: string;
  label: string;
  icon: ReactNode;
}
interface Indicator {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function MainNavigation({
  items,
  selected,
  onSelect,
}: {
  items: readonly NavigationItem[];
  selected: string;
  onSelect(id: string): void;
}) {
  const nav = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState<Indicator>();
  const [animate, setAnimate] = useState(false);
  const itemLabels = items.map((item) => `${item.id}:${item.label}`).join('|');
  const measure = useCallback(() => {
    const button = nav.current?.querySelector<HTMLButtonElement>('[aria-current="page"]');
    if (!button) {
      setIndicator(undefined);
      return;
    }
    const next = {
      x: button.offsetLeft,
      y: button.offsetTop,
      width: button.offsetWidth,
      height: button.offsetHeight,
    };
    setIndicator((previous) =>
      previous &&
      previous.x === next.x &&
      previous.y === next.y &&
      previous.width === next.width &&
      previous.height === next.height
        ? previous
        : next,
    );
  }, []);
  useLayoutEffect(() => {
    measure();
  }, [selected, itemLabels, measure]);
  useLayoutEffect(() => {
    const element = nav.current;
    if (!element) return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.querySelectorAll('button').forEach((button) => observer.observe(button));
    return () => observer.disconnect();
  }, [itemLabels, measure]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <nav ref={nav} className="main-navigation" aria-label={t('主导航')}>
      {indicator && (
        <span
          aria-hidden="true"
          className={`main-navigation-indicator${animate ? ' animated' : ''}`}
          style={{
            width: indicator.width,
            height: indicator.height,
            transform: `translate3d(${indicator.x}px, ${indicator.y}px, 0)`,
          }}
        />
      )}
      {items.map((item) => (
        <button
          key={item.id}
          aria-current={selected === item.id ? 'page' : undefined}
          title={item.label}
          aria-label={item.label}
          className={selected === item.id ? 'selected' : ''}
          onClick={() => onSelect(item.id)}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>
  );
}
