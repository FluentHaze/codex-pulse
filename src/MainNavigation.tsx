import type { ReactNode } from 'react';
import { t } from '../electron/i18n';
import './main-navigation.css';

interface NavigationItem {
  id: string;
  label: string;
  icon: ReactNode;
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
  return (
    <nav className="main-navigation" aria-label={t('主导航')}>
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
