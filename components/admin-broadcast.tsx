'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  List,
  Megaphone,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import BottomSheet from './bottom-sheet';
import { api } from '@/lib/client';
import { addDays, israelNow } from '@/lib/availability';
import { HE_DAYS, HE_LETTERS, HE_MONTHS, dow } from '@/lib/calendar-format';
import { clientMatchesTextSearch } from '@/lib/phone';

type Client = { id: string; name: string; phone: string };
type Audience = 'all' | 'appointments' | 'selected' | 'inactive';
type Scheduled = {
  id: string;
  title: string;
  content: string;
  channel: 'push' | 'sms' | 'both';
  audience: Audience;
  appointment_dates: string[] | null;
  recipient_user_ids: string[] | null;
  inactive_days: number | null;
  scheduled_at: string;
  status: 'scheduled' | 'sending';
};
type Overview = {
  owner: boolean;
  allCount?: number;
  clients?: Client[];
  booked?: Record<string, string[]>;
  scheduled?: Scheduled[];
};
type Step = 'home' | 'list' | 'channel' | 'audience' | 'compose' | 'when' | 'time' | 'preview';
type Dialog = { title: string; message: string; after?: () => void };

const TITLE_MAX = 40;
const CONTENT_MAX = 80;
const ISRAEL_TZ = 'Asia/Jerusalem';
const PERIODS: [number, string][] = [
  [30, 'חודש'],
  [45, 'חודש וחצי'],
  [60, 'חודשיים'],
  [90, '3 חודשים'],
  [180, 'חצי שנה'],
];
const AUDIENCES: [Audience, string, string, typeof Users][] = [
  ['all', 'כל הלקוחות', 'כל הלקוחות הרשומים', Users],
  ['appointments', 'עם תורים', 'רק מי שיש לו תור', CalendarDays],
  ['selected', 'בחירת לקוחות', 'מסמנים מהרשימה', UserCheck],
  ['inactive', 'לא קבעו תור', 'לפי תקופה שתבחרו', Clock],
];
const COMPOSE_TITLE: Record<Audience, string> = {
  all: 'שליחת התראה לכל הלקוחות',
  appointments: 'התראה ללקוחות עם תורים',
  selected: 'התראה ללקוחות שנבחרו',
  inactive: 'התראה ללקוחות שלא קבעו תור',
};
const CHANNEL_LABEL = { push: 'פוש על המסך', sms: 'SMS', both: 'גם וגם' };
const AUDIENCE_LABEL: Record<Audience, string> = {
  all: 'כל הלקוחות',
  appointments: 'עם תורים',
  selected: 'בחירת לקוחות',
  inactive: 'לא קבעו תור',
};
const GENERIC_ERROR = 'לא ניתן לשלוח. בדקו חיבור או שיש לפחות לקוח אחד עם מספר טלפון.';
const SMS_SHORT = 'אין יתרת SMS מספקת לשליחה זו. אפשר להוסיף הודעות SMS בעמוד הראשי.';

const pad = (n: number) => String(n).padStart(2, '0');
const periodLabel = (days: number) => PERIODS.find(([d]) => d === days)?.[1] || '';
const countSentence = (n: number) => `${n} לקוחות יקבלו התראה`;
function addMonths(month: string, n: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}
function israelParts(iso: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ISRAEL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const v = (k: string) => parts.find((p) => p.type === k)!.value;
  return { date: `${v('year')}-${v('month')}-${v('day')}`, hour: +v('hour'), minute: +v('minute') };
}
const wallLabel = (date: string, hour: number, minute: number) =>
  `${+date.slice(8)}.${+date.slice(5, 7)}.${date.slice(0, 4)}, ${pad(hour)}:${pad(minute)}`;
function isFuture(date: string, hour: number, minute: number) {
  const now = israelNow();
  if (date !== now.date) return date > now.date;
  return hour * 60 + minute - (now.minute + new Date().getSeconds() / 60) > 0.5;
}

function Hero({ icon: Icon, title, sub }: { icon: typeof Users; title: string; sub: string }) {
  return (
    <div className="bc-hero">
      <span>
        <i>
          <Icon size={26} />
        </i>
      </span>
      <h2>{title}</h2>
      <p>{sub}</p>
    </div>
  );
}
function Head({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="bc-head">
      <h2>{title}</h2>
      <p>{sub}</p>
    </div>
  );
}
function Card({
  on,
  onClick,
  icon: Icon,
  title,
  sub,
  kind,
}: {
  on: boolean;
  onClick: () => void;
  icon: typeof Users;
  title: string;
  sub: string;
  kind: 'channel' | 'audience' | 'when';
}) {
  return (
    <button type="button" className={`bc-card is-${kind}${on ? ' is-on' : ''}`} aria-pressed={on} onClick={onClick}>
      <em className="bc-card-check">{on && <Check size={kind === 'audience' ? 11 : 12} strokeWidth={3} />}</em>
      <span className="bc-card-icon">
        <Icon size={22} strokeWidth={2.15} />
      </span>
      <strong>{title}</strong>
      <small>{sub}</small>
    </button>
  );
}
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={`bc-chip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}
function Summary({ icon: Icon, children }: { icon: typeof Users; children: React.ReactNode }) {
  return (
    <p className="bc-summary">
      <Icon size={15} />
      {children}
    </p>
  );
}

function MonthGrid({
  variant,
  today,
  isOn,
  onPick,
  count,
  month,
  setMonth,
}: {
  variant: 'days' | 'date';
  today: string;
  isOn: (d: string) => boolean;
  onPick: (d: string) => void;
  count?: (d: string) => number | undefined;
  month: string;
  setMonth: (m: string) => void;
}) {
  const minMonth = today.slice(0, 7);
  const maxMonth = addMonths(minMonth, 6);
  const swipe = useRef<number | null>(null);
  const first = `${month}-01`;
  const cells: (string | null)[] = Array(dow(first)).fill(null);
  for (let d = first; d.startsWith(month); d = addDays(d, 1)) cells.push(d);
  const go = (n: number) => {
    const next = addMonths(month, n);
    if (next >= minMonth && next <= maxMonth) setMonth(next);
  };
  return (
    <div className={`bc-cal is-${variant}`}>
      <div className="bc-cal-head">
        <button type="button" aria-label="החודש הקודם" disabled={month <= minMonth} onClick={() => go(-1)}>
          <ChevronRight size={20} />
        </button>
        <strong>
          {HE_MONTHS[+month.slice(5) - 1]} {month.slice(0, 4)}
        </strong>
        <button type="button" aria-label="החודש הבא" disabled={month >= maxMonth} onClick={() => go(1)}>
          <ChevronLeft size={20} />
        </button>
      </div>
      <div className="bc-cal-week">
        {HE_LETTERS.map((l) => (
          <span key={l}>{variant === 'days' ? `${l}׳` : l}</span>
        ))}
      </div>
      <div
        className="bc-cal-grid"
        onPointerDown={(e) => (swipe.current = e.clientX)}
        onPointerUp={(e) => {
          if (swipe.current === null) return;
          const dx = e.clientX - swipe.current;
          swipe.current = null;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        }}
      >
        {cells.map((d, i) => {
          if (!d) return <span key={`b${i}`} />;
          const past = d < today;
          const on = isOn(d);
          const n = count?.(d);
          return (
            <button
              type="button"
              key={d}
              disabled={past}
              className={`${on ? 'is-on' : ''}${d === today ? ' is-today' : ''}`}
              aria-pressed={on}
              onClick={() => onPick(d)}
            >
              <b>{+d.slice(8)}</b>
              {variant === 'days' && !past && (
                <small className={n ? 'has' : ''}>{n === undefined ? '' : n > 0 ? n : '-'}</small>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Wheel({ label, count, value, onChange }: { label: string; count: number; value: number; onChange: (v: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [live, setLive] = useState(value);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = value * 44;
    setLive(value);
  }, []);
  return (
    <div className="bc-wheel">
      <span>{label}</span>
      <div
        ref={ref}
        className="bc-wheel-scroll"
        onScroll={(e) => {
          const index = Math.max(0, Math.min(count - 1, Math.round(e.currentTarget.scrollTop / 44)));
          setLive(index);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => onChange(index), 90);
        }}
      >
        {Array.from({ length: count }, (_, i) => (
          <button
            type="button"
            key={i}
            className={i === live ? 'is-on' : ''}
            onClick={() => ref.current?.scrollTo({ top: i * 44, behavior: 'smooth' })}
          >
            {pad(i)}
          </button>
        ))}
      </div>
    </div>
  );
}

function BcDialog({ dialog, onClose }: { dialog: Dialog | null; onClose: () => void }) {
  if (!dialog) return null;
  return createPortal(
    <div className="bc-dialog-layer" dir="rtl" role="alertdialog" aria-modal="true">
      <div className="bc-dialog">
        <h3>{dialog.title}</h3>
        <p>{dialog.message}</p>
        <button type="button" onClick={onClose}>
          אישור
        </button>
      </div>
    </div>,
    document.body,
  );
}

export default function AdminBroadcast({
  slug,
  icon,
  open,
  onOpenChange,
}: {
  slug: string;
  icon?: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const today = israelNow().date;
  const tomorrow = addDays(today, 1);
  const weekRest = useMemo(
    () => Array.from({ length: 7 - dow(today) }, (_, i) => addDays(today, i)),
    [today],
  );
  const [overview, setOverview] = useState<Overview | null>(null);
  const [booked, setBooked] = useState<Record<string, string[]>>({});
  const [ownerModal, setOwnerModal] = useState(false);
  const [step, setStep] = useState<Step>('home');
  const [push, setPush] = useState(true);
  const [sms, setSms] = useState(false);
  const [audience, setAudience] = useState<Audience>('all');
  const [dates, setDates] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [period, setPeriod] = useState(30);
  const [inactive, setInactive] = useState<Client[] | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [when, setWhen] = useState<'now' | 'scheduled'>('now');
  const [date, setDate] = useState(tomorrow);
  const [hour, setHour] = useState(10);
  const [minute, setMinute] = useState(0);
  const [editId, setEditId] = useState<string | null>(null);
  const [daysMonth, setDaysMonth] = useState(today.slice(0, 7));
  const [dateMonth, setDateMonth] = useState(today.slice(0, 7));
  const [balance, setBalance] = useState<{ ok: boolean; total?: number } | null>(null);
  const [pick, setPick] = useState<'selected' | 'inactive' | null>(null);
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [removing, setRemoving] = useState<Scheduled | null>(null);
  const [deleting, setDeleting] = useState(false);
  const months = useRef(new Set<string>());
  const keepSelection = useRef(false);

  const channel = push && sms ? 'both' : sms ? 'sms' : 'push';

  function load() {
    api(slug, 'admin-broadcast')
      .then((r: Overview) => {
        if (!r.owner) {
          setOwnerModal(true);
          onOpenChange(false);
          return;
        }
        const now = israelNow().date.slice(0, 7);
        months.current = new Set([now, addMonths(now, 1)]);
        setBooked(r.booked || {});
        setOverview(r);
      })
      .catch(() => setOverview({ owner: true, allCount: 0, clients: [], booked: {}, scheduled: [] }));
  }

  useEffect(() => {
    if (!open) return;
    setStep('home');
    setOverview(null);
    setBalance(null);
    load();
  }, [open, slug]);

  useEffect(() => {
    if (!open || !sms || balance) return;
    api(slug, 'admin-sms')
      .then((r) => setBalance({ ok: !!r.ok, total: r.total }))
      .catch(() => setBalance({ ok: false }));
  }, [open, sms, balance, slug]);

  useEffect(() => {
    if (!open || audience !== 'inactive') return;
    let active = true;
    setInactive(null);
    api(slug, 'admin-broadcast', undefined, { inactive: String(period) })
      .then((r) => {
        if (!active) return;
        const list: Client[] = r.clients || [];
        setInactive(list);
        if (keepSelection.current) {
          keepSelection.current = false;
          setSelected((s) => s.filter((id) => list.some((c) => c.id === id)));
        } else setSelected(list.map((c) => c.id));
      })
      .catch(() => active && setInactive([]));
    return () => {
      active = false;
    };
  }, [open, audience, period, slug]);

  useEffect(() => {
    if (!overview) return;
    const wanted = new Set([daysMonth, ...dates.map((d) => d.slice(0, 7))]);
    for (const month of wanted) {
      if (months.current.has(month)) continue;
      months.current.add(month);
      api(slug, 'admin-broadcast', undefined, { month })
        .then((r) => setBooked((b) => ({ ...b, ...(r.booked || {}) })))
        .catch(() => months.current.delete(month));
    }
  }, [overview, daysMonth, dates, slug]);

  const apptCount = useMemo(() => {
    if (!dates.length) return 0;
    if (dates.some((d) => !booked[d])) return null;
    return new Set(dates.flatMap((d) => booked[d])).size;
  }, [dates, booked]);
  const recipients =
    audience === 'all'
      ? (overview?.allCount ?? null)
      : audience === 'appointments'
        ? apptCount
        : audience === 'inactive' && !inactive
          ? null
          : selected.length;
  const audienceOk =
    audience === 'all' ||
    (audience === 'appointments' && dates.length > 0 && !!apptCount) ||
    (audience === 'selected' && selected.length > 0) ||
    (audience === 'inactive' && !!inactive && selected.length > 0);
  const composeOk = audienceOk && !!title.trim() && !!content.trim();
  const future = when === 'now' || isFuture(date, hour, minute);
  const smsChecking = sms && (!balance || recipients === null);
  const smsShort =
    sms && !!balance?.ok && recipients !== null && recipients > 0 && (balance.total || 0) < recipients;

  function reset() {
    setPush(true);
    setSms(false);
    setAudience('all');
    setDates([]);
    setSelected([]);
    setPeriod(30);
    setTitle('');
    setContent('');
    setWhen('now');
    setDate(tomorrow);
    setHour(10);
    setMinute(0);
    setEditId(null);
    setDaysMonth(today.slice(0, 7));
    setDateMonth(tomorrow.slice(0, 7));
  }
  function startNew() {
    reset();
    setStep('channel');
  }
  function startEdit(s: Scheduled) {
    const at = israelParts(s.scheduled_at);
    reset();
    setTitle(s.title);
    setContent(s.content);
    setPush(s.channel !== 'sms');
    setSms(s.channel !== 'push');
    setDates((s.appointment_dates || []).filter((d) => d >= today));
    setPeriod(s.inactive_days || 30);
    setSelected(s.recipient_user_ids || []);
    keepSelection.current = s.audience === 'inactive';
    setAudience(s.audience);
    setWhen('scheduled');
    setDate(at.date < today ? today : at.date);
    setDateMonth((at.date < today ? today : at.date).slice(0, 7));
    setHour(at.hour);
    setMinute(at.minute);
    setEditId(s.id);
    setStep('channel');
  }
  function chooseAudience(value: Audience) {
    setAudience(value);
    if (value === 'appointments') {
      setDates([tomorrow]);
      setDaysMonth(tomorrow.slice(0, 7));
    }
    if (value === 'selected') {
      setSelected([]);
      setSearch('');
      setPick('selected');
    }
  }
  function toggleChannel(which: 'push' | 'sms') {
    if (which === 'push' && (!push || sms)) setPush(!push);
    if (which === 'sms' && (!sms || push)) setSms(!sms);
  }
  function toggleDate(d: string) {
    setDates((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d].sort()));
  }
  function leaveWhen() {
    if (when === 'now') return setStep('preview');
    if (!isFuture(date, hour, minute)) {
      const now = israelNow();
      const next = date === now.date ? Math.min(now.minute + 1, 1439) : hour * 60 + minute;
      setHour(Math.floor(next / 60));
      setMinute(next % 60);
    }
    setStep('time');
  }
  function daysLabel() {
    if (dates.length === 1) {
      const d = dates[0];
      return d === today ? 'היום' : d === tomorrow ? 'מחר' : HE_DAYS[dow(d)];
    }
    if (dates.length === weekRest.length && weekRest.every((d) => dates.includes(d))) return 'השבוע';
    return `${dates.length} ימים`;
  }
  function successMessage(r: { scheduled: boolean; count: number }) {
    if (r.scheduled) return 'ההודעה תוזמנה ותישלח לפי שעון ישראל.';
    if (audience === 'all') {
      if (channel === 'sms')
        return r.count ? 'נשלחה הודעת SMS ללקוחות.' : 'לא נמצאו לקוחות עם מספר טלפון — לא נשלחו הודעות.';
      if (!r.count) return 'ההודעה פורסמה בדף הבית. לא נמצאו לקוחות עם מספר טלפון - לא נשלחו התראות.';
      return channel === 'both'
        ? 'ההודעה פורסמה בדף הבית ונשלחו התראת פוש ו-SMS ללקוחות.'
        : 'ההודעה פורסמה בדף הבית ונשלחה התראת פוש ללקוחות הרלוונטיים.';
    }
    if (!r.count) return 'לא נמצאו לקוחות עם תור ומספר טלפון בימים שנבחרו - לא נשלחו התראות.';
    if (audience === 'appointments') return `נשלחה ההודעה ל-${r.count} לקוחות עם תור בימים שנבחרו.`;
    if (audience === 'selected') return `נשלחה ההודעה ל-${r.count} לקוחות שנבחרו.`;
    return `נשלחה ההודעה ל-${r.count} לקוחות שלא קבעו תור.`;
  }
  async function send() {
    if (smsShort) return setDialog({ title: 'שגיאה', message: SMS_SHORT });
    if (when === 'scheduled' && !isFuture(date, hour, minute))
      return setDialog({ title: 'שגיאה', message: 'בחרו תאריך ושעה עתידיים לפי שעון ישראל' });
    setSending(true);
    try {
      const r = await api(slug, 'admin-broadcast', {
        title: title.trim(),
        content: content.trim(),
        channel,
        audience,
        dates,
        ids: selected,
        inactiveDays: period,
        scheduledAt: when === 'scheduled' ? `${date}T${pad(hour)}:${pad(minute)}` : null,
        editId,
      });
      setDialog({
        title: 'נשלח',
        message: successMessage(r),
        after: () => {
          reset();
          setStep('home');
          load();
        },
      });
    } catch (e: any) {
      setDialog({ title: 'שגיאה', message: e?.message || GENERIC_ERROR });
    } finally {
      setSending(false);
    }
  }
  async function remove() {
    if (!removing) return;
    setDeleting(true);
    try {
      await api(slug, 'admin-broadcast', { operation: 'delete', id: removing.id });
      setOverview((o) => o && { ...o, scheduled: (o.scheduled || []).filter((s) => s.id !== removing.id) });
      setRemoving(null);
    } catch (e: any) {
      setRemoving(null);
      setDialog({ title: 'שגיאה', message: e?.message || GENERIC_ERROR });
    } finally {
      setDeleting(false);
    }
  }

  const pool = pick === 'inactive' ? inactive || [] : overview?.clients || [];
  const shown = pool.filter((c) => clientMatchesTextSearch(c.name, c.phone, search));
  const allPicked = pool.length > 0 && pool.every((c) => selected.includes(c.id));
  const scheduled = overview?.scheduled || [];

  let body: React.ReactNode;
  let bar: React.ReactNode;
  const backBtn = (label: string, onClick: () => void, outlined = false) => (
    <button type="button" className={`bc-back${outlined ? ' is-outlined' : ''}`} onClick={onClick} disabled={sending}>
      {label}
    </button>
  );
  const nextBtn = (label: string, onClick: () => void, disabled = false) => (
    <button type="button" className="bc-next" onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );

  if (step === 'home') {
    body = (
      <>
        <Hero icon={Megaphone} title="הודעות שידור" sub="כאן יוצרים הודעה ללקוחות. אפשר לשלוח עכשיו או לתזמן." />
        <div className="bc-home">
          <button type="button" className="bc-new" onClick={startNew}>
            <Plus size={20} strokeWidth={2.4} />
            הודעת שידור חדשה
          </button>
          <button type="button" className="bc-link" onClick={() => setStep('list')}>
            {scheduled.length ? `הודעות מתוזמנות (${scheduled.length})` : 'הודעות מתוזמנות'}
          </button>
        </div>
      </>
    );
    bar = backBtn('ביטול', () => onOpenChange(false));
  } else if (step === 'list') {
    body = (
      <>
        <Head title="הודעות מתוזמנות" sub="הודעות שתוזמנו לפי שעון ישראל. אפשר לערוך או למחוק לפני השליחה." />
        <div className="bc-sched-list">
          {!overview ? (
            <div className="bc-center">
              <span className="cl-spinner is-large" />
            </div>
          ) : !scheduled.length ? (
            <div className="bc-center bc-empty">
              <Clock size={22} />
              <strong>אין הודעות ממתינות</strong>
            </div>
          ) : (
            scheduled.map((s) => {
              const at = israelParts(s.scheduled_at);
              return (
                <div className="bc-sched" key={s.id}>
                  <span className="bc-sched-icon">
                    <Clock size={18} />
                  </span>
                  <div className="bc-sched-text">
                    <strong>{s.title}</strong>
                    <small>{wallLabel(at.date, at.hour, at.minute)}</small>
                    <small>
                      {CHANNEL_LABEL[s.channel]} · {AUDIENCE_LABEL[s.audience]}
                    </small>
                    {s.status === 'sending' && <em>נשלחת כעת…</em>}
                  </div>
                  {s.status === 'sending' ? (
                    <span className="cl-spinner" />
                  ) : (
                    <div className="bc-sched-actions">
                      <button type="button" aria-label="עריכה" onClick={() => startEdit(s)}>
                        <Pencil size={16} strokeWidth={2.1} />
                      </button>
                      <button type="button" className="is-danger" aria-label="מחיקה" onClick={() => setRemoving(s)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </>
    );
    bar = backBtn('חזור', () => setStep('home'));
  } else if (step === 'channel') {
    body = (
      <>
        <Hero icon={Megaphone} title="איך לשלוח" sub="בחרו פוש או SMS — אפשר גם לסמן את שניהם." />
        <div className="bc-cards bc-pad">
          <Card kind="channel" on={push} onClick={() => toggleChannel('push')} icon={Bell} title="פוש על המסך" sub="התראה באפליקציה" />
          <Card kind="channel" on={sms} onClick={() => toggleChannel('sms')} icon={MessageSquare} title="SMS" sub="הודעת טקסט לטלפון" />
        </div>
        {push && sms && <p className="bc-hint">תישלח גם התראת פוש וגם SMS</p>}
      </>
    );
    bar = (
      <>
        {backBtn('חזור', () => setStep('home'))}
        {nextBtn('המשך', () => setStep('audience'))}
      </>
    );
  } else if (step === 'audience') {
    body = (
      <>
        <Hero icon={Users} title="למי לשלוח" sub="בחרו למי תישלח ההודעה." />
        <div className="bc-pad">
          <p className="bc-label">למי לשלוח</p>
          <div className="bc-grid">
            {AUDIENCES.map(([value, label, sub, Icon]) => (
              <Card kind="audience" key={value} on={audience === value} onClick={() => chooseAudience(value)} icon={Icon} title={label} sub={sub} />
            ))}
          </div>
          {audience === 'appointments' && (
            <div className="bc-panel">
              <p className="bc-panel-hint">
                בחרו ימים ביומן - רק לקוחות עם תור באותם ימים יקבלו את ההודעה (בלי באנר בדף הבית).
              </p>
              <div className="bc-chips">
                <Chip on={dates.length === 1 && dates[0] === tomorrow} onClick={() => { setDates([tomorrow]); setDaysMonth(tomorrow.slice(0, 7)); }}>
                  מחר
                </Chip>
                <Chip
                  on={dates.length === weekRest.length && weekRest.every((d) => dates.includes(d))}
                  onClick={() => { setDates(weekRest); setDaysMonth(today.slice(0, 7)); }}
                >
                  השבוע
                </Chip>
              </div>
              <MonthGrid
                variant="days"
                today={today}
                month={daysMonth}
                setMonth={setDaysMonth}
                isOn={(d) => dates.includes(d)}
                onPick={toggleDate}
                count={(d) => booked[d]?.length}
              />
              <Summary icon={Bell}>
                {!dates.length
                  ? 'בחרו לפחות יום אחד'
                  : apptCount === null
                    ? 'סופר לקוחות…'
                    : apptCount === 0
                      ? 'אין לקוחות עם תור בימים שנבחרו'
                      : countSentence(apptCount)}
              </Summary>
            </div>
          )}
          {audience === 'selected' && (
            <div className="bc-panel">
              <p className="bc-panel-hint">סמנו את הלקוחות שיקבלו את ההודעה, כמו בעמוד הלקוחות.</p>
              <button type="button" className="bc-new" onClick={() => { setSearch(''); setPick('selected'); }}>
                <Users size={18} />
                {selected.length ? 'עריכת הרשימה' : 'בחירת לקוחות'}
              </button>
              <Summary icon={Users}>{selected.length ? countSentence(selected.length) : 'בחרו לפחות לקוח אחד'}</Summary>
            </div>
          )}
          {audience === 'inactive' && (
            <div className="bc-panel">
              <p className="bc-panel-hint">
                בחרו כמה זמן בלי תור. המערכת תאתר את הלקוחות, ואפשר להסיר מישהו מהרשימה.
              </p>
              <div className="bc-chips">
                {PERIODS.map(([days, label]) => (
                  <Chip key={days} on={period === days} onClick={() => setPeriod(days)}>
                    {label}
                  </Chip>
                ))}
              </div>
              <button type="button" className="bc-new" disabled={!inactive} onClick={() => { setSearch(''); setPick('inactive'); }}>
                <List size={18} />
                סקירת הרשימה
              </button>
              <Summary icon={Clock}>
                {!inactive
                  ? 'סופר לקוחות…'
                  : !inactive.length
                    ? 'אין לקוחות בלי תור בתקופה הזו'
                    : countSentence(selected.length)}
              </Summary>
            </div>
          )}
        </div>
      </>
    );
    bar = (
      <>
        {backBtn('חזור', () => setStep('channel'))}
        {nextBtn('המשך לכתיבה', () => setStep('compose'), !audienceOk)}
      </>
    );
  } else if (step === 'compose') {
    const sub =
      audience === 'all'
        ? channel === 'push'
          ? 'מתפרסמת הודעה בדף הבית ונשלחת התראת פוש לאפליקציה אצל כל לקוח (לפי הפרטים הרשומים אצלו). לא נשלח SMS.'
          : channel === 'sms'
            ? 'הודעת SMS לכל הלקוחות עם מספר טלפון. לא מתפרסם באנר בדף הבית ולא נשלח פוש.'
            : 'באנר בדף הבית, התראת פוש באפליקציה, וגם SMS לטלפון.'
        : audience === 'appointments'
          ? channel === 'push'
            ? 'התראת פוש רק ללקוחות עם תור בימים שתבחרו. לא נשלח SMS ולא מתפרסם באנר בדף הבית.'
            : channel === 'sms'
              ? 'SMS רק ללקוחות עם תור בימים שתבחרו. לא מתפרסם באנר בדף הבית.'
              : 'פוש ו-SMS ללקוחות עם תור בימים שתבחרו. לא מתפרסם באנר בדף הבית.'
          : audience === 'selected'
            ? 'ההודעה תישלח רק ללקוחות שסימנתם. לא מתפרסם באנר בדף הבית.'
            : 'ההודעה תישלח ללקוחות שלא קבעו תור בתקופה שבחרתם. לא מתפרסם באנר בדף הבית.';
    const chipText =
      audience === 'all'
        ? 'כל הלקוחות'
        : audience === 'selected'
          ? `${selected.length} לקוחות שנבחרו`
          : audience === 'inactive'
            ? `${selected.length} לקוחות · בלי תור ${periodLabel(period)}`
            : `${apptCount ?? 0} לקוחות · ${daysLabel()}`;
    const ChipIcon = audience === 'appointments' ? CalendarDays : audience === 'inactive' ? Clock : Users;
    body = (
      <>
        <Hero icon={Megaphone} title={COMPOSE_TITLE[audience]} sub={sub} />
        <div className="bc-chipbar">
          <span>
            <ChipIcon size={16} />
            {chipText}
          </span>
          <button type="button" onClick={() => setStep('audience')}>
            {audience === 'all' ? 'שינוי' : 'שינוי ימים'}
          </button>
        </div>
        <div className="bc-fields">
          <div className="bc-field">
            <span className="bc-field-label">כותרת</span>
            <div className="bc-field-box">
              <input
                value={title}
                maxLength={TITLE_MAX}
                placeholder="למשל: מבצע השבוע"
                onChange={(e) => setTitle(e.target.value)}
                aria-label="כותרת"
              />
              <small>
                {title.length}/{TITLE_MAX}
              </small>
            </div>
          </div>
          <div className="bc-field">
            <span className="bc-field-label">תוכן ההתראה</span>
            <div className="bc-field-box">
              <textarea
                value={content}
                maxLength={CONTENT_MAX}
                placeholder="כתבו כאן את ההודעה שייראו הלקוחות במסך ההתראות..."
                onChange={(e) => setContent(e.target.value)}
                aria-label="תוכן ההתראה"
              />
              <small>
                {content.length}/{CONTENT_MAX}
              </small>
            </div>
          </div>
        </div>
      </>
    );
    bar = (
      <>
        {backBtn('חזור', () => setStep('audience'), audience !== 'all')}
        {nextBtn('המשך', () => setStep('when'), !composeOk)}
      </>
    );
  } else if (step === 'when') {
    body = (
      <>
        <Head title="מתי לשלוח" sub="שלחו עכשיו, או תזמנו לפי שעון ישראל." />
        <div className="bc-cards bc-pad">
          <Card kind="when" on={when === 'now'} onClick={() => setWhen('now')} icon={Send} title="עכשיו" sub="תישלח מיד אחרי האישור" />
          <Card
            kind="when"
            on={when === 'scheduled'}
            onClick={() => {
              setWhen('scheduled');
              if (!date) setDate(today);
              setDateMonth((date || today).slice(0, 7));
            }}
            icon={Clock}
            title="תזמון"
            sub="תאריך ושעה לפי שעון ישראל"
          />
        </div>
        {when === 'scheduled' && (
          <div className="bc-pad">
            <p className="bc-hint">בחרו יום ביומן</p>
            <div className="bc-date-box">
              <MonthGrid variant="date" today={today} month={dateMonth} setMonth={setDateMonth} isOn={(d) => d === date} onPick={setDate} />
            </div>
          </div>
        )}
      </>
    );
    bar = (
      <>
        {backBtn('חזור', () => setStep('compose'))}
        {nextBtn('המשך', leaveWhen, when === 'scheduled' && !date)}
      </>
    );
  } else if (step === 'time') {
    body = (
      <>
        <Head title="שעת שליחה" sub="בחרו שעה לפי שעון ישראל" />
        <div className="bc-wheels">
          <i className="bc-wheels-band" />
          <Wheel label="דקות" count={60} value={minute} onChange={setMinute} />
          <Wheel label="שעה" count={24} value={hour} onChange={setHour} />
        </div>
      </>
    );
    bar = (
      <>
        {backBtn('חזור', () => setStep('when'))}
        {nextBtn('המשך', () => setStep('preview'), !future)}
      </>
    );
  } else {
    const n = recipients ?? 0;
    const sub =
      audience === 'all'
        ? 'כך תיראה ההתראה אצל הלקוחות.\nלחצו אישור לשליחה לכל הלקוחות.'
        : audience === 'appointments'
          ? `כך תיראה ההתראה.\nתישלח ל-${n} לקוחות עם תור בימים שנבחרו.`
          : audience === 'selected'
            ? `כך תיראה ההתראה.\nתישלח ל-${n} לקוחות שנבחרו.`
            : `כך תיראה ההתראה.\nתישלח ל-${n} לקוחות שלא קבעו תור.`;
    body = (
      <>
        <Head title="תצוגה מקדימה" sub={sub} />
        <div className="bc-pad">
          {push && (
            <div className="bc-push">
              <div className="bc-push-top">
                <span>{new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}</span>
                <i>
                  <Bell size={11} fill="currentColor" />
                </i>
              </div>
              <div className="bc-push-body">
                <span className="bc-push-logo">
                  {icon ? <img src={icon} alt="" /> : <Bell size={20} />}
                </span>
                <div>
                  <strong>{title.trim()}</strong>
                  <p>{content.trim()}</p>
                </div>
              </div>
            </div>
          )}
          {sms && (
            <div className="bc-sms">
              <small>תצוגת SMS</small>
              <p>
                {title.trim()}
                {'\n'}
                {content.trim()}
              </p>
            </div>
          )}
          <p className="bc-status">{when === 'now' ? 'נשלח עכשיו' : `מתוזמן ל-${wallLabel(date, hour, minute)}`}</p>
          {sms &&
            (smsChecking ? (
              <p className="bc-sms-line">בודקים יתרת SMS…</p>
            ) : smsShort ? (
              <button type="button" className="bc-sms-line is-error" onClick={() => onOpenChange(false)}>
                {SMS_SHORT}
              </button>
            ) : balance?.ok ? (
              <p className="bc-sms-line">
                יתרת הודעות SMS לאחר השליחה: {Math.max(0, (balance.total || 0) - n)}
              </p>
            ) : null)}
        </div>
      </>
    );
    bar = (
      <>
        {backBtn('חזור', () => setStep(when === 'scheduled' ? 'time' : 'when'), true)}
        {nextBtn(sending ? 'שולח...' : 'אישור', () => void send(), sending || smsChecking || smsShort || !future)}
      </>
    );
  }

  return (
    <>
      <BottomSheet
        open={open && !ownerModal}
        onClose={() => onOpenChange(false)}
        size="auto"
        locked={sending || !!dialog || !!removing || !!pick}
        className="bc-sheet"
      >
        <div className="bc-scroll" key={step}>
          {body}
        </div>
        <div className={`bc-bar${step === 'home' || step === 'list' ? ' is-single' : ''}`}>{bar}</div>
      </BottomSheet>

      {pick &&
        createPortal(
          <div className="bc-pick" dir="rtl" role="dialog" aria-modal="true">
            <div className="bc-pick-grip">
              <span />
            </div>
            <div className="bc-pick-head">
              <button type="button" className="bc-pick-close" aria-label="סגירה" onClick={() => setPick(null)}>
                <X size={18} />
              </button>
              <div className="bc-pick-title">
                <span>
                  <Users size={20} />
                </span>
                <div>
                  <h2>{pick === 'selected' ? 'בחירת לקוחות' : 'לקוחות שיקבלו'}</h2>
                  <p>
                    {pick === 'selected'
                      ? 'סמנו את הלקוחות שיקבלו את ההודעה, כמו בעמוד הלקוחות.'
                      : 'בחרו כמה זמן בלי תור. המערכת תאתר את הלקוחות, ואפשר להסיר מישהו מהרשימה.'}
                  </p>
                </div>
              </div>
              <b className="bc-pick-count">{selected.length}</b>
            </div>
            <label className="bc-search">
              <Search size={16} />
              <input
                value={search}
                placeholder="חיפוש לפי שם או טלפון"
                onChange={(e) => setSearch(e.target.value)}
                aria-label="חיפוש לפי שם או טלפון"
              />
              {search && (
                <button type="button" aria-label="נקה חיפוש" onClick={() => setSearch('')}>
                  <X size={14} />
                </button>
              )}
            </label>
            <div className="bc-pick-tools">
              <button type="button" onClick={() => setSelected(allPicked ? [] : pool.map((c) => c.id))}>
                {allPicked ? 'ניקוי בחירה' : 'בחירת הכל'}
              </button>
              <span>{selected.length} נבחרו</span>
            </div>
            <div className="bc-pick-list">
              {!shown.length ? (
                <div className="bc-center bc-empty">
                  <span className="bc-empty-icon">
                    <Search size={22} />
                  </span>
                  <strong>{search ? 'לא נמצאו לקוחות בחיפוש' : 'בחרו לפחות לקוח אחד'}</strong>
                </div>
              ) : (
                shown.map((c) => {
                  const on = selected.includes(c.id);
                  return (
                    <button
                      type="button"
                      key={c.id}
                      className={`bc-client${on ? ' is-on' : ''}`}
                      aria-pressed={on}
                      onClick={() => setSelected((s) => (on ? s.filter((id) => id !== c.id) : [...s, c.id]))}
                    >
                      <span className="bc-client-avatar">{(c.name.trim()[0] || '?').toUpperCase()}</span>
                      <span className="bc-client-text">
                        <strong>{c.name}</strong>
                        {c.phone && <small dir="ltr">{c.phone}</small>}
                      </span>
                      <em className="bc-client-check">{on && <Check size={14} strokeWidth={3} />}</em>
                    </button>
                  );
                })
              )}
            </div>
            <div className="bc-pick-foot">
              <button type="button" onClick={() => setPick(null)}>
                {selected.length ? `אישור · ${selected.length}` : 'אישור'}
              </button>
            </div>
          </div>,
          document.body,
        )}

      {removing &&
        createPortal(
          <div className="bc-dialog-layer" dir="rtl" role="alertdialog" aria-modal="true">
            <div className="bc-dialog bc-confirm">
              <span className="bc-confirm-icon">
                <TriangleAlert size={27} />
              </span>
              <h3>מחיקת הודעה מתוזמנת</h3>
              <p>למחוק את ההודעה המתוזמנת? היא לא תישלח.</p>
              <div className="bc-confirm-actions">
                <button type="button" onClick={() => setRemoving(null)} disabled={deleting}>
                  ביטול
                </button>
                <button type="button" className="is-danger" onClick={() => void remove()} disabled={deleting}>
                  {deleting ? <span className="cl-spinner" /> : 'מחיקה'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {ownerModal &&
        createPortal(
          <div className="bc-owner-layer" dir="rtl" role="alertdialog" aria-modal="true" onClick={() => setOwnerModal(false)}>
            <div className="bc-owner" onClick={(e) => e.stopPropagation()}>
              <i className="bc-owner-bar" />
              <span className="bc-owner-icon">
                <ShieldCheck size={34} strokeWidth={1.8} />
              </span>
              <h3>אין הרשאה</h3>
              <p>
                רק מנהל העסק (המשתמש הרשום עם מספר הטלפון של העסק בהגדרות) יכול לשלוח התראה לכל הלקוחות. בקשו
                מהמנהל לשלוח את ההודעה, או התחברו עם חשבון המנהל.
              </p>
              <button type="button" onClick={() => setOwnerModal(false)}>
                אישור
              </button>
            </div>
          </div>,
          document.body,
        )}

      <BcDialog
        dialog={dialog}
        onClose={() => {
          const after = dialog?.after;
          setDialog(null);
          after?.();
        }}
      />
    </>
  );
}
