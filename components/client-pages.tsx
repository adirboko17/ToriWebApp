'use client';
import { useEffect, useState } from 'react';
import {
  CalendarDays,
  Clock,
  ArrowLeft,
  Bell,
  UserRound,
  LogOut,
  Plus,
  Images,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { api, dateLabel, downloadCalendar, usePreferences } from '@/lib/client';
import { israelNow } from '@/lib/availability';
import AuthForm from './auth-form';
export default function ClientPages({
  slug,
  screen,
  data,
  onUser,
}: {
  slug: string;
  screen: string;
  data: any;
  onUser: (u: any) => void;
}) {
  const [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [tab, setTab] = useState('upcoming'),
    [lightbox, setLightbox] = useState<any>(null),
    [cancel, setCancel] = useState<any>(null),
    [swap, setSwap] = useState<any>(null),
    [swapDates, setSwapDates] = useState<string[]>([]),
    [swapDate, setSwapDate] = useState(israelNow().date),
    [swapFrom, setSwapFrom] = useState('09:00'),
    [swapUntil, setSwapUntil] = useState('18:00'),
    [swapSaved, setSwapSaved] = useState(false),
    [name, setName] = useState(data.user?.name || ''),
    [birth, setBirth] = useState(data.user?.birth_date || ''),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false),
    [category, setCategory] = useState('הכול');
  const { language, setLanguage } = usePreferences();
  const publicScreen = ['gallery', 'products'].includes(screen);
  async function refresh() {
    setLoading(true);
    setError('');
    try {
      if (screen !== 'profile') setRows(await api(slug, screen));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, [slug, screen, data.user?.id]);
  useEffect(() => {
    setName(data.user?.name || '');
    setBirth(data.user?.birth_date || '');
  }, [data.user?.id]);
  if (!publicScreen && !data.user)
    return (
      <AuthForm
        slug={slug}
        onDone={(u) => {
          onUser(u);
          if (u.user_type === 'admin') location.assign(`/b/${slug}/admin`);
        }}
      />
    );
  if (
    data.user?.client_approved === false &&
    data.profile.require_client_approval &&
    data.user.user_type === 'client'
  )
    return (
      <div className="empty-state">
        <Clock />
        <h1>ממתינים לאישור העסק</h1>
        <p>ההרשמה הושלמה. אפשר יהיה לקבוע תור לאחר אישור החשבון.</p>
        <button className="primary-button" onClick={() => location.reload()}>
          בדיקת סטטוס
        </button>
      </div>
    );
  const titles: Record<string, string> = {
    appointments: 'התורים שלי',
    gallery: 'קצת מהעבודות שלנו',
    products: 'הבחירות שלנו',
    profile: 'הפרופיל שלי',
    notifications: 'העדכונים שלך',
    waitlist: 'רשימת ההמתנה שלי',
  };
  const statusNames: Record<string, string> = {
    confirmed: 'מאושר',
    completed: 'בוצע',
    cancelled: 'בוטל',
    no_show: 'לא הגיע',
    pending: 'ממתין',
    waiting: 'ממתין',
    booked: 'שובץ',
    contacted: 'נוצר קשר',
  };
  const now = israelNow();
  const upcoming = (r: any) =>
    ['confirmed', 'pending'].includes(r.status) &&
    (r.slot_date > now.date ||
      (r.slot_date === now.date &&
        r.slot_time.slice(0, 5) >=
          `${String(Math.floor(now.minute / 60)).padStart(2, '0')}:${String(now.minute % 60).padStart(2, '0')}`));
  return (
    <>
      <span className="eyebrow">{data.profile.display_name || 'הזמן שלך'}</span>
      <h1>{titles[screen] || 'העמוד לא נמצא'}</h1>
      {screen === 'appointments' && (
        <>
          <div className="segmented">
            <button
              className={tab === 'upcoming' ? 'selected' : ''}
              onClick={() => setTab('upcoming')}
            >
              תורים קרובים
            </button>
            <button
              className={tab === 'history' ? 'selected' : ''}
              onClick={() => setTab('history')}
            >
              היסטוריה
            </button>
          </div>
          {!loading &&
            rows.filter((r) => upcoming(r) === (tab === 'upcoming')).length ===
              0 && (
              <div className="empty-state">
                <CalendarDays size={36} />
                <h2>
                  {tab === 'upcoming'
                    ? 'עדיין אין תור ביומן'
                    : 'אין תורים קודמים'}
                </h2>
                <p>נמצא לך זמן שמתאים בדיוק לך.</p>
                <a className="primary-button" href={`/b/${slug}/book`}>
                  קביעת תור
                  <ArrowLeft size={18} />
                </a>
              </div>
            )}
          {rows
            .filter((r) => upcoming(r) === (tab === 'upcoming'))
            .map((r) => (
              <article className="summary-card" key={r.id}>
                <span className="badge">{statusNames[r.status]}</span>
                <h2>{r.service_name}</h2>
                <p>
                  <CalendarDays size={18} />
                  {dateLabel(r.slot_date)}
                </p>
                <p>
                  <Clock size={18} />
                  {r.slot_time.slice(0, 5)} · {r.duration_minutes} דקות
                </p>
                {upcoming(r) && (
                  <div className="row-actions">
                    <button
                      className="text-button"
                      onClick={() => downloadCalendar(r)}
                    >
                      הוספה ליומן
                    </button>
                    <button
                      className="text-button danger"
                      onClick={() => setCancel(r)}
                    >
                      ביטול תור
                    </button>
                    {data.profile.client_swap_enabled !== false && (
                      <button
                        className="text-button"
                        onClick={() => {
                          setSwap(r);
                          setSwapSaved(false);
                          setSwapDates([]);
                        }}
                      >
                        בקשת החלפה
                      </button>
                    )}
                  </div>
                )}
              </article>
            ))}
          <a className="text-button" href={`/b/${slug}/waitlist`}>
            הבקשות שלי ברשימת ההמתנה
          </a>
        </>
      )}
      {screen === 'gallery' && (
        <>
          <p className="intro">הפרטים הקטנים שעושים את ההבדל.</p>
          <div className="filter-strip">
            {['הכול', ...new Set(rows.flatMap((r) => r.categories || []))].map(
              (c: any) => (
                <button
                  className={category === c ? 'selected' : ''}
                  key={c}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ),
            )}
          </div>
          <div className="gallery-grid">
            {rows
              .filter(
                (r) => category === 'הכול' || r.categories?.includes(category),
              )
              .map((r) => (
                <button key={r.id} onClick={() => setLightbox(r)}>
                  <img
                    src={r.image_urls?.[0] || r.image_url}
                    alt={r.name}
                    loading="lazy"
                  />
                  <span>{r.name}</span>
                </button>
              ))}
          </div>
          {!loading && !rows.length && (
            <div className="empty-state">
              <Images />
              <p>עבודות חדשות יופיעו כאן בקרוב.</p>
            </div>
          )}
        </>
      )}
      {screen === 'products' && (
        <div className="gallery-grid">
          {rows.map((r) => (
            <article className="product-card" key={r.id}>
              {r.image_url && <img src={r.image_url} alt={r.name} />}
              <h2>{r.name}</h2>
              <p>{r.description}</p>
              <strong>₪{r.price}</strong>
            </article>
          ))}
          {!loading && !rows.length && (
            <p className="empty-state">אין כרגע מוצרים בקטלוג.</p>
          )}
        </div>
      )}
      {screen === 'notifications' && (
        <>
          {rows.map((r) => (
            <article className="summary-card" key={r.id}>
              <Bell size={18} />
              <h2>{r.title}</h2>
              <p>{r.content}</p>
              <small>
                {new Date(r.created_at).toLocaleDateString('he-IL')}
              </small>
            </article>
          ))}
          {!loading && !rows.length && (
            <p className="empty-state">אין עדכונים חדשים.</p>
          )}
        </>
      )}
      {screen === 'waitlist' && (
        <>
          {rows.map((r) => (
            <article className="summary-card" key={r.id}>
              <span className="badge">{statusNames[r.status]}</span>
              <h2>{r.service_name}</h2>
              <p>
                {dateLabel(r.requested_date)} ·{' '}
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
              {r.status === 'waiting' && (
                <button
                  className="text-button danger"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api(slug, 'waitlist', { remove: r.id });
                      await refresh();
                    } catch (e: any) {
                      setError(e.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  ביטול הבקשה
                </button>
              )}
            </article>
          ))}
          {!loading && !rows.length && (
            <p className="empty-state">אין לך בקשות פעילות ברשימת ההמתנה.</p>
          )}
        </>
      )}
      {screen === 'profile' && (
        <>
          <div className="profile-avatar">
            {data.user.image_url ? (
              <img src={data.user.image_url} alt="" />
            ) : (
              <UserRound size={38} />
            )}
          </div>
          <label className="upload-label">
            החלפת תמונת פרופיל
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBusy(true);
                setError('');
                try {
                  const form = new FormData();
                  form.append('image', file);
                  const response = await fetch(`/api/b/${slug}/avatar`, {
                    method: 'POST',
                    body: form,
                  });
                  const updated: any = await response.json();
                  if (!response.ok) throw new Error(updated.error);
                  onUser(updated);
                } catch (e: any) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              setSaved(false);
              try {
                const u = await api(slug, 'profile', {
                  name,
                  birth_date: birth,
                  language,
                });
                onUser(u);
                setSaved(true);
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              שם מלא
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
              />
            </label>
            <label>
              מספר טלפון
              <input value={data.user.phone} readOnly dir="ltr" />
            </label>
            <label>
              תאריך לידה
              <input
                type="date"
                value={birth}
                max={now.date}
                onChange={(e) => setBirth(e.target.value)}
              />
            </label>
            <label>
              שפה
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="he">עברית</option>
                <option value="en">English</option>
              </select>
            </label>
            <button className="primary-button" disabled={busy}>
              שמירת הפרטים
            </button>
            {saved && (
              <p role="status" className="success-note">
                הפרטים נשמרו
              </p>
            )}
          </form>
          <a className="menu-row" href={`/b/${slug}/notifications`}>
            <Bell size={20} />
            ההתראות שלי
            <ArrowLeft size={18} />
          </a>
          <a className="menu-row" href={`/b/${slug}/waitlist`}>
            <Clock size={20} />
            רשימת ההמתנה
            <ArrowLeft size={18} />
          </a>
          {data.user.user_type === 'admin' && (
            <a className="menu-row" href={`/b/${slug}/admin`}>
              כניסה לניהול העסק
              <ArrowLeft size={18} />
            </a>
          )}
          <button
            className="text-button danger"
            onClick={async () => {
              await api(slug, 'logout', {});
              onUser(null);
              location.assign(`/b/${slug}`);
            }}
          >
            <LogOut size={17} />
            התנתקות
          </button>
        </>
      )}
      {loading && screen !== 'profile' && (
        <p className="empty-state" role="status">
          טוענים…
        </p>
      )}
      {error && (
        <p className="error-note" role="alert">
          {error}
        </p>
      )}
      <Dialog open={!!swap} onOpenChange={(v) => !v && setSwap(null)}>
        <DialogContent className="tori-dialog" dir="rtl">
          <DialogTitle>
            {swapSaved ? 'בקשת ההחלפה נשמרה' : 'בקשת החלפת תור'}
          </DialogTitle>
          <DialogDescription>
            {swapSaved
              ? 'התור הנוכחי נשאר שמור עד להשלמת החלפה באפליקציה.'
              : 'הבקשה מיועדת להחלפת תור לאותו טיפול. התור הקיים נשאר שמור.'}
          </DialogDescription>
          {!swapSaved && (
            <>
              <label>
                תאריך מועדף
                <input
                  type="date"
                  min={now.date}
                  value={swapDate}
                  onChange={(e) => setSwapDate(e.target.value)}
                />
              </label>
              <button
                className="secondary-button"
                onClick={() =>
                  setSwapDates([...new Set([...swapDates, swapDate])])
                }
              >
                הוספת תאריך
                <Plus size={16} />
              </button>
              <div className="filter-strip">
                {swapDates.map((d) => (
                  <button
                    key={d}
                    onClick={() =>
                      setSwapDates(swapDates.filter((v) => v !== d))
                    }
                  >
                    {d} ×
                  </button>
                ))}
              </div>
              <div className="form-pair">
                <label>
                  משעה
                  <input
                    type="time"
                    value={swapFrom}
                    onChange={(e) => setSwapFrom(e.target.value)}
                  />
                </label>
                <label>
                  עד שעה
                  <input
                    type="time"
                    value={swapUntil}
                    onChange={(e) => setSwapUntil(e.target.value)}
                  />
                </label>
              </div>
              <button
                className="primary-button"
                disabled={busy || !swapDates.length}
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  try {
                    await api(slug, 'swap', {
                      id: swap.id,
                      dates: swapDates,
                      from: swapFrom,
                      until: swapUntil,
                    });
                    setSwapSaved(true);
                  } catch (e: any) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                שמירת בקשת החלפה
              </button>
            </>
          )}
          {error && <p className="error-note">{error}</p>}
        </DialogContent>
      </Dialog>
      <Dialog open={!!cancel} onOpenChange={(v) => !v && setCancel(null)}>
        <DialogContent className="tori-dialog" dir="rtl">
          <DialogTitle>לבטל את התור?</DialogTitle>
          <DialogDescription>
            {cancel?.service_name} · {cancel && dateLabel(cancel.slot_date)} ·{' '}
            {cancel?.slot_time.slice(0, 5)}
          </DialogDescription>
          <p>לאחר הביטול השעה תהיה זמינה להזמנה ללקוחות אחרים.</p>
          <button
            className="primary-button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                const r = await api(slug, 'cancel', { id: cancel.id });
                setCancel(null);
                await refresh();
                if (r.warning) setError(r.warning);
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            כן, לבטל את התור
          </button>
          <button className="text-button" onClick={() => setCancel(null)}>
            להשאיר את התור
          </button>
          {error && <p className="error-note">{error}</p>}
        </DialogContent>
      </Dialog>
      <Dialog open={!!lightbox} onOpenChange={(v) => !v && setLightbox(null)}>
        <DialogContent className="tori-dialog lightbox" dir="rtl">
          <DialogTitle>{lightbox?.name}</DialogTitle>
          <DialogDescription>
            {lightbox?.description || 'גלריית עבודות'}
          </DialogDescription>
          {(lightbox?.image_urls?.length
            ? lightbox.image_urls
            : [lightbox?.image_url]
          )
            .filter(Boolean)
            .map((src: string) => (
              <img src={src} alt={lightbox?.name || ''} key={src} />
            ))}
        </DialogContent>
      </Dialog>
    </>
  );
}
