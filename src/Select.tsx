import { DismissBackdrop } from './DismissBackdrop';
import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface OptionProps {
  value: string | number;
  children: ReactNode;
  disabled?: boolean;
}

/** Shared, keyboard-accessible picker. Options are rendered in our own themed popup. */
export function Select({
  value,
  onValueChange,
  children,
  disabled,
  ...props
}: {
  value: string | number;
  onValueChange(value: string): void;
  children: ReactNode;
  disabled?: boolean;
  'aria-label'?: string;
}) {
  const options = Children.toArray(children)
    .filter(isValidElement<OptionProps>)
    .map((item) => item.props);
  const selected = options.findIndex((option) => String(option.value) === String(value));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(Math.max(0, selected));
  const [position, setPosition] = useState({ left: 0, top: 0, width: 180, maxHeight: 280 });
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const id = useId();
  const show = () => {
    if (disabled) return;
    setActive(Math.max(0, selected));
    setOpen(true);
  };
  useLayoutEffect(() => {
    if (!open) return;
    const positionPopup = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, 144), innerWidth - 24);
      const below = innerHeight - rect.bottom - 16;
      const contentHeight = popup.current?.scrollHeight ?? 280;
      const above = below < Math.min(180, contentHeight) && rect.top > below;
      const height = Math.max(34, Math.min(280, contentHeight, above ? rect.top - 16 : below));
      setPosition({
        left: Math.max(12, Math.min(rect.left, innerWidth - width - 12)),
        top: above ? rect.top - height - 6 : rect.bottom + 6,
        width,
        maxHeight: height,
      });
    };
    positionPopup();
    window.addEventListener('resize', positionPopup);
    window.addEventListener('scroll', positionPopup, true);
    return () => {
      window.removeEventListener('resize', positionPopup);
      window.removeEventListener('scroll', positionPopup, true);
    };
  }, [open, options.length]);
  useEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open, id]);
  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onValueChange(String(option.value));
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <>
      <button
        {...props}
        ref={trigger}
        type="button"
        role="combobox"
        className="custom-select"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? id : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onBlur={(event) => {
          if (!popup.current?.contains(event.relatedTarget)) setOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
            return;
          }
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            if (!open) {
              show();
              return;
            }
            const enabled = options
              .map((option, index) => (option.disabled ? -1 : index))
              .filter((index) => index >= 0);
            const current = enabled.indexOf(active);
            const next =
              event.key === 'Home'
                ? enabled[0]
                : event.key === 'End'
                  ? enabled.at(-1)
                  : enabled[
                      (current + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) %
                        enabled.length
                    ];
            if (next !== undefined) setActive(next);
          } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (open) choose(active);
            else show();
          }
        }}
      >
        <span>{options[selected]?.children ?? '—'}</span>
        <svg
          viewBox="0 0 20 20"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="m6 8 4 4 4-4" />
        </svg>
      </button>
      {open && <DismissBackdrop close={() => setOpen(false)} />}
      {open &&
        createPortal(
          <div
            ref={popup}
            id={id}
            role="listbox"
            aria-label={props['aria-label']}
            className={`select-popup ${trigger.current?.closest('.app')?.classList.contains('dark') ? 'dark' : 'light'}`}
            style={position}
            onPointerDown={(event) => event.preventDefault()}
          >
            {options.map((option, index) => (
              <div
                key={option.value}
                id={`${id}-${index}`}
                role="option"
                aria-selected={index === selected}
                aria-disabled={option.disabled || undefined}
                className={active === index ? 'highlighted' : ''}
                onPointerMove={() => setActive(index)}
                onClick={() => choose(index)}
              >
                <span>{option.children}</span>
                {index === selected && <span aria-hidden="true">✓</span>}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
