'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Ban,
  Bell,
  Calendar,
  CalendarDays,
  ChevronLeft,
  Clock,
  Hourglass,
  MessageCircle,
  Phone,
  Search,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import BottomSheet from './bottom-sheet';
import TimeField, { timeOptions } from './time-wheel';
import { api } from '@/lib/client';
import { durationOf, slotMinutes, visitsOf, type Visit } from '@/lib/visits';
import {
  HE_LETTERS,
  REMINDER_PALETTE,
  clock,
  dow,
  hebrewDayMonth,
  hm,
  longDate,
  numericDate,
  reminderColor,
} from '@/lib/calendar-format';

const fiveMinuteTimes = timeOptions(5);

export function IosAlert({
  open,
  title,
  message,
  confirm,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirm: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="ios-alert-layer" dir="rtl" role="alertdialog" aria-modal="true" aria-label={title}>
      <div className="ios-alert">
        <div className="ios-alert-copy">
          <strong>{title}</strong>
          <p>{message}</p>
        </div>
        <div className="ios-alert-buttons">
          <button type="button" onClick={onCancel} disabled={busy}>
            ביטול
          </button>
          <button type="button" className="is-destructive" onClick={onConfirm} disabled={busy}>
            {busy ? '…' : confirm}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const initials = (name: string) =>
  String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('') || '?';

function whatsappHref(phone: string) {
  const digits = String(phone || '').replace(/\D/g, '');
  return `https://wa.me/${digits.startsWith('0') ? `972${digits.slice(1)}` : digits}`;
}

export function QuickActionsSheet({
  visit,
  onClose,
  onDelete,
  onOpenClient,
}: {
  visit: Visit | null;
  onClose: () => void;
  onDelete: (row: any) => void;
  onOpenClient: (visit: Visit) => void;
}) {
  const [shown, setShown] = useState<Visit | null>(visit);
  useEffect(() => {
    if (visit) setShown(visit);
  }, [visit]);
  const v = visit || shown;
  const start = v ? slotMinutes(v.slot_time) : 0;
  const duration = v ? durationOf(v) : 0;
  const multi = (v?.rows.length || 0) > 1;
  const phone = String(v?.client_phone || '').trim();
  return (
    <BottomSheet open={!!visit} onClose={onClose} size="auto" className="cal-sheet">
      {v && (
        <div className="sheet-scroll qa">
          <section className="qa-hero">
            <div className="qa-client">
              <button type="button" className="qa-avatar" aria-label="פתח את כרטיס הלקוח" onClick={() => onOpenClient(v)}>
                <i>{initials(v.client_name || '')}</i>
              </button>
              <div>
                <strong>{v.client_name || 'לקוח'}</strong>
                <p>{v.service_name || ''}</p>
                {multi && <small>{v.rows.length} שירותים</small>}
              </div>
            </div>
            <i className="qa-separator" />
            <div className="qa-meta">
              {[
                [Calendar, `${HE_LETTERS[dow(v.slot_date)]}׳ · ${numericDate(v.slot_date).slice(0, 5)}`, 'תאריך'],
                [Clock, `${clock(start)} – ${clock(start + duration)}`, 'שעה'],
                [Hourglass, `${duration} דק׳`, 'משך'],
              ].map(([Icon, value, caption]: any) => (
                <div key={caption}>
                  <Icon size={16} />
                  <b dir={caption === 'שעה' ? 'ltr' : undefined}>{value}</b>
                  <span>{caption}</span>
                </div>
              ))}
            </div>
          </section>
          {multi && (
            <div className="qa-services">
              <h3>שירותים בתור</h3>
              {v.rows.map((row: any) => (
                <div key={row.id}>
                  <span>
                    <strong>{String(row.service_name || '').trim() || '—'}</strong>
                    <small>
                      {hm(row.slot_time)} · {durationOf(row)} דק׳
                    </small>
                  </span>
                  <button type="button" aria-label="ביטול שירות זה" onClick={() => onDelete(row)}>
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="qa-buttons">
            {phone ? (
              <>
                {!multi && (
                  <button type="button" className="qa-delete" aria-label="מחיקת תור" onClick={() => onDelete(v.rows[0])}>
                    <Trash2 size={20} />
                  </button>
                )}
                <a className="qa-whatsapp" href={whatsappHref(phone)} target="_blank" rel="noreferrer" aria-label="WhatsApp">
                  <MessageCircle size={22} />
                </a>
                <a className="qa-call" href={`tel:${phone}`}>
                  <Phone size={18} />
                  חייג ללקוח
                </a>
              </>
            ) : (
              !multi && (
                <button type="button" className="qa-delete-wide" onClick={() => onDelete(v.rows[0])}>
                  <Trash2 size={18} />
                  מחיקת תור
                </button>
              )
            )}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

export function AddSheet({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (kind: 'appointment' | 'reminder' | 'override' | 'constraint') => void;
}) {
  const options = [
    ['appointment', Calendar, 'תור', 'קביעת תור ללקוח לפי שירות ושעה', 'is-primary'],
    ['reminder', StickyNote, 'תזכורת ביומן', 'תזכורת לעצמך - לא חוסמת משבצות', 'is-note'],
    ['override', Clock, 'חריגה', 'שינוי חלון זמן של תאריך מסוים', 'is-hours'],
    ['constraint', Ban, 'אילוצים', 'חסימת זמן בלוח - לקוחות לא יוכלו לקבוע תור', 'is-block'],
  ] as const;
  return (
    <BottomSheet open={open} onClose={onClose} size="auto" className="cal-sheet">
      <div className="sheet-scroll add-sheet">
        <h2>מה תרצה להוסיף?</h2>
        <p>בחרו תור, תזכורת, חריגת שעות או אילוץ</p>
        {options.map(([kind, Icon, title, hint, tone]) => (
          <button type="button" key={kind} className="add-option" onClick={() => onPick(kind)}>
            <span className={`add-icon ${tone}`}>
              <Icon size={24} />
            </span>
            <span className="add-copy">
              <strong>{title}</strong>
              <small>{hint}</small>
            </span>
            <ChevronLeft size={18} className="add-caret" />
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

const fullDay = (c: any) => slotMinutes(c.start_time) <= 0 && slotMinutes(c.end_time) >= 23 * 60 + 45;
const chipDate = (date: string) => `${HE_LETTERS[dow(date)]}׳ · ${numericDate(date)}`;

export function ItemSummarySheet({
  item,
  kind,
  onClose,
  onEdit,
  onDelete,
}: {
  item: any;
  kind: 'constraint' | 'reminder';
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [shown, setShown] = useState<any>(item);
  useEffect(() => {
    if (item) setShown(item);
  }, [item]);
  const it = item || shown;
  const palette = reminderColor(it?.color_key);
  const isConstraint = kind === 'constraint';
  const date = it ? (isConstraint ? it.date : it.event_date) : '';
  const start = it ? slotMinutes(it.start_time) : 0;
  const end = it ? (isConstraint ? slotMinutes(it.end_time) : start + (Number(it.duration_minutes) || 30)) : 0;
  return (
    <BottomSheet open={!!item} onClose={onClose} size="auto" className="cal-sheet">
      {it && (
        <div className="sheet-scroll qa">
          <section
            className={`qa-hero item-hero${isConstraint ? ' is-block' : ''}`}
            style={isConstraint ? undefined : ({ '--note-bar': palette.bar, '--note-bg': palette.bg } as React.CSSProperties)}
          >
            <div className="qa-client">
              <span className="item-icon">{isConstraint ? <Ban size={26} /> : <StickyNote size={26} />}</span>
              <div>
                <strong>{isConstraint ? it.reason?.trim() || 'זמן חסום' : it.title}</strong>
                <p>
                  {isConstraint
                    ? 'חוסם משבצות - לקוחות לא יוכלו להזמין בזמן הזה'
                    : 'תזכורת לעצמך - לא חוסמת משבצות'}
                </p>
              </div>
            </div>
            {!isConstraint && it.notes && <p className="item-notes">{it.notes}</p>}
            <div className="item-chips">
              <span>
                <CalendarDays size={15} />
                {chipDate(date)}
              </span>
              <span dir={isConstraint && fullDay(it) ? undefined : 'ltr'}>
                {isConstraint ? <Ban size={15} /> : <Bell size={15} />}
                {isConstraint && fullDay(it) ? 'חסימה כל היום' : `${clock(start)} – ${clock(end)}`}
              </span>
            </div>
          </section>
          <div className="qa-buttons">
            <button type="button" className="qa-delete" aria-label="מחיקה" onClick={onDelete}>
              <Trash2 size={20} />
            </button>
            <button type="button" className="qa-call" onClick={onEdit}>
              עריכה
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

export function IosSwitch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`ios-switch${checked ? ' is-on' : ''}`}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
    >
      <i />
    </button>
  );
}

export function ConstraintEditorSheet({
  slug,
  userId,
  draft,
  onClose,
  onSaved,
}: {
  slug: string;
  userId: string;
  draft: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!draft) return;
    const whole = draft.id ? fullDay(draft) : false;
    setForm({
      id: draft.id,
      date: draft.date,
      start: whole ? '09:00' : hm(draft.start_time) || '12:00',
      end: whole ? '10:00' : hm(draft.end_time) || '13:00',
      whole,
      reason: draft.reason || '',
    });
    setError('');
  }, [draft]);
  const set = (key: string, value: any) => setForm((f: any) => ({ ...f, [key]: value }));
  async function save() {
    if (!form.whole && form.start >= form.end) return setError('שעת הסיום חייבת להיות אחרי שעת ההתחלה');
    setBusy(true);
    setError('');
    try {
      await api(slug, 'admin-hours', {
        kind: 'constraint',
        worker: userId,
        id: form.id,
        date: form.date,
        start: form.whole ? '00:00' : form.start,
        end: form.whole ? '23:59' : form.end,
        reason: form.reason.trim(),
      });
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <BottomSheet open={!!draft} onClose={onClose} title={form.id ? 'עריכת אילוץ' : 'אילוץ חדש'} size="auto" className="cal-sheet">
      <div className="sheet-scroll editor">
        <div className="editor-card">
          <label className="editor-row">
            <span>תאריך</span>
            <input type="date" value={form.date || ''} onChange={(e) => set('date', e.target.value)} />
          </label>
          <div className="editor-row">
            <span>כל היום</span>
            <IosSwitch checked={!!form.whole} onChange={(v) => set('whole', v)} label="כל היום" />
          </div>
          {!form.whole && (
            <div className="editor-times">
              <div>
                <span>שעת התחלה</span>
                <TimeField label="שעת התחלה" value={form.start || '12:00'} onChange={(v) => set('start', v)} options={fiveMinuteTimes} />
              </div>
              <ChevronLeft size={18} className="editor-arrow" />
              <div>
                <span>שעת סיום</span>
                <TimeField label="שעת סיום" value={form.end || '13:00'} onChange={(v) => set('end', v)} options={fiveMinuteTimes} />
              </div>
            </div>
          )}
        </div>
        <label className="editor-field">
          <span>סיבה (לא חובה)</span>
          <input value={form.reason || ''} maxLength={200} onChange={(e) => set('reason', e.target.value)} placeholder="למשל: חופשה, אירוע משפחתי" />
        </label>
        {error && <p className="editor-error" role="alert">{error}</p>}
        <button type="button" className="editor-save" disabled={busy || !form.date} onClick={save}>
          {busy ? 'שומרים…' : 'שמירה'}
        </button>
      </div>
    </BottomSheet>
  );
}

export function ReminderEditorSheet({
  slug,
  draft,
  onClose,
  onSaved,
}: {
  slug: string;
  draft: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!draft) return;
    setForm({
      id: draft.id,
      title: draft.title || '',
      notes: draft.notes || '',
      date: draft.event_date,
      time: hm(draft.start_time) || '09:00',
      duration: Number(draft.duration_minutes) || 30,
      color: draft.color_key || 'blue',
    });
    setError('');
  }, [draft]);
  const set = (key: string, value: any) => setForm((f: any) => ({ ...f, [key]: value }));
  async function save() {
    if (!form.title.trim()) return setError('יש להזין כותרת לתזכורת');
    setBusy(true);
    setError('');
    try {
      await api(slug, 'admin-reminder', { ...form, title: form.title.trim() });
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <BottomSheet open={!!draft} onClose={onClose} title={form.id ? 'עריכת תזכורת' : 'תזכורת חדשה'} size="auto" className="cal-sheet">
      <div className="sheet-scroll editor">
        <label className="editor-field">
          <span>כותרת</span>
          <input value={form.title || ''} maxLength={80} onChange={(e) => set('title', e.target.value)} placeholder="למשל: להזמין חומרים" />
        </label>
        <label className="editor-field">
          <span>הערות (לא חובה)</span>
          <textarea value={form.notes || ''} maxLength={500} rows={3} onChange={(e) => set('notes', e.target.value)} />
        </label>
        <div className="editor-card">
          <label className="editor-row">
            <span>תאריך</span>
            <input type="date" value={form.date || ''} onChange={(e) => set('date', e.target.value)} />
          </label>
          <div className="editor-row">
            <span>שעה</span>
            <TimeField label="שעה" value={form.time || '09:00'} onChange={(v) => set('time', v)} options={fiveMinuteTimes} compact />
          </div>
        </div>
        <div className="editor-group">
          <span>משך</span>
          <div className="editor-chips">
            {[15, 30, 45, 60, 90, 120].map((n) => (
              <button type="button" key={n} className={form.duration === n ? 'is-on' : ''} onClick={() => set('duration', n)}>
                {n < 60 ? `${n} דק׳` : n === 60 ? 'שעה' : n === 90 ? 'שעה וחצי' : 'שעתיים'}
              </button>
            ))}
          </div>
        </div>
        <div className="editor-group">
          <span>צבע</span>
          <div className="editor-colors">
            {Object.entries(REMINDER_PALETTE).map(([key, c]) => (
              <button
                type="button"
                key={key}
                aria-label={key}
                aria-pressed={form.color === key}
                className={form.color === key ? 'is-on' : ''}
                style={{ '--dot': c.bar } as React.CSSProperties}
                onClick={() => set('color', key)}
              />
            ))}
          </div>
        </div>
        {error && <p className="editor-error" role="alert">{error}</p>}
        <button type="button" className="editor-save" disabled={busy || !form.date} onClick={save}>
          {busy ? 'שומרים…' : 'שמירה'}
        </button>
      </div>
    </BottomSheet>
  );
}

export function AgendaRow({ visit, onPress, withDate }: { visit: Visit; onPress: () => void; withDate?: boolean }) {
  const start = slotMinutes(visit.slot_time);
  return (
    <button type="button" className="agenda-row" onClick={onPress}>
      <i />
      <span className="agenda-body">
        <strong>{visit.client_name || 'לקוח'}</strong>
        {(visit.service_name || withDate) && (
          <small>{withDate ? `${longDate(visit.slot_date)}${visit.service_name ? ` · ${visit.service_name}` : ''}` : visit.service_name}</small>
        )}
      </span>
      <span className="agenda-times">
        <span>{clock(start)}</span>
        <span>{clock(start + durationOf(visit))}</span>
      </span>
    </button>
  );
}

export function SearchSheet({
  open,
  slug,
  onClose,
  onPick,
}: {
  open: boolean;
  slug: string;
  onClose: () => void;
  onPick: (visit: Visit) => void;
}) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    if (!open) {
      setQ('');
      setRows(null);
    }
  }, [open]);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return setRows(null);
    let live = true;
    const timer = setTimeout(() => {
      api(slug, 'admin-calendar', undefined, { mode: 'search', q: term })
        .then((r) => live && setRows(r))
        .catch(() => live && setRows([]));
    }, 280);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, slug]);
  return (
    <BottomSheet open={open} onClose={onClose} title="חיפוש תורים" size="tall" className="cal-sheet">
      <div className="cal-search">
        <Search size={18} />
        <input
          autoFocus
          type="search"
          value={q}
          placeholder="שם לקוח או טלפון"
          onChange={(e) => setQ(e.target.value)}
        />
        {q && (
          <button type="button" aria-label="ניקוי" onClick={() => setQ('')}>
            <X size={16} />
          </button>
        )}
      </div>
      <div className="sheet-scroll cal-search-results">
        {rows === null ? (
          <p className="cal-sheet-empty">הקלידו לפחות 2 תווים כדי לחפש</p>
        ) : !rows.length ? (
          <p className="cal-sheet-empty">לא נמצאו תורים</p>
        ) : (
          rows.map((r) => <AgendaRow key={r.id} visit={{ ...r, rows: [r] }} withDate onPress={() => onPick({ ...r, rows: [r] })} />)
        )}
      </div>
    </BottomSheet>
  );
}

export function MonthDaySheet({
  slug,
  date,
  version,
  onClose,
  onVisit,
  onConstraint,
  onReminder,
}: {
  slug: string;
  date: string | null;
  version: number;
  onClose: () => void;
  onVisit: (v: Visit) => void;
  onConstraint: (c: any) => void;
  onReminder: (r: any) => void;
}) {
  const [shownDate, setShownDate] = useState(date);
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    if (!date) return;
    setShownDate(date);
    let live = true;
    setData((d: any) => (d?.date === date ? d : null));
    api(slug, 'admin-calendar', undefined, { from: date, to: date })
      .then((r) => live && setData({ ...r, date }))
      .catch(() => live && setData({ appointments: [], constraints: [], reminders: [], date }));
    return () => {
      live = false;
    };
  }, [date, slug, version]);
  const d = date || shownDate;
  const visits = data ? visitsOf(data.appointments.filter((a: any) => a.status !== 'cancelled')) : [];
  const empty = data && !visits.length && !data.constraints.length && !data.reminders.length;
  return (
    <BottomSheet open={!!date} onClose={onClose} title={d ? longDate(d) : ''} size="medium" className="cal-sheet">
      <div className="sheet-scroll month-day">
        {d && hebrewDayMonth(d) && <p className="month-day-hebrew">{hebrewDayMonth(d)}</p>}
        {!data ? (
          <div className="cal-loading">
            <div className="loading-ring" />
          </div>
        ) : empty ? (
          <p className="cal-sheet-empty">אין תורים, אילוצים או תזכורות ביום הזה</p>
        ) : (
          <>
            {data.constraints.map((c: any) => (
              <button type="button" key={c.id} className="month-day-item is-block" onClick={() => onConstraint(c)}>
                <Ban size={16} />
                <strong>{c.reason?.trim() || 'זמן חסום'}</strong>
                <span dir={fullDay(c) ? undefined : 'ltr'}>{fullDay(c) ? 'כל היום' : `${hm(c.start_time)} – ${hm(c.end_time)}`}</span>
              </button>
            ))}
            {data.reminders.map((r: any) => {
              const c = reminderColor(r.color_key);
              const s = slotMinutes(r.start_time);
              return (
                <button
                  type="button"
                  key={r.id}
                  className="month-day-item is-note"
                  style={{ '--note-bar': c.bar, '--note-bg': c.bg } as React.CSSProperties}
                  onClick={() => onReminder(r)}
                >
                  <StickyNote size={16} />
                  <strong>{r.title}</strong>
                  <span dir="ltr">{`${clock(s)} – ${clock(s + (Number(r.duration_minutes) || 30))}`}</span>
                </button>
              );
            })}
            {visits.map((v) => (
              <AgendaRow key={v.id} visit={v} onPress={() => onVisit(v)} />
            ))}
          </>
        )}
      </div>
    </BottomSheet>
  );
}
