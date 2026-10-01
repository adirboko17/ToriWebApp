'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  Clock,
  Clock3,
  Home,
  Plus,
  Scissors,
  User,
  Users,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { api, downloadCalendar } from '@/lib/client';
import { addDays, israelNow, minutes, timeString } from '@/lib/availability';
import { isUpcoming } from '@/lib/client-appointments';
import AuthForm from './auth-form';
import BrandImage from './brand-image';
import BottomSheet from './bottom-sheet';

type Step = 1 | 2 | 3 | 4;

const hm = (t: string) => String(t || '').slice(0, 5);
const longDate = (d: string, extra: Intl.DateTimeFormatOptions = {}) =>
  new Date(d + 'T12:00:00Z').toLocaleDateString('he-IL', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...extra,
  });
const shortDate = (d: string) => `${Number(d.slice(8))}.${Number(d.slice(5, 7))}.${d.slice(2, 4)}`;
const priceText = (n: number) => (n > 0 ? `₪${n}` : '-');
const daypart = (t: string) => {
  const h = Number(t.slice(0, 2));
  return h >= 5 && h <= 11 ? 'בוקר' : h >= 12 && h <= 16 ? 'צהריים' : 'ערב';
};

const PERIODS = [
  { id: 'morning', emoji: '☀️', label: 'בוקר', range: '8:00 – 12:00', end: 12 },
  { id: 'afternoon', emoji: '🌤', label: 'צהריים', range: '12:00 – 16:00', end: 16 },
  { id: 'evening', emoji: '🌙', label: 'ערב', range: '16:00 – 20:00', end: 20 },
];

function Headline({ title, subtitle, shadow = true }: { title: string; subtitle: string; shadow?: boolean }) {
  return (
    <div className={`bk-headline${shadow ? '' : ' no-shadow'}`}>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}

function Spinner({ label, light }: { label: string; light?: boolean }) {
  return (
    <div className={`bk-loading${light ? ' is-light' : ''}`} role="status">
      <span className="cc-spinner is-large" />
      <p>{label}</p>
    </div>
  );
}

function StaffCarousel({ staff, onPick }: { staff: any[]; onPick: (s: any) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(390);
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ x: number; t: number; moved: boolean } | null>(null);
  useEffect(() => {
    const measure = () => box.current && setWidth(box.current.clientWidth || 390);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  const n = staff.length;
  const cardW = Math.round(width * 0.67);
  const cardH = Math.round(cardW * 1.44);
  let progress = index + (drag || 0) / width;
  if (progress < 0) progress *= 0.3;
  if (progress > n - 1) progress = n - 1 + (progress - (n - 1)) * 0.3;
  const end = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const velocity = (dx / Math.max(1, performance.now() - s.t)) * 1000;
    setDrag(null);
    if (!s.moved) {
      onPick(staff[index]);
      return;
    }
    let next = Math.round(index + dx / width);
    if (Math.abs(velocity) > 350) next = index + Math.sign(velocity);
    setIndex(Math.max(0, Math.min(n - 1, Math.max(index - 1, Math.min(index + 1, next)))));
  };
  return (
    <div className="bk-carousel" ref={box}>
      <div
        className={`bk-pager${drag === null ? '' : ' is-dragging'}`}
        style={{ height: cardH }}
        onPointerDown={(e) => {
          start.current = { x: e.clientX, t: performance.now(), moved: false };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const dx = e.clientX - s.x;
          if (Math.abs(dx) > 6) s.moved = true;
          if (s.moved) setDrag(dx);
        }}
        onPointerUp={end}
        onPointerCancel={() => {
          start.current = null;
          setDrag(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setIndex((i) => Math.min(n - 1, i + 1));
          if (e.key === 'ArrowRight') setIndex((i) => Math.max(0, i - 1));
          if (e.key === 'Enter') onPick(staff[index]);
        }}
        tabIndex={0}
        role="listbox"
        aria-label="בחירת איש צוות"
      >
        {staff.map((s, i) => (
          <div
            key={s.id}
            className="bk-page"
            style={{ transform: `translateX(${(progress - i) * width}px)` }}
            role="option"
            aria-selected={i === index}
            aria-label={s.name}
          >
            <div className="bk-staff-card" style={{ width: cardW, height: cardH }}>
              <BrandImage
                sources={[s.image_url]}
                alt={s.name}
                fallback={
                  <span className="bk-staff-fallback">
                    <User size={Math.round(cardH * 0.22)} />
                  </span>
                }
              />
            </div>
          </div>
        ))}
      </div>
      <div className="bk-staff-names" style={{ width: cardW }}>
        {staff.map((s, i) => (
          <strong key={s.id} style={{ opacity: Math.max(0, 1 - Math.abs(progress - i) / 0.8) }}>
            {s.name}
          </strong>
        ))}
      </div>
      {n > 1 && (
        <div className="bk-dots">
          {staff.map((s, i) => (
            <button
              type="button"
              key={s.id}
              aria-label={s.name}
              className={i === index ? 'is-on' : ''}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StaffList({ staff, selected, onPick }: { staff: any[]; selected: string; onPick: (s: any) => void }) {
  return (
    <div className="bk-card bk-scroll-card">
      {staff.map((s, i) => (
        <div key={s.id}>
          {i > 0 && <i className="bk-hairline is-inset" />}
          <button
            type="button"
            className={`bk-staff-row${s.id === selected ? ' is-on' : ''}`}
            onClick={() => onPick(s)}
          >
            <span className="bk-staff-ring">
              <BrandImage
                sources={[s.image_url]}
                alt=""
                fallback={
                  <span className="bk-staff-mini">
                    <User size={22} />
                  </span>
                }
              />
            </span>
            <span className="bk-row-copy">
              <strong>{s.name}</strong>
              <small>איש צוות</small>
            </span>
            <ChevronLeft size={18} className="bk-row-chevron" />
          </button>
        </div>
      ))}
    </div>
  );
}

function MonthCalendar({
  today,
  last,
  days,
  loaded,
  selected,
  onPick,
}: {
  today: string;
  last: string;
  days: Record<string, number>;
  loaded: boolean;
  selected: string;
  onPick: (date: string, count: number | undefined) => void;
}) {
  const [offset, setOffset] = useState(0);
  const base = new Date(today + 'T12:00:00Z');
  const month = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, 1, 12));
  const first = month.toISOString().slice(0, 10);
  const lead = month.getUTCDay();
  const length = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0, 12)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length }, (_, i) => addDays(first, i)),
  ];
  while (cells.length % 7) cells.push(null);
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(2026, 0, 4 + i, 12)).toLocaleDateString('he-IL', { timeZone: 'UTC', weekday: 'short' }),
  );
  return (
    <div className="bk-calendar">
      <div className="bk-cal-head">
        <button type="button" aria-label="חודש הבא" disabled={offset >= 11} onClick={() => setOffset((o) => o + 1)}>
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>
        <div>
          <strong>{month.toLocaleDateString('he-IL', { timeZone: 'UTC', month: 'long' })}</strong>
          <span>{month.getUTCFullYear()}</span>
        </div>
        <button type="button" aria-label="חודש קודם" disabled={offset <= 0} onClick={() => setOffset((o) => o - 1)}>
          <ChevronRight size={22} strokeWidth={2.5} />
        </button>
      </div>
      <div className="bk-cal-week">
        {weekdays.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="bk-cal-grid">
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const inRange = d >= today && d <= last;
          const count = days[d] ?? (loaded ? -1 : undefined);
          const isToday = d === today;
          const isSelected = d === selected;
          const dot =
            !inRange || count === undefined
              ? ''
              : count > 0
                ? 'is-open'
                : count === 0
                  ? 'is-full'
                  : 'is-closed';
          const tappable = inRange && (count === undefined || count >= 0);
          return (
            <button
              type="button"
              key={d}
              className={`bk-day${inRange ? '' : ' is-out'}${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}`}
              disabled={!tappable}
              aria-label={longDate(d)}
              aria-pressed={isSelected}
              onClick={() => onPick(d, count)}
            >
              <b>{Number(d.slice(8))}</b>
              <i className={dot} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WaitlistSheet({
  open,
  date,
  services,
  busy,
  done,
  onSubmit,
  onClose,
  onFinish,
}: {
  open: boolean;
  date: string;
  services: string;
  busy: boolean;
  done: string[] | null;
  onSubmit: (periods: string[]) => void;
  onClose: () => void;
  onFinish: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => {
    if (open) setPicked([]);
  }, [open]);
  const clock = israelNow();
  const options = PERIODS.filter((p) => date !== clock.date || p.end * 60 > clock.minute);
  return (
    <BottomSheet open={open} onClose={onClose} size="auto" locked={Boolean(done)} className="bw-sheet">
      {done ? (
        <div className="bw-body is-done">
          <span className="bw-glow is-large">
            <CircleCheck size={60} />
          </span>
          <h2>נרשמת לרשימת ההמתנה</h2>
          <span className="bw-pill">לתאריך {longDate(date)}</span>
          <div className="bw-meta">
            <small>שירות</small>
            <strong>{services}</strong>
            <i />
            <small>חלון זמן מועדף</small>
            <strong>{PERIODS.filter((p) => done.includes(p.id)).map((p) => p.label).join(' · ')}</strong>
            <i />
            <strong>נעדכן אותך מיד</strong>
            <small>כשיתפנה תור בחלון שבחרת</small>
          </div>
          <button type="button" className="bw-submit is-ready" onClick={onFinish}>
            הבנתי
          </button>
        </div>
      ) : (
        <div className="bw-body">
          <h2>הצטרפות לרשימת המתנה</h2>
          <p>בחרו חלון אחד או יותר</p>
          <div className="bw-pills">
            <span className="bw-pill">{date ? longDate(date, { weekday: 'long', year: undefined }) : ''}</span>
            <span className="bw-pill is-service">{services || 'כל שירות זמין'}</span>
          </div>
          {options.length ? (
            <div className="bw-cubes">
              {options.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  className={picked.includes(p.id) ? 'is-on' : ''}
                  aria-pressed={picked.includes(p.id)}
                  onClick={() =>
                    setPicked((list) => (list.includes(p.id) ? list.filter((v) => v !== p.id) : [...list, p.id]))
                  }
                >
                  <span>{p.emoji}</span>
                  <strong>{p.label}</strong>
                  <small>{p.range}</small>
                </button>
              ))}
            </div>
          ) : (
            <p className="bw-none">אין חלונות זמן נוספים היום לפי שעות הפעילות - בחרי תאריך אחר או נסי שוב מחר.</p>
          )}
          <button
            type="button"
            className={`bw-submit${picked.length ? ' is-ready' : ''}`}
            disabled={!picked.length || busy}
            onClick={() => onSubmit(picked)}
          >
            {busy ? <span className="cc-spinner is-small is-white" /> : picked.length ? <CircleCheck size={20} /> : null}
            הצטרפות לרשימה
          </button>
        </div>
      )}
    </BottomSheet>
  );
}

export default function BookingFlow({
  slug,
  data,
  onUser,
}: {
  slug: string;
  data: any;
  onUser: (u: any) => void;
}) {
  const { profile, staff, services, user } = data;
  const router = useRouter();
  const solo = staff.length === 1;
  const multi = profile.allow_multi_service_booking === true;
  const [step, setStep] = useState<Step>(solo ? 2 : 1);
  const [worker, setWorker] = useState<string>(solo ? staff[0].id : '');
  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [days, setDays] = useState<Record<string, number>>({});
  const [openDays, setOpenDays] = useState(7);
  const [daysLoaded, setDaysLoaded] = useState(false);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<any>(null);
  const [conflict, setConflict] = useState<any>(null);
  const [auth, setAuth] = useState(false);
  const [waitDate, setWaitDate] = useState('');
  const [waitBusy, setWaitBusy] = useState(false);
  const [waitDone, setWaitDone] = useState<string[] | null>(null);
  const today = israelNow().date;
  const last = addDays(today, Math.max(1, openDays) - 1);
  const member = staff.find((s: any) => s.id === worker);
  const visible = services.filter((s: any) => !s.worker_id || s.worker_id === worker);
  const picked = services.filter((s: any) => selected.includes(s.id));
  const duration = picked.reduce((n: number, s: any) => n + (s.duration_minutes || 60), 0);
  const price = picked.reduce((n: number, s: any) => n + Number(s.price || 0), 0);
  const serviceNames = picked.map((s: any) => s.name).join(' + ');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const w = params.get('worker');
    const chosen = services.find((s: any) => s.id === params.get('service'));
    const target = chosen?.worker_id || w;
    if (target && staff.some((s: any) => s.id === target)) {
      setWorker(target);
      setStep(2);
    }
    if (chosen) {
      setSelected([chosen.id]);
      setStep(3);
    }
  }, []);

  useEffect(() => {
    if (step < 3 || !worker || !selected.length) return;
    let active = true;
    setDaysLoaded(false);
    api(slug, 'days', undefined, { worker, services: selected.join(',') })
      .then((r) => {
        if (!active) return;
        setDays(r.days);
        setOpenDays(r.open);
      })
      .catch(() => active && setDays({}))
      .finally(() => active && setDaysLoaded(true));
    return () => {
      active = false;
    };
  }, [slug, worker, selected.join(','), step >= 3, user?.id]);

  useEffect(() => {
    if (step !== 4 || !date) return;
    let active = true;
    setSlots(null);
    api(slug, 'availability', undefined, { worker, services: selected.join(','), date })
      .then((r) => active && setSlots(r.slots))
      .catch(() => active && setSlots([]));
    return () => {
      active = false;
    };
  }, [slug, step, worker, selected.join(','), date, user?.id]);

  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: 'configure_booking',
          title: 'בחירת טיפול לתור',
          description: 'Select a staff member and services and show available days. Does not create an appointment.',
          inputSchema: {
            type: 'object',
            properties: {
              worker: { type: 'string' },
              services: { type: 'array', items: { type: 'string' } },
            },
            required: ['worker', 'services'],
            additionalProperties: false,
          },
          execute: async (input: any) => {
            if (
              !staff.some((s: any) => s.id === input.worker) ||
              !Array.isArray(input.services) ||
              !input.services.length ||
              input.services.some(
                (id: string) =>
                  !services.some((s: any) => s.id === id && (!s.worker_id || s.worker_id === input.worker)),
              ) ||
              (!multi && input.services.length > 1)
            )
              throw new Error('Invalid selection');
            setWorker(input.worker);
            setSelected(input.services);
            setDate('');
            setTime('');
            setStep(3);
            return { worker: input.worker, services: input.services, stage: 'select_day' };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, [staff, services, multi]);

  const leave = () => router.push(`/${slug}`);
  const back = () => {
    setExpanded(false);
    if (step === 4) {
      setTime('');
      setStep(3);
    } else if (step === 3) {
      setDate('');
      setTime('');
      setSlots(null);
      setStep(2);
    } else if (step === 2 && !solo) setStep(1);
    else leave();
  };
  const firstStep = step === 1 || (step === 2 && solo);
  const pickStaff = (s: any) => {
    setWorker(s.id);
    setSelected([]);
    setDate('');
    setTime('');
    setStep(2);
  };
  const pickService = (id: string) => {
    setDate('');
    setTime('');
    if (multi) {
      setSelected((list) => (list.includes(id) ? list.filter((v) => v !== id) : [...list, id]));
      return;
    }
    setSelected([id]);
    setStep(3);
  };
  const pickDay = (d: string, count: number | undefined) => {
    if (count === 0) {
      setWaitDone(null);
      setWaitDate(d);
      return;
    }
    setDate(d);
    setTime('');
    setStep(4);
  };
  const pickTime = (t: string) => {
    setTime(t);
    requestAnimationFrame(() => setExpanded(true));
  };
  const jump = (target: Step) => {
    if (target === 1 && solo) return;
    setExpanded(false);
    setTimeout(() => {
      if (target <= 3) setTime('');
      if (target <= 2) setDate('');
      setStep(target);
    }, 180);
  };

  const book = async (replace?: any) => {
    setBusy(true);
    try {
      if (replace) await api(slug, 'cancel', { id: replace.id });
      const row = await api(slug, 'book', { worker, services: selected, date, time });
      setConflict(null);
      setSuccess(row);
    } catch (e: any) {
      if (replace) setConflict(null);
      alert(e.message);
      if (/תפוס|אינה פנויה/.test(e.message)) {
        setTime('');
        setExpanded(false);
        setSlots(null);
        api(slug, 'availability', undefined, { worker, services: selected.join(','), date })
          .then((r) => setSlots(r.slots))
          .catch(() => setSlots([]));
      }
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    if (!user) {
      setAuth(true);
      return;
    }
    if (user.block) {
      alert('החשבון שלך חסום. לא ניתן לקבוע תורים.');
      return;
    }
    if (user.client_approved === false) {
      alert('ההרשמה שלך ממתינה לאישור העסק. עדיין לא ניתן לקבוע תורים.');
      return;
    }
    setBusy(true);
    try {
      const mine: any[] = await api(slug, 'appointments');
      const existing = mine.find((a) => a.slot_date === date && isUpcoming(a));
      if (existing) {
        setBusy(false);
        setConflict(existing);
        return;
      }
    } catch {}
    await book();
  };
  const joinWaitlist = async (periods: string[]) => {
    if (!user) {
      setAuth(true);
      return;
    }
    if (!user.phone) {
      alert('מידע המשתמש חסר');
      return;
    }
    setWaitBusy(true);
    try {
      await api(slug, 'waitlist', { worker, services: selected, date: waitDate, periods });
      setWaitDone(periods);
    } catch {
      alert('אירעה שגיאה בעת ההוספה לרשימת ההמתנה');
    } finally {
      setWaitBusy(false);
    }
  };

  const grouped = useMemo(() => {
    const list = slots || [];
    return [
      { id: 'morning', emoji: '☀️', label: 'בוקר', items: list.filter((t) => Number(t.slice(0, 2)) < 12) },
      {
        id: 'afternoon',
        emoji: '🌤',
        label: 'צהריים',
        items: list.filter((t) => Number(t.slice(0, 2)) >= 12 && Number(t.slice(0, 2)) <= 16),
      },
      { id: 'evening', emoji: '🌙', label: 'ערב', items: list.filter((t) => Number(t.slice(0, 2)) >= 17) },
    ].filter((g) => g.items.length);
  }, [slots]);

  const endTime = success ? timeString(minutes(success.slot_time) + (success.duration_minutes || duration)) : '';
  const sheetOpen = expanded || Boolean(success);

  return (
    <div className={`bk bk-step-${step}`}>
      <span className="bk-lava" aria-hidden>
        <i />
        <i />
        <i />
        <i />
      </span>
      <div className="bk-fab-wrap">
        <button
          type="button"
          className="bk-fab"
          aria-label={firstStep ? 'בית - יציאה מקביעת תור' : 'חזרה לשלב הקודם'}
          onClick={firstStep ? leave : back}
        >
          {firstStep ? <Home size={22} /> : <ChevronRight size={26} strokeWidth={2.6} />}
        </button>
      </div>

      <div className="bk-stage">
        {step === 1 && (
          <section className={`bk-step bk-staff${profile.staff_selection_style === 'avatar_list' ? ' is-list' : ''}`}>
            <Headline
              title="בחירת איש צוות"
              subtitle={
                profile.staff_selection_style === 'avatar_list' ? 'לחצו על איש צוות כדי להמשיך' : 'סמן את הבחירה שלך למטה'
              }
              shadow={false}
            />
            {!staff.length ? (
              <div className="bk-empty-staff">
                <Users size={52} />
                <p>אין אנשי צוות זמינים</p>
              </div>
            ) : profile.staff_selection_style === 'avatar_list' ? (
              <StaffList staff={staff} selected={worker} onPick={pickStaff} />
            ) : (
              <StaffCarousel staff={staff} onPick={pickStaff} />
            )}
          </section>
        )}

        {step === 2 && (
          <section className="bk-step bk-services">
            <Headline
              title="בחר/י שירות"
              subtitle={multi ? 'ניתן לבחור שירות אחד או יותר' : 'הקישו לבחירת שירות אחד'}
            />
            {!visible.length ? (
              <div className="bk-empty-card">
                <span>
                  <Scissors size={26} />
                </span>
                <strong>{member?.name ? `אין כרגע שירותים ל${member.name}` : 'אין שירותים זמינים'}</strong>
                <p>נסו לבחור איש צוות אחר, או לחזור מאוחר יותר</p>
              </div>
            ) : (
              <div className={`bk-card bk-scroll-card${multi ? ' is-multi' : ''}`}>
                {visible.map((s: any, i: number) => {
                  const on = selected.includes(s.id);
                  return (
                    <div key={s.id}>
                      {i > 0 && <i className="bk-dashed" />}
                      <button
                        type="button"
                        className={`bk-service${on ? ' is-on' : ''}`}
                        aria-pressed={on}
                        onClick={() => pickService(s.id)}
                      >
                        <span className="bk-service-icon">
                          {on ? <Check size={20} strokeWidth={2.6} /> : <Clock3 size={18} strokeWidth={2.2} />}
                        </span>
                        <span className="bk-row-copy">
                          <strong>{s.name}</strong>
                          <small>{s.duration_minutes || 60} דק׳</small>
                        </span>
                        <span className="bk-price">{priceText(Number(s.price || 0))}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {multi && selected.length > 0 && (
              <button type="button" className="bk-continue" onClick={() => setStep(3)}>
                המשך
                <ChevronLeft size={18} />
              </button>
            )}
          </section>
        )}

        {step === 3 && (
          <section className="bk-step bk-days">
            <Headline
              title="בחירת תאריך"
              subtitle={daysLoaded ? 'הנקודות מראות זמינות - לחצו על יום כדי להמשיך' : 'בודק...'}
            />
            <MonthCalendar
              today={today}
              last={last}
              days={days}
              loaded={daysLoaded}
              selected={date}
              onPick={pickDay}
            />
            <div className="bk-legend">
              <span>
                <i className="is-open" />
                יש תורים
              </span>
              <span>
                <i className="is-full" />
                מלא
              </span>
              <span>
                <i className="is-closed" />
                סגור
              </span>
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="bk-step bk-times">
            <Headline title="בחר שעה" subtitle="סמן את השעה הרצויה למטה" />
            {slots === null ? (
              <Spinner label="טוען שעות זמינות..." light />
            ) : !slots.length ? (
              <div className="bk-no-slots">
                <CalendarDays size={48} />
                <strong>אין שעות פנויות לתאריך שנבחר</strong>
                <p>בחר/י יום אחר או חזור/י אחורה</p>
              </div>
            ) : (
              <>
                {grouped.map((g) => (
                  <div className="bk-period" key={g.id}>
                    <div className="bk-period-head">
                      <span>{g.emoji}</span>
                      <strong>{g.label}</strong>
                      <i />
                    </div>
                    <div className="bk-slots">
                      {g.items.map((t) => (
                        <button
                          type="button"
                          key={t}
                          className={t === time ? 'is-on' : ''}
                          aria-pressed={t === time}
                          onClick={() => pickTime(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="bk-wait-cta">
                  <i />
                  <p>לא מצאת שעה מתאימה?</p>
                  <button
                    type="button"
                    onClick={() => {
                      setWaitDone(null);
                      setWaitDate(date);
                    }}
                  >
                    <Clock size={16} />
                    הצטרף/פי לרשימת המתנה
                  </button>
                </div>
              </>
            )}
          </section>
        )}
      </div>

      <div className={`bk-backdrop${sheetOpen ? ' is-on' : ''}`} onClick={() => !success && setExpanded(false)} />
      <div className={`bk-summary${expanded ? ' is-expanded' : ''}${success ? ' is-success' : ''}`}>
        {!success && (
          <button
            type="button"
            className="bk-handle"
            aria-label={expanded ? 'סגירת הסיכום' : 'פתיחת הסיכום'}
            onClick={() => setExpanded((v) => !v)}
          >
            <ChevronUp size={18} />
          </button>
        )}
        {success ? (
          <div className="bk-success">
            <span className="bk-success-glow">
              <CircleCheck size={72} />
            </span>
            <h2>התור נקבע בהצלחה</h2>
            <span className="bk-success-pill">
              <CalendarDays size={13} />
              {longDate(success.slot_date, { year: 'numeric' })}
            </span>
            <span className="bk-success-pill">
              <Clock size={13} />
              {hm(success.slot_time)} – {endTime}
            </span>
            <div className="bk-success-meta">
              <small>שירות</small>
              <strong>{success.service_name || serviceNames}</strong>
              <i />
              <small>על ידי</small>
              <strong>{member?.name}</strong>
            </div>
            <div className="bk-success-actions">
              <button type="button" className="is-soft" onClick={() => downloadCalendar(success)}>
                <CalendarDays size={17} />
                הוסף ליומן
              </button>
              <button type="button" className="is-primary" onClick={leave}>
                הבנתי
              </button>
            </div>
          </div>
        ) : (
          <>
            <strong className="bk-summary-title">סיכום תור</strong>
            {!expanded ? (
              <div className="bk-peek">
                {member ? (
                  <button type="button" className="bk-peek-item" onClick={() => setExpanded(true)}>
                    <span className="bk-peek-avatar">
                      <BrandImage sources={[member.image_url]} alt="" fallback={<User size={11} fill="#aaa" strokeWidth={0} />} />
                    </span>
                    <span>{member.name}</span>
                  </button>
                ) : (
                  <button type="button" className="bk-peek-placeholder" onClick={() => jump(1)}>
                    <User size={13} />
                    איש צוות
                  </button>
                )}
                <i className="bk-peek-sep" />
                {picked.length ? (
                  <button type="button" className="bk-peek-item is-flex" onClick={() => setExpanded(true)}>
                    <span className="bk-peek-price">{priceText(price)}</span>
                    <span className="bk-peek-text">{serviceNames}</span>
                  </button>
                ) : (
                  <button type="button" className="bk-peek-placeholder is-flex" onClick={() => jump(2)}>
                    <Scissors size={14} />
                    בחר שירות
                  </button>
                )}
                <i className="bk-peek-sep" />
                {date ? (
                  <button type="button" className="bk-peek-item" onClick={() => setExpanded(true)}>
                    <CalendarDays size={12} color="#888" />
                    <span>{shortDate(date)}</span>
                  </button>
                ) : (
                  <button type="button" className="bk-peek-placeholder is-compact" onClick={() => jump(3)}>
                    בחר/י תאריך
                  </button>
                )}
                {time && (
                  <>
                    <i className="bk-peek-sep" />
                    <button type="button" className="bk-peek-item" onClick={() => setExpanded(true)}>
                      <Clock size={12} color="#888" />
                      <span>{time}</span>
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="bk-rows">
                {member && (
                  <button type="button" className="bk-sum-row" onClick={() => jump(1)}>
                    <span className="bk-sum-avatar">
                      <BrandImage sources={[member.image_url]} alt="" fallback={<User size={18} />} />
                    </span>
                    <span className="bk-sum-copy">
                      <small>איש צוות</small>
                      <strong>{member.name}</strong>
                    </span>
                    <span className="bk-sum-back">
                      <ChevronRight size={15} />
                      <em>חזור לשלב</em>
                    </span>
                  </button>
                )}
                {picked.length > 0 && (
                  <>
                    <i className="bk-dashed" />
                    <button type="button" className="bk-sum-row is-service" onClick={() => jump(2)}>
                      <span className="bk-sum-icon">
                        <CircleCheck size={22} />
                      </span>
                      <span className="bk-sum-copy">
                        <small>שירות</small>
                        <strong>{serviceNames}</strong>
                        <span>{`${priceText(price)} · ${duration} דק׳`}</span>
                      </span>
                      <span className="bk-sum-back">
                        <ChevronRight size={15} />
                        <em>חזור לשלב</em>
                      </span>
                    </button>
                  </>
                )}
                {date && (
                  <>
                    <i className="bk-dashed" />
                    <button type="button" className="bk-sum-row" onClick={() => jump(3)}>
                      <span className="bk-sum-icon">
                        <CalendarDays size={18} />
                      </span>
                      <span className="bk-sum-copy">
                        <small>תאריך</small>
                        <strong>{`${longDate(date, { day: undefined, month: undefined })} · ${shortDate(date)}`}</strong>
                      </span>
                      <span className="bk-sum-back">
                        <ChevronRight size={15} />
                        <em>חזור לשלב</em>
                      </span>
                    </button>
                  </>
                )}
                {time && (
                  <>
                    <i className="bk-dashed" />
                    <button type="button" className="bk-sum-row" onClick={() => jump(4)}>
                      <span className="bk-sum-icon">
                        <Clock size={18} />
                      </span>
                      <span className="bk-sum-copy">
                        <small>שעה</small>
                        <strong>{`${time} · ${daypart(time)}`}</strong>
                      </span>
                      <span className="bk-sum-back">
                        <ChevronRight size={15} />
                        <em>חזור לשלב</em>
                      </span>
                    </button>
                  </>
                )}
                {time && (
                  <button type="button" className="bk-confirm" disabled={busy} onClick={confirm}>
                    {busy ? <span className="cc-spinner is-small is-white" /> : 'קבע תור'}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {conflict && (
        <div className="bk-conflict-layer" onClick={() => !busy && setConflict(null)}>
          <div className="bk-conflict" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <span className="bk-conflict-icon">
              <CalendarDays size={30} />
            </span>
            <h2>תור קיים</h2>
            <p>
              {`יש לך תור קיים בתאריך ${longDate(conflict.slot_date)} בשעה ${hm(conflict.slot_time) || 'לא ידוע'} עבור ${conflict.service_name || 'לא הוגדר'}.`}
              <br />
              {`האם לבטל את התור הקיים ולקבוע חדש ב־${longDate(date)} בשעה ${time}?`}
            </p>
            <div className="bk-conflict-actions">
              <button type="button" className="is-swap" disabled={busy} onClick={() => book(conflict)}>
                <ArrowLeftRight size={16} />
                החלפת תור
              </button>
              <button type="button" className="is-add" disabled={busy} onClick={() => book()}>
                <Plus size={16} />
                קביעת תור נוסף
              </button>
            </div>
            <button type="button" className="bk-conflict-cancel" disabled={busy} onClick={() => setConflict(null)}>
              ביטול
            </button>
          </div>
        </div>
      )}

      <WaitlistSheet
        open={Boolean(waitDate)}
        date={waitDate}
        services={serviceNames}
        busy={waitBusy}
        done={waitDone}
        onSubmit={joinWaitlist}
        onClose={() => setWaitDate('')}
        onFinish={leave}
      />

      <Dialog open={auth} onOpenChange={setAuth}>
        <DialogContent className="tori-dialog" dir="rtl">
          <DialogTitle>התחברות לעסק</DialogTitle>
          <DialogDescription>נזהה אותך כדי לשמור את התור על שמך.</DialogDescription>
          <AuthForm
            slug={slug}
            onDone={(u) => {
              onUser(u);
              setAuth(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
