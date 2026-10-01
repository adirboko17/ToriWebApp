'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Clock3,
  Phone,
  Scissors,
  Search,
  User,
  UserPlus,
  UserRound,
} from 'lucide-react';
import { api } from '@/lib/client';
import { addDays, israelNow, minutes } from '@/lib/availability';
import { HE_LETTERS, HE_MONTHS, HE_WEEKDAYS, addMonths, daysInMonth, dow, monthStart, ymd } from '@/lib/calendar-format';

type Client = { id: string; name: string; phone: string; image_url?: string | null };
type Service = { id: string; name: string; duration_minutes?: number | null; price?: number | null };
type Done = { date: string; start: string; end: string };

const localPhone = (s: string) => {
  const d = String(s || '').replace(/\D/g, '');
  return d.startsWith('972') ? `0${d.slice(3)}` : d;
};
function matches(c: Client, q: string) {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  if (String(c.name || '').toLowerCase().includes(t)) return true;
  const d = localPhone(t).replace(/^0/, '');
  return d.length >= 2 && localPhone(c.phone).includes(d);
}
const initial = (name: string) => String(name || '?').trim().charAt(0) || '?';
const durationOf = (s: Service) => (s.duration_minutes && s.duration_minutes > 0 ? s.duration_minutes : 60);
const periodOf = (t: string) => (minutes(t) < 12 * 60 ? 0 : minutes(t) < 17 * 60 ? 1 : 2);
const PERIODS = [
  ['בוקר', '☀️'],
  ['צהריים', '🌤'],
  ['ערב', '🌙'],
] as const;
const daypart = (t: string) => (minutes(t) >= 5 * 60 && minutes(t) < 12 * 60 ? 'בוקר' : minutes(t) >= 12 * 60 && minutes(t) < 17 * 60 ? 'צהריים' : 'ערב');
const fullDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('he-IL', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const rowDate = (d: string) => {
  const { y, m, d: day } = ymd(d);
  return `${HE_WEEKDAYS[dow(d)]} · ${day}.${m + 1}.${String(y).slice(2)}`;
};
const chipDate = (d: string) => `${HE_LETTERS[dow(d)]}׳ ${ymd(d).d}.${ymd(d).m + 1}`;

function Alert({ alert, onClose }: { alert: { title: string; message: string } | null; onClose: () => void }) {
  if (!alert) return null;
  return (
    <div className="ios-alert-layer" dir="rtl" role="alertdialog" aria-modal="true" aria-label={alert.title}>
      <div className="ios-alert">
        <div className="ios-alert-copy">
          <strong>{alert.title}</strong>
          <p>{alert.message}</p>
        </div>
        <div className="ios-alert-buttons">
          <button type="button" onClick={onClose}>
            אישור
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminAddAppointment({
  slug,
  userId,
  open,
  initialDate,
  initialTime,
  clients,
  services,
  multi,
  onClose,
  onBooked,
}: {
  slug: string;
  userId: string;
  open: boolean;
  initialDate?: string;
  initialTime?: string;
  clients: Client[];
  services: Service[];
  multi: boolean;
  onClose: () => void;
  onBooked: (date: string) => void;
}) {
  const today = israelNow().date;
  const lastMonth = addMonths(today, 12);
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<'choose' | 'existing' | 'new'>('choose');
  const [list, setList] = useState<Client[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [month, setMonth] = useState(monthStart(today));
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [times, setTimes] = useState<string[] | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  useEffect(() => {
    if (!open) return;
    const start = initialDate && initialDate >= today ? initialDate : null;
    setStep(1);
    setMode('choose');
    setList(clients.filter((c) => String(c.phone || '').trim()));
    setClient(null);
    setQuery('');
    setName('');
    setPhone('');
    setPicked([]);
    setDate(start);
    setMonth(monthStart(start || today));
    setTime(start && initialTime ? initialTime : null);
    setTimes(null);
    setExpanded(false);
    setDone(null);
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open || step !== 3 || !picked.length) return;
    let live = true;
    setCounts(null);
    api(slug, 'admin-book-month', undefined, {
      services: picked.join(','),
      from: month,
      to: addDays(month, daysInMonth(month) - 1),
    })
      .then((r) => live && setCounts(r))
      .catch(() => live && setCounts({}));
    return () => {
      live = false;
    };
  }, [open, step, month, picked.join(',')]);

  useEffect(() => {
    if (!open || step !== 4 || !date || !picked.length) return;
    let live = true;
    setTimes(null);
    api(slug, 'availability', undefined, { worker: userId, services: picked.join(','), date })
      .then((r) => {
        if (!live) return;
        setTimes(r.slots);
        if (time) setExpanded(true);
      })
      .catch(() => {
        if (!live) return;
        setTimes([]);
        setAlert({ title: 'שגיאה', message: 'נכשל בטעינת שעות זמינות. נסו שוב.' });
      });
    return () => {
      live = false;
    };
  }, [open, step, date, picked.join(',')]);

  if (!open || typeof document === 'undefined') return null;

  const chosen = picked.map((id) => services.find((s) => s.id === id)).filter(Boolean) as Service[];
  const totalMinutes = chosen.reduce((n, s) => n + durationOf(s), 0);
  const prices = chosen.map((s) => s.price).filter((p) => p != null);
  const totalPrice = prices.length ? prices.reduce((n, p) => n + Number(p), 0) : null;
  const newValid = name.trim().length >= 2 && phone.replace(/\D/g, '').length >= 9;

  function back() {
    if (busy || done) return;
    setExpanded(false);
    if (step > 1) return setStep(step - 1);
    if (mode !== 'choose') return setMode('choose');
    onClose();
  }
  function jump(to: number) {
    setExpanded(false);
    if (to === 1) setMode(client && list.some((c) => c.id === client.id) ? 'existing' : mode);
    setStep(to);
  }
  async function continueClient() {
    if (mode === 'existing' && client) return setStep(2);
    if (mode !== 'new' || !newValid) return;
    setBusy(true);
    try {
      const created: Client = await api(slug, 'admin-new-client', { name: name.trim(), phone });
      setList((l) => [...l, created]);
      setClient(created);
      setMode('existing');
      setStep(2);
    } catch (e: any) {
      setAlert({ title: 'שגיאה', message: e.message || 'לא ניתן ליצור את הלקוח. נסו שוב.' });
    } finally {
      setBusy(false);
    }
  }
  function pickService(id: string) {
    setTime(null);
    if (!multi) {
      setPicked([id]);
      setStep(3);
      return;
    }
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }
  function pickDay(d: string) {
    if (d !== date) setTime(null);
    setDate(d);
    setStep(4);
  }
  async function submit() {
    if (!client || !chosen.length || !date || !time) {
      setAlert({ title: 'שגיאה', message: 'אנא מלא/י את כל השדות הנדרשים' });
      return;
    }
    setBusy(true);
    try {
      setDone(await api(slug, 'admin-book', { clientId: client.id, services: picked, date, time }));
      setExpanded(true);
    } catch (e: any) {
      const taken = String(e.message || '').includes('נתפסת');
      setAlert({ title: taken ? 'השעה תפוסה' : 'שגיאה בקביעת התור', message: e.message || '' });
    } finally {
      setBusy(false);
    }
  }

  const intro = (title: string, text: string) => (
    <div className="aa-intro">
      <h1>{title}</h1>
      <p>{text}</p>
    </div>
  );
  const continuePill = (onClick: () => void, disabled = false) => (
    <button type="button" className="aa-continue" disabled={disabled || busy} onClick={onClick}>
      {busy ? <span className="aa-spinner" /> : 'המשך'}
      {!busy && <ChevronLeft size={18} strokeWidth={2.4} />}
    </button>
  );
  const avatar = (c: Client) => <span className="aa-avatar">{initial(c.name)}</span>;

  let body: React.ReactNode = null;
  if (step === 1 && mode === 'choose')
    body = (
      <>
        {intro('סוג לקוח', 'בחרו אם מדובר בלקוח שכבר נמצא אצלכם ברשימה או בלקוח חדש שטרם נרשם.')}
        <div className="aa-choices">
          {(
            [
              ['existing', User, 'לקוח קיים', 'חיפוש ובחירה מתוך רשימת הלקוחות'],
              ['new', UserPlus, 'לקוח חדש', 'הזנת שם וטלפון ללקוח חדש'],
            ] as const
          ).map(([id, Icon, title, hint]) => (
            <button type="button" key={id} className="aa-choice" onClick={() => setMode(id)}>
              <span className="aa-choice-icon">
                <Icon size={24} strokeWidth={2.2} />
              </span>
              <span className="aa-choice-copy">
                <strong>{title}</strong>
                <small>{hint}</small>
              </span>
              <ChevronLeft size={20} strokeWidth={2.2} className="aa-choice-caret" />
            </button>
          ))}
        </div>
      </>
    );
  else if (step === 1 && mode === 'existing')
    body = (
      <>
        {intro('בחר לקוח קיים', 'בחר לקוח קיים מהרשימה לקביעת התור.')}
        {client ? (
          <div className="aa-stack">
            <div className="aa-selected">
              {avatar(client)}
              <span className="aa-person">
                <strong>{client.name}</strong>
                <small dir="ltr">{client.phone}</small>
              </span>
              <button type="button" onClick={() => setClient(null)}>
                שנה/י
              </button>
            </div>
            {continuePill(continueClient)}
          </div>
        ) : (
          <div className="aa-field-wrap">
            <label className={`aa-field${focused ? ' is-focused' : ''}`}>
              <Search size={18} />
              <input
                value={query}
                placeholder="בחר/י לקוח..."
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            {focused && (
              <div className="aa-dropdown" onMouseDown={(e) => e.preventDefault()}>
                {(() => {
                  const found = list.filter((c) => matches(c, query)).slice(0, 60);
                  if (!found.length) return <p className="aa-dropdown-empty">אין תוצאות</p>;
                  return found.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => {
                        setClient(c);
                        setFocused(false);
                        setQuery('');
                      }}
                    >
                      {avatar(c)}
                      <span className="aa-person">
                        <strong>{c.name}</strong>
                        <small dir="ltr">{c.phone}</small>
                      </span>
                    </button>
                  ));
                })()}
              </div>
            )}
          </div>
        )}
      </>
    );
  else if (step === 1)
    body = (
      <>
        {intro('הוספת לקוח חדש', 'הזינו שם וטלפון - הלקוח יוכל אחר כך להתחבר לאפליקציה עם מספר הטלפון הזה.')}
        <div className="aa-field-wrap aa-stack">
          <label className="aa-field">
            <User size={18} />
            <input value={name} aria-label="שם מלא" placeholder="כתוב/י שם מלא" onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="aa-field">
            <Phone size={18} />
            <input
              value={phone}
              type="tel"
              inputMode="tel"
              aria-label="מספר טלפון נייד"
              placeholder="מספר טלפון"
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          {newValid && continuePill(continueClient)}
        </div>
      </>
    );
  else if (step === 2)
    body = (
      <>
        <div className="aa-intro is-section">
          <h1>בחר/י שירות</h1>
          <p>{multi ? 'ניתן לבחור שירות אחד או יותר' : 'הקישו לבחירת שירות אחד'}</p>
        </div>
        {services.length ? (
          <div className={`aa-services${services.length > 3 ? ' is-scroll' : ''}`}>
            {services.map((s) => {
              const on = picked.includes(s.id);
              return (
                <button type="button" key={s.id} className={`aa-service${on ? ' is-on' : ''}`} onClick={() => pickService(s.id)}>
                  <span className="aa-service-icon">{on ? <Check size={20} strokeWidth={2.6} /> : <Clock3 size={18} />}</span>
                  <span className="aa-service-copy">
                    <strong>{s.name}</strong>
                    <small>{durationOf(s)} דק׳</small>
                  </span>
                  <span className="aa-price">{s.price != null ? `₪${s.price}` : '-'}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="aa-empty">
            <span>
              <Scissors size={26} />
            </span>
            <strong>אין שירותים זמינים</strong>
            <small>נסו לבחור איש צוות אחר, או לחזור מאוחר יותר</small>
          </div>
        )}
        {multi && picked.length > 0 && <div className="aa-center">{continuePill(() => setStep(3))}</div>}
      </>
    );
  else if (step === 3) {
    const { y, m } = ymd(month);
    const lead = dow(month);
    const cells: (string | null)[] = [
      ...Array(lead).fill(null),
      ...Array.from({ length: daysInMonth(month) }, (_, i) => addDays(month, i)),
    ];
    while (cells.length % 7) cells.push(null);
    body = (
      <>
        <div className="aa-intro is-section">
          <h1>בחירת תאריך</h1>
          <p>{counts === null ? 'בודק...' : 'הנקודות מראות זמינות - לחצו על יום כדי להמשיך'}</p>
        </div>
        <div className="aa-cal">
          <div className="aa-cal-head">
            <button type="button" aria-label="חודש קודם" disabled={month <= monthStart(today)} onClick={() => setMonth(addMonths(month, -1))}>
              <ChevronRight size={22} />
            </button>
            <strong>
              {HE_MONTHS[m]} {y}
            </strong>
            <button type="button" aria-label="חודש הבא" disabled={month >= lastMonth} onClick={() => setMonth(addMonths(month, 1))}>
              <ChevronLeft size={22} />
            </button>
          </div>
          <div className="aa-cal-week">
            {HE_LETTERS.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>
          <div className="aa-cal-grid">
            {cells.map((d, i) => {
              if (!d) return <span key={`e${i}`} />;
              const count = counts?.[d];
              const past = d < today;
              const closed = count === -1;
              const dot = past || count === undefined || d === date ? '' : count > 0 ? 'is-open' : count === 0 ? 'is-full' : 'is-closed';
              return (
                <button
                  type="button"
                  key={d}
                  disabled={past || closed}
                  className={`${d === today ? 'is-today' : ''}${d === date ? ' is-selected' : ''}${past ? ' is-past' : ''}`}
                  onClick={() => pickDay(d)}
                >
                  <b>{ymd(d).d}</b>
                  <i className={dot} />
                </button>
              );
            })}
          </div>
        </div>
        <div className="aa-legend">
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
      </>
    );
  } else {
    const groups = PERIODS.map((_, i) => (times || []).filter((t) => periodOf(t) === i));
    body = (
      <>
        {intro('שעה', 'בחר/י חלון זמן פנוי')}
        {times === null ? (
          <div className="aa-loading">
            <span className="aa-spinner" />
            טוען שעות זמינות...
          </div>
        ) : !times.length ? (
          <div className="aa-empty">
            <span>
              <Clock size={26} />
            </span>
            <strong>אין שעות זמינות ליום זה</strong>
            <small>אפשר לחזור ולבחור יום אחר</small>
          </div>
        ) : (
          groups.map((group, i) =>
            group.length ? (
              <section className="aa-period" key={i}>
                <header>
                  <span>{PERIODS[i][1]}</span>
                  <strong>{PERIODS[i][0]}</strong>
                  <i />
                </header>
                <div className="aa-times">
                  {group.map((t) => (
                    <button
                      type="button"
                      key={t}
                      className={t === time ? 'is-on' : ''}
                      onClick={() => {
                        setTime(t);
                        setExpanded(true);
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </section>
            ) : null,
          )
        )}
      </>
    );
  }

  const chips = [
    client && [client.name, 1],
    chosen.length && [chosen.map((s) => s.name).join(' + '), 2],
    date && step > 3 && [chipDate(date), 3],
    time && date && step > 3 && [time, 4],
  ].filter(Boolean) as [string, number][];

  return createPortal(
    <div className={`aa step-${step}${client ? ' has-sheet' : ''}`} dir="rtl">
      <button type="button" className="aa-back" aria-label="חזרה" onClick={back}>
        <ArrowRight size={22} />
      </button>
      <div className={`aa-body${step === 4 ? ' is-top' : ''}`}>{body}</div>
      {client && (
        <>
          {expanded && <div className="aa-scrim" onClick={() => !done && setExpanded(false)} />}
          <div className={`aa-sheet${expanded ? ' is-open' : ''}`}>
            <button type="button" className="aa-sheet-grip" aria-label="סיכום תור" onClick={() => !done && setExpanded(!expanded)}>
              <span />
            </button>
            {done ? (
              <div className="aa-done">
                <span className="aa-done-icon">
                  <CheckCircle2 size={72} strokeWidth={1.6} />
                </span>
                <h2>התור נקבע בהצלחה</h2>
                <div className="aa-done-pills">
                  <span>{fullDate(done.date)}</span>
                  <span dir="ltr">
                    {done.start} – {done.end}
                  </span>
                </div>
                <div className="aa-done-meta">
                  <div>
                    <small>שירות</small>
                    <strong>{chosen.map((s) => s.name).join(' + ')}</strong>
                  </div>
                  <div>
                    <small>לקוח</small>
                    <strong>{client.name}</strong>
                  </div>
                </div>
                <button type="button" className="aa-confirm" onClick={() => onBooked(done.date)}>
                  הבנתי
                </button>
              </div>
            ) : (
              <>
                <strong className="aa-sheet-title">סיכום תור</strong>
                {!expanded ? (
                  <div className="aa-chips" onClick={() => setExpanded(true)}>
                    {chips.map(([label], i) => (
                      <span key={i}>{label}</span>
                    ))}
                  </div>
                ) : (
                  <div className="aa-rows">
                    <button type="button" className="aa-row" onClick={() => jump(1)}>
                      <span className="aa-row-icon is-gray">
                        <UserRound size={18} />
                      </span>
                      <span className="aa-row-copy">
                        <small>לקוח</small>
                        <strong>{client.name}</strong>
                      </span>
                      <span className="aa-row-back">
                        <em>חזור לשלב</em>
                        <ChevronLeft size={15} />
                      </span>
                    </button>
                    {chosen.length > 0 && (
                      <button type="button" className="aa-row is-service" onClick={() => jump(2)}>
                        <span className="aa-row-icon">
                          <CheckCircle2 size={20} />
                        </span>
                        <span className="aa-row-copy">
                          <small>שירות</small>
                          <strong>{chosen.map((s) => s.name).join(' + ')}</strong>
                          <span>
                            {totalPrice != null ? `₪${totalPrice}` : '-'} · {totalMinutes} דק׳
                          </span>
                        </span>
                        <span className="aa-row-back">
                          <em>חזור לשלב</em>
                          <ChevronLeft size={15} />
                        </span>
                      </button>
                    )}
                    {date && step > 3 && (
                      <button type="button" className="aa-row" onClick={() => jump(3)}>
                        <span className="aa-row-icon">
                          <Calendar size={18} />
                        </span>
                        <span className="aa-row-copy">
                          <small>תאריך</small>
                          <strong>{rowDate(date)}</strong>
                        </span>
                        <span className="aa-row-back">
                          <em>חזור לשלב</em>
                          <ChevronLeft size={15} />
                        </span>
                      </button>
                    )}
                    {time && date && step > 3 && (
                      <button type="button" className="aa-row" onClick={() => jump(4)}>
                        <span className="aa-row-icon">
                          <Clock size={18} />
                        </span>
                        <span className="aa-row-copy">
                          <small>שעה</small>
                          <strong>
                            <bdi dir="ltr">{time}</bdi> · {daypart(time)}
                          </strong>
                        </span>
                        <span className="aa-row-back">
                          <em>חזור לשלב</em>
                          <ChevronLeft size={15} />
                        </span>
                      </button>
                    )}
                    {time && date && step > 3 && (
                      <button type="button" className="aa-confirm" disabled={busy} onClick={submit}>
                        {busy ? <span className="aa-spinner is-dark" /> : 'קבע תור'}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
      <Alert alert={alert} onClose={() => setAlert(null)} />
    </div>,
    document.body,
  );
}
