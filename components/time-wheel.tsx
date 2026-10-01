'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import BottomSheet from './bottom-sheet';

const ITEM = 44;

export function timeOptions(step = 10, from = 0, to = 24 * 60 - step) {
  const out: string[] = [];
  for (let m = from; m <= to; m += step)
    out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  return out;
}

function Wheel({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useLayoutEffect(() => {
    const index = Math.max(0, options.indexOf(value));
    if (list.current) list.current.scrollTop = index * ITEM;
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <div className="wheel">
      <i className="wheel-band" />
      <div
        className="wheel-list"
        ref={list}
        onScroll={(e) => {
          const top = e.currentTarget.scrollTop;
          clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            const next = options[Math.min(options.length - 1, Math.max(0, Math.round(top / ITEM)))];
            if (next && next !== value) onChange(next);
          }, 70);
        }}
      >
        {options.map((option, i) => (
          <button
            type="button"
            key={option}
            className={option === value ? 'is-on' : ''}
            onClick={() => list.current?.scrollTo({ top: i * ITEM, behavior: 'smooth' })}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TimeField({
  label,
  value,
  onChange,
  options = timeOptions(),
  disabled,
  compact,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options?: string[];
  disabled?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const choices = options.includes(value) ? options : [...options, value].sort();
  return (
    <>
      <button
        type="button"
        className={`time-field${compact ? ' is-compact' : ''}`}
        disabled={disabled}
        aria-label={`${label}: ${value}`}
        onClick={() => {
          setDraft(value);
          setOpen(true);
        }}
      >
        <strong dir="ltr">{value}</strong>
        <ChevronDown size={16} />
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={label} size="auto" className="wheel-sheet">
        <Wheel options={choices} value={draft} onChange={setDraft} />
        <div className="wheel-actions">
          <button
            type="button"
            className="wheel-confirm"
            onClick={() => {
              onChange(draft);
              setOpen(false);
            }}
          >
            אישור
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
