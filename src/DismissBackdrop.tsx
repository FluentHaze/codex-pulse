import { createPortal } from 'react-dom';

/** Consume the dismissal click so it cannot activate controls behind a popup. */
export function DismissBackdrop({ close }: { close(): void }) {
  return createPortal(
    <div
      className="popup-dismiss-backdrop"
      aria-hidden="true"
      onPointerDown={(event) => event.preventDefault()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        close();
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        close();
      }}
    />,
    document.body,
  );
}
