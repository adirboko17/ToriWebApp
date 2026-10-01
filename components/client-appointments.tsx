'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeftRight,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  Clock,
  Mail,
  Send,
  Tag,
  User,
  X,
} from 'lucide-react';
import { api } from '@/lib/client';
import { addDays, israelNow } from '@/lib/availability';
import { cancelLocked, hebrewDay, isUpcoming, minutesUntil } from '@/lib/client-appointments';
import BottomSheet from './bottom-sheet';
import BrandImage from './brand-image';
import { WhatsAppIcon, whatsappLink } from './brand-icons';

export type AppointmentsRequest = { type: 'list' | 'cancel' | 'swap'; appointment?: any; n: number };

const FULL_DATE: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
const time = (t: string) => String(t || '').slice(0, 5);

function sectionLabel(date: string, past: boolean) {
  if (!past) {
    const today = israelNow().date;
    if (date === today) return 'היום';
    if (date === addDays(today, 1)) return 'מחר';
  }
  return hebrewDay(date, FULL_DATE);
}

function Avatar({ src }: { src?: string }) {
  const fallback = (
    <span className="ca-avatar-fallback">
      <User size={21} fill="currentColor" strokeWidth={0} />
    </span>
  );
  return (
    <span className="ca-avatar">
      {src ? <BrandImage sources={[src]} alt="" fallback={fallback} /> : fallback}
    </span>
  );
}

function AppointmentCard({
  a,
  staff,
  label,
  header,
  children,
}: {
  a: any;
  staff: any;
  label: string;
  header?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`ca-card-host${children ? ' has-tags' : ''}`}>
      <article className="ca-card">
        <div className="ca-card-head">
          <span>{header || hebrewDay(a.slot_date, { day: 'numeric', month: 'long' })}</span>
          <em>{label}</em>
        </div>
        <div className="ca-card-body">
          <Avatar src={staff?.image_url} />
          <div className="ca-card-copy">
            <strong>{a.service_name || 'שירות'}</strong>
            {staff?.name && <span>{staff.name}</span>}
          </div>
          <i className="ca-rule" />
          <b className="ca-time">{time(a.slot_time)}</b>
        </div>
      </article>
      {children && <div className="ca-tags">{children}</div>}
    </div>
  );
}

function CenterDialog({
  open,
  onClose,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  className: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return createPortal(
    <div className={`ca-dialog-layer ${className}`} dir="rtl" onClick={onClose}>
      <div className="ca-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function CancelSheet({
  slug,
  appointment,
  onClose,
  onCancelled,
}: {
  slug: string;
  appointment: any;
  onClose: () => void;
  onCancelled: (id: string) => void;
}) {
  const [phase, setPhase] = useState<'confirm' | 'working' | 'done'>('confirm');
  const [shown, setShown] = useState<any>(appointment);
  useEffect(() => {
    if (appointment) {
      setShown(appointment);
      setPhase('confirm');
    }
  }, [appointment]);
  const confirm = async () => {
    setPhase('working');
    try {
      await api(slug, 'cancel', { id: shown.id });
      onCancelled(shown.id);
      setPhase('done');
    } catch (e: any) {
      setPhase('confirm');
      alert(e.message || 'אירעה שגיאה בעת הביטול. נסו שוב.');
    }
  };
  return (
    <BottomSheet open={Boolean(appointment)} onClose={onClose} size="auto" locked={phase === 'working'} className="cc-sheet">
      {shown && phase === 'confirm' && (
        <div className="cc-body">
          <div className="cc-head">
            <div>
              <h2>ביטול תור</h2>
              <p>האם לבטל את התור שבחרת?</p>
            </div>
            <button type="button" className="cc-close" aria-label="סגור" onClick={onClose}>
              <X size={22} />
            </button>
          </div>
          <div className="cc-chips">
            <span className="is-date">
              <CalendarDays size={14} />
              {hebrewDay(shown.slot_date, FULL_DATE)}
            </span>
            <div>
              <span className="is-service">
                <Tag size={14} />
                {shown.service_name || 'שירות'}
              </span>
              <span className="is-time">
                <Clock size={14} />
                {time(shown.slot_time)}
              </span>
            </div>
          </div>
          <div className="cc-actions">
            <button type="button" className="cc-back" onClick={onClose}>
              חזרה
            </button>
            <button type="button" className="cc-confirm" onClick={confirm}>
              אישור
            </button>
          </div>
        </div>
      )}
      {phase === 'working' && (
        <div className="cc-state" role="status">
          <span className="cc-spinner" />
          <p>מבטלים את התור…</p>
        </div>
      )}
      {phase === 'done' && (
        <div className="cc-state is-done">
          <CircleCheck size={76} className="cc-done-icon" />
          <h2>התור בוטל</h2>
          <p>התור בוטל בהצלחה. אפשר לקבוע תור חדש בכל זמן שתרצה.</p>
          <button type="button" className="cc-got-it" onClick={onClose}>
            הבנתי
          </button>
        </div>
      )}
    </BottomSheet>
  );
}

function LateCancelDialog({
  appointment,
  hours,
  phone,
  onClose,
}: {
  appointment: any;
  hours: number;
  phone?: string | null;
  onClose: () => void;
}) {
  const a = appointment;
  const message = a
    ? `היי, אשמח לבטל את התור שנקבע ל־${hebrewDay(a.slot_date, FULL_DATE)} בשעה ${time(a.slot_time)} עבור "${a.service_name || 'שירות'}". אפשר לעזור?`
    : 'היי, אשמח לעזרה בביטול תור בהתראה קצרה.';
  const send = () => {
    if (!phone) {
      alert('מספר הטלפון של המנהל אינו זמין כרגע');
      return;
    }
    window.open(whatsappLink(phone, message), '_blank', 'noopener');
  };
  return (
    <CenterDialog open={Boolean(a)} onClose={onClose} className="cl-late">
      {a && (
        <>
          <h2>לא ניתן לבטל תור</h2>
          <p>ניתן לבטל תורים עד {hours} שעות לפני המועד. לביטול בהתראה קצרה, אנא צור קשר עם המנהל.</p>
          <div className="cl-late-chips">
            <span>
              <CalendarDays size={14} />
              {hebrewDay(a.slot_date, FULL_DATE)}
            </span>
            <span>
              <Clock size={14} />
              {time(a.slot_time)}
            </span>
            <span>
              <Tag size={14} />
              {a.service_name || 'שירות'}
            </span>
          </div>
          <div className="cl-late-actions">
            <button type="button" className="is-close" onClick={onClose}>
              סגור
            </button>
            <button type="button" className="is-whatsapp" onClick={send}>
              <WhatsAppIcon size={18} />
              שליחת הודעה
            </button>
          </div>
        </>
      )}
    </CenterDialog>
  );
}

const SWAP_DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];
const SWAP_RANGES = [
  { id: 'morning', emoji: '☀️', label: 'בוקר', from: '08:00', until: '12:00' },
  { id: 'noon', emoji: '🌤', label: 'צהריים', from: '12:00', until: '16:00' },
  { id: 'evening', emoji: '🌙', label: 'ערב', from: '16:00', until: '20:00' },
];

function preferenceDays(dates: string[]) {
  const found = new Set<number>();
  for (const date of dates || []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const day = new Date(date + 'T12:00:00Z').getUTCDay();
    if (day < 6) found.add(day);
  }
  return [...found].sort().map((day) => SWAP_DAYS[day]);
}

function preferenceRanges(request: any) {
  const saved = Array.isArray(request?.preferred_time_slots) ? request.preferred_time_slots : [];
  if (saved.length)
    return SWAP_RANGES.filter(
      (range) => saved.includes(range.id) || (range.id === 'noon' && saved.includes('afternoon')),
    ).map((range) => range.label);
  const from = String(request?.preferred_time_from || '').slice(0, 5);
  const until = String(request?.preferred_time_to || '').slice(0, 5);
  return SWAP_RANGES.filter((range) => range.from >= from && range.until <= until).map((range) => range.label);
}

function SwapSheet({
  slug,
  data,
  appointment,
  request,
  loaded,
  upcoming,
  staffOf,
  onClose,
  onSent,
}: {
  slug: string;
  data: any;
  appointment: any;
  request: any;
  loaded: boolean;
  upcoming: any[];
  staffOf: (a: any) => any;
  onClose: () => void;
  onSent: () => void;
}) {
  const p = data.profile;
  const [picked, setPicked] = useState<any>(null);
  const [days, setDays] = useState<number[]>([]);
  const [ranges, setRanges] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cancelled, setCancelled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (!appointment) return;
    setPicked(appointment);
    setDays([]);
    setRanges([]);
    setError('');
    setCancelled(false);
    setDismissed(false);
  }, [appointment]);
  const minHours = Math.min(168, Math.max(0, Number(p.client_swap_min_hours ?? 24)));
  const tomorrow = addDays(israelNow().date, 1);
  const weekSunday = addDays(tomorrow, (7 - new Date(tomorrow + 'T12:00:00Z').getUTCDay()) % 7);
  const a = picked;
  const tooSoon = a ? minutesUntil(a) < Math.max(0, minHours * 60) : false;
  const toggle = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  const ready = days.length > 0 && ranges.length > 0 && !tooSoon && !busy;
  const send = async () => {
    if (!ready || !a) return;
    const today = israelNow().date;
    const dates: string[] = [];
    for (let i = 0; i < 28 && dates.length < 14; i++) {
      const d = addDays(today, i);
      if (days.includes(new Date(d + 'T12:00:00Z').getUTCDay()) && d !== a.slot_date) dates.push(d);
    }
    const chosen = SWAP_RANGES.filter((r) => ranges.includes(r.id));
    setBusy(true);
    setError('');
    try {
      await api(slug, 'swap', {
        id: a.id,
        dates,
        from: chosen[0].from,
        until: chosen[chosen.length - 1].until,
        slots: ranges,
      });
      onSent();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const disabled = p.client_swap_enabled === false;
  const searching = Boolean(request) && !dismissed;
  const dayLabels = searching ? preferenceDays(request.preferred_dates || []) : [];
  const rangeLabels = searching ? preferenceRanges(request) : [];
  const cancelRequest = async () => {
    if (!a || busy) return;
    setBusy(true);
    setError('');
    try {
      await api(slug, 'swap', { id: a.id, cancel: true });
      setDismissed(true);
      setCancelled(true);
      onSent();
    } catch (e: any) {
      setError(e.message || 'הביטול נכשל, נסה שוב');
    } finally {
      setBusy(false);
    }
  };
  return (
    <BottomSheet open={Boolean(appointment)} onClose={onClose} size="auto" locked={busy} className="cs-sheet">
      <div className="cs-body">
        {appointment && !loaded ? (
          <div className="cs-wait" role="status">
            <span className="cc-spinner" />
          </div>
        ) : cancelled ? (
          <div className="cs-status">
            <div className="cs-status-hero">
              <span className="cs-status-icon is-muted">
                <X size={36} />
              </span>
              <h2>הבקשה בוטלה</h2>
              <p>אפשר לבחור ימים ושעות חדשים ולשלוח בקשה ללקוחות אחרים.</p>
            </div>
            <button type="button" className="cs-send" onClick={() => setCancelled(false)}>
              המשך לחפש תור אחר
            </button>
            <button type="button" className="cs-quiet" onClick={onClose}>
              סגור
            </button>
          </div>
        ) : searching && a ? (
          <div className="cs-status">
            <div className="cs-status-hero">
              <span className="cs-status-icon">
                <ArrowLeftRight size={26} />
              </span>
              <span className="cs-status-pill">
                {request.status === 'pending_confirmation' ? 'ממתינים לאישור שלך' : 'מחפשים לך תור'}
                {request.status === 'pending_confirmation' ? null : <i className="ch-ring" aria-hidden />}
              </span>
              <h2>{request.status === 'pending_confirmation' ? 'יש הצעה להחלפה' : 'הבקשה נשלחה'}</h2>
              <p>
                {request.status === 'pending_confirmation'
                  ? 'בדקי את התור המוצע ואשרי רק אם הוא מתאים לך. עד האישור התורים לא מתחלפים.'
                  : 'נודיע לך ברגע שמישהו יציע החלפה - ורק אחרי שתאשרי זה יתחלף'}
              </p>
            </div>
            <div className="cs-status-panel">
              <AppointmentCard a={a} staff={staffOf(a)} label="התור שלך" header={hebrewDay(a.slot_date)} />
              {(dayLabels.length > 0 || rangeLabels.length > 0) && request.status !== 'pending_confirmation' && (
                <div className="cs-prefs">
                  <span>במקום התור הזה</span>
                  <div>
                    {dayLabels.length > 0 && (
                      <span className="cs-pref">
                        <CalendarDays size={14} />
                        {dayLabels.map((label) => (
                          <b key={label}>{label}</b>
                        ))}
                      </span>
                    )}
                    {dayLabels.length > 0 && rangeLabels.length > 0 && <i className="cs-pref-dot" />}
                    {rangeLabels.length > 0 && (
                      <span className="cs-pref">
                        <Clock size={14} />
                        {rangeLabels.map((label) => (
                          <b key={label}>{label}</b>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
            {error && <p className="cs-hint is-error">{error}</p>}
            <button type="button" className="cs-send" disabled={busy} onClick={cancelRequest}>
              {busy ? <span className="cc-spinner is-small" /> : null}
              בטל בקשה
            </button>
          </div>
        ) : (
          <>
        <div className="cs-head">
          <h2>החלפת תור</h2>
          <p>{disabled ? 'החלפת תורים אינה זמינה כרגע' : 'מציעים את התור שלך ומקבלים תור של מישהו אחר'}</p>
        </div>
        {!disabled && a && (
          <>
            {upcoming.length > 1 && (
              <div className="cs-which">
                <span>איזה תור להחליף?</span>
                <div>
                  {upcoming.map((u) => (
                    <button
                      type="button"
                      key={u.id}
                      className={u.id === a.id ? 'is-on' : ''}
                      onClick={() => setPicked(u)}
                    >
                      {Number(u.slot_date.slice(8))}.{Number(u.slot_date.slice(5, 7))} · {time(u.slot_time)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <AppointmentCard
              a={a}
              staff={staffOf(a)}
              label="התור שלך"
              header={hebrewDay(a.slot_date)}
            />
            <div className="cs-pick">
              <h3>באילו ימים מתאים לך?</h3>
              <div className="cs-days">
                {SWAP_DAYS.map((label, day) => {
                  const hint = addDays(weekSunday, day);
                  return (
                    <button
                      type="button"
                      key={day}
                      className={days.includes(day) ? 'is-on' : ''}
                      aria-pressed={days.includes(day)}
                      onClick={() => setDays((list) => toggle(list, day))}
                    >
                      <strong>{label}</strong>
                      <i />
                      <small>{`${Number(hint.slice(8))}.${Number(hint.slice(5, 7))}`}</small>
                    </button>
                  );
                })}
              </div>
              {days.length > 0 && (
                <span className="cs-chosen">
                  {days.length === 1 ? 'נבחר יום אחד' : `נבחרו ${days.length} ימים`}
                </span>
              )}
              <i className="cs-divider" />
              <h3>באיזה שעות?</h3>
              <div className="cs-ranges">
                {SWAP_RANGES.map((r) => (
                  <button
                    type="button"
                    key={r.id}
                    className={ranges.includes(r.id) ? 'is-on' : ''}
                    aria-pressed={ranges.includes(r.id)}
                    onClick={() => setRanges((list) => toggle(list, r.id))}
                  >
                    <span>{r.emoji}</span>
                    <strong>{r.label}</strong>
                    <small>{`${Number(r.from.slice(0, 2))}:00 – ${Number(r.until.slice(0, 2))}:00`}</small>
                  </button>
                ))}
              </div>
            </div>
            {tooSoon && (
              <p className="cs-hint">
                התור הזה קרוב מדי למועד - לפי מדיניות העסק אי אפשר לפרסם אותו להחלפה.
              </p>
            )}
            {error && <p className="cs-hint is-error">{error}</p>}
            <button type="button" className="cs-send" disabled={!ready} onClick={send}>
              {busy ? <span className="cc-spinner is-small" /> : <Send size={17} />}
              שלח בקשה להחלפה
            </button>
          </>
        )}
        </>
        )}
      </div>
    </BottomSheet>
  );
}

export default function ClientAppointments({
  slug,
  data,
  open,
  request,
  onClose,
  onChanged,
}: {
  slug: string;
  data: any;
  open: boolean;
  request: AppointmentsRequest | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const p = data.profile;
  const [rows, setRows] = useState<any[] | null>(null);
  const [swaps, setSwaps] = useState<any[]>([]);
  const [swapsLoaded, setSwapsLoaded] = useState(false);
  const [past, setPast] = useState(false);
  const [cancelling, setCancelling] = useState<any>(null);
  const [late, setLate] = useState<any>(null);
  const [swapping, setSwapping] = useState<any>(null);
  const load = useCallback(() => {
    api(slug, 'appointments')
      .then(setRows)
      .catch(() => setRows([]));
    api(slug, 'swaps')
      .then(setSwaps)
      .catch(() => setSwaps([]))
      .finally(() => setSwapsLoaded(true));
  }, [slug]);
  useEffect(() => {
    if (open) {
      setPast(false);
      load();
    }
  }, [open, load]);
  const startCancel = useCallback(
    (a: any) => {
      if (cancelLocked(a, p.min_cancellation_hours)) setLate(a);
      else setCancelling(a);
    },
    [p.min_cancellation_hours],
  );
  useEffect(() => {
    if (!request || request.type === 'list' || !request.appointment) return;
    if (request.type === 'cancel') startCancel(request.appointment);
    else {
      setSwapping(request.appointment);
      setSwapsLoaded(false);
      load();
    }
  }, [request?.n]);
  const staffOf = useCallback(
    (a: any) => data.staff?.find((s: any) => s.id === (a.barber_id || a.user_id)),
    [data.staff],
  );
  const upcoming = useMemo(() => (rows || []).filter(isUpcoming), [rows]);
  const history = useMemo(
    () => (rows || []).filter((r) => r.is_available === false && minutesUntil(r) < 0),
    [rows],
  );
  const list = past ? history : upcoming;
  const groups = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const r of [...list].sort((x, y) =>
      x.slot_date === y.slot_date
        ? time(x.slot_time).localeCompare(time(y.slot_time))
        : x.slot_date.localeCompare(y.slot_date),
    ))
      map.set(r.slot_date, [...(map.get(r.slot_date) || []), r]);
    return [...map.entries()];
  }, [list]);
  const swapOn = p.client_swap_enabled !== false && data.user?.user_type !== 'admin';
  const swapFor = (a: any) => swaps.find((s) => s.appointment_id === a.id);
  const nested = Boolean(cancelling || late);
  const name = data.user?.name?.trim();
  return (
    <>
      <BottomSheet open={open} onClose={onClose} size="auto" locked={nested} className="ca-sheet" title="">
        <div className="ca-head">
          <span className="ca-side">
            {past && (
              <button type="button" className="ca-icon" aria-label="חזרה" onClick={() => setPast(false)}>
                <ChevronRight size={22} />
              </button>
            )}
          </span>
          <h2>{past ? 'היסטוריה' : 'התורים שלי'}</h2>
          <span className="ca-side">
            <button
              type="button"
              className={`ca-icon${past ? ' is-on' : ''}`}
              aria-label="היסטוריה"
              aria-pressed={past}
              onClick={() => setPast((v) => !v)}
            >
              <Clock size={22} {...(past ? { fill: 'currentColor', stroke: '#fff' } : {})} />
            </button>
          </span>
        </div>
        {!rows ? (
          <div className="ca-loading" role="status">
            <span className="cc-spinner is-large" />
            <strong>טוען את התורים שלך...</strong>
            <span>{name ? `מחפש תורים עבור ${name}` : 'מחפש תורים...'}</span>
          </div>
        ) : !groups.length ? (
          <div className="ca-empty">
            <span>{past ? <Clock size={42} /> : <CalendarDays size={42} />}</span>
            <strong>{past ? 'אין תורים בעבר' : 'אין תורים קרובים'}</strong>
            <p>{past ? 'התורים הקודמים שלך יופיעו כאן' : 'התורים הקרובים שלך יופיעו כאן'}</p>
          </div>
        ) : (
          <div className="sheet-scroll ca-list">
            {groups.map(([date, items]) => (
              <section key={date}>
                <div className="ca-date">
                  <h3>{sectionLabel(date, past)}</h3>
                  <i />
                </div>
                {items.map((a) => {
                  const swap = swapFor(a);
                  return (
                    <AppointmentCard
                      key={a.id}
                      a={a}
                      staff={staffOf(a)}
                      label={past ? 'הושלם' : a.status === 'pending' ? 'ממתין' : 'מאושר'}
                    >
                      {!past && (
                        <>
                          {swapOn && (
                            <button
                              type="button"
                              className="ca-tag is-swap"
                              aria-label="להחלפת תור"
                              onClick={() => setSwapping(a)}
                            >
                              {swap?.status === 'pending_confirmation' ? (
                                <>
                                  <Mail size={16} />
                                  יש הצעה להחלפה
                                  <em>1</em>
                                </>
                              ) : swap ? (
                                <span className="ch-search">
                                  <i className="ch-ring" aria-hidden />
                                  מחפשים לך תור
                                </span>
                              ) : (
                                <>
                                  <ArrowLeftRight size={16} />
                                  החלף
                                </>
                              )}
                            </button>
                          )}
                          <button type="button" className="ca-tag is-cancel" onClick={() => startCancel(a)}>
                            <X size={16} />
                            ביטול
                          </button>
                        </>
                      )}
                    </AppointmentCard>
                  );
                })}
              </section>
            ))}
          </div>
        )}
      </BottomSheet>
      <CancelSheet
        slug={slug}
        appointment={cancelling}
        onClose={() => setCancelling(null)}
        onCancelled={(id) => {
          setRows((list) => (list ? list.filter((r) => r.id !== id) : list));
          onChanged();
        }}
      />
      <LateCancelDialog
        appointment={late}
        hours={Number(p.min_cancellation_hours ?? 24)}
        phone={p.manager_phone || p.phone}
        onClose={() => setLate(null)}
      />
      <SwapSheet
        slug={slug}
        data={data}
        appointment={swapping}
        request={swapping ? (swaps.find((s) => s.appointment_id === swapping.id) ?? null) : null}
        loaded={swapsLoaded}
        upcoming={upcoming}
        staffOf={staffOf}
        onClose={() => setSwapping(null)}
        onSent={() => {
          load();
          onChanged();
        }}
      />
    </>
  );
}
