'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const CLOSE_DISTANCE = 110;
const EXIT_MS = 280;

export default function BottomSheet({
  open,
  onClose,
  title,
  size = 'tall',
  locked = false,
  className = '',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: 'tall' | 'medium' | 'auto';
  locked?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number; dy: number } | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(frame);
    }
    setShown(false);
    const timer = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !locked) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      root.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, locked, onClose]);

  if (!mounted) return null;

  const setOffset = (dy: number) => {
    if (!sheet.current) return;
    sheet.current.style.transform = dy ? `translateY(${dy}px)` : '';
    sheet.current.style.transition = dy ? 'none' : '';
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (locked) return;
    drag.current = { y: e.clientY, t: performance.now(), dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    setOffset(drag.current.dy);
  };
  const onPointerUp = () => {
    const state = drag.current;
    drag.current = null;
    if (!state) return;
    const velocity = state.dy / Math.max(1, performance.now() - state.t);
    setOffset(0);
    if (state.dy > CLOSE_DISTANCE || (state.dy > 30 && velocity > 0.6)) onClose();
  };

  return createPortal(
    <div className={`sheet-layer${shown ? ' is-open' : ''}`} dir="rtl">
      <div className="sheet-backdrop" onClick={() => !locked && onClose()} />
      <div
        ref={sheet}
        className={`sheet sheet-${size} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          className="sheet-grip"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span />
          {title && <h2>{title}</h2>}
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
