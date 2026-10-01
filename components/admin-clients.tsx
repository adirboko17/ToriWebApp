'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  Ban,
  Calendar,
  CalendarCheck,
  CalendarX,
  Check,
  ChevronDown,
  Clock,
  Delete,
  History,
  KeyRound,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  TriangleAlert,
  User,
  UsersRound,
  X,
} from 'lucide-react';
import BottomSheet from './bottom-sheet';
import { IosAlert } from './admin-calendar-sheets';
import { api } from '@/lib/client';
import { phoneLookupVariants } from '@/lib/phone';

type Client = {
  id: string;
  name: string;
  phone: string;
  image_url?: string | null;
  created_at?: string;
  block?: boolean;
  visits?: number;
  avgMonth?: number | null;
};
type Overview = { approval: boolean; approved: Client[]; month: Client[]; pending: Client[] };
type Mode = 'all' | 'unblocked' | 'blocked' | 'pending' | 'month';
type Action = {
  title: string;
  message: string;
  confirm: string;
  destructive?: boolean;
  single?: boolean;
  run?: () => Promise<void> | void;
};

const money = (n: number) => `₪${Math.round(n).toLocaleString('he-IL')}`;
const initial = (name: string) => (name || '?').trim().charAt(0).toUpperCase() || '?';
const initials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`;
  return Array.from(name.trim()).slice(0, 2).join('') || '?';
};
const slotDate = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day, 12)).toLocaleDateString('he-IL', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};
const whatsappUrl = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits.startsWith('0') ? `972${digits.slice(1)}` : digits}`;
};

function matches(c: Client, q: string) {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  if (c.name?.toLowerCase().includes(query)) return true;
  const digits = query.replace(/\D/g, '');
  if (!digits) return false;
  const phone = String(c.phone || '').replace(/\D/g, '');
  return phone.includes(digits) || phoneLookupVariants(c.phone || '').some((v) => v.replace(/\D/g, '').includes(digits));
}

function WhatsAppIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.46 9.46 0 0 1-4.82-1.32l-.35-.21-3.58.94.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.04c0-5.22 4.25-9.47 9.48-9.47 2.53 0 4.91.99 6.7 2.78a9.41 9.41 0 0 1 2.77 6.7c0 5.23-4.25 9.47-9.47 9.47zm8.06-17.53A11.33 11.33 0 0 0 12.05.63C5.77.63.66 5.74.66 12.02c0 2.01.52 3.97 1.52 5.7L.56 23.63l6.04-1.58a11.36 11.36 0 0 0 5.44 1.39h.01c6.28 0 11.39-5.11 11.39-11.39 0-3.04-1.19-5.9-3.33-8.05z" />
    </svg>
  );
}

function ActionModal({ action, busy, onClose }: { action: Action | null; busy: boolean; onClose: () => void }) {
  if (!action || typeof document === 'undefined') return null;
  const run = async () => {
    if (action.run) await action.run();
    else onClose();
  };
  return createPortal(
    <div className="cl-modal-layer" dir="rtl" role="alertdialog" aria-modal="true" aria-label={action.title} onClick={() => !busy && onClose()}>
      <div className="cl-modal" onClick={(e) => e.stopPropagation()}>
        {action.destructive && (
          <span className="cl-modal-danger">
            <TriangleAlert size={27} strokeWidth={2.2} />
          </span>
        )}
        <h2>{action.title}</h2>
        <p>{action.message}</p>
        <div className="cl-modal-buttons">
          {!action.single && (
            <button type="button" className="cl-modal-cancel" disabled={busy} onClick={onClose}>
              ביטול
            </button>
          )}
          <button
            type="button"
            className={`cl-modal-confirm${action.destructive ? ' is-danger' : ''}${action.single ? ' is-full' : ''}`}
            disabled={busy}
            onClick={() => void run()}
          >
            {busy ? <span className="cl-spinner" /> : action.confirm}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Section({
  title,
  Icon,
  count,
  children,
}: {
  title: string;
  Icon: any;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="cp-section">
      <button type="button" className="cp-section-tab" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon size={18} strokeWidth={2.1} />
        <strong>{title}</strong>
        <small>{count}</small>
        <ChevronDown size={18} strokeWidth={2.2} className={open ? 'is-open' : ''} />
      </button>
      {open && <div className="cp-section-body">{children}</div>}
    </div>
  );
}

const STATUS: Record<string, [string, string, string]> = {
  completed: ['הושלם', '#ECFDF5', '#047857'],
  pending: ['ממתין', '#FFFBEB', '#B45309'],
  cancelled: ['בוטל', '#FEF2F2', '#C2410C'],
  no_show: ['לא הגיע/ה', '#F3F4F6', '#4B5563'],
};

function leadLabel(minutes: number) {
  if (minutes < 0) return 'בוטל אחרי מועד התור';
  if (minutes < 60) return `בוטל ${minutes} דקות לפני התור`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `בוטל ${hours} שעות ו־${rest} דקות לפני התור` : `בוטל ${hours} שעות לפני התור`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `בוטל ${days} ימים ו־${restHours} שעות לפני התור` : `בוטל ${days} ימים לפני התור`;
}

function Empty({ text }: { text: string }) {
  return (
    <div className="cp-empty">
      <CalendarCheck size={18} strokeWidth={1.8} />
      <span>{text}</span>
    </div>
  );
}

function AppointmentRow({ a }: { a: any }) {
  const [label, bg, fg] = STATUS[a.status] || ['מאושר', 'color-mix(in srgb, var(--primary) 10%, white)', 'var(--on-light)'];
  return (
    <div className="cp-event">
      <span className="cp-event-accent" />
      <span className="cp-event-main">
        <strong>{a.service_name || '-'}</strong>
        <small>
          <Calendar size={13} strokeWidth={2} />
          {slotDate(a.slot_date)}
          <Clock size={13} strokeWidth={2} />
          {String(a.slot_time).slice(0, 5)}
        </small>
      </span>
      <span className="cp-pill" style={{ background: bg, color: fg }}>
        {label}
      </span>
    </div>
  );
}

function useClientActions(slug: string, onBlocked: (c: Client, block: boolean) => void) {
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const callClient = (c: Client) =>
    setAction({
      title: 'התקשר/י',
      message: `להתקשר ל־${c.phone}?`,
      confirm: 'שיחה',
      run: () => {
        setAction(null);
        window.location.href = `tel:${c.phone}`;
      },
    });
  const toggleBlock = (c: Client) => {
    const blocking = !c.block;
    setAction({
      title: blocking ? 'חסימת לקוח' : 'ביטול חסימה',
      message: blocking ? `לחסום את ${c.name}?` : `לבטל חסימה ל־${c.name}?`,
      confirm: blocking ? 'חסום' : 'בטל חסימה',
      destructive: blocking,
      run: async () => {
        setBusy(true);
        try {
          await api(slug, 'admin-client', { id: c.id, operation: blocking ? 'block' : 'unblock' });
          onBlocked(c, blocking);
          setAction({
            title: blocking ? 'הלקוח נחסם' : 'החסימה בוטלה',
            message: blocking ? `${c.name} נחסם/ה בהצלחה` : `${c.name} שוחרר/ה מחסימה בהצלחה`,
            confirm: 'אישור',
            single: true,
          });
        } catch {
          setAction({
            title: 'שגיאה',
            message: blocking ? 'נכשל בחסימת הלקוח' : 'נכשל בביטול חסימת הלקוח',
            confirm: 'אישור',
            single: true,
          });
        } finally {
          setBusy(false);
        }
      },
    });
  };
  const modal = <ActionModal action={action} busy={busy} onClose={() => setAction(null)} />;
  return { callClient, toggleBlock, setAction, modal };
}

function Notice({ notice, onClose }: { notice: { title: string; message: string } | null; onClose: () => void }) {
  if (!notice || typeof document === 'undefined') return null;
  return createPortal(
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
    </div>,
    document.body,
  );
}

const KEYPAD = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'space', 0, 'delete'] as const;

export function EmergencyPasscode({
  open,
  changing,
  draft = false,
  onClose,
  onSubmit,
}: {
  open: boolean;
  changing: boolean;
  draft?: boolean;
  onClose: () => void;
  onSubmit: (code: string) => Promise<unknown> | void;
}) {
  const [step, setStep] = useState<'choose' | 'confirm'>('choose');
  const [digits, setDigits] = useState('');
  const [first, setFirst] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [notice, setNotice] = useState<{ title: string; message: string; done?: boolean } | null>(null);

  useEffect(() => {
    if (open) return;
    setStep('choose');
    setDigits('');
    setFirst('');
    setBusy(false);
  }, [open]);

  const press = useCallback(
    (key: (typeof KEYPAD)[number]) => {
      if (busy || notice) return;
      if (key === 'delete') setDigits((d) => d.slice(0, -1));
      else if (key !== 'space') setDigits((d) => (d.length >= 6 ? d : d + key));
    },
    [busy, notice],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(Number(e.key) as any);
      else if (e.key === 'Backspace') press('delete');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, press]);

  useEffect(() => {
    if (digits.length !== 6 || busy) return;
    if (step === 'choose') {
      setFirst(digits);
      setDigits('');
      setStep('confirm');
      return;
    }
    if (digits !== first) {
      setShake((s) => s + 1);
      setDigits('');
      setNotice({ title: 'שגיאה', message: 'סיסמאות החירום אינן תואמות' });
      return;
    }
    if (draft) {
      onSubmit(digits);
      onClose();
      return;
    }
    setBusy(true);
    Promise.resolve(onSubmit(digits))
      .then(() => setNotice({ title: 'נשמר', message: 'סיסמת החירום עודכנה בהצלחה.', done: true }))
      .catch(() => {
        setDigits('');
        setNotice({ title: 'שגיאה', message: 'שמירת סיסמת החירום נכשלה' });
      })
      .finally(() => setBusy(false));
  }, [digits, step, first, busy, draft, onSubmit, onClose]);

  if (!open || typeof document === 'undefined') return null;
  const title =
    step === 'choose' ? (changing ? 'בחר/י סיסמת חירום חדשה' : 'בחר/י סיסמת חירום') : 'אמת/י את סיסמת החירום';
  const hint =
    step === 'choose' ? 'הזינו 6 ספרות - ישמשו כגיבוי כשקוד SMS לא מגיע.' : 'הזינו שוב את אותן 6 ספרות לאימות.';
  return createPortal(
    <div className="aa ep" dir="rtl">
      <div className="ep-body">
        <h1>{title}</h1>
        <p>{hint}</p>
        <div className={`ep-dots${busy ? ' is-busy' : ''}`} key={shake} data-shake={shake > 0 || undefined}>
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i}>{digits[i] !== undefined && <b>{digits[i]}</b>}</span>
          ))}
        </div>
        <div className="ep-status">{busy && <span className="aa-spinner" />}</div>
        <div className="ep-keypad">
          {KEYPAD.map((key, i) =>
            key === 'space' ? (
              <span key={i} />
            ) : (
              <button type="button" key={i} disabled={busy} aria-label={key === 'delete' ? 'מחק' : String(key)} onClick={() => press(key)}>
                {key === 'delete' ? <Delete size={30} strokeWidth={1.8} /> : key}
              </button>
            ),
          )}
        </div>
        <button
          type="button"
          className="ep-footer"
          disabled={busy}
          onClick={() => {
            if (step === 'confirm') {
              setStep('choose');
              setDigits('');
              setFirst('');
            } else onClose();
          }}
        >
          {step === 'confirm' ? 'חזרה לבחירת קוד' : 'ביטול'}
        </button>
      </div>
      <Notice
        notice={notice}
        onClose={() => {
          const done = notice?.done;
          setNotice(null);
          if (done) onClose();
        }}
      />
    </div>,
    document.body,
  );
}

function EmergencyCard({ slug, clientId, code, onCode }: { slug: string; clientId: string; code: string | null; onCode: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="cp-emergency">
      <div className="cp-emergency-head">
        <span>
          <KeyRound size={20} strokeWidth={2.2} />
        </span>
        <div>
          <strong>קוד חירום</strong>
          <small>6 ספרות - גיבוי כש-SMS לא מגיע</small>
        </div>
      </div>
      {code && (
        <div className="cp-emergency-code">
          <small>הקוד של הלקוח</small>
          <b dir="ltr">{code.split('').join('  ')}</b>
        </div>
      )}
      <button type="button" className="cp-emergency-btn" onClick={() => setOpen(true)}>
        {code ? 'שנה קוד חירום' : 'הגדר קוד חירום'}
      </button>
      <EmergencyPasscode
        open={open}
        changing={Boolean(code)}
        onClose={() => setOpen(false)}
        onSubmit={(next) =>
          api(slug, 'admin-client', { id: clientId, operation: 'emergency', code: next }).then(() => onCode(next))
        }
      />
    </div>
  );
}

export type ClientTarget = Partial<Client> & { alt?: string | null };

export function ClientProfile({
  slug,
  target,
  onClose,
  onChanged,
}: {
  slug: string;
  target: ClientTarget | null;
  onClose: () => void;
  onChanged?: (c: Client) => void;
}) {
  const [profile, setProfile] = useState<any>(null);
  const [shown, setShown] = useState<ClientTarget | null>(target);
  useEffect(() => {
    if (target) setShown(target);
  }, [target]);
  const key = target ? `${target.id || ''}|${target.alt || ''}|${target.phone || ''}` : '';
  useEffect(() => {
    if (!target) return;
    let live = true;
    setProfile(null);
    const query: Record<string, string> = {};
    if (target.id) query.id = target.id;
    if (target.alt) query.alt = target.alt;
    if (target.phone) query.phone = target.phone;
    api(slug, 'admin-client-profile', undefined, query)
      .then((data) => live && setProfile(data))
      .catch((e) => live && setProfile({ error: e.message || 'לא ניתן לטעון את פרטי הלקוח כרגע.' }));
    return () => {
      live = false;
    };
  }, [slug, key]);

  const setClient = (change: Partial<Client>) =>
    setProfile((pr: any) => (pr?.client ? { ...pr, client: { ...pr.client, ...change } } : pr));
  const { callClient, toggleBlock, modal } = useClientActions(slug, (c, block) => {
    setClient({ block });
    onChanged?.({ ...c, block });
  });

  const c: Client | null = profile?.client
    ? { ...(target || shown), ...profile.client }
    : ((target || shown) as Client | null);
  const avgMonth = profile?.avgMonth ?? c?.avgMonth ?? null;
  const since = c?.created_at
    ? new Date(c.created_at).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })
    : null;
  const ready = Boolean(profile?.client);
  return (
    <>
    {modal}
    <BottomSheet open={Boolean(target)} onClose={onClose} title="כרטיס לקוח" className="cp-sheet">
      {c && (
        <div className="sheet-scroll cp-scroll">
          <div className="cp-hero">
            <span className="cp-avatar">
              {c.image_url ? <img src={c.image_url} alt="" /> : initials(c.name || 'לקוח')}
            </span>
            <div className="cp-hero-text">
              <div className="cp-name">
                <strong>{c.name || 'לקוח'}</strong>
                {c.block && <span className="cl-blocked">חסום</span>}
              </div>
              {c.phone && <span dir="ltr">{c.phone}</span>}
              {since && <small>לקוח/ה מאז {since}</small>}
            </div>
            <div className="cp-actions">
              <a
                className={`cp-action is-whatsapp${c.phone ? '' : ' is-disabled'}`}
                href={c.phone ? whatsappUrl(c.phone) : undefined}
                target="_blank"
                rel="noreferrer"
                aria-label="וואטסאפ"
              >
                <WhatsAppIcon size={22} />
              </a>
              <button type="button" className="cp-action is-call" disabled={!c.phone} aria-label="התקשר/י" onClick={() => callClient(c)}>
                <Phone size={18} strokeWidth={2.3} />
              </button>
              <button
                type="button"
                className={`cp-action ${c.block ? 'is-unblock' : 'is-block'}`}
                aria-label={c.block ? 'ביטול חסימה' : 'חסימת לקוח'}
                disabled={!ready}
                onClick={() => toggleBlock(c)}
              >
                {c.block ? <ShieldCheck size={18} strokeWidth={2.3} /> : <Ban size={18} strokeWidth={2.3} />}
              </button>
            </div>
          </div>
          {!profile ? (
            <div className="cl-loading">
              <span className="cl-spinner is-large" />
            </div>
          ) : profile.error ? (
            <Empty text={profile.error} />
          ) : (
            <>
              <div className="cp-stats">
                <div>
                  <strong>{profile.visits}</strong>
                  <small>תורים</small>
                </div>
                <div>
                  <strong className={profile.cancellations.length ? 'is-warn' : ''}>{profile.cancellations.length}</strong>
                  <small>ביטולים</small>
                </div>
                <div>
                  <strong>{avgMonth != null ? money(avgMonth) : '-'}</strong>
                  <small>ממוצע לחודש</small>
                </div>
              </div>
              <EmergencyCard
                slug={slug}
                clientId={profile.client.id}
                code={profile.emergency}
                onCode={(code) => setProfile((pr: any) => ({ ...pr, emergency: code }))}
              />
              <Section title="תורים קרובים" Icon={CalendarCheck} count={profile.upcoming.length}>
                {profile.upcoming.length ? (
                  profile.upcoming.map((a: any) => <AppointmentRow a={a} key={a.id} />)
                ) : (
                  <Empty text="אין תורים קרובים." />
                )}
              </Section>
              <Section title="ביטולים" Icon={CalendarX} count={profile.cancellations.length}>
                {profile.cancellations.length ? (
                  profile.cancellations.map((a: any) => (
                    <div className="cp-event is-cancel" key={a.id}>
                      <span className="cp-event-main">
                        <strong>{a.service_name || '-'}</strong>
                        <em>{leadLabel(a.minutes_before)}</em>
                        <small>
                          {slotDate(a.slot_date)} · {String(a.slot_time).slice(0, 5)}
                        </small>
                      </span>
                      <span className="cp-pill" style={{ background: '#FEF2F2', color: '#C2410C' }}>
                        בוטל
                      </span>
                    </div>
                  ))
                ) : (
                  <Empty text="הלקוח/ה לא ביטל/ה תורים." />
                )}
              </Section>
              <Section title="היסטוריית תורים" Icon={History} count={profile.history.length}>
                {profile.history.length ? (
                  profile.history.map((a: any) => <AppointmentRow a={a} key={a.id} />)
                ) : (
                  <Empty text="אין עדיין תורים קודמים." />
                )}
              </Section>
            </>
          )}
        </div>
      )}
    </BottomSheet>
    </>
  );
}

function AddClient({ slug, open, onClose, onAdded }: { slug: string; open: boolean; onClose: () => void; onAdded: (c: Client) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    setName('');
    setPhone('');
    setError('');
  }, [open]);
  if (!open || typeof document === 'undefined') return null;
  const valid = name.trim().length >= 2 && phone.replace(/\D/g, '').length >= 9;
  async function submit() {
    setBusy(true);
    try {
      const created = await api(slug, 'admin-new-client', { name: name.trim(), phone: phone.trim() });
      onAdded(created);
    } catch (e: any) {
      setError(e.message || 'לא ניתן להוסיף את הלקוח');
    } finally {
      setBusy(false);
    }
  }
  return createPortal(
    <div className="aa cl-add" dir="rtl">
      <button type="button" className="aa-back" aria-label="חזרה" onClick={onClose}>
        <ArrowRight size={22} />
      </button>
      <div className="aa-body">
        <div className="aa-intro">
          <h1>הוספת לקוח חדש</h1>
          <p>הזינו שם ומספר טלפון. הלקוח יוכל להתחבר אחר כך עם המספר הזה.</p>
        </div>
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
              placeholder="מספר טלפון נייד"
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <button type="button" className="cl-add-submit" disabled={!valid || busy} onClick={() => void submit()}>
            {busy ? <span className="aa-spinner" /> : 'הוסף לקוח'}
          </button>
        </div>
      </div>
      <ActionModal
        action={error ? { title: 'שגיאה', message: error, confirm: 'אישור', single: true } : null}
        busy={false}
        onClose={() => setError('')}
      />
    </div>,
    document.body,
  );
}

export default function AdminClients({
  slug,
  open,
  initialMode = 'all',
  onClose,
  onChanged,
}: {
  slug: string;
  open: boolean;
  initialMode?: Mode;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [data, setData] = useState<Overview | null>(null);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Client | null>(null);
  const [adding, setAdding] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [declining, setDeclining] = useState<Client | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api(slug, 'admin-clients'));
    } catch {
      setData((d) => d || { approval: false, approved: [], month: [], pending: [] });
    }
  }, [slug]);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setQuery('');
    void load();
  }, [open, initialMode, load]);

  const approval = Boolean(data?.approval);
  const list = useMemo(() => {
    if (!data) return [];
    const base =
      mode === 'pending'
        ? data.pending
        : mode === 'month'
          ? data.month
          : data.approved.filter((c) => (mode === 'blocked' ? c.block : mode === 'unblocked' ? !c.block : true));
    return base.filter((c) => matches(c, query));
  }, [data, mode, query]);

  const title = mode === 'month' ? 'לקוחות חדשים החודש' : mode === 'pending' ? 'אישור לקוחות' : 'רשימת לקוחות';
  const [emptyTitle, emptyHint] =
    mode === 'pending'
      ? ['אין הרשמות שממתינות לאישור', 'כשלקוח חדש יירשם, הוא יופיע כאן לאישור.']
      : mode === 'month'
        ? ['לא נרשמו לקוחות חדשים החודש', 'לקוחות שיירשמו החודש יופיעו כאן.']
        : ['אין כאן לקוחות כרגע', 'נסו לשנות את החיפוש או לעבור לסינון אחר בשורה למעלה.'];

  function patch(id: string, change: Partial<Client>) {
    setData((d) =>
      d && {
        ...d,
        approved: d.approved.map((c) => (c.id === id ? { ...c, ...change } : c)),
        month: d.month.map((c) => (c.id === id ? { ...c, ...change } : c)),
      },
    );
  }

  const { callClient, toggleBlock, setAction, modal } = useClientActions(slug, (c, block) => patch(c.id, { block }));

  async function approve(c: Client) {
    setRowBusy(c.id);
    try {
      await api(slug, 'admin-client', { id: c.id, operation: 'approve' });
      await load();
      onChanged?.();
    } catch (e: any) {
      setAction({ title: 'שגיאה', message: e.message || 'הפעולה נכשלה', confirm: 'אישור', single: true });
    } finally {
      setRowBusy(null);
    }
  }

  async function decline() {
    if (!declining) return;
    const c = declining;
    setRowBusy(c.id);
    try {
      await api(slug, 'admin-client', { id: c.id, operation: 'decline' });
      setDeclining(null);
      await load();
      onChanged?.();
    } catch (e: any) {
      setDeclining(null);
      setAction({ title: 'שגיאה', message: e.message || 'הפעולה נכשלה', confirm: 'אישור', single: true });
    } finally {
      setRowBusy(null);
    }
  }

  const chip = (key: Mode, label: string, badge?: number) => (
    <button
      type="button"
      key={key}
      className={`cl-chip${mode === key ? ' active' : ''}`}
      aria-pressed={mode === key}
      onClick={() => setMode(key)}
    >
      {label}
      {badge ? <span className="cl-chip-badge">{badge > 99 ? '99+' : badge}</span> : null}
    </button>
  );
  const monthCount = data?.month.length || 0;

  return (
    <>
      <BottomSheet open={open} onClose={onClose} className="cl-sheet">
        <div className="cl-head">
          <h2>{title}</h2>
          <span className="cl-count">{list.length.toLocaleString('he-IL')}</span>
        </div>
        <div className="cl-search-row">
          <label className="cl-search">
            <Search size={18} />
            <input
              value={query}
              placeholder="חיפוש לפי שם או טלפון..."
              enterKeyHint="search"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button type="button" className="cl-add-btn" aria-label="הוספת לקוח חדש" onClick={() => setAdding(true)}>
            <Plus size={20} strokeWidth={2.6} />
          </button>
        </div>
        <div className="cl-chips">
          {chip('all', 'הכול')}
          {chip('unblocked', 'לא חסומים')}
          {chip('blocked', 'חסומים')}
          {approval && chip('pending', 'אישור לקוחות', data?.pending.length)}
          {chip('month', monthCount ? `נוספו החודש (${monthCount > 99 ? '99+' : monthCount})` : 'נוספו החודש')}
        </div>
        <div className="sheet-scroll cl-list">
          {!data ? (
            <div className="cl-loading">
              <span className="cl-spinner is-large" />
              <p>טוען לקוחות...</p>
            </div>
          ) : !list.length ? (
            <div className="cl-empty">
              <span>
                <UsersRound size={28} />
              </span>
              <strong>{emptyTitle}</strong>
              <p>{emptyHint}</p>
            </div>
          ) : mode === 'pending' ? (
            list.map((c) => (
              <div className="cl-card is-pending" key={c.id}>
                <span className="cl-avatar">{c.image_url ? <img src={c.image_url} alt="" /> : initial(c.name)}</span>
                <span className="cl-text">
                  <strong>{c.name || 'לקוח'}</strong>
                  {c.phone && <small dir="ltr">{c.phone}</small>}
                </span>
                <span className="cl-actions">
                  <button
                    type="button"
                    className="cl-icon is-decline"
                    aria-label="דחייה"
                    disabled={rowBusy !== null}
                    onClick={() => setDeclining(c)}
                  >
                    <X size={16} strokeWidth={2.4} />
                  </button>
                  <button
                    type="button"
                    className="cl-icon is-approve"
                    aria-label="אישור"
                    disabled={rowBusy !== null}
                    onClick={() => void approve(c)}
                  >
                    {rowBusy === c.id ? <span className="cl-spinner" /> : <Check size={16} strokeWidth={2.6} />}
                  </button>
                </span>
              </div>
            ))
          ) : (
            list.map((c) => (
              <div
                className={`cl-card${c.block ? ' is-blocked' : ''}`}
                role="button"
                tabIndex={0}
                key={c.id}
                onClick={() => setSelected(c)}
                onKeyDown={(e) => e.key === 'Enter' && setSelected(c)}
              >
                <span className="cl-avatar">{initial(c.name)}</span>
                <span className="cl-text">
                  <span className="cl-name">
                    <strong>{c.name || 'לקוח'}</strong>
                    {c.block && <span className="cl-blocked">חסום</span>}
                  </span>
                  {c.phone && <small dir="ltr">{c.phone}</small>}
                  <em>
                    {c.visits || 0} תורים · {c.avgMonth != null ? money(c.avgMonth) : '-'} ממוצע לחודש
                  </em>
                </span>
                <span className="cl-actions" onClick={(e) => e.stopPropagation()}>
                  <a
                    className={`cl-icon is-whatsapp${c.phone ? '' : ' is-disabled'}`}
                    href={c.phone ? whatsappUrl(c.phone) : undefined}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="וואטסאפ"
                  >
                    <WhatsAppIcon size={16} />
                  </a>
                  <button type="button" className="cl-icon is-call" disabled={!c.phone} aria-label="התקשר/י" onClick={() => callClient(c)}>
                    <Phone size={15} strokeWidth={2.25} />
                  </button>
                  <button
                    type="button"
                    className={`cl-icon ${c.block ? 'is-unblock' : 'is-block'}`}
                    aria-label={c.block ? 'ביטול חסימה' : 'חסימת לקוח'}
                    onClick={() => toggleBlock(c)}
                  >
                    {c.block ? <ShieldCheck size={15} strokeWidth={2.25} /> : <Ban size={15} strokeWidth={2.25} />}
                  </button>
                </span>
              </div>
            ))
          )}
        </div>
      </BottomSheet>
      <ClientProfile slug={slug} target={selected} onClose={() => setSelected(null)} onChanged={(c) => patch(c.id, { block: c.block })} />
      <AddClient
        slug={slug}
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={(c) => {
          setAdding(false);
          void load();
          onChanged?.();
          setAction({
            title: 'הלקוח נוסף',
            message: `${c.name} נוסף/ה למערכת ויכול/ה להתחבר עם מספר הטלפון.`,
            confirm: 'אישור',
            single: true,
          });
        }}
      />
      {modal}
      <IosAlert
        open={Boolean(declining)}
        title="דחיית הרשמה"
        message={`להסיר את ${declining?.name || 'הלקוח'}? יצטרך להירשם מחדש.`}
        confirm="הסר"
        busy={rowBusy !== null}
        onCancel={() => setDeclining(null)}
        onConfirm={() => void decline()}
      />
    </>
  );
}
