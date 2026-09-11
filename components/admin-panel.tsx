'use client';
import { useEffect, useState } from 'react';
import {
  CalendarDays,
  Plus,
  Phone,
  Check,
  Clock,
  Users,
  ArrowLeft,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { api, dateLabel } from '@/lib/client';
import { israelNow } from '@/lib/availability';
import AuthForm from './auth-form';
export default function AdminPanel({
  slug,
  data,
  onUser,
}: {
  slug: string;
  data: any;
  onUser: (u: any) => void;
}) {
  const [tab, setTab] = useState('calendar'),
    [date, setDate] = useState(israelNow().date),
    [week, setWeek] = useState(false),
    [records, setRecords] = useState<any>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState(''),
    [form, setForm] = useState<any>({}),
    [slots, setSlots] = useState<string[]>([]),
    [search, setSearch] = useState('');
  async function refresh() {
    try {
      setRecords(
        await api(slug, 'admin', undefined, { date, week: week ? '1' : '0' }),
      );
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    if (data.user?.user_type === 'admin') void refresh();
  }, [data.user?.id, date, week]);
  useEffect(() => {
    if (modal !== 'book' || !form.worker || !form.service || !form.date) {
      setSlots([]);
      return;
    }
    let active = true;
    api(slug, 'availability', undefined, {
      worker: form.worker,
      services: form.service,
      date: form.date,
    })
      .then((r) => {
        if (active) setSlots(r.slots);
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, [modal, form.worker, form.service, form.date]);
  const set = (key: string, value: any) =>
    setForm((f: any) => ({ ...f, [key]: value }));
  async function mutation(action: string, body: any) {
    setBusy(true);
    setError('');
    try {
      await api(slug, action, body);
      await refresh();
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (!data.user) return <AuthForm slug={slug} onDone={onUser} />;
  if (data.user.user_type !== 'admin')
    return <p className="error-note">האזור הזה מיועד למנהלי העסק.</p>;
  const labels: Record<string, string> = {
    confirmed: 'מאושר',
    completed: 'בוצע',
    no_show: 'לא הגיע',
    pending: 'ממתין',
  };
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  return (
    <>
      <div className="eyebrow">ניהול · {data.profile.display_name}</div>
      <h1>יום טוב, {data.user.name}</h1>
      <div className="admin-tabs">
        {[
          ['calendar', 'יומן'],
          ['clients', 'לקוחות'],
          ['hours', 'שעות פעילות'],
          ['waitlist', 'המתנה'],
        ].map(([v, l]) => (
          <button
            className={tab === v ? 'selected' : ''}
            key={v}
            onClick={() => setTab(v)}
          >
            {l}
          </button>
        ))}
      </div>
      {error && (
        <p className="error-note" role="alert">
          {error}
        </p>
      )}
      {!records ? (
        <p className="empty-state">טוענים את העסק…</p>
      ) : (
        <>
          {tab === 'calendar' && (
            <>
              <div className="admin-toolbar">
                <input
                  aria-label="תאריך ביומן"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
                <button
                  className="secondary-button"
                  onClick={() => setWeek(!week)}
                >
                  {week ? 'תצוגת יום' : 'תצוגת שבוע'}
                </button>
                <button
                  className="icon-button"
                  aria-label="הוספת תור"
                  onClick={() => {
                    setForm({ date, worker: data.user.id });
                    setModal('book');
                  }}
                >
                  <Plus />
                </button>
              </div>
              <div className="stats-card">
                <div>
                  <strong>{records.appointments.length}</strong>
                  <span>תורים {week ? 'בשבוע' : 'ביום'}</span>
                </div>
                <div>
                  <strong>
                    {
                      records.clients.filter(
                        (c: any) => c.client_approved === false,
                      ).length
                    }
                  </strong>
                  <span>ממתינים לאישור</span>
                </div>
              </div>
              {records.appointments.map((r: any) => (
                <article className="admin-appointment" key={r.id}>
                  <div className="appointment-time">
                    {r.slot_time.slice(0, 5)}
                    <small>{r.duration_minutes} דקות</small>
                  </div>
                  <div>
                    <strong>{r.client_name}</strong>
                    <p>{r.service_name}</p>
                    {week && <small>{dateLabel(r.slot_date)}</small>}
                    <a href={`tel:${r.client_phone}`} className="phone-link">
                      <Phone size={14} />
                      {r.client_phone}
                    </a>
                    <span className="badge">
                      {labels[r.status] || r.status}
                    </span>
                    <div className="row-actions">
                      <button
                        disabled={busy}
                        onClick={() =>
                          mutation('admin-status', {
                            id: r.id,
                            status: 'completed',
                          })
                        }
                      >
                        בוצע
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          mutation('admin-status', {
                            id: r.id,
                            status: 'no_show',
                          })
                        }
                      >
                        לא הגיע
                      </button>
                      <button
                        className="danger"
                        onClick={() => {
                          setForm(r);
                          setModal('cancel');
                        }}
                      >
                        ביטול
                      </button>
                    </div>
                  </div>
                </article>
              ))}
              {!records.appointments.length && (
                <p className="empty-state">אין תורים בתאריכים שנבחרו.</p>
              )}
            </>
          )}
          {tab === 'clients' && (
            <>
              <label>
                חיפוש לקוח
                <input
                  placeholder="שם או טלפון"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              {records.clients
                .filter((c: any) => `${c.name} ${c.phone}`.includes(search))
                .map((c: any) => (
                  <article className="summary-card" key={c.id}>
                    <h2>{c.name}</h2>
                    <a className="phone-link" href={`tel:${c.phone}`}>
                      <Phone size={15} />
                      {c.phone}
                    </a>
                    <span className="badge">
                      {c.block
                        ? 'חסום'
                        : c.client_approved === false
                          ? 'ממתין לאישור'
                          : 'מאושר'}
                    </span>
                    <div className="row-actions">
                      {c.client_approved === false && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            mutation('admin-client', {
                              id: c.id,
                              operation: 'approve',
                            })
                          }
                        >
                          אישור לקוח
                        </button>
                      )}
                      <button
                        disabled={busy}
                        onClick={() =>
                          mutation('admin-client', {
                            id: c.id,
                            operation: c.block ? 'unblock' : 'block',
                          })
                        }
                      >
                        {c.block ? 'שחרור חסימה' : 'חסימה'}
                      </button>
                    </div>
                  </article>
                ))}
            </>
          )}
          {tab === 'waitlist' && (
            <>
              {records.waitlist.map((r: any) => (
                <article className="summary-card" key={r.id}>
                  <h2>{r.client_name}</h2>
                  <p>
                    {r.service_name} · {dateLabel(r.requested_date)}
                  </p>
                  <p>
                    {
                      (
                        {
                          morning: 'בוקר',
                          afternoon: 'צהריים',
                          evening: 'ערב',
                          any: 'בכל שעה',
                        } as any
                      )[r.time_period]
                    }
                  </p>
                  <a className="phone-link" href={`tel:${r.client_phone}`}>
                    <Phone size={16} />
                    {r.client_phone}
                  </a>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setForm({
                        date: r.requested_date,
                        worker: r.user_id || data.user.id,
                        clientName: r.client_name,
                        clientPhone: r.client_phone,
                        waitlistId: r.id,
                      });
                      setModal('book');
                    }}
                  >
                    שיבוץ תור
                    <ArrowLeft size={16} />
                  </button>
                </article>
              ))}
              {!records.waitlist.length && (
                <p className="empty-state">אין בקשות ממתינות.</p>
              )}
            </>
          )}
          {tab === 'hours' && (
            <>
              <div className="row-actions">
                <button
                  className="secondary-button"
                  onClick={() => {
                    setForm({
                      kind: 'weekly',
                      worker: data.user.id,
                      day: 0,
                      start: '09:00',
                      end: '18:00',
                      active: true,
                      step: 15,
                    });
                    setModal('hours');
                  }}
                >
                  תבנית שבועית
                  <Plus size={16} />
                </button>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setForm({
                      kind: 'override',
                      worker: data.user.id,
                      date,
                      start: '09:00',
                      end: '18:00',
                      active: true,
                    });
                    setModal('hours');
                  }}
                >
                  שעות מיוחדות
                </button>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setForm({
                      kind: 'constraint',
                      worker: data.user.id,
                      date,
                      start: '12:00',
                      end: '13:00',
                    });
                    setModal('hours');
                  }}
                >
                  חסימת זמן
                </button>
              </div>
              {[
                ['hours', 'weekly'],
                ['overrides', 'override'],
                ['constraints', 'constraint'],
              ].map(([collection, kind]) => (
                <section key={kind}>
                  <h2 className="small-heading">
                    {kind === 'weekly'
                      ? 'שעות שבועיות'
                      : kind === 'override'
                        ? 'שעות מיוחדות'
                        : 'חסימות זמן'}
                  </h2>
                  {records[collection].map((r: any) => (
                    <button
                      className="hours-row"
                      key={r.id}
                      onClick={() => {
                        setForm({
                          ...r,
                          kind,
                          worker: r.user_id || '',
                          day: r.day_of_week,
                          start: r.start_time.slice(0, 5),
                          end: r.end_time.slice(0, 5),
                          active: r.is_active,
                          step: r.slot_duration_minutes,
                          breaks: r.breaks || [],
                        });
                        setModal('hours');
                      }}
                    >
                      <span>
                        {kind === 'weekly'
                          ? `יום ${days[r.day_of_week]}`
                          : dateLabel(r.date)}
                        <small>
                          {data.staff.find((s: any) => s.id === r.user_id)
                            ?.name || 'כל העסק'}
                        </small>
                      </span>
                      <span>
                        {r.is_active === false
                          ? 'סגור'
                          : `${r.start_time.slice(0, 5)}–${r.end_time.slice(0, 5)}`}
                      </span>
                    </button>
                  ))}
                </section>
              ))}
            </>
          )}
        </>
      )}
      <Dialog open={!!modal} onOpenChange={(v) => !v && setModal('')}>
        <DialogContent className="tori-dialog" dir="rtl">
          <DialogTitle>
            {modal === 'book'
              ? 'הוספת תור'
              : modal === 'cancel'
                ? 'ביטול תור'
                : 'עריכת שעות הפעילות'}
          </DialogTitle>
          <DialogDescription>
            {modal === 'cancel'
              ? `${form.client_name} · ${form.service_name}`
              : 'הפרטים נשמרים גם באפליקציה של העסק.'}
          </DialogDescription>
          {modal === 'cancel' ? (
            <button
              className="primary-button"
              disabled={busy}
              onClick={async () => {
                if (await mutation('cancel', { id: form.id })) setModal('');
              }}
            >
              אישור ביטול
            </button>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await mutation(
                  modal === 'book' ? 'book' : 'admin-hours',
                  modal === 'book'
                    ? { ...form, services: [form.service] }
                    : form,
                );
                if (ok) setModal('');
              }}
            >
              <label>
                איש צוות
                <select
                  value={form.worker || ''}
                  onChange={(e) => {
                    set('worker', e.target.value);
                    set('service', '');
                    set('time', '');
                  }}
                  required={modal === 'book'}
                >
                  <option value="">
                    {modal === 'book' ? 'בחירה' : 'כל העסק'}
                  </option>
                  {data.staff.map((s: any) => (
                    <option value={s.id} key={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              {modal === 'book' ? (
                <>
                  <label>
                    לקוח קיים
                    <select
                      value={form.clientId || ''}
                      onChange={(e) => set('clientId', e.target.value)}
                    >
                      <option value="">שם וטלפון ידניים</option>
                      {records?.clients.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.name} · {c.phone}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!form.clientId && (
                    <>
                      <label>
                        שם הלקוח
                        <input
                          value={form.clientName || ''}
                          onChange={(e) => set('clientName', e.target.value)}
                          required
                        />
                      </label>
                      <label>
                        טלפון
                        <input
                          type="tel"
                          dir="ltr"
                          value={form.clientPhone || ''}
                          onChange={(e) => set('clientPhone', e.target.value)}
                          required
                        />
                      </label>
                    </>
                  )}
                  <label>
                    טיפול
                    <select
                      value={form.service || ''}
                      onChange={(e) => {
                        set('service', e.target.value);
                        set('time', '');
                      }}
                      required
                    >
                      <option value="">בחירת טיפול</option>
                      {data.services
                        .filter(
                          (s: any) =>
                            !s.worker_id || s.worker_id === form.worker,
                        )
                        .map((s: any) => (
                          <option value={s.id} key={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    תאריך
                    <input
                      type="date"
                      value={form.date || date}
                      onChange={(e) => {
                        set('date', e.target.value);
                        set('time', '');
                      }}
                      required
                    />
                  </label>
                  <label>
                    שעה פנויה
                    <select
                      value={form.time || ''}
                      onChange={(e) => set('time', e.target.value)}
                      required
                    >
                      <option value="">בחירת שעה</option>
                      {slots.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <>
                  {form.kind === 'weekly' ? (
                    <label>
                      יום בשבוע
                      <select
                        value={form.day ?? 0}
                        onChange={(e) => set('day', Number(e.target.value))}
                      >
                        {days.map((d, i) => (
                          <option key={d} value={i}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <label>
                      תאריך
                      <input
                        type="date"
                        value={form.date || date}
                        onChange={(e) => set('date', e.target.value)}
                        required
                      />
                    </label>
                  )}
                  <div className="form-pair">
                    <label>
                      משעה
                      <input
                        type="time"
                        value={form.start || ''}
                        onChange={(e) => set('start', e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      עד שעה
                      <input
                        type="time"
                        value={form.end || ''}
                        onChange={(e) => set('end', e.target.value)}
                        required
                      />
                    </label>
                  </div>
                  {form.kind !== 'constraint' && (
                    <>
                      <label>
                        פעילות
                        <select
                          value={form.active === false ? 'closed' : 'open'}
                          onChange={(e) =>
                            set('active', e.target.value === 'open')
                          }
                        >
                          <option value="open">פתוח</option>
                          <option value="closed">סגור</option>
                        </select>
                      </label>
                      {form.kind === 'weekly' && (
                        <label>
                          מרווח התחלות תור בדקות
                          <select
                            value={form.step || 15}
                            onChange={(e) => set('step', +e.target.value)}
                          >
                            {[5, 10, 15, 20, 30, 60].map((n) => (
                              <option key={n}>{n}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      <div className="small-heading">הפסקות</div>
                      {(form.breaks || []).map((b: any, i: number) => (
                        <div className="form-pair" key={i}>
                          <input
                            type="time"
                            aria-label="תחילת הפסקה"
                            value={b.start_time}
                            onChange={(e) =>
                              set(
                                'breaks',
                                form.breaks.map((x: any, j: number) =>
                                  j === i
                                    ? { ...x, start_time: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                          <input
                            type="time"
                            aria-label="סיום הפסקה"
                            value={b.end_time}
                            onChange={(e) =>
                              set(
                                'breaks',
                                form.breaks.map((x: any, j: number) =>
                                  j === i
                                    ? { ...x, end_time: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                          <button
                            type="button"
                            onClick={() =>
                              set(
                                'breaks',
                                form.breaks.filter(
                                  (_: any, j: number) => j !== i,
                                ),
                              )
                            }
                          >
                            הסרה
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="text-button"
                        onClick={() =>
                          set('breaks', [
                            ...(form.breaks || []),
                            { start_time: '12:00', end_time: '12:30' },
                          ])
                        }
                      >
                        הוספת הפסקה
                      </button>
                    </>
                  )}
                </>
              )}
              <button className="primary-button" disabled={busy}>
                {busy ? 'שומרים…' : 'שמירה'}
              </button>
              {modal === 'hours' && form.id && (
                <button
                  type="button"
                  className="text-button danger"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await mutation('admin-hours', {
                        kind: form.kind,
                        id: form.id,
                        remove: true,
                      })
                    )
                      setModal('');
                  }}
                >
                  מחיקת ההגדרה
                </button>
              )}
            </form>
          )}
          {error && (
            <p role="alert" className="error-note">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
