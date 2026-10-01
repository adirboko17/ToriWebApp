'use client';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Briefcase, Check, CheckCircle2, Clock, Coffee, Plus, PlusCircle, Trash2, X } from 'lucide-react';
import BottomSheet from './bottom-sheet';
import TimeField, { timeOptions } from './time-wheel';
import { IosAlert, IosSwitch } from './admin-calendar-sheets';
import { api } from '@/lib/client';
import { addDays, israelNow } from '@/lib/availability';
import { HE_DAYS, HE_MONTHS_SHORT, HE_WEEKDAYS, dow, hm, ymd } from '@/lib/calendar-format';

type Break = { id: string; start_time: string; end_time: string };
const TEN = timeOptions(10);
const BREAK_OPTIONS = [0, 5, 10, 15, 20, 25, 30];
let breakSeq = 0;
const makeBreak = (start = '12:00', end = '12:30'): Break => ({ id: `b${++breakSeq}`, start_time: start, end_time: end });
const range = (start: string, end: string) => `${start} – ${end}`;

function breaksOf(row: any): { start_time: string; end_time: string }[] {
  const list = (Array.isArray(row?.breaks) ? row.breaks : [])
    .map((b: any) => ({ start_time: hm(b.start_time), end_time: hm(b.end_time) }))
    .filter((b: any) => b.start_time && b.end_time);
  if (!list.length && row?.break_start_time && row?.break_end_time)
    list.push({ start_time: hm(row.break_start_time), end_time: hm(row.break_end_time) });
  return list;
}

function validate(start: string, end: string, breaks: { start_time: string; end_time: string }[]) {
  if (start >= end) return 'שעת הסיום חייבת להיות אחרי שעת ההתחלה';
  for (const b of breaks)
    if (!(start < b.start_time && b.start_time < b.end_time && b.end_time <= end))
      return 'כל הפסקה חייבת להיות בתוך שעות העבודה וללא חפיפה';
  const sorted = [...breaks].sort((a, b) => a.start_time.localeCompare(b.start_time));
  for (let i = 1; i < sorted.length; i++)
    if (sorted[i - 1].end_time > sorted[i].start_time) return 'אין חפיפה בין הפסקות';
  return '';
}

function defaultBreak(start: string, end: string, existing: Break[]) {
  const last = existing[existing.length - 1];
  const from = last ? last.end_time : '12:00';
  const s = from > start && from < end ? from : start;
  const endIndex = Math.min(TEN.indexOf(s) + 3, TEN.length - 1);
  return makeBreak(s, TEN[endIndex] > end ? end : TEN[endIndex]);
}

function HoursEditor({
  start,
  end,
  useBreaks,
  breaks,
  onChange,
}: {
  start: string;
  end: string;
  useBreaks: boolean;
  breaks: Break[];
  onChange: (patch: Partial<{ start: string; end: string; useBreaks: boolean; breaks: Break[] }>) => void;
}) {
  const endOptions = TEN.filter((t) => t > start);
  return (
    <>
      <section className="hours-section">
        <i className="hours-section-bar" />
        <div className="hours-section-inner">
          <header>
            <Briefcase size={15} />
            שעות עבודה
          </header>
          <div className="hours-toggle">
            <span>להוסיף הפסקות?</span>
            <IosSwitch
              checked={useBreaks}
              label="להוסיף הפסקות?"
              onChange={(v) => onChange({ useBreaks: v, breaks: v && !breaks.length ? [defaultBreak(start, end, [])] : breaks })}
            />
          </div>
          <div className="hours-times">
            <div>
              <label>שעת התחלה</label>
              <TimeField label="שעת התחלה" value={start} options={TEN} onChange={(v) => onChange({ start: v, end: end > v ? end : TEN.find((t) => t > v) || end })} />
            </div>
            <ArrowRight size={16} className="hours-arrow" />
            <div>
              <label>שעת סיום</label>
              <TimeField label="שעת סיום" value={end} options={endOptions} onChange={(v) => onChange({ end: v })} />
            </div>
          </div>
        </div>
      </section>
      {useBreaks && (
        <section className="hours-section is-break">
          <i className="hours-section-bar" />
          <div className="hours-section-inner">
            <header>
              <Coffee size={15} />
              הפסקות
            </header>
            {breaks.map((b, i) => (
              <div className="hours-break" key={b.id}>
                <div className="hours-break-head">
                  <span>
                    <Coffee size={13} />
                    הפסקה #{i + 1}
                  </span>
                  <button type="button" aria-label="הסרת הפסקה" onClick={() => onChange({ breaks: breaks.filter((x) => x.id !== b.id) })}>
                    <X size={13} />
                  </button>
                </div>
                <div className="hours-times">
                  <div>
                    <label>התחלה</label>
                    <TimeField
                      label="התחלה"
                      value={b.start_time}
                      options={TEN}
                      onChange={(v) => onChange({ breaks: breaks.map((x) => (x.id === b.id ? { ...x, start_time: v } : x)) })}
                    />
                  </div>
                  <ArrowLeft size={16} className="hours-arrow" />
                  <div>
                    <label>סיום</label>
                    <TimeField
                      label="סיום"
                      value={b.end_time}
                      options={TEN.filter((t) => t > b.start_time)}
                      onChange={(v) => onChange({ breaks: breaks.map((x) => (x.id === b.id ? { ...x, end_time: v } : x)) })}
                    />
                  </div>
                </div>
              </div>
            ))}
            <button type="button" className="hours-add-break" onClick={() => onChange({ breaks: [...breaks, defaultBreak(start, end, breaks)] })}>
              <PlusCircle size={18} />
              הוסף/י הפסקה
            </button>
          </div>
        </section>
      )}
    </>
  );
}

function WeeklyHours({ slug, userId, weekly, onChanged }: { slug: string; userId: string; weekly: any[]; onChanged: () => void }) {
  const [rows, setRows] = useState(weekly);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<any>(null);
  const [original, setOriginal] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setRows(weekly), [weekly]);
  const rowOf = (day: number) => rows.find((h) => h.day_of_week === day);
  const snapshot = (d: any) => JSON.stringify([d.start, d.end, d.useBreaks, d.useBreaks ? d.breaks.map((b: Break) => [b.start_time, b.end_time]) : []]);
  const dirty = !!draft && snapshot(draft) !== original;

  const active = rows.filter((h) => h.is_active && h.start_time && h.end_time);
  const unique = new Set(active.map((h) => `${hm(h.start_time)}|${hm(h.end_time)}`));
  const summary = !active.length
    ? { title: 'כל הימים סגורים', range: '' }
    : {
        title: active.length === 1 ? 'פתוח יום אחד' : `פתוח ${active.length} ימים`,
        range: unique.size === 1 ? range(hm(active[0].start_time), hm(active[0].end_time)) : 'שעות משתנות',
      };

  function open(day: number) {
    const row = rowOf(day);
    const breaks = breaksOf(row).map((b) => makeBreak(b.start_time, b.end_time));
    const next = {
      start: hm(row?.start_time) || '09:00',
      end: hm(row?.end_time) || '17:00',
      useBreaks: breaks.length > 0,
      breaks,
    };
    setDraft(next);
    setOriginal(snapshot(next));
    setEditing(day);
    setError('');
  }

  async function toggle(day: number, value: boolean) {
    const row = rowOf(day);
    setError('');
    setRows((list) =>
      row
        ? list.map((h) => (h.day_of_week === day ? { ...h, is_active: value } : h))
        : [...list, { day_of_week: day, start_time: '09:00', end_time: '17:00', is_active: value }],
    );
    try {
      await api(slug, 'admin-hours', {
        kind: 'weekly',
        worker: userId,
        id: row?.id,
        day,
        start: hm(row?.start_time) || '09:00',
        end: hm(row?.end_time) || '17:00',
        active: value,
        breaks: breaksOf(row),
      });
      onChanged();
    } catch (e: any) {
      setRows(weekly);
      setError(e.message || 'נכשל בעדכון שעות העבודה');
    }
  }

  async function save() {
    if (editing === null || !draft) return;
    const breaks = draft.useBreaks ? draft.breaks.map(({ start_time, end_time }: Break) => ({ start_time, end_time })) : [];
    const problem = validate(draft.start, draft.end, breaks);
    if (problem) return setError(problem);
    const row = rowOf(editing);
    setBusy(true);
    setError('');
    try {
      await api(slug, 'admin-hours', {
        kind: 'weekly',
        worker: userId,
        id: row?.id,
        day: editing,
        start: draft.start,
        end: draft.end,
        active: row ? row.is_active !== false : true,
        breaks,
      });
      setEditing(null);
      onChanged();
    } catch (e: any) {
      setError(e.message || 'שמירת שעות העבודה נכשלה');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error && (
        <p className="hours-error" role="alert">
          {error}
        </p>
      )}
      <div className="hours-card">
        <div className="hours-summary-head">
          <strong>{summary.title}</strong>
          {summary.range && <span dir={summary.range.includes(':') ? 'ltr' : undefined}>{summary.range}</span>}
        </div>
        {[0, 1, 2, 3, 4, 5, 6].map((day) => {
          const row = rowOf(day);
          const isActive = !!row?.is_active;
          const isEditing = editing === day;
          const start = isEditing ? draft.start : hm(row?.start_time);
          const end = isEditing ? draft.end : hm(row?.end_time);
          const breaks = isEditing ? (draft.useBreaks ? draft.breaks : []) : breaksOf(row);
          return (
            <div
              key={day}
              className={`hours-day${isEditing ? ' is-editing' : ''}`}
              role="button"
              tabIndex={0}
              aria-expanded={isEditing}
              onClick={() => {
                if (!isEditing) open(day);
                else if (!dirty) setEditing(null);
              }}
              onKeyDown={(e) => {
                if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  if (!isEditing) open(day);
                  else if (!dirty) setEditing(null);
                }
              }}
            >
              <div className="hours-day-main">
                <div className="hours-day-identity">
                  <strong className={isActive ? '' : 'is-closed'}>{HE_DAYS[day]}</strong>
                  <span className={isActive ? '' : 'is-closed'} dir={isActive && start && end ? 'ltr' : undefined}>
                    {isActive && start && end ? range(start, end) : 'סגור'}
                  </span>
                  {isActive &&
                    breaks.map((b: any, i: number) => (
                      <small key={i}>
                        {breaks.length > 1 ? `הפסקה #${i + 1}: ` : 'הפסקה: '}
                        <bdi dir="ltr">{range(b.start_time, b.end_time)}</bdi>
                      </small>
                    ))}
                </div>
                <IosSwitch checked={isActive} label={isActive ? 'פתוח' : 'סגור'} onChange={(v) => toggle(day, v)} />
              </div>
              {isEditing && (
                <div className="hours-editor" onClick={(e) => e.stopPropagation()}>
                  <HoursEditor
                    start={draft.start}
                    end={draft.end}
                    useBreaks={draft.useBreaks}
                    breaks={draft.breaks}
                    onChange={(patch) => setDraft((d: any) => ({ ...d, ...patch }))}
                  />
                  <section className="hours-day-summary">
                    <header>
                      <CheckCircle2 size={16} />
                      סיכום יום
                    </header>
                    <div>
                      <b dir="ltr">{range(draft.start, draft.end)}</b>
                      <span>
                        <Clock size={13} />
                        עבודה
                      </span>
                    </div>
                    {draft.useBreaks &&
                      draft.breaks.map((b: Break, i: number) => (
                        <div key={b.id} className="is-break">
                          <b dir="ltr">{range(b.start_time, b.end_time)}</b>
                          <span>
                            <Coffee size={13} />
                            {draft.breaks.length > 1 ? `הפסקה #${i + 1}: ` : 'הפסקה: '}
                          </span>
                        </div>
                      ))}
                  </section>
                  <div className="hours-actions">
                    <button type="button" className="hours-cancel" disabled={!dirty} onClick={() => setEditing(null)}>
                      ביטול
                    </button>
                    <button type="button" className="hours-save" disabled={!dirty || busy} onClick={save}>
                      <Check size={16} />
                      {busy ? 'שומרים…' : 'שמירה'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function FixedBreaks({ slug, value, onChanged }: { slug: string; value: number; onChanged: (v: number) => void }) {
  const [current, setCurrent] = useState(value);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState('');
  useEffect(() => setCurrent(value), [value]);
  async function pick(minutes: number) {
    if (minutes === current || saving !== null) return;
    setSaving(minutes);
    setError('');
    try {
      await api(slug, 'admin-break', { minutes });
      setCurrent(minutes);
      onChanged(minutes);
    } catch {
      setError('כשל בשמירת ההפסקה. אנא נסו שוב.');
    } finally {
      setSaving(null);
    }
  }
  return (
    <>
      {error && (
        <p className="hours-error" role="alert">
          {error}
        </p>
      )}
      <div className="hours-card">
        <div className="hours-summary-head">
          <strong>זמן הפסקה קבוע בין תור לתור</strong>
          <span>{current === 0 ? 'כרגע בלי הפסקה בין תורים' : `כרגע ${current} דקות בין תורים`}</span>
        </div>
        {BREAK_OPTIONS.map((minutes) => (
          <button
            type="button"
            role="radio"
            aria-checked={current === minutes}
            key={minutes}
            className={`hours-option${current === minutes ? ' is-on' : ''}`}
            disabled={saving !== null}
            onClick={() => pick(minutes)}
          >
            <span>{minutes === 0 ? 'ללא' : `${minutes} דקות`}</span>
            <i>{saving === minutes ? <span className="hours-spinner" /> : current === minutes ? <Check size={22} /> : null}</i>
          </button>
        ))}
        <p className="hours-hint">בחרו מספר דקות של הפסקה בין תור לתור, ניתן לבחור ״ללא״ כדי להשאיר את זה ללא הפסקה</p>
      </div>
    </>
  );
}

const overrideDate = (date: string) => `${HE_WEEKDAYS[dow(date)]}, ${ymd(date).d} ב${HE_MONTHS_SHORT[ymd(date).m]}`;

function Overrides({
  slug,
  userId,
  overrides,
  bookedDates,
  onChanged,
}: {
  slug: string;
  userId: string;
  overrides: any[];
  bookedDates: string[];
  onChanged: () => void;
}) {
  const today = israelNow().date;
  const [composer, setComposer] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<any>(null);
  const booked = new Set(bookedDates);
  const set = (patch: any) => setComposer((c: any) => ({ ...c, ...patch }));

  function openComposer(row?: any) {
    const breaks = breaksOf(row).map((b) => makeBreak(b.start_time, b.end_time));
    setComposer({
      scope: 'day',
      from: row?.date || today,
      to: row?.date || addDays(today, 6),
      active: row ? row.is_active !== false : true,
      start: hm(row?.start_time) || '09:00',
      end: hm(row?.end_time) || '17:00',
      useBreaks: breaks.length > 0,
      breaks,
      editing: !!row,
    });
    setError('');
  }

  async function save() {
    const dates: string[] = [];
    if (composer.scope === 'day') dates.push(composer.from);
    else {
      if (!composer.to || composer.to < composer.from) return setError('תאריך הסיום חייב להיות אחרי תאריך ההתחלה');
      for (let d = composer.from; d <= composer.to && dates.length <= 31; d = addDays(d, 1)) dates.push(d);
      if (dates.length > 31) return setError('אפשר לבחור עד 31 ימים');
    }
    if (dates.some((d) => d < today)) return setError('אי אפשר לבחור תאריך שעבר');
    const breaks = composer.active && composer.useBreaks ? composer.breaks.map(({ start_time, end_time }: Break) => ({ start_time, end_time })) : [];
    if (composer.active) {
      const problem = validate(composer.start, composer.end, breaks);
      if (problem) return setError(problem);
    } else if (dates.some((d) => booked.has(d))) return setError('אי אפשר לסגור יום שיש בו תורים');
    setBusy(true);
    setError('');
    try {
      for (const date of dates)
        await api(slug, 'admin-hours', {
          kind: 'override',
          worker: userId,
          date,
          start: composer.active ? composer.start : '09:00',
          end: composer.active ? composer.end : '17:00',
          active: composer.active,
          breaks,
        });
      setComposer(null);
      onChanged();
    } catch (e: any) {
      setError(e.message || 'לא ניתן לשמור את החריגה. נסו שוב.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api(slug, 'admin-hours', { kind: 'override', id: removing.id, remove: true });
      setRemoving(null);
      onChanged();
    } catch (e: any) {
      setRemoving(null);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const composerBooked = composer && composer.scope === 'day' && booked.has(composer.from);
  return (
    <>
      {error && !composer && (
        <p className="hours-error" role="alert">
          {error}
        </p>
      )}
      <div className="hours-card">
        <div className="hours-summary-head">
          <strong>שעות לתאריך</strong>
          <span>מחליפות את השעות השבועיות רק בימים האלה</span>
        </div>
        {overrides.length ? (
          overrides.map((o) => {
            const breaks = breaksOf(o);
            return (
              <div className="hours-override" key={o.id}>
                <button type="button" className="hours-override-main" onClick={() => openComposer(o)}>
                  <strong>{overrideDate(o.date)}</strong>
                  <span dir={o.is_active !== false ? 'ltr' : undefined}>
                    {o.is_active !== false ? range(hm(o.start_time), hm(o.end_time)) : 'סגור'}
                  </span>
                  {o.is_active !== false &&
                    breaks.map((b, i) => (
                      <small key={i}>
                        {breaks.length > 1 ? `הפסקה #${i + 1}: ` : 'הפסקה: '}
                        <bdi dir="ltr">{range(b.start_time, b.end_time)}</bdi>
                      </small>
                    ))}
                </button>
                <button type="button" className="hours-override-delete" aria-label="מחיקת חריגה" onClick={() => setRemoving(o)}>
                  <Trash2 size={18} />
                </button>
              </div>
            );
          })
        ) : (
          <p className="hours-empty">אין חריגות קרובות. השעות השבועיות הרגילות בתוקף.</p>
        )}
        <div className="hours-override-add-wrap">
          <button type="button" className="hours-override-add" onClick={() => openComposer()}>
            <Plus size={18} />
            הוספת חריגה
          </button>
        </div>
      </div>
      <BottomSheet open={!!composer} onClose={() => setComposer(null)} title="הגדרת שעות לתאריכים" size="tall" className="hours-sheet">
        {composer && (
          <div className="sheet-scroll hours-composer">
            <p className="hours-composer-sub">בחרו יום או טווח תאריכים</p>
            {!composer.editing && (
              <div className="hours-scope" role="tablist">
                {[
                  ['day', 'יום'],
                  ['range', 'טווח'],
                ].map(([id, label]) => (
                  <button type="button" role="tab" aria-selected={composer.scope === id} key={id} className={composer.scope === id ? 'is-on' : ''} onClick={() => set({ scope: id })}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className="hours-card hours-composer-card">
              <label className="hours-composer-row">
                <span>{composer.scope === 'range' ? 'מתאריך' : 'תאריך'}</span>
                <input type="date" min={today} value={composer.from} disabled={composer.editing} onChange={(e) => set({ from: e.target.value })} />
              </label>
              {composer.scope === 'range' && (
                <label className="hours-composer-row">
                  <span>עד תאריך</span>
                  <input type="date" min={composer.from} value={composer.to} onChange={(e) => set({ to: e.target.value })} />
                </label>
              )}
              <div className="hours-composer-row">
                <span>{composer.active ? 'פתוח' : 'סגור'}</span>
                <IosSwitch checked={composer.active} label="פתוח" onChange={(v) => set({ active: v })} />
              </div>
            </div>
            {composerBooked && <p className="hours-composer-hint">יש תורים - אפשר לצמצם עד התור הראשון והאחרון, ולשנות הפסקות רק בחורים הפנויים</p>}
            {composer.active ? (
              <HoursEditor
                start={composer.start}
                end={composer.end}
                useBreaks={composer.useBreaks}
                breaks={composer.breaks}
                onChange={(patch) => set(patch)}
              />
            ) : (
              <p className="hours-composer-hint">הימים האלה יהיו סגורים לקביעת תורים חדשים</p>
            )}
            {error && (
              <p className="hours-error" role="alert">
                {error}
              </p>
            )}
            <div className="hours-actions">
              <button type="button" className="hours-cancel" onClick={() => setComposer(null)}>
                ביטול
              </button>
              <button type="button" className="hours-save" disabled={busy} onClick={save}>
                <Check size={16} />
                {busy ? 'שומרים…' : 'שמירה'}
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
      <IosAlert
        open={!!removing}
        title="למחוק את החריגה?"
        message="היום הזה יחזור לשעות השבועיות הרגילות."
        confirm="מחק"
        busy={busy}
        onCancel={() => setRemoving(null)}
        onConfirm={remove}
      />
    </>
  );
}

export default function AdminHours({ slug, userId }: { slug: string; userId: string }) {
  const [tab, setTab] = useState<'hours' | 'breaks' | 'overrides'>('hours');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const load = () =>
    api(slug, 'admin-hours-data')
      .then((r) => {
        setData(r);
        setError('');
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, [slug, userId]);
  return (
    <div className="hours">
      <nav className="hours-tabs" role="tablist">
        {(
          [
            ['hours', 'שעות עבודה'],
            ['breaks', 'הפסקות קבועות'],
            ['overrides', 'חריגות'],
          ] as const
        ).map(([id, label]) => (
          <button type="button" role="tab" aria-selected={tab === id} key={id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      <div className="hours-content">
        {error && !data ? (
          <p className="hours-error" role="alert">
            {error}
          </p>
        ) : !data ? (
          <div className="hours-loading" role="status">
            <div className="loading-ring" />
            <span>טוען שעות עבודה…</span>
          </div>
        ) : tab === 'hours' ? (
          <WeeklyHours slug={slug} userId={userId} weekly={data.weekly} onChanged={load} />
        ) : tab === 'breaks' ? (
          <FixedBreaks slug={slug} value={data.breakMinutes} onChanged={(breakMinutes) => setData((d: any) => ({ ...d, breakMinutes }))} />
        ) : (
          <Overrides slug={slug} userId={userId} overrides={data.overrides} bookedDates={data.bookedDates} onChanged={load} />
        )}
      </div>
    </div>
  );
}
