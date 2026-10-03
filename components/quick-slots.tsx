'use client';
import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Clock3, User, Zap } from 'lucide-react';
import BottomSheet from './bottom-sheet';
import { api } from '@/lib/client';

const LIMIT = 10;

function uniqueServices(services: any[]) {
  const seen = new Set<string>();
  const rows = [];
  for (const service of services) {
    const key = String(service?.name || '').trim().toLowerCase();
    if (!key || seen.has(key) || service.is_active === false) continue;
    seen.add(key);
    rows.push(service);
  }
  return rows;
}

function slotDate(date: string) {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

export default function QuickSlots({
  slug,
  services,
  multi,
  open,
  onClose,
  onBooked,
  preview = false,
}: {
  slug: string;
  services: any[];
  multi: boolean;
  open: boolean;
  onClose: () => void;
  onBooked: () => void;
  preview?: boolean;
}) {
  const list = useMemo(() => uniqueServices(services), [services]);
  const [step, setStep] = useState<'service' | 'time' | 'done'>('service');
  const [picked, setPicked] = useState<string[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setStep('service');
    setPicked([]);
    setSlots([]);
    setLoading(false);
    setPending(null);
    setBusy(false);
    setError('');
  }

  async function load(ids: string[]) {
    setError('');
    setPending(null);
    setSlots([]);
    setLoading(true);
    setStep('time');
    try {
      const result = await api(slug, 'quick-slots', undefined, { services: ids.join(',') });
      setSlots(result.slots || []);
    } catch (e: any) {
      setError(e.message || 'לא ניתן לטעון תורים');
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }

  function choose(service: any) {
    if (!multi) {
      setPicked([service.id]);
      void load([service.id]);
      return;
    }
    setPicked((ids) =>
      ids.includes(service.id) ? ids.filter((id) => id !== service.id) : [...ids, service.id],
    );
  }

  async function confirm() {
    if (!pending || busy) return;
    if (preview) {
      onClose();
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api(slug, 'book', {
        worker: pending.worker,
        services: pending.services,
        date: pending.date,
        time: pending.time,
      });
      setStep('done');
      onBooked();
    } catch (e: any) {
      setError(e.message || 'השעה כבר אינה פנויה. בחרו שעה אחרת.');
      void load(picked);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      size={step === 'time' ? 'medium' : 'tall'}
      locked={busy}
      className="qs-sheet"
    >
      <div className="qs-lava" aria-hidden>
        <i />
        <i />
        <i />
      </div>
      <div className="sheet-scroll qs-body">
        {step === 'done' ? (
          <div className="qs-done">
            <strong>התור נקבע</strong>
            <button
              type="button"
              className="qs-confirm"
              onClick={() => {
                reset();
                onClose();
              }}
            >
              סגור
            </button>
          </div>
        ) : step === 'service' ? (
          <>
            <div className="qs-hero">
              {preview && <p className="qs-preview-note">תצוגה מקדימה · התור לא יישמר</p>}
              <span>
                <Zap size={13} strokeWidth={2.4} />
                {LIMIT} פנויים
              </span>
              <h2>
                הכי קרוב <em>אליך</em>
              </h2>
              <p>בחרו שירות ונתחיל</p>
            </div>
            {list.length === 0 ? (
              <p className="qs-empty">אין שירותים זמינים</p>
            ) : (
              <div className="qs-list">
                <div className="qs-list-scroll">
                {list.map((service, index) => {
                  const on = picked.includes(service.id);
                  const price = Number(service.price || 0);
                  const duration = service.duration_minutes || 60;
                  return (
                    <div key={service.id}>
                      <button
                        type="button"
                        className={`qs-row${on ? ' is-on' : ''}`}
                        aria-pressed={on}
                        onClick={() => choose(service)}
                      >
                        <span className="qs-clock" aria-hidden>
                          {on ? <Check size={20} strokeWidth={2.4} /> : <Clock3 size={18} strokeWidth={2.2} />}
                        </span>
                        <span className="qs-mid">
                          <strong>{service.name}</strong>
                          <small>{duration} דק׳</small>
                        </span>
                        <span className="qs-price">{price > 0 ? `₪${price}` : '-'}</span>
                      </button>
                      {index < list.length - 1 && <i className="qs-dash" />}
                    </div>
                  );
                })}
                </div>
              </div>
            )}
            {multi && picked.length > 0 && (
              <button type="button" className="qs-continue" onClick={() => void load(picked)}>
                המשך
                <ChevronLeft size={17} strokeWidth={2.2} />
              </button>
            )}
          </>
        ) : (
          <>
            <div className="qs-time-hero">
              <button
                type="button"
                className="qs-back"
                aria-label="חזרה"
                onClick={() => {
                  setStep('service');
                  setPending(null);
                  setError('');
                }}
              >
                <ChevronRight size={20} />
              </button>
              <h2>התורים הקרובים</h2>
              <p>{LIMIT} התורים הפנויים הקרובים ביותר</p>
            </div>
            {loading ? (
              <p className="qs-empty">טוען תורים…</p>
            ) : slots.length === 0 ? (
              <p className="qs-empty">אין תורים זמינים בקרוב</p>
            ) : (
              <div className="qs-slots">
                {slots.map((slot) => {
                  const on =
                    pending?.date === slot.date &&
                    pending?.time === slot.time &&
                    pending?.worker === slot.worker;
                  return (
                    <button
                      type="button"
                      key={`${slot.date}-${slot.time}-${slot.worker}`}
                      className={`qs-slot ch-next${on ? ' is-on' : ''}`}
                      aria-pressed={on}
                      onClick={() => setPending(slot)}
                    >
                      <span className="ch-card-head">
                        <span className="ch-next-date">{slotDate(slot.date)}</span>
                        <span className="ch-next-label">תור פנוי</span>
                      </span>
                      <span className="ch-next-body">
                        <span className="ch-avatar">
                          {slot.worker_image ? (
                            <img src={slot.worker_image} alt="" />
                          ) : (
                            <User size={22} />
                          )}
                        </span>
                        <span className="ch-next-copy">
                          <strong>{slot.service_name}</strong>
                          {slot.worker_name && <small>{slot.worker_name}</small>}
                        </span>
                        <i className="ch-hairline" />
                        <b className="ch-next-time">{String(slot.time).slice(0, 5)}</b>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {error && (
              <p role="alert" className="qs-error">
                {error}
              </p>
            )}
            {pending && (
              <button type="button" className="qs-confirm" disabled={busy} onClick={() => void confirm()}>
                {busy ? 'רק רגע…' : preview ? 'סגירת תצוגה' : 'אישור התור'}
              </button>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  );
}
