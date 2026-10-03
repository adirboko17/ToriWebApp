'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Ban, Bell, Calendar, CalendarDays, Check, ChevronRight, Grid3x3, List, Plus, Search, StickyNote } from 'lucide-react';
import { api } from '@/lib/client';
import { addDays, israelNow } from '@/lib/availability';
import { durationOf, slotMinutes, visitsOf, type Visit } from '@/lib/visits';
import { ClientProfile, type ClientTarget } from './admin-clients';
import {
  HE_LETTERS,
  HE_MONTHS,
  HE_MONTHS_SHORT,
  HE_SHORT_WEEKDAYS,
  HE_WEEKDAYS,
  addMonths,
  clock,
  daysInMonth,
  dow,
  hebrewDay,
  hebrewDayMonth,
  monthStart,
  reminderColor,
  weekStartOf,
  ymd,
} from '@/lib/calendar-format';
import { HoursOverridesSheet } from './admin-hours';
import {
  AddSheet,
  AgendaRow,
  ConstraintEditorSheet,
  IosAlert,
  ItemSummarySheet,
  MonthDaySheet,
  QuickActionsSheet,
  ReminderEditorSheet,
  SearchSheet,
} from './admin-calendar-sheets';

type Mode = 'day' | 'week' | 'month' | 'list';
const VIEWS = [
  ['day', 'יומי', Calendar],
  ['week', 'שבועי', CalendarDays],
  ['month', 'חודשי', Grid3x3],
  ['list', 'רשימה', List],
] as const;
const STORAGE_KEY = 'tori-calendar-view';
const ROW = 90;
const WEEK_HOUR = 78;
const MONTHS_AROUND = 12;

const isFullDay = (c: any) => slotMinutes(c.start_time) <= 0 && slotMinutes(c.end_time) >= 23 * 60 + 45;
const endOf = (start: number, duration: number) => start + Math.max(1, duration || 30);
const reminderEnd = (r: any) => endOf(slotMinutes(r.start_time), Number(r.duration_minutes) || 30);
const overlaps = (a1: number, a2: number, b1: number, b2: number) => a1 < b2 && b1 < a2;

function groupBy<T>(items: T[], key: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(key(item), [...(map.get(key(item)) || []), item]);
  return map;
}

function weekTitle(start: string) {
  const a = ymd(start);
  const b = ymd(addDays(start, 6));
  if (a.m === b.m) return `${HE_MONTHS[a.m]} ${a.y}`;
  if (a.y !== b.y) return `${HE_MONTHS_SHORT[a.m]} ${a.y} – ${HE_MONTHS_SHORT[b.m]} ${b.y}`;
  return `${HE_MONTHS_SHORT[a.m]} – ${HE_MONTHS_SHORT[b.m]} ${a.y}`;
}

function useNowMinute() {
  const [minute, setMinute] = useState(() => israelNow().minute);
  useEffect(() => {
    const timer = setInterval(() => setMinute(israelNow().minute), 30000);
    return () => clearInterval(timer);
  }, []);
  return minute;
}

function useSwipe(onPrev: () => void, onNext: () => void) {
  const pane = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; active: boolean | null } | null>(null);
  const handlers = useRef({ onPrev, onNext });
  handlers.current = { onPrev, onNext };
  const reset = (el: HTMLElement, animate: boolean) => {
    el.style.transition = animate ? 'transform .25s ease' : 'none';
    el.style.transform = '';
  };
  return {
    ref: pane,
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY, active: null };
    },
    onTouchMove: (e: React.TouchEvent) => {
      const s = start.current;
      const el = pane.current;
      if (!s || !el) return;
      const t = e.touches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (s.active === null) {
        if (Math.abs(dx) > 22 && Math.abs(dx) > Math.abs(dy) * 1.2) s.active = true;
        else if (Math.abs(dy) > 18) s.active = false;
      }
      if (s.active) {
        el.style.transition = 'none';
        el.style.transform = `translateX(${dx}px)`;
      }
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current;
      const el = pane.current;
      start.current = null;
      if (!s?.active || !el) return;
      const dx = e.changedTouches[0].clientX - s.x;
      if (Math.abs(dx) < 50) return reset(el, true);
      el.style.transition = 'transform .2s ease';
      el.style.transform = `translateX(${dx > 0 ? el.offsetWidth : -el.offsetWidth}px)`;
      setTimeout(() => {
        if (dx > 0) handlers.current.onNext();
        else handlers.current.onPrev();
        reset(el, false);
      }, 200);
    },
    onTouchCancel: () => {
      start.current = null;
      if (pane.current) reset(pane.current, true);
    },
  };
}

function HoldButton({
  className,
  label,
  onTap,
  onHold,
  children,
}: {
  className?: string;
  label?: string;
  onTap: () => void;
  onHold: () => void;
  children: ReactNode;
}) {
  const timer = useRef<number | null>(null);
  const held = useRef(false);
  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        held.current = false;
        clear();
        timer.current = window.setTimeout(() => {
          held.current = true;
          onHold();
        }, 420);
      }}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onContextMenu={(e) => {
        e.preventDefault();
        held.current = true;
        onHold();
      }}
      onClick={() => {
        if (held.current) {
          held.current = false;
          return;
        }
        onTap();
      }}
    >
      {children}
    </button>
  );
}

type Confirm =
  | { kind: 'appointment'; row: any }
  | { kind: 'constraint'; item: any }
  | { kind: 'reminder'; item: any }
  | null;

export default function AdminCalendar({
  slug,
  userId,
  version,
  focusDate,
  onBook,
}: {
  slug: string;
  userId: string;
  version: number;
  focusDate?: string;
  onBook: (date: string) => void;
}) {
  const today = israelNow().date;
  const nowMinute = useNowMinute();
  const [mode, setModeState] = useState<Mode>('day');
  const [date, setDate] = useState(today);
  const [data, setData] = useState<any>(null);
  const [months, setMonths] = useState<any>(null);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState<DOMRect | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(monthStart(today));
  const [topHeight, setTopHeight] = useState(0);
  const [adding, setAdding] = useState(false);
  const [hoursSheet, setHoursSheet] = useState<{ date: string | null } | null>(null);
  const [searching, setSearching] = useState(false);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [clientTarget, setClientTarget] = useState<ClientTarget | null>(null);
  const [summary, setSummary] = useState<{ kind: 'constraint' | 'reminder'; item: any } | null>(null);
  const [constraintDraft, setConstraintDraft] = useState<any>(null);
  const [reminderDraft, setReminderDraft] = useState<any>(null);
  const [monthDay, setMonthDay] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const viewButton = useRef<HTMLButtonElement>(null);
  const scrolledFor = useRef('');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Mode | null;
    if (saved && VIEWS.some(([m]) => m === saved)) setModeState(saved);
  }, []);
  const setMode = (next: Mode) => {
    setModeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    setMenu(null);
  };
  const reload = () => setTick((t) => t + 1);
  useEffect(() => {
    if (focusDate) setDate(focusDate);
  }, [focusDate]);

  const weekStart = weekStartOf(date);
  const [from, to] =
    mode === 'month'
      ? [addMonths(today, -MONTHS_AROUND), addDays(addMonths(today, MONTHS_AROUND + 1), -1)]
      : mode === 'list'
        ? [addDays(today, -28), addDays(today, 171)]
        : [weekStart, addDays(weekStart, 6)];

  useEffect(() => {
    let live = true;
    setError('');
    const query: Record<string, string> = { from, to };
    if (mode === 'month') query.mode = 'months';
    api(slug, 'admin-calendar', undefined, query)
      .then((r) => {
        if (!live) return;
        if (mode === 'month') setMonths(r);
        else setData({ ...r, from, to });
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [slug, mode === 'month' ? 'month' : `${from}|${to}`, version, tick]);

  useLayoutEffect(() => {
    const el = top.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setTopHeight(el.offsetHeight));
    observer.observe(el);
    setTopHeight(el.offsetHeight);
    return () => observer.disconnect();
  }, []);

  const ready = !!data && data.from === from && data.to === to;
  const visits = useMemo(
    () => (ready ? visitsOf(data.appointments.filter((a: any) => a.status !== 'cancelled')) : []),
    [data, ready],
  );
  const visitsByDate = useMemo(() => groupBy(visits, (v) => v.slot_date), [visits]);
  const constraintsByDate = useMemo(
    () => groupBy<any>(ready ? data.constraints : [], (c) => c.date),
    [data, ready],
  );
  const remindersByDate = useMemo(
    () => groupBy<any>(ready ? data.reminders : [], (r) => r.event_date),
    [data, ready],
  );
  const overrideDates = useMemo(
    () => new Set<string>((ready ? data.overrides : []).map((o: any) => o.date)),
    [data, ready],
  );

  function hoursFor(day: string) {
    const row =
      data?.overrides?.find((o: any) => o.date === day) ||
      data?.hours?.find((h: any) => h.day_of_week === dow(day));
    return {
      start: row?.start_time ? slotMinutes(row.start_time) : 7 * 60,
      end: row?.end_time ? slotMinutes(row.end_time) : 21 * 60,
      active: !!row && row.is_active !== false,
    };
  }
  function fullyBlocked(day: string) {
    const list = constraintsByDate.get(day) || [];
    if (!list.length) return false;
    if (list.some(isFullDay)) return true;
    const hours = hoursFor(day);
    if (!hours.active) return false;
    let covered = hours.start;
    for (const c of [...list].sort((a, b) => slotMinutes(a.start_time) - slotMinutes(b.start_time))) {
      if (slotMinutes(c.start_time) > covered) break;
      covered = Math.max(covered, slotMinutes(c.end_time));
    }
    return covered >= hours.end;
  }

  useEffect(() => {
    if (mode === 'day' || mode === 'week') window.scrollTo({ top: 0 });
  }, [date, mode]);

  useEffect(() => {
    if (mode !== 'month' && mode !== 'list') return;
    const selector = mode === 'month' ? '[data-month]' : '[data-agenda-date]';
    const onScroll = () => {
      let current = '';
      for (const el of document.querySelectorAll<HTMLElement>(selector)) {
        if (el.getBoundingClientRect().top - topHeight > 40) break;
        current = el.dataset.month || el.dataset.agendaDate || '';
      }
      if (current) setVisibleMonth(monthStart(current));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [mode, topHeight, visits, months]);

  useEffect(() => {
    if (mode === 'month' ? !months : mode === 'list' ? !ready : true) return;
    if (scrolledFor.current === mode) return;
    scrolledFor.current = mode;
    const target =
      mode === 'month'
        ? document.querySelector<HTMLElement>(`[data-month="${monthStart(date)}"]`)
        : [...document.querySelectorAll<HTMLElement>('[data-agenda-date]')].find(
            (el) => (el.dataset.agendaDate || '') >= today,
          );
    setVisibleMonth(monthStart(mode === 'month' ? date : target?.dataset.agendaDate || today));
    if (target) window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - topHeight });
  }, [mode, months, ready]);
  useEffect(() => {
    if (mode === 'day' || mode === 'week') scrolledFor.current = '';
  }, [mode]);

  const swipe = useSwipe(
    () => setDate((d) => addDays(d, -7)),
    () => setDate((d) => addDays(d, 7)),
  );

  const title = mode === 'month' || mode === 'list'
    ? `${HE_MONTHS[ymd(visibleMonth).m]} ${ymd(visibleMonth).y}`
    : weekTitle(weekStart);

  function goToday() {
    setDate(today);
    if (mode === 'month' || mode === 'list') {
      const target =
        mode === 'month'
          ? document.querySelector<HTMLElement>(`[data-month="${monthStart(today)}"]`)
          : [...document.querySelectorAll<HTMLElement>('[data-agenda-date]')].find(
              (el) => (el.dataset.agendaDate || '') >= today,
            );
      if (target)
        window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - topHeight, behavior: 'smooth' });
    }
  }

  const isPastRow = (row: any) =>
    row.slot_date < today ||
    (row.slot_date === today && slotMinutes(row.slot_time) + durationOf(row) < nowMinute);

  async function confirmDelete() {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === 'appointment') {
        await api(slug, 'admin-remove', { id: confirm.row.id });
        setVisit((v) => {
          if (!v || v.rows.length <= 1) return null;
          const rows = v.rows.filter((r: any) => r.id !== confirm.row.id);
          return rows.length ? { ...visitsOf(rows)[0], rows } : null;
        });
      } else if (confirm.kind === 'constraint') {
        await api(slug, 'admin-hours', { kind: 'constraint', id: confirm.item.id, remove: true });
        setSummary(null);
      } else {
        await api(slug, 'admin-reminder', { id: confirm.item.id, remove: true });
        setSummary(null);
      }
      setConfirm(null);
      reload();
    } catch (e: any) {
      setConfirm(null);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const alert =
    confirm?.kind === 'appointment'
      ? {
          title: 'מחיקת תור',
          message: isPastRow(confirm.row)
            ? 'התור כבר הסתיים. הפעולה תמחק את הרשומה לצמיתות (כאילו לא היה).'
            : 'התור עדיין לפנינו. המשבצת תשוחרר ויהיה אפשר לקבוע תור אחר במקום.',
        }
      : confirm?.kind === 'constraint'
        ? { title: 'מחיקת אילוץ', message: 'המשבצות ישתחררו ולקוחות יוכלו לקבוע תור בזמן הזה.' }
        : { title: 'מחיקת תזכורת', message: 'התזכורת תוסר מהיומן.' };

  const openSummary = (kind: 'constraint' | 'reminder', item: any) => setSummary({ kind, item });
  const addDate = date < today ? today : date;
  const openDayHours = (day: string) => setHoursSheet({ date: day });

  return (
    <div className={`cal cal-mode-${mode}`}>
      <div className="cal-top" ref={top}>
        <header className="cal-head">
          <button type="button" className="cal-title" onClick={goToday} aria-label={`${title} · מעבר להיום`}>
            <h1>{title}</h1>
            <ChevronRight size={18} strokeWidth={2.6} />
          </button>
          <div className="cal-actions">
            <button type="button" aria-label="הוספה" onClick={() => setAdding(true)}>
              <Plus size={26} strokeWidth={2.2} />
            </button>
            <button type="button" aria-label="חיפוש" onClick={() => setSearching(true)}>
              <Search size={23} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              ref={viewButton}
              aria-label="תצוגת יומן"
              aria-expanded={!!menu}
              onClick={() => setMenu(menu ? null : viewButton.current!.getBoundingClientRect())}
            >
              {(() => {
                const Icon = VIEWS.find(([m]) => m === mode)![2];
                return <Icon size={23} strokeWidth={2.2} />;
              })()}
            </button>
          </div>
        </header>
        {mode === 'day' && (
          <div className="cal-strip">
            {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d) => {
              const selected = d === date;
              const blocked = fullyBlocked(d);
              const parts = [HE_LETTERS[dow(d)], String(ymd(d).d)];
              if (blocked) parts.push('יום חסום לחלוטין באילוץ');
              if (overrideDates.has(d)) parts.push('יש חריגת שעות');
              parts.push('החזיקו כדי להוסיף חריגה');
              return (
                <HoldButton
                  key={d}
                  className={`${selected ? 'is-selected' : ''}${d === today ? ' is-today' : ''}${blocked ? ' is-blocked' : ''}`}
                  label={parts.join(', ')}
                  onTap={() => setDate(d)}
                  onHold={() => openDayHours(d)}
                >
                  <span>{HE_LETTERS[dow(d)]}</span>
                  <b>
                    {ymd(d).d}
                    {overrideDates.has(d) && <span className="cal-override" />}
                  </b>
                  <i className={visitsByDate.has(d) ? 'is-marked' : ''} />
                </HoldButton>
              );
            })}
          </div>
        )}
        {mode === 'week' && (
          <div className="week-head">
            <span className="week-gutter" />
            {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d) => (
              <HoldButton
                key={d}
                className={`${d === date ? 'is-selected' : ''}${d === today ? ' is-today' : ''}`}
                label={`${HE_LETTERS[dow(d)]} ${ymd(d).d}${overrideDates.has(d) ? ', יש חריגת שעות' : ''}, החזיקו כדי להוסיף חריגה`}
                onTap={() => setDate(d)}
                onHold={() => openDayHours(d)}
              >
                <em>{HE_LETTERS[dow(d)]}</em>
                <b>
                  {ymd(d).d}
                  {overrideDates.has(d) && <span className="cal-override" />}
                </b>
                {visitsByDate.has(d) && <i />}
                <small>{HE_SHORT_WEEKDAYS[dow(d)]}</small>
              </HoldButton>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="error-note cal-error" role="alert">
          {error}
        </p>
      )}

      {mode === 'day' && (
        <div className="cal-pane" {...swipe}>
          <DayTimeline
            date={date}
            today={today}
            nowMinute={nowMinute}
            ready={ready}
            hours={hoursFor(date)}
            visits={visitsByDate.get(date) || []}
            constraints={constraintsByDate.get(date) || []}
            reminders={remindersByDate.get(date) || []}
            onVisit={setVisit}
            onConstraint={(c) => openSummary('constraint', c)}
            onReminder={(r) => openSummary('reminder', r)}
          />
        </div>
      )}
      {mode === 'week' && (
        <div className="cal-pane" {...swipe}>
          <WeekGrid
            weekStart={weekStart}
            selected={date}
            visitsByDate={visitsByDate}
            constraintsByDate={constraintsByDate}
            remindersByDate={remindersByDate}
            onVisit={setVisit}
            onConstraint={(c) => openSummary('constraint', c)}
            onReminder={(r) => openSummary('reminder', r)}
          />
        </div>
      )}
      {mode === 'month' &&
        (!months ? (
          <div className="cal-loading">
            <div className="loading-ring" />
          </div>
        ) : (
          <MonthList
            today={today}
            selected={date}
            counts={months.counts}
            constraintDates={new Set(months.constraintDates)}
            overrideDates={new Set(months.overrideDates || [])}
            onDay={(d) => {
              setDate(d);
              setMonthDay(d);
            }}
            onHoldDay={openDayHours}
          />
        ))}
      {mode === 'list' &&
        (!ready ? (
          <div className="cal-loading">
            <div className="loading-ring" />
          </div>
        ) : (
          <AgendaList visits={visits} today={today} onVisit={setVisit} />
        ))}

      {menu && (
        <div className="cal-menu-layer" onClick={() => setMenu(null)}>
          <div
            className="cal-menu"
            role="menu"
            style={{
              top: menu.bottom + 4,
              left: Math.min(Math.max(10, menu.right - 168), window.innerWidth - 178),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {VIEWS.map(([m, label, Icon]) => (
              <button type="button" role="menuitemradio" aria-checked={mode === m} key={m} onClick={() => setMode(m)}>
                <Icon size={20} />
                <span>{label}</span>
                <i>{mode === m && <Check size={18} strokeWidth={2.6} />}</i>
              </button>
            ))}
          </div>
        </div>
      )}

      <AddSheet
        open={adding}
        onClose={() => setAdding(false)}
        onPick={(kind) => {
          setAdding(false);
          if (kind === 'appointment') onBook(addDate);
          else if (kind === 'reminder')
            setReminderDraft({ event_date: addDate, start_time: '09:00', duration_minutes: 30, color_key: 'blue' });
          else if (kind === 'override') setHoursSheet({ date: null });
          else setConstraintDraft({ date: addDate, start_time: '12:00', end_time: '13:00' });
        }}
      />
      <HoursOverridesSheet
        slug={slug}
        userId={userId}
        open={!!hoursSheet}
        date={hoursSheet?.date ?? null}
        onClose={() => setHoursSheet(null)}
        onChanged={reload}
      />
      <SearchSheet
        open={searching}
        slug={slug}
        onClose={() => setSearching(false)}
        onPick={(v) => {
          setSearching(false);
          setVisit(v);
        }}
      />
      <MonthDaySheet
        slug={slug}
        date={monthDay}
        version={version + tick}
        onClose={() => setMonthDay(null)}
        onVisit={setVisit}
        onConstraint={(c) => openSummary('constraint', c)}
        onReminder={(r) => openSummary('reminder', r)}
      />
      <QuickActionsSheet
        visit={visit}
        onClose={() => setVisit(null)}
        onDelete={(row) => setConfirm({ kind: 'appointment', row })}
        onOpenClient={(v) => {
          const row = v.rows[0] || {};
          setClientTarget({
            id: row.client_user_id || undefined,
            alt: row.user_id && row.user_id !== row.barber_id ? row.user_id : undefined,
            name: v.client_name || '',
            phone: String(v.client_phone || '').trim(),
          });
        }}
      />
      <ClientProfile slug={slug} target={clientTarget} onClose={() => setClientTarget(null)} />
      <ItemSummarySheet
        item={summary?.item || null}
        kind={summary?.kind || 'constraint'}
        onClose={() => setSummary(null)}
        onEdit={() => {
          const s = summary!;
          setSummary(null);
          if (s.kind === 'constraint') setConstraintDraft(s.item);
          else setReminderDraft(s.item);
        }}
        onDelete={() => setConfirm({ kind: summary!.kind, item: summary!.item } as Confirm)}
      />
      <ConstraintEditorSheet
        slug={slug}
        userId={userId}
        draft={constraintDraft}
        onClose={() => setConstraintDraft(null)}
        onSaved={() => {
          setConstraintDraft(null);
          reload();
        }}
      />
      <ReminderEditorSheet
        slug={slug}
        draft={reminderDraft}
        onClose={() => setReminderDraft(null)}
        onSaved={() => {
          setReminderDraft(null);
          reload();
        }}
      />
      <IosAlert
        open={!!confirm}
        title={alert.title}
        message={alert.message}
        confirm="מחק"
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function DayTimeline({
  date,
  today,
  nowMinute,
  ready,
  hours,
  visits,
  constraints,
  reminders,
  onVisit,
  onConstraint,
  onReminder,
}: {
  date: string;
  today: string;
  nowMinute: number;
  ready: boolean;
  hours: { start: number; end: number };
  visits: Visit[];
  constraints: any[];
  reminders: any[];
  onVisit: (v: Visit) => void;
  onConstraint: (c: any) => void;
  onReminder: (r: any) => void;
}) {
  const bounds = useMemo(() => {
    if (constraints.some(isFullDay)) return { start: 0, end: 24 * 60 };
    let start = hours.start;
    let end = hours.end;
    for (const c of constraints) {
      const s = slotMinutes(c.start_time);
      const e = slotMinutes(c.end_time);
      start = Math.min(start, s);
      end = Math.max(end, e <= s ? s + 30 : e);
    }
    for (const v of visits) {
      start = Math.min(start, slotMinutes(v.slot_time));
      end = Math.max(end, endOf(slotMinutes(v.slot_time), durationOf(v)));
    }
    for (const r of reminders) {
      start = Math.min(start, slotMinutes(r.start_time));
      end = Math.max(end, reminderEnd(r));
    }
    end += 30;
    const snappedStart = Math.max(0, Math.floor(start / 30) * 30);
    return {
      start: snappedStart,
      end: Math.min(24 * 60, Math.max(Math.ceil(end / 30) * 30, snappedStart + 30)),
    };
  }, [hours.start, hours.end, visits, constraints, reminders]);
  const rows = (bounds.end - bounds.start) / 30;
  const y = (minute: number) => ((minute - bounds.start) / 30) * ROW + ROW / 2;
  const splitReminders = new Set<string>();
  const splitVisits = new Set<string>();
  for (const r of reminders)
    for (const v of visits)
      if (
        overlaps(
          slotMinutes(r.start_time),
          reminderEnd(r),
          slotMinutes(v.slot_time),
          slotMinutes(v.slot_time) + durationOf(v),
        )
      ) {
        splitReminders.add(r.id);
        splitVisits.add(v.id);
      }
  const showNow = date === today && nowMinute >= bounds.start && nowMinute <= bounds.end;
  const empty = ready && !visits.length && !constraints.length && !reminders.length;
  return (
    <>
      <div className="day-timeline" style={{ height: rows * ROW }}>
        {Array.from({ length: rows }, (_, i) => (
          <div className="day-row" key={i}>
            <span>{clock(bounds.start + i * 30)}</span>
            <i />
          </div>
        ))}
        {constraints.map((c) => {
          const s = slotMinutes(c.start_time);
          const e = Math.min(slotMinutes(c.end_time), bounds.end);
          const top = y(Math.max(s, bounds.start));
          return (
            <button
              type="button"
              key={c.id}
              className="day-block"
              style={{ top, height: Math.max(((e - Math.max(s, bounds.start)) / 30) * ROW, 44) }}
              onClick={() => onConstraint(c)}
            >
              <span className="day-block-title">
                <Ban size={15} />
                <strong>{c.reason?.trim() || 'זמן חסום'}</strong>
              </span>
              <span className="day-block-pill">
                <span dir="ltr">{`${clock(s)} – ${clock(slotMinutes(c.end_time))}`}</span>
                <Ban size={13} />
              </span>
            </button>
          );
        })}
        {reminders.map((r) => {
          const palette = reminderColor(r.color_key);
          const s = slotMinutes(r.start_time);
          return (
            <button
              type="button"
              key={r.id}
              className={`day-note${splitReminders.has(r.id) ? ' is-split' : ''}`}
              style={{
                top: y(s),
                height: Math.max(((Number(r.duration_minutes) || 30) / 30) * ROW, 44),
                '--note-bar': palette.bar,
                '--note-bg': palette.bg,
              } as React.CSSProperties}
              onClick={() => onReminder(r)}
            >
              <span className="day-block-title">
                <StickyNote size={16} />
                <strong>{r.title}</strong>
              </span>
              <span className="day-block-pill">
                <span dir="ltr">{`${clock(s)} – ${clock(reminderEnd(r))}`}</span>
                <Bell size={13} />
              </span>
            </button>
          );
        })}
        {visits.map((v) => {
          const s = slotMinutes(v.slot_time);
          const duration = durationOf(v);
          const height = Math.max((duration / 30) * ROW - 3, 28);
          const compact = height < 52;
          const split = splitVisits.has(v.id);
          const time = compact ? clock(s) : `${clock(s)} – ${clock(s + duration)}`;
          return (
            <button
              type="button"
              key={v.id}
              className={`day-card${compact ? ' is-compact' : ''}${split ? ' is-split' : ''}`}
              style={{ top: y(s) + 1.5, height }}
              onClick={() => onVisit(v)}
              aria-label={`${v.client_name || 'לקוח'}${v.service_name ? `, ${v.service_name}` : ''}, ${clock(s)} – ${clock(s + duration)}`}
            >
              {compact ? (
                <span className="day-card-line">
                  <strong>{v.client_name || 'לקוח'}</strong>
                  {height >= 36 && !split && v.service_name && <em>{v.service_name}</em>}
                  <small dir="ltr">{time}</small>
                </span>
              ) : (
                <>
                  <span className="day-card-line">
                    <strong>{v.client_name || 'לקוח'}</strong>
                    <small dir="ltr">{time}</small>
                  </span>
                  {!split && v.service_name && <em>{v.service_name}</em>}
                </>
              )}
            </button>
          );
        })}
        {showNow && (
          <div className="day-now" style={{ top: y(nowMinute) }}>
            <span />
            <i />
            <b />
          </div>
        )}
      </div>
      {empty && (
        <div className="day-empty">
          <strong>אין תורים ליום זה</strong>
          <span>בחר/י יום אחר מהסרגל העליון</span>
        </div>
      )}
    </>
  );
}

function WeekGrid({
  weekStart,
  selected,
  visitsByDate,
  constraintsByDate,
  remindersByDate,
  onVisit,
  onConstraint,
  onReminder,
}: {
  weekStart: string;
  selected: string;
  visitsByDate: Map<string, Visit[]>;
  constraintsByDate: Map<string, any[]>;
  remindersByDate: Map<string, any[]>;
  onVisit: (v: Visit) => void;
  onConstraint: (c: any) => void;
  onReminder: (r: any) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  let start = 7 * 60;
  let end = 22 * 60;
  for (const d of days) {
    for (const v of visitsByDate.get(d) || []) {
      start = Math.min(start, slotMinutes(v.slot_time));
      end = Math.max(end, slotMinutes(v.slot_time) + durationOf(v));
    }
    for (const c of constraintsByDate.get(d) || []) {
      if (isFullDay(c)) continue;
      start = Math.min(start, slotMinutes(c.start_time));
      end = Math.max(end, slotMinutes(c.end_time));
    }
    for (const r of remindersByDate.get(d) || []) {
      start = Math.min(start, slotMinutes(r.start_time));
      end = Math.max(end, reminderEnd(r));
    }
  }
  start = Math.floor(start / 60) * 60;
  end = Math.min(24 * 60, Math.ceil(end / 60) * 60);
  const hours = (end - start) / 60;
  const y = (m: number) => ((Math.max(start, Math.min(end, m)) - start) / 60) * WEEK_HOUR;
  return (
    <div className="week-body" style={{ height: hours * WEEK_HOUR }}>
      <div className="week-hours">
        {Array.from({ length: hours }, (_, i) => (
          <span key={i}>{clock(start + i * 60)}</span>
        ))}
      </div>
      {days.map((d, index) => (
        <div
          key={d}
          className={`week-col${index % 2 ? ' is-alt' : ''}${d === selected ? ' is-selected' : ''}`}
        >
          {Array.from({ length: hours }, (_, i) => (
            <i key={i} style={{ top: i * WEEK_HOUR }} />
          ))}
          {(constraintsByDate.get(d) || []).map((c) => {
            const top = y(slotMinutes(c.start_time));
            return (
              <button
                type="button"
                key={c.id}
                className="week-block"
                style={{ top, height: Math.max(y(slotMinutes(c.end_time)) - top - 2, 18) }}
                onClick={() => onConstraint(c)}
              >
                <strong>{c.reason?.trim() || 'זמן חסום'}</strong>
                {!isFullDay(c) && <small dir="ltr">{`${clock(slotMinutes(c.start_time))}–${clock(slotMinutes(c.end_time))}`}</small>}
              </button>
            );
          })}
          {(remindersByDate.get(d) || []).map((r) => {
            const palette = reminderColor(r.color_key);
            const top = y(slotMinutes(r.start_time));
            return (
              <button
                type="button"
                key={r.id}
                className="week-note"
                style={{
                  top,
                  height: Math.max(y(reminderEnd(r)) - top - 2, 18),
                  '--note-bar': palette.bar,
                  '--note-bg': palette.bg,
                } as React.CSSProperties}
                onClick={() => onReminder(r)}
              >
                <strong>{r.title}</strong>
              </button>
            );
          })}
          {(visitsByDate.get(d) || []).map((v) => {
            const top = y(slotMinutes(v.slot_time)) + 1;
            const height = Math.max(((durationOf(v) / 60) * WEEK_HOUR) - 2, 14);
            const compact = height < 36;
            const name = v.client_name || 'לקוח';
            return (
              <button
                type="button"
                key={v.id}
                className={`week-card${height < 22 ? ' is-micro' : ''}`}
                style={{ top, height }}
                onClick={() => onVisit(v)}
                aria-label={`${name}${v.service_name ? `, ${v.service_name}` : ''}`}
              >
                <strong>{compact ? name.trim().split(/\s+/)[0] : name}</strong>
                {height >= 44 && v.service_name && <small>{v.service_name}</small>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function MonthList({
  today,
  selected,
  counts,
  constraintDates,
  overrideDates,
  onDay,
  onHoldDay,
}: {
  today: string;
  selected: string;
  counts: Record<string, number>;
  constraintDates: Set<string>;
  overrideDates: Set<string>;
  onDay: (d: string) => void;
  onHoldDay: (d: string) => void;
}) {
  const months = Array.from({ length: MONTHS_AROUND * 2 + 1 }, (_, i) => addMonths(today, i - MONTHS_AROUND));
  return (
    <div className="month-list">
      {months.map((first) => {
        const lead = dow(first);
        const cells: (string | null)[] = [
          ...Array(lead).fill(null),
          ...Array.from({ length: daysInMonth(first) }, (_, i) => addDays(first, i)),
        ];
        while (cells.length % 7) cells.push(null);
        const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
        const { y, m } = ymd(first);
        return (
          <section className="month-block" key={first} data-month={first}>
            <h2>{HE_MONTHS[m]}</h2>
            <p>{y}</p>
            <div className="month-weekdays">
              {HE_LETTERS.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
            <div className="month-weeks">
              {weeks.map((week, i) => (
                <div className="month-week" key={i}>
                  {week.map((d, j) => {
                    if (!d) return <span key={`e${j}`} className="month-cell is-empty" />;
                    const count = counts[d] || 0;
                    return (
                      <HoldButton
                        key={d}
                        className={`month-cell${d === today ? ' is-today' : d === selected ? ' is-selected' : ''}${d < today ? ' is-past' : ''}`}
                        label={`${ymd(d).d}${count ? `, ${count === 1 ? 'תור אחד' : `${count} תורים`}` : ''}${constraintDates.has(d) ? ', אילוץ' : ''}${overrideDates.has(d) ? ', יש חריגת שעות' : ''}, החזיקו כדי להוסיף חריגה`}
                        onTap={() => onDay(d)}
                        onHold={() => onHoldDay(d)}
                      >
                        <b>
                          {ymd(d).d}
                          {overrideDates.has(d) && <span className="cal-override" />}
                        </b>
                        <small>{hebrewDay(d)}</small>
                        <span className="month-pills">
                          {count > 0 && <em className="month-count">{count === 1 ? 'תור אחד' : `${count} תורים`}</em>}
                          {constraintDates.has(d) && <em className="month-block-pill">אילוץ</em>}
                        </span>
                      </HoldButton>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        );
      })}
      <p className="month-hint">הקישו על יום כדי לראות את היום. החזיקו על יום כדי להוסיף חריגה.</p>
    </div>
  );
}

function AgendaList({ visits, today, onVisit }: { visits: Visit[]; today: string; onVisit: (v: Visit) => void }) {
  if (!visits.length)
    return (
      <div className="agenda-empty">
        <strong>אין תורים להצגה</strong>
        <span>תורים מהשבועות האחרונים וכל התורים הקרובים יופיעו כאן לפי תאריך</span>
      </div>
    );
  const groups = groupBy(visits, (v) => v.slot_date);
  return (
    <div className="agenda">
      {[...groups.entries()].map(([d, list]) => (
        <section key={d}>
          <header className={`agenda-head${d === today ? ' is-today' : ''}`} data-agenda-date={d}>
            <strong>{`${HE_WEEKDAYS[dow(d)]} – ${ymd(d).d} ב${HE_MONTHS_SHORT[ymd(d).m]}`}</strong>
            <span>{hebrewDayMonth(d)}</span>
          </header>
          {list.map((v) => (
            <AgendaRow key={v.id} visit={v} onPress={() => onVisit(v)} />
          ))}
        </section>
      ))}
    </div>
  );
}
