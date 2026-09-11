'use client';
import { useState, useEffect } from 'react';
import {
  CalendarDays,
  Clock,
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  UserRound,
  Heart,
  Plus,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { api, dateLabel, downloadCalendar } from '@/lib/client';
import { israelNow, addDays } from '@/lib/availability';
import AuthForm from './auth-form';
import BookingCalendar from './booking-calendar';
import { useRouter } from 'next/navigation';
export default function BookingFlow({
  slug,
  data,
  onUser,
  initialService,
}: {
  slug: string;
  data: any;
  onUser: (u: any) => void;
  initialService?: string;
}) {
  const { profile, staff, services, user } = data;
  const router = useRouter();
  const [step, setStep] = useState(staff.length === 1 ? 1 : 0),
    [worker, setWorker] = useState(staff.length === 1 ? staff[0].id : ''),
    [selected, setSelected] = useState<string[]>(
      initialService ? [initialService] : [],
    ),
    [date, setDate] = useState(israelNow().date),
    [time, setTime] = useState(''),
    [slots, setSlots] = useState<string[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [auth, setAuth] = useState(false),
    [success, setSuccess] = useState<any>(null),
    [wait, setWait] = useState(false),
    [period, setPeriod] = useState('any'),
    [waitDone, setWaitDone] = useState(false);
  const visible = services.filter(
      (s: any) => !s.worker_id || s.worker_id === worker,
    ),
    picked = services.filter((s: any) => selected.includes(s.id)),
    duration = picked.reduce(
      (n: number, s: any) => n + (s.duration_minutes || 60),
      0,
    ),
    price = picked.reduce((n: number, s: any) => n + Number(s.price || 0), 0);
  const today = israelNow().date,
    days = Math.max(
      1,
      Number(profile.booking_open_days_by_user?.[worker] ?? 7),
    );
  const staffName = staff.find((s: any) => s.id === worker)?.name;
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const initialWorker = params.get('worker');
    const initialDate = params.get('date');
    if (initialWorker && staff.some((s: any) => s.id === initialWorker)) {
      setWorker(initialWorker);
      setStep(1);
    }
    if (
      initialDate &&
      /^\d{4}-\d{2}-\d{2}$/.test(initialDate) &&
      initialDate >= today
    )
      setDate(initialDate);
    const id = params.get('service');
    const chosen = services.find((s: any) => s.id === id);
    if (chosen) {
      setSelected([chosen.id]);
      if (
        chosen.worker_id &&
        staff.some((s: any) => s.id === chosen.worker_id)
      ) {
        setWorker(chosen.worker_id);
        setStep(1);
      }
    }
  }, []);
  useEffect(() => {
    if (step !== 2 || !worker || !selected.length) return;
    let active = true;
    setLoading(true);
    setError('');
    setTime('');
    api(slug, 'availability', undefined, {
      worker,
      services: selected.join(','),
      date,
    })
      .then((r) => {
        if (active) setSlots(r.slots);
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setSlots([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
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
          description:
            'Select a staff member and services and show available times. Does not create an appointment.',
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
                  !services.some(
                    (s: any) =>
                      s.id === id &&
                      (!s.worker_id || s.worker_id === input.worker),
                  ),
              ) ||
              (!profile.allow_multi_service_booking &&
                input.services.length > 1)
            )
              throw new Error('Invalid selection');
            setWorker(input.worker);
            setSelected(input.services);
            setStep(2);
            return {
              worker: input.worker,
              services: input.services,
              stage: 'select_time',
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, [staff, services, profile.allow_multi_service_booking]);
  async function confirm() {
    if (!user) {
      setAuth(true);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const row = await api(slug, 'book', {
        worker,
        services: selected,
        date,
        time,
      });
      setSuccess(row);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function joinWait() {
    if (!user) {
      setAuth(true);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api(slug, 'waitlist', { worker, services: selected, date, period });
      setWaitDone(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (success)
    return (
      <div className="success-page">
        <div className="success-symbol">
          <Check size={44} />
        </div>
        <span className="eyebrow">זמן טוב שמור לך</span>
        <h1>התור שלך נקבע!</h1>
        <p className="intro">מחכים לך. כל הפרטים כאן למטה.</p>
        <div className="summary-card">
          <h2>{success.service_name}</h2>
          <p>
            <CalendarDays size={18} />
            {dateLabel(success.slot_date)}
          </p>
          <p>
            <Clock size={18} />
            {success.slot_time.slice(0, 5)} · {success.duration_minutes} דקות
          </p>
          <p>
            <UserRound size={18} />
            {staffName}
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() => downloadCalendar(success)}
        >
          הוספה ליומן
          <Plus size={18} />
        </button>
        <a className="text-button" href={`/b/${slug}/appointments`}>
          לכל התורים שלי
        </a>
      </div>
    );
  return (
    <div className={`booking-view booking-stage-${step}`}>
      <div className="page-top">
        <button
          className="icon-button"
          aria-label="חזרה"
          onClick={() =>
            step > 0 ? setStep(step - 1) : router.push(`/b/${slug}`)
          }
        >
          <ChevronRight />
        </button>
        <span>קביעת תור</span>
        <span className="muted">{step + 1} מתוך 4</span>
      </div>
      {worker && step > 0 && (
        <div className="booking-chips">
          <button
            onClick={() => setStep(0)}
            className="booking-chip staff-chip"
          >
            {staff.find((s: any) => s.id === worker)?.image_url ? (
              <img
                src={staff.find((s: any) => s.id === worker).image_url}
                alt=""
              />
            ) : (
              <UserRound size={26} />
            )}
            <span>{staffName}</span>
          </button>
          {picked.length > 0 && step > 1 && (
            <button className="booking-chip" onClick={() => setStep(1)}>
              <strong>{picked.map((s: any) => s.name).join(' + ')}</strong>
              <span>₪{price}</span>
            </button>
          )}
          {step > 2 && (
            <button className="booking-chip" onClick={() => setStep(2)}>
              <CalendarDays size={24} />
              <span>
                {new Date(date + 'T12:00:00Z').toLocaleDateString('he-IL', {
                  day: 'numeric',
                  month: 'short',
                })}{' '}
                · {time}
              </span>
            </button>
          )}
        </div>
      )}
      <div className="steps">
        {['צוות', 'טיפול', 'זמן', 'אישור'].map((s, i) => (
          <button
            key={s}
            disabled={i > step}
            className={i === step ? 'current' : i < step ? 'done' : ''}
            onClick={() => setStep(i)}
          >
            <span>{i < step ? <Check size={14} /> : i + 1}</span>
            {s}
          </button>
        ))}
      </div>
      <span className="eyebrow">
        {
          ['נעים להכיר', 'הבחירה שלך', 'נמצא לך רגע פנוי', 'רגע לפני שנפגשים'][
            step
          ]
        }
      </span>
      <h1>
        {
          [
            'עם מי נפגשים?',
            'מה נעשה הפעם?',
            'מתי נוח לך?',
            'כל הפרטים, במקום אחד.',
          ][step]
        }
      </h1>
      <p className="intro">
        {
          [
            'בחרו את איש הצוות שלכם',
            'בחרו את הטיפול שמתאים לכם',
            'השעות המוצגות פנויות להזמנה',
            'בדקו את הפרטים ואשרו את התור',
          ][step]
        }
      </p>
      {step === 0 && (
        <div
          className={`staff-grid ${profile.staff_selection_style === 'avatar_list' ? 'staff-list' : 'staff-carousel'}`}
        >
          {staff.map((s: any) => (
            <button
              className={`staff-card ${worker === s.id ? 'selected' : ''}`}
              key={s.id}
              onClick={() => {
                setWorker(s.id);
                setSelected([]);
                setStep(1);
              }}
            >
              {s.image_url ? (
                <img src={s.image_url} alt={s.name} />
              ) : (
                <div className="staff-fallback">
                  <UserRound size={45} />
                </div>
              )}
              <strong>{s.name}</strong>
              <span>
                לבחירה <ChevronLeft size={15} />
              </span>
            </button>
          ))}
          {!staff.length && (
            <p className="empty-state">אין כרגע אנשי צוות זמינים להזמנה.</p>
          )}
        </div>
      )}
      {step === 1 && (
        <>
          <div className="service-list">
            {visible.map((s: any) => (
              <button
                className={`service-card ${selected.includes(s.id) ? 'selected' : ''}`}
                key={s.id}
                onClick={() =>
                  setSelected(
                    profile.allow_multi_service_booking
                      ? selected.includes(s.id)
                        ? selected.filter((id) => id !== s.id)
                        : [...selected, s.id]
                      : [s.id],
                  )
                }
              >
                <span className="service-symbol">
                  {selected.includes(s.id) ? <Check /> : <Heart />}
                </span>
                <span className="service-copy">
                  <strong>{s.name}</strong>
                  <span className="duration">
                    <Clock size={14} />
                    {s.duration_minutes || 60} דקות
                  </span>
                </span>
                <span className="service-price native-price">₪{s.price}</span>
                <span
                  className={`choice-dot ${selected.includes(s.id) ? 'checked' : ''}`}
                />
              </button>
            ))}
          </div>
          {!visible.length && (
            <p className="empty-state">אין כרגע טיפולים זמינים לצוות שנבחר.</p>
          )}
          <button
            className="primary-button"
            disabled={!selected.length}
            onClick={() => setStep(2)}
          >
            בחירת יום ושעה
            <ArrowLeft size={18} />
          </button>
        </>
      )}
      {step === 2 && (
        <>
          <div className="month-label compact-date-label">
            <CalendarDays size={19} />
            {new Date(date + 'T12:00:00Z').toLocaleDateString('he-IL', {
              month: 'long',
              year: 'numeric',
            })}
            <input
              aria-label="בחירת תאריך"
              type="date"
              min={today}
              max={addDays(today, days - 1)}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <BookingCalendar
            date={date}
            min={today}
            max={addDays(today, days - 1)}
            onSelect={setDate}
          />
          <div className="day-strip compact-day-strip">
            {Array.from({ length: Math.min(days, 60) }, (_, i) =>
              addDays(today, i),
            ).map((d) => (
              <button
                className={date === d ? 'selected' : ''}
                key={d}
                onClick={() => setDate(d)}
              >
                <span>
                  {new Date(d + 'T12:00:00Z').toLocaleDateString('he-IL', {
                    weekday: 'short',
                  })}
                </span>
                <strong>{+d.slice(8)}</strong>
                <span className="day-dot" />
              </button>
            ))}
          </div>
          <div className="section-heading">
            <h2>שעות פנויות</h2>
            <span>
              {duration} דקות · {staffName}
            </span>
          </div>
          {loading ? (
            <p className="empty-state" role="status">
              בודקים שעות פנויות…
            </p>
          ) : (
            <div className="time-grid">
              {slots.map((t) => (
                <button
                  className={time === t ? 'selected' : ''}
                  key={t}
                  onClick={() => setTime(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          {!loading && !slots.length && !error && (
            <div className="empty-state">
              <Clock />
              <h3>אין שעות פנויות ביום הזה</h3>
              <p>אפשר לבחור יום אחר או להצטרף לרשימת ההמתנה.</p>
            </div>
          )}
          <button
            className="primary-button"
            disabled={!time || loading}
            onClick={() => setStep(3)}
          >
            המשך לאישור
            <ArrowLeft size={18} />
          </button>
          <button className="text-button" onClick={() => setWait(true)}>
            לא מצאת שעה? הצטרפות לרשימת המתנה
          </button>
        </>
      )}
      {step === 3 && (
        <>
          <div className="summary-card">
            <span className="summary-label">הטיפול שלך</span>
            <h2>{picked.map((s: any) => s.name).join(' + ')}</h2>
            <p>
              <UserRound size={19} />
              {staffName}
            </p>
            <p>
              <CalendarDays size={19} />
              {dateLabel(date)}
            </p>
            <p>
              <Clock size={19} />
              {time} · {duration} דקות
            </p>
            <div className="summary-total">
              <span>סך הכול לתשלום בעסק</span>
              <strong>₪{price}</strong>
            </div>
          </div>
          <p className="policy">
            ביטול אפשרי עד {profile.min_cancellation_hours || 0} שעות לפני התור.
          </p>
          {user &&
          profile.require_client_approval &&
          user.client_approved === false ? (
            <p className="error-note">החשבון ממתין לאישור העסק.</p>
          ) : (
            <button
              className="primary-button"
              disabled={busy}
              onClick={confirm}
            >
              {busy
                ? 'שומרים את התור…'
                : user
                  ? 'אישור וקביעת תור'
                  : 'התחברות ואישור התור'}
              <Check size={19} />
            </button>
          )}
        </>
      )}
      {error && (
        <p className="error-note" role="alert">
          {error}
        </p>
      )}
      <Dialog open={auth} onOpenChange={setAuth}>
        <DialogContent className="tori-dialog" dir="rtl">
          <DialogTitle>התחברות לעסק</DialogTitle>
          <DialogDescription>
            נזהה אותך כדי לשמור את התור על שמך.
          </DialogDescription>
          <AuthForm
            slug={slug}
            onDone={(u) => {
              onUser(u);
              setAuth(false);
            }}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={wait} onOpenChange={setWait}>
        <DialogContent className="tori-dialog" dir="rtl">
          <DialogTitle>
            {waitDone ? 'נוספת לרשימת ההמתנה' : 'נחפש לך מקום'}
          </DialogTitle>
          <DialogDescription>
            {waitDone
              ? 'העסק יוכל ליצור איתך קשר אם יתפנה תור.'
              : `בקשה לתאריך ${dateLabel(date)}`}
          </DialogDescription>
          {!waitDone && (
            <>
              <label>
                מתי נוח לך?
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                >
                  <option value="any">בכל שעה</option>
                  <option value="morning">בוקר</option>
                  <option value="afternoon">צהריים</option>
                  <option value="evening">ערב</option>
                </select>
              </label>
              <button
                className="primary-button"
                disabled={busy}
                onClick={joinWait}
              >
                {user ? 'הצטרפות לרשימה' : 'התחברות והצטרפות'}
              </button>
            </>
          )}
          {error && <p className="error-note">{error}</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
