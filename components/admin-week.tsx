'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/client';
import { addDays, israelNow } from '@/lib/availability';
import { HE_LETTERS, dow } from '@/lib/calendar-format';

const EMPTY = [0, 0, 0, 0, 0, 0, 0];
const SWIPE = 44;
const SNAP_MS = 300;

const utc = (d: string) => new Date(`${d}T12:00:00Z`);
function rangeLabel(from: string) {
  const to = addDays(from, 6);
  const same = from.slice(0, 7) === to.slice(0, 7);
  const fmt = (d: string, month: boolean) =>
    utc(d).toLocaleDateString('he-IL', { timeZone: 'UTC', day: 'numeric', ...(month ? { month: 'short' } : {}) });
  return `${fmt(from, !same)} – ${fmt(to, true)}`;
}
function relativeLabel(offset: number) {
  if (offset === 0) return 'השבוע';
  if (offset === -1) return 'השבוע שעבר';
  if (offset === 1) return 'שבוע הבא';
  return offset < 0 ? `לפני ${-offset} שבועות` : `בעוד ${offset} שבועות`;
}

function Week({ from, counts, today, center }: { from: string; counts: number[]; today: string; center: boolean }) {
  const max = Math.max(...counts, 1);
  return (
    <div className="wk-row">
      {counts.map((count, i) => {
        const day = addDays(from, i);
        const progress = count === 0 ? 0 : Math.max(0.14, count / max);
        return (
          <div className="wk-col" key={i}>
            <b>{count > 0 ? count : ''}</b>
            <span
              className={`wk-bar${center ? ' is-live' : ''}`}
              style={{
                height: `calc(28px + (100% - 28px) * ${progress})`,
                background: `color-mix(in srgb, var(--primary) ${Math.round(progress * 100)}%, color-mix(in srgb, var(--primary) 13%, transparent))`,
              }}
            />
            <small className={day === today ? 'is-today' : ''}>
              {HE_LETTERS[i]}
              {day === today && <i />}
            </small>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminWeek({ slug }: { slug: string }) {
  const today = israelNow().date;
  const thisWeek = addDays(today, -dow(today));
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<Record<number, number[]>>({});
  const [dx, setDx] = useState(0);
  const [snapping, setSnapping] = useState(false);
  const [width, setWidth] = useState(300);
  const clip = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const loading = useRef(new Set<number>());

  const weekOf = (o: number) => addDays(thisWeek, o * 7);

  useEffect(() => {
    for (const o of [offset - 1, offset, offset + 1]) {
      if (data[o] || loading.current.has(o)) continue;
      loading.current.add(o);
      api(slug, 'admin-week', undefined, { from: weekOf(o) })
        .then((counts) => setData((d) => ({ ...d, [o]: counts })))
        .catch(() => setData((d) => (d[o] ? d : { ...d, [o]: EMPTY })))
        .finally(() => loading.current.delete(o));
    }
  }, [offset, slug]);

  useEffect(() => {
    const el = clip.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, [data[0] !== undefined]);

  function go(direction: -1 | 1) {
    if (snapping) return;
    setSnapping(true);
    setDx(direction === -1 ? -width : width);
    setTimeout(() => {
      setSnapping(false);
      setDx(0);
      setOffset((o) => o + direction);
    }, SNAP_MS);
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (snapping) return;
    drag.current = { x: e.clientX, y: e.clientY, active: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (!d.active) {
      if (Math.abs(my) > 14 && Math.abs(my) > Math.abs(mx)) {
        drag.current = null;
        return;
      }
      if (Math.abs(mx) < 12) return;
      d.active = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    setDx(mx);
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active) return;
    if (dx < -SWIPE) go(-1);
    else if (dx > SWIPE) go(1);
    else {
      setSnapping(true);
      setDx(0);
      setTimeout(() => setSnapping(false), SNAP_MS);
    }
  };

  if (data[0] === undefined)
    return (
      <section className="wk wk-loading" role="status">
        <span className="cl-spinner" />
      </section>
    );

  const counts = data[offset] || EMPTY;
  const total = counts.reduce((a, b) => a + b, 0);
  const slide = drag.current?.active ? '' : snapping ? ' is-snapping' : '';
  return (
    <section className="wk" aria-label="מצב השבוע">
      <div className="wk-head">
        <div>
          <h2>מצב השבוע</h2>
          <p>{relativeLabel(offset)}</p>
        </div>
        <span className="wk-total">
          <small>תורים השבוע</small>
          <b>{total}</b>
        </span>
      </div>
      <div
        className="wk-clip"
        ref={clip}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {([-1, 0, 1] as const).map((slot) => (
          <div
            className={`wk-slot${slide}`}
            key={offset + slot}
            style={{ transform: `translateX(${-slot * width + dx}px)` }}
          >
            <Week from={weekOf(offset + slot)} counts={data[offset + slot] || EMPTY} today={today} center={slot === 0} />
          </div>
        ))}
      </div>
      <div className="wk-foot">
        <button type="button" aria-label="שבוע קודם" onClick={() => go(-1)}>
          <ChevronRight size={16} strokeWidth={2.4} />
        </button>
        <span>{rangeLabel(weekOf(offset))}</span>
        <button type="button" aria-label="שבוע הבא" onClick={() => go(1)}>
          <ChevronLeft size={16} strokeWidth={2.4} />
        </button>
      </div>
    </section>
  );
}
