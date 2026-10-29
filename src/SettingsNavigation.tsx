import { useEffect, useState } from 'react';
import { t } from '../electron/i18n';

export interface SettingsCategory {
  id: string;
  label: string;
}

/** Frequently used categories first; scroll position keeps the index in sync. */
export function SettingsNavigation({ categories }: { categories: SettingsCategory[] }) {
  const [active, setActive] = useState(categories[0]?.id);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const sections = categories
        .map((category) => ({
          category,
          top: document.getElementById(category.id)?.getBoundingClientRect().top,
        }))
        .filter((section) => section.top !== undefined);
      const current =
        sections.filter((section) => section.top! <= Math.max(140, innerHeight * 0.4)).at(-1) ??
        sections[0];
      if (current) setActive(current.category.id);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [categories]);
  return (
    <nav className="settings-navigation" aria-label={t('偏好设置')}>
      {categories.map((category) => (
        <button
          type="button"
          key={category.id}
          aria-current={active === category.id ? 'location' : undefined}
          onClick={() => {
            const section = document.getElementById(category.id);
            const heading = section?.querySelector('h2');
            if (heading) {
              heading.tabIndex = -1;
              heading.focus({ preventScroll: true });
            }
            section?.scrollIntoView({
              block: 'start',
              behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
                ? 'instant'
                : 'smooth',
            });
            setActive(category.id);
          }}
        >
          {category.label}
        </button>
      ))}
    </nav>
  );
}
