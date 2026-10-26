import { useEffect } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { IconClose } from './icons';

/** Лист поверх экрана: снизу или во весь экран. Закрывается крестиком и тапом по фону. */
export function Sheet({
  title,
  onClose,
  full,
  children,
  action,
}: {
  title?: ComponentChildren;
  onClose: () => void;
  full?: boolean;
  children: ComponentChildren;
  action?: ComponentChildren;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <>
      {!full && <div class="sheet-backdrop" onClick={onClose} />}
      <div class={`sheet ${full ? 'sheet-full' : ''}`} role="dialog" aria-modal="true">
        <div class="sheet-head">
          <div class="sheet-title">{title}</div>
          {action}
          <button class="icon-btn" onClick={onClose} aria-label="Закрыть">
            <IconClose />
          </button>
        </div>
        <div class="sheet-body">{children}</div>
      </div>
    </>
  );
}
