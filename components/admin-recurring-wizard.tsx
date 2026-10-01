'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
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
import { HE_LETTERS, dow, ymd } from '@/lib/calendar-format';

type Client = { id: string; name: string; phone: string };
type Service = { id: string; name: string; duration_minutes?: number | null; price?: number | null };
type Setup = { clients: Client[]; services: Service[]; days: number[]; multi: boolean };
type Notice = { title: string; message: string; saved?: boolean };

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const REPEATS = [1, 2, 3, 4];
const repeatLabel = (w: number) => (w === 1 ? 'כל שבוע' : `כל ${w} שבועות`);
const TAKEN = 'השעה שנבחרה כבר נתפסת השבוע. אנא בחר/י שעה אחרת.';

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
const nextDate = (day: number) => {
  const today = israelNow().date;
  return addDays(today, (day - dow(today) + 7) % 7);
};
const shortDate = (d: string) => {
  const { y, m, d: day } = ymd(d);
  return `${day}.${m + 1}.${String(y).slice(2)}`;
};

function Alert({ notice, onClose }: { notice: Notice | null; onClose: () => void }) {
  if (!notice) return null;
  return (
    <div className="ios-alert-layer" dir="rtl" role="alertdialog" aria-modal="true" aria-label={notice.title}>
      <div className="ios-alert">
        <div className="ios-alert-copy">
          <strong>{notice.title}</strong>
          <p>{notice.message}</p>
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

export default function AdminRecurringWizard({
  slug,
  open,
  onClose,
  onSaved,
}: {
  slug: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<'choose' | 'existing' | 'new'>('choose');
  const [list, setList] = useState<Client[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [day, setDay] = useState<number | null>(null);
  const [repeat, setRepeat] = useState<number | null>(null);
  const [times, setTimes] = useState<string[] | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setSetup(null);
    setStep(1);
    setMode('choose');
    setList([]);
    setClient(null);
    setQuery('');
    setName('');
    setPhone('');
    setPicked([]);
    setDay(null);
    setRepeat(null);
    setTimes(null);
    setTime(null);
    setExpanded(false);
    api(slug, 'admin-settings-list', undefined, { part: 'recurring-setup' })
      .then((r: Setup) => {
        if (!live) return;
        setSetup(r);
        setList(r.clients || []);
      })
      .catch(() => live && setSetup({ clients: [], services: [], days: [], multi: false }));
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      live = false;
      root.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open || step !== 5 || day === null || !picked.length) return;
    let live = true;
    setTimes(null);
    api(slug, 'admin-settings-list', undefined, { part: 'recurring-times', day: String(day), services: picked.join(',') })
      .then((r) => {
        if (!live) return;
        setTimes(r.times || []);
        if (time) setExpanded(true);
      })
      .catch(() => {
        if (!live) return;
        setTimes([]);
        setNotice({ title: 'שגיאה', message: 'נכשל בטעינת שעות זמינות. נסו שוב.' });
      });
    return () => {
      live = false;
    };
  }, [open, step, day, repeat, picked.join(',')]);

  if (!open || typeof document === 'undefined') return null;

  const services = setup?.services || [];
  const multi = setup?.multi === true;
  const chosen = picked.map((id) => services.find((s) => s.id === id)).filter(Boolean) as Service[];
  const totalMinutes = chosen.reduce((n, s) => n + durationOf(s), 0);
  const prices = chosen.map((s) => s.price).filter((p) => p != null);
  const totalPrice = prices.length ? prices.reduce((n, p) => n + Number(p), 0) : null;
  const newValid = name.trim().length >= 2 && phone.replace(/\D/g, '').length >= 9;
  const first = day !== null ? nextDate(day) : null;

  function back() {
    if (busy) return;
    setExpanded(false);
    if (step > 1) return setStep(step - 1);
    if (mode !== 'choose') return setMode('choose');
    onClose();
  }
  function jump(to: number) {
    setExpanded(false);
    if (to === 1) setMode(client ? 'existing' : mode);
    if (to === 5) setTime(null);
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
      setNotice({ title: 'שגיאה', message: e.message || 'לא ניתן ליצור את הלקוח. נסו שוב.' });
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
  async function submit() {
    if (!client || !chosen.length || day === null || !time) {
      setNotice({ title: 'שגיאה', message: 'אנא מלא/י את כל השדות: לקוח, יום, שעה ושירות' });
      return;
    }
    setBusy(true);
    try {
      await api(slug, 'admin-settings-list', {
        part: 'recurring',
        op: 'save',
        client_id: client.id,
        service_ids: picked,
        day_of_week: day,
        time,
        repeat_interval: repeat || 1,
      });
      setExpanded(false);
      setNotice({ title: 'הצלחה', message: 'תור קבוע נוצר. השעה תישמר לאחר יצירה שבועית.', saved: true });
    } catch (e: any) {
      const taken = String(e.message || '') === TAKEN;
      setNotice({ title: taken ? 'השעה תפוסה' : 'שגיאה', message: e.message || 'יצירת תור קבוע נכשלה' });
    } finally {
      setBusy(false);
    }
  }

  const intro = (title: string, text: string, section = false) => (
    <div className={`aa-intro${section ? ' is-section' : ''}`}>
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
        {client
          ? intro('לקוח', 'בחר/י לקוח לתור')
          : intro('בחר לקוח קיים', 'בחר לקוח קיים מהרשימה לקביעת התור.')}
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
                  if (!setup) return <p className="aa-dropdown-empty">טוען...</p>;
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
        {intro('בחר/י שירות', multi ? 'ניתן לבחור שירות אחד או יותר' : 'הקישו לבחירת שירות אחד', true)}
        {!setup ? (
          <div className="aa-loading">
            <span className="aa-spinner" />
          </div>
        ) : services.length ? (
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
  else if (step === 3)
    body = (
      <>
        {intro('יום קבוע בשבוע', 'רק ימים שבהם מוגדרות שעות פעילות - בחרו את היום שבו התור יחזור', true)}
        {!setup ? (
          <div className="aa-loading">
            <span className="aa-spinner" />
            טוען את לוח השעות…
          </div>
        ) : !setup.days.length ? (
          <div className="ar-empty">
            <strong>אין ימים פעילים בלוח</strong>
            <small>הפעילו לפחות יום אחד תחת «שעות פעילות» בהגדרות, ואז חזרו לכאן.</small>
          </div>
        ) : (
          <div className="ar-days">
            {setup.days.map((d) => (
              <button
                type="button"
                key={d}
                className={d === day ? 'is-on' : ''}
                onClick={() => {
                  setDay(d);
                  setTime(null);
                  setStep(4);
                }}
              >
                {DAY_NAMES[d]}
              </button>
            ))}
          </div>
        )}
      </>
    );
  else if (step === 4)
    body = (
      <>
        {intro('תדירות חזרה', 'הגדירו כל כמה זמן זה יחזור')}
        <div className="ar-repeats">
          {REPEATS.map((w) => (
            <button
              type="button"
              key={w}
              className={w === repeat ? 'is-on' : ''}
              onClick={() => {
                setRepeat(w);
                setStep(5);
              }}
            >
              {repeatLabel(w)}
            </button>
          ))}
        </div>
      </>
    );
  else {
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
    first && step > 3 && [`${HE_LETTERS[dow(first)]}׳ ${ymd(first).d}.${ymd(first).m + 1}`, 3],
    time && step > 4 && [time, 5],
  ].filter(Boolean) as [string, number][];
  const ready = !!(time && first && step > 4);

  return createPortal(
    <div className={`aa step-${step}${client ? ' has-sheet' : ''}`} dir="rtl">
      <button type="button" className="aa-back" aria-label="חזרה" onClick={back}>
        <ArrowRight size={22} />
      </button>
      <div className={`aa-body${step === 5 ? ' is-top' : ''}`}>{body}</div>
      {client && (
        <>
          {expanded && <div className="aa-scrim" onClick={() => setExpanded(false)} />}
          <div className={`aa-sheet${expanded ? ' is-open' : ''}`}>
            <button type="button" className="aa-sheet-grip" aria-label="סיכום תור" onClick={() => setExpanded(!expanded)}>
              <span />
            </button>
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
                {first && step > 3 && (
                  <button type="button" className="aa-row is-service" onClick={() => jump(3)}>
                    <span className="aa-row-icon">
                      <Calendar size={18} />
                    </span>
                    <span className="aa-row-copy">
                      <small>תאריך</small>
                      <strong>יום {DAY_NAMES[day!]}</strong>
                      <span>
                        {shortDate(first)}
                        {repeat ? ` · ${repeatLabel(repeat)}` : ''}
                      </span>
                    </span>
                    <span className="aa-row-back">
                      <em>חזור לשלב</em>
                      <ChevronLeft size={15} />
                    </span>
                  </button>
                )}
                {ready && (
                  <button type="button" className="aa-row" onClick={() => jump(5)}>
                    <span className="aa-row-icon">
                      <Clock size={18} />
                    </span>
                    <span className="aa-row-copy">
                      <small>שעה</small>
                      <strong>
                        <bdi dir="ltr">{time}</bdi> · {daypart(time!)}
                      </strong>
                    </span>
                    <span className="aa-row-back">
                      <em>חזור לשלב</em>
                      <ChevronLeft size={15} />
                    </span>
                  </button>
                )}
                {ready && (
                  <button type="button" className="aa-confirm" disabled={busy} onClick={submit}>
                    {busy ? <span className="aa-spinner is-dark" /> : 'קבע תור'}
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
      <Alert
        notice={notice}
        onClose={() => {
          const saved = notice?.saved;
          setNotice(null);
          if (saved) onSaved();
        }}
      />
    </div>,
    document.body,
  );
}
