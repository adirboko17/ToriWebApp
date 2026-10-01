'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  Clock,
  Hourglass,
  Images,
  MessageCircleMore,
  MessageSquareText,
  MessageSquareWarning,
  Phone,
  Plus,
  RefreshCw,
  ShoppingBag,
  UserRound,
  Users,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { api, dateLabel } from '@/lib/client';
import { israelNow, minutes } from '@/lib/availability';
import { phonesMatch } from '@/lib/phone';
import AuthForm from './auth-form';
import AdminSettings from './admin-settings';
import AdminBroadcast from './admin-broadcast';
import { CatalogSheet, WaitlistSheet } from './admin-sheets';
import AdminCalendar from './admin-calendar';
import AdminHours from './admin-hours';
import AdminAddAppointment from './admin-add-appointment';
import AdminClients from './admin-clients';
import AdminWeek from './admin-week';
import AdminNotifications, { type NotificationTarget } from './admin-notifications';
import AdminFinance from './admin-finance';
import { ProductCarousel, StoryCarousel } from './catalog-carousel';
function byDisplayOrder(items: any[]) {
  return [...items].sort(
    (a, b) =>
      (a.display_order ?? 999999) - (b.display_order ?? 999999) ||
      String(b.created_at).localeCompare(String(a.created_at)),
  );
}
function hebrewDate(date: string, options: Intl.DateTimeFormatOptions) {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('he-IL', {
    timeZone: 'UTC',
    ...options,
  });
}
export default function AdminPanel({
  slug,
  data,
  view,
  onUser,
}: {
  slug: string;
  data: any;
  view: string;
  onUser: (u: any) => void;
}) {
  const today = israelNow().date;
  const [date] = useState(today),
    [records, setRecords] = useState<any>(null),
    [version, setVersion] = useState(0),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState(''),
    [form, setForm] = useState<any>({}),
    [slots, setSlots] = useState<string[]>([]),
    [search, setSearch] = useState(''),
    [unread, setUnread] = useState(0),
    [broadcast, setBroadcast] = useState(false),
    [sms, setSms] = useState<any>(null),
    [smsDetails, setSmsDetails] = useState(false),
    [designs, setDesigns] = useState<any[] | null>(null),
    [products, setProducts] = useState<any[] | null>(null),
    [sheet, setSheet] = useState<'' | 'waitlist' | 'designs' | 'products'>(''),
    [adding, setAdding] = useState<string | null>(null),
    [focusDate, setFocusDate] = useState<string>(),
    [clients, setClients] = useState<'' | 'all' | 'pending'>('');
  const router = useRouter();
  function openTarget(target: NotificationTarget) {
    const home = `/${slug}/admin`;
    if (target.to === 'calendar') {
      if (target.date) setFocusDate(target.date);
      router.push(`${home}?v=calendar`);
      return;
    }
    router.push(home);
    if (target.to === 'pending') setClients('pending');
    if (target.to === 'waitlist') setSheet('waitlist');
  }
  function loadCatalog(kind: 'designs' | 'products') {
    return api(slug, kind === 'designs' ? 'gallery' : 'products')
      .then((r) => (kind === 'designs' ? setDesigns(r) : setProducts(r)))
      .catch(() => (kind === 'designs' ? setDesigns([]) : setProducts([])));
  }
  async function refresh() {
    try {
      setRecords(await api(slug, 'admin', undefined, { date: today, week: '0' }));
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    if (data.user?.user_type === 'admin') void refresh();
  }, [data.user?.id]);
  useEffect(() => {
    if (data.user?.user_type !== 'admin' || view !== 'home') return;
    let active = true;
    api(slug, 'notifications')
      .then((rows: any[]) => {
        if (active) setUnread(rows.filter((n) => !n.is_read).length);
      })
      .catch(() => {});
    api(slug, 'admin-sms')
      .then((r) => active && setSms(r))
      .catch(() => active && setSms({ ok: false }));
    void loadCatalog('designs');
    void loadCatalog('products');
    return () => {
      active = false;
    };
  }, [data.user?.id, view]);
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
      setVersion((v) => v + 1);
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
  const base = `/${slug}/admin`;
  const mine = (records?.appointments || []).filter(
    (r: any) =>
      r.status !== 'cancelled' &&
      (r.barber_id === data.user.id || r.user_id === data.user.id),
  );
  const nowMinute = israelNow().minute;
  const next = mine.find(
    (r: any) => r.slot_date === today && minutes(r.slot_time) > nowMinute,
  );
  const nextImage =
    next &&
    records?.clients.find((c: any) => phonesMatch(c.phone, next.client_phone))
      ?.image_url;
  const pendingClients = (records?.clients || []).filter(
    (c: any) => c.client_approved === false,
  ).length;
  const waitlist = records?.waitlist || [];
  const pageHead = (title: string, back?: boolean) => (
    <div className="admin-page-head">
      {back && (
        <Link className="admin-back" href={base} aria-label="חזרה לבית">
          <ArrowRight size={20} />
        </Link>
      )}
      <h1>{title}</h1>
    </div>
  );
  return (
    <div className={`admin-view admin-view-${view}`}>
      {error && (
        <p className="error-note" role="alert">
          {error}
        </p>
      )}
      {view === 'settings' ? (
        <AdminSettings slug={slug} />
      ) : view === 'calendar' ? (
        <AdminCalendar slug={slug} userId={data.user.id} version={version} focusDate={focusDate} onBook={setAdding} />
      ) : view === 'hours' ? (
        <AdminHours slug={slug} userId={data.user.id} />
      ) : view === 'notifications' ? (
        <AdminNotifications slug={slug} onOpen={openTarget} />
      ) : view === 'finance' ? (
        <AdminFinance slug={slug} />
      ) : !records ? (
        <div className="empty-state" role="status">
          <div className="loading-ring" />
          <p>טוענים את העסק…</p>
        </div>
      ) : (
        <>
          {view === 'home' && (
            <div className="admin-home">
              <Link className="admin-today" href={`${base}?v=calendar`}>
                <div>
                  <span>{hebrewDate(today, { weekday: 'long' })}</span>
                  <strong>
                    {hebrewDate(today, { day: 'numeric', month: 'short' })}
                  </strong>
                </div>
                <div className="admin-today-count">
                  <strong>{mine.length}</strong>
                  <span>תורים</span>
                </div>
              </Link>
              <section className="admin-card">
                <div className="admin-card-head">
                  <span className="tile-icon">
                    <Clock size={15} />
                  </span>
                  <h2>התור הבא</h2>
                  <button
                    type="button"
                    className="admin-refresh"
                    aria-label="רענון"
                    onClick={() => void refresh()}
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
                {next ? (
                  <Link className="admin-next" href={`${base}?v=calendar`}>
                    <span className="admin-avatar">
                      {nextImage ? (
                        <img src={nextImage} alt="" />
                      ) : (
                        <span>
                          <UserRound size={24} />
                        </span>
                      )}
                    </span>
                    <div className="admin-next-info">
                      <strong>{next.client_name || 'לקוח'}</strong>
                      {next.service_name && (
                        <span className="admin-pill">{next.service_name}</span>
                      )}
                    </div>
                    <i className="admin-divider" />
                    <b>{next.slot_time.slice(0, 5)}</b>
                  </Link>
                ) : (
                  <p className="admin-empty">
                    <CalendarDays size={20} />
                    אין תורים קרובים היום
                  </p>
                )}
              </section>
              <div className="admin-tiles">
                <button type="button" onClick={() => setClients('all')}>
                  <span>
                    <Users size={24} />
                    {pendingClients > 0 && (
                      <em>{pendingClients > 99 ? '99+' : pendingClients}</em>
                    )}
                  </span>
                  <strong>לקוחות</strong>
                </button>
                <button type="button" onClick={() => setBroadcast(true)}>
                  <span>
                    <MessageCircleMore size={24} />
                  </span>
                  <strong>הודעת שידור</strong>
                </button>
                <Link href={`${base}?v=notifications`}>
                  <span>
                    <Bell size={24} />
                    {unread > 0 && (
                      <em className="is-light">{unread > 99 ? '99+' : unread}</em>
                    )}
                  </span>
                  <strong>התראות</strong>
                </Link>
              </div>
              <button
                type="button"
                className="admin-card admin-card-button"
                onClick={() => setSheet('waitlist')}
              >
                <div className="admin-card-head">
                  <span className="tile-icon">
                    <Hourglass size={15} />
                  </span>
                  <h2>רשימת המתנה</h2>
                  <ChevronLeft size={15} className="admin-card-caret" />
                </div>
                {waitlist.length ? (
                  <div className="admin-waitlist-body">
                    <div>
                      <ul className="admin-waitlist-names">
                        {waitlist.slice(0, 3).map((r: any) => (
                          <li key={r.id}>
                            <i>{String(r.client_name || '?').trim().charAt(0)}</i>
                            {r.client_name}
                          </li>
                        ))}
                      </ul>
                      <span className="admin-chip">
                        צפייה ברשימה
                        <ChevronLeft size={15} />
                      </span>
                    </div>
                    <i className="admin-divider" />
                    <div className="admin-count">
                      <strong>{waitlist.length}</strong>
                      <span>ממתינים</span>
                    </div>
                  </div>
                ) : (
                  <p className="admin-empty">
                    <Hourglass size={20} />
                    אין ממתינים כרגע
                  </p>
                )}
              </button>
              {!sms ? (
                <div className="admin-card admin-sms is-loading" role="status">
                  <div className="loading-ring" />
                  <span>טוען יתרת SMS…</span>
                </div>
              ) : sms.ok ? (
                <section className="admin-card admin-sms">
                  <div className="admin-sms-top">
                    <span className="admin-sms-icon">
                      <MessageSquareText size={22} />
                    </span>
                    <div className="admin-sms-copy">
                      <strong>יתרת הודעות SMS</strong>
                      <span>סה״כ הודעות זמינות</span>
                    </div>
                    <div className="admin-count">
                      <strong>{sms.total.toLocaleString('he-IL')}</strong>
                      <span>הודעות</span>
                    </div>
                  </div>
                  <a
                    className="admin-sms-topup"
                    href={sms.topupUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <i>
                      <Plus size={15} strokeWidth={2.8} />
                    </i>
                    הוספת הודעות
                  </a>
                  <button
                    type="button"
                    className="admin-sms-toggle"
                    aria-expanded={smsDetails}
                    onClick={() => setSmsDetails(!smsDetails)}
                  >
                    {smsDetails ? 'הסתר פרטים' : 'הצג פרטים'}
                    <ChevronDown size={16} />
                  </button>
                  {smsDetails && (
                    <div className="admin-sms-details">
                      <div>
                        <span>
                          <strong>נותרו מהחבילה</strong>
                          <small>{sms.resetHint}</small>
                        </span>
                        <b>{sms.packageLeft.toLocaleString('he-IL')}</b>
                      </div>
                      <div>
                        <span>
                          <strong>הודעות שנקנו</strong>
                          <small>נשארות גם אחרי האיפוס</small>
                        </span>
                        <b>{sms.prepaid.toLocaleString('he-IL')}</b>
                      </div>
                    </div>
                  )}
                </section>
              ) : (
                <div className="admin-card admin-sms">
                  <div className="admin-sms-top">
                    <span className="admin-sms-icon">
                      <MessageSquareWarning size={22} />
                    </span>
                    <div className="admin-sms-copy">
                      <strong>יתרת הודעות SMS</strong>
                      <span>לא ניתן לטעון את היתרה כרגע.</span>
                    </div>
                  </div>
                </div>
              )}
              <AdminWeek slug={slug} key={version} />
              <div className="admin-preview-stack">
              {(
                [
                  {
                    kind: 'designs' as const,
                    title: 'גלריה',
                    Icon: Images,
                    items: designs,
                    empty: 'עדיין אין תמונות בגלריה',
                    cta: 'הוספת תמונות לגלריה',
                  },
                  {
                    kind: 'products' as const,
                    title: 'מוצרים',
                    Icon: ShoppingBag,
                    items: products,
                    empty: 'עדיין אין מוצרים בחנות',
                    cta: 'הוספת מוצר',
                  },
                ] as const
              ).map(({ kind, title, Icon, items, empty, cta }) => (
                <section className="admin-card admin-preview" key={kind}>
                  <button type="button" className="admin-preview-head" onClick={() => setSheet(kind)}>
                    <span className="tile-icon">
                      <Icon size={16} />
                    </span>
                    <h2>{title}</h2>
                    {!!items?.length && <em>{items.length}</em>}
                    <span className="admin-preview-caret">
                      <ChevronLeft size={16} />
                    </span>
                  </button>
                  {!items ? (
                    <div className="admin-preview-loading">
                      <div className="loading-ring" />
                    </div>
                  ) : !items.length ? (
                    <button type="button" className="admin-preview-empty" onClick={() => setSheet(kind)}>
                      <Icon size={20} />
                      <span>{empty}</span>
                      <b>
                        {cta}
                        <ChevronLeft size={14} />
                      </b>
                    </button>
                  ) : kind === 'designs' ? (
                    <StoryCarousel
                      items={byDisplayOrder(items)}
                      people={[...(data.staff || []), data.user]}
                      dots
                      onOpen={() => setSheet(kind)}
                    />
                  ) : (
                    <ProductCarousel items={byDisplayOrder(items)} dots onOpen={() => setSheet(kind)} />
                  )}
                </section>
              ))}
              </div>
              <WaitlistSheet
                slug={slug}
                open={sheet === 'waitlist'}
                onClose={() => setSheet('')}
                entries={waitlist}
                clients={records.clients}
                onBook={(r) => {
                  setForm({
                    date: r.requested_date,
                    worker: r.user_id || data.user.id,
                    clientName: r.client_name,
                    clientPhone: r.client_phone,
                    waitlistId: r.id,
                  });
                  setModal('book');
                }}
                onChanged={() => void refresh()}
              />
              {(['designs', 'products'] as const).map((kind) => (
                <CatalogSheet
                  key={kind}
                  slug={slug}
                  kind={kind}
                  open={sheet === kind}
                  onClose={() => setSheet('')}
                  items={(kind === 'designs' ? designs : products) || []}
                  onChanged={() => void loadCatalog(kind)}
                />
              ))}
            </div>
          )}
          {view === 'waitlist' && (
            <>
              {pageHead('רשימת המתנה', true)}
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
        </>
      )}
      <Dialog open={!!modal} onOpenChange={(v) => !v && setModal('')}>
        <DialogContent className="tori-dialog" dir="rtl">
          <DialogTitle>הוספת תור</DialogTitle>
          <DialogDescription>הפרטים נשמרים גם באפליקציה של העסק.</DialogDescription>
          <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (await mutation('book', { ...form, services: [form.service] })) setModal('');
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
              ) : null}
              <button className="primary-button" disabled={busy}>
                {busy ? 'שומרים…' : 'שמירה'}
              </button>
            </form>
          {error && (
            <p role="alert" className="error-note">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
      <AdminBroadcast
        slug={slug}
        icon={data.profile?.icon_url}
        open={broadcast}
        onOpenChange={setBroadcast}
      />
      <AdminAddAppointment
        slug={slug}
        userId={data.user.id}
        open={!!adding}
        initialDate={adding || undefined}
        clients={records?.clients || []}
        services={data.services.filter((s: any) => !s.worker_id || s.worker_id === data.user.id)}
        multi={data.profile?.allow_multi_service_booking === true}
        onClose={() => setAdding(null)}
        onBooked={(bookedDate) => {
          setAdding(null);
          setFocusDate(bookedDate);
          setVersion((v) => v + 1);
          void refresh();
        }}
      />
      <AdminClients
        slug={slug}
        open={!!clients}
        initialMode={clients === 'pending' ? 'pending' : 'all'}
        onClose={() => setClients('')}
        onChanged={() => void refresh()}
      />
    </div>
  );
}
