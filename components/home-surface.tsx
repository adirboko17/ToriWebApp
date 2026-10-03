'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  ArrowLeftRight,
  CloudSun,
  Clock,
  Mail,
  MapPin,
  Megaphone,
  Moon,
  ChevronLeft,
  Plus,
  Sun,
  User,
  X,
  Zap,
} from 'lucide-react';
import { ProductCarousel, StoryCarousel } from './catalog-carousel';
import { GalleryStory, ProductDetail } from './client-viewers';
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon, whatsappLink } from './brand-icons';
import BrandImage from './brand-image';
import { api } from '@/lib/client';
import QuickSlots from './quick-slots';
import { businessLogos } from '@/lib/branding';
import { israelNow, addDays } from '@/lib/availability';
import { isUpcoming, cancelLocked, hebrewDay } from '@/lib/client-appointments';

export type HomeActions = {
  openAppointments: () => void;
  cancel: (appointment: any) => void;
  swap: (appointment: any) => void;
};

const periods: Record<string, { label: string; Icon: any; color?: string }> = {
  morning: { label: 'בוקר', Icon: Sun, color: '#F5A623' },
  afternoon: { label: 'צהריים', Icon: CloudSun },
  evening: { label: 'ערב', Icon: Moon },
  any: { label: 'כל זמן', Icon: Clock },
};

function FixedMessage({ text }: { text: string }) {
  const key = `tori-fixed-message:${text}`;
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const drag = useRef<{ y: number; t: number; moved: boolean } | null>(null);
  const pulled = useRef(false);
  const leavingRef = useRef(false);
  useEffect(() => {
    if (!sessionStorage.getItem(key)) setOpen(true);
  }, [key]);
  const close = () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    sessionStorage.setItem(key, '1');
    setLeaving(true);
    setDragging(false);
    setShift(-Math.max(480, window.innerHeight));
    window.setTimeout(() => setOpen(false), 260);
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (leaving) return;
    drag.current = { y: e.clientY, t: performance.now(), moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const start = drag.current;
    if (!start || leaving) return;
    const dy = e.clientY - start.y;
    if (dy < -8) start.moved = true;
    if (!start.moved) return;
    setDragging(true);
    setShift(Math.min(0, dy));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = drag.current;
    drag.current = null;
    if (!start?.moved) {
      setDragging(false);
      return;
    }
    pulled.current = true;
    const dy = e.clientY - start.y;
    const velocity = (dy / Math.max(1, performance.now() - start.t)) * 1000;
    if (dy < -48 || velocity < -580) close();
    else {
      setShift(0);
      setDragging(false);
    }
  };
  if (!open) return null;
  const lines = text.trim().split('\n');
  const first = lines.findIndex((l) => l.trim());
  const rich = (line: string) =>
    line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((part, i) =>
      /^\*{1,2}[^*]+\*{1,2}$/.test(part) ? <b key={i}>{part.replace(/\*/g, '')}</b> : part,
    );
  return createPortal(
    <div className="ch-fixed" dir="rtl">
      <button type="button" className="ch-fixed-backdrop" aria-label="סגירה" onClick={close} />
      <div
        className={`ch-fixed-sheet${dragging ? ' is-dragging' : ''}${leaving ? ' is-leaving' : ''}`}
        style={{
          transform: shift ? `translateY(${shift}px)` : undefined,
          transition: dragging ? 'none' : 'transform 240ms ease',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="הודעה חשובה"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
          setShift(0);
          setDragging(false);
        }}
      >
        <div className="ch-fixed-head">
          <span>
            <Megaphone size={19} />
          </span>
          <h2>הודעה חשובה</h2>
        </div>
        <div className="ch-fixed-body">
          {lines.map((line, i) =>
            !line.trim() ? (
              <i key={i} />
            ) : (
              <p key={i} className={i === first ? 'is-title' : ''}>
                {rich(line)}
              </p>
            ),
          )}
        </div>
        <button
          type="button"
          className="ch-fixed-handle"
          aria-label="גררו למעלה על הפס כדי לסגור"
          onClick={() => {
            if (pulled.current) {
              pulled.current = false;
              return;
            }
            close();
          }}
        >
          <span />
        </button>
      </div>
    </div>,
    document.body,
  );
}

function WeekMeter({
  slug,
  staff,
  disabled,
  bookHref,
}: {
  slug: string;
  staff: any[];
  disabled: boolean;
  bookHref: (worker: string, date: string) => string;
}) {
  const [worker, setWorker] = useState(staff[0]?.id || '');
  const [days, setDays] = useState<Record<string, number> | null>(null);
  const today = israelNow().date;
  useEffect(() => {
    if (!worker) return;
    let active = true;
    setDays(null);
    api(slug, 'week', undefined, { worker })
      .then((r) => active && setDays(r.days || {}))
      .catch(() => active && setDays({}));
    return () => {
      active = false;
    };
  }, [slug, worker]);
  const dates = Array.from({ length: 6 }, (_, i) => addDays(today, i));
  const max = Math.max(1, ...dates.map((d) => days?.[d] || 0));
  return (
    <section className={`ch-meter${disabled ? ' is-disabled' : ''}`}>
      <h2>מד זמינות תורים</h2>
      {staff.length > 1 && (
        <>
          <p>בחרו איש צוות לצפייה בזמינות</p>
          <div className="ch-meter-staff">
            {staff.map((s) => (
              <button
                type="button"
                key={s.id}
                className={s.id === worker ? 'is-on' : ''}
                onClick={() => setWorker(s.id)}
                aria-pressed={s.id === worker}
              >
                <span>
                  {/^https:\/\//.test(s.image_url || '') ? (
                    <img src={s.image_url} alt="" />
                  ) : (
                    <em>{String(s.name || '?').trim().charAt(0)}</em>
                  )}
                </span>
                <small>{String(s.name || '').split(' ')[0]}</small>
              </button>
            ))}
          </div>
        </>
      )}
      <hr />
      <div className="ch-meter-days">
        {dates.map((d, i) => {
          const count = days?.[d] || 0;
          const ratio = count / max;
          const empty = days !== null && count <= 0;
          const label =
            i === 0 && count > 0
              ? 'היום'
              : new Date(d + 'T12:00:00Z').toLocaleDateString('he-IL', { weekday: 'short', timeZone: 'UTC' });
          const fill = (
            <>
              <span className="ch-gauge">
                <i
                  style={
                    {
                      height: `${Math.round(Math.sqrt(ratio) * 76)}px`,
                      opacity: count > 0 ? 0.28 + ratio * 0.72 : 0,
                      transitionDelay: `${i * 60}ms`,
                    } as React.CSSProperties
                  }
                />
              </span>
              <small className={i === 0 && count > 0 ? 'is-today' : ''}>{label}</small>
            </>
          );
          return empty || disabled || days === null ? (
            <span key={d} className={`ch-day${empty ? ' is-empty' : ''}`}>
              {fill}
            </span>
          ) : (
            <Link key={d} className="ch-day" href={bookHref(worker, d)} aria-label={`${d}, ${count} תורים פנויים`}>
              {fill}
            </Link>
          );
        })}
      </div>
      <div className="ch-meter-legend">
        <span>
          <i className="is-full" />
          תורים פנויים
        </span>
        <b>·</b>
        <span>
          <i />
          אין תורים
        </span>
      </div>
    </section>
  );
}

export default function HomeSurface({
  slug,
  data,
  actions,
  version = 0,
}: {
  slug: string;
  data: any;
  actions: HomeActions;
  version?: number;
}) {
  const { profile: p, user, staff } = data;
  const services: any[] = data.services || [];
  const [loading, setLoading] = useState(Boolean(user));
  const [quickOpen, setQuickOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [next, setNext] = useState<any>(null);
  const [swaps, setSwaps] = useState<any[]>([]);
  const [waiting, setWaiting] = useState<any[]>([]);
  const [designs, setDesigns] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [storyId, setStoryId] = useState<string | null>(null);
  const [product, setProduct] = useState<any>(null);
  const blocked = Boolean(user?.block);
  const awaiting = Boolean(
    user && user.user_type === 'client' && p.require_client_approval && user.client_approved === false,
  );
  const registered = Boolean(user) && !awaiting;
  const allowed = (audience: string | undefined, fallback: string) => {
    const value = audience || fallback;
    return value === 'everyone' || (value === 'registered' && registered);
  };
  const meterStaff = useMemo(
    () => [...staff].sort((a: any, b: any) => String(a.name).localeCompare(String(b.name), 'he')),
    [staff],
  );
  useEffect(() => {
    let active = true;
    api(slug, 'gallery')
      .then((r) => active && setDesigns(r))
      .catch(() => {});
    api(slug, 'products')
      .then((r) => active && setProducts(r))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [slug]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    api(slug, 'appointments')
      .then((rows: any[]) => {
        if (active) setNext(rows.filter(isUpcoming)[0] || null);
      })
      .catch(() => active && setNext(null))
      .finally(() => active && setLoading(false));
    api(slug, 'waitlist')
      .then((rows: any[]) => {
        const today = israelNow().date;
        if (active) setWaiting(rows.filter((r) => r.status === 'waiting' && r.requested_date >= today));
      })
      .catch(() => {});
    api(slug, 'swaps')
      .then((rows: any[]) => active && setSwaps(rows || []))
      .catch(() => active && setSwaps([]));
    return () => {
      active = false;
    };
  }, [slug, user?.id, version, tick]);

  const barber = next && staff.find((s: any) => s.id === next.barber_id);
  const nextSwap = next && swaps.find((s) => s.appointment_id === next.id);
  const swapOffer = nextSwap?.status === 'pending_confirmation';
  const swapSearch = Boolean(nextSwap) && !swapOffer;
  const swapOn = p.client_swap_enabled !== false;
  const locked = next && cancelLocked(next, p.min_cancellation_hours);
  const address = p.address || '';
  const phone = p.phone || '';
  const logos = businessLogos(p, slug);
  const bookLink = user ? `/${slug}/book` : `/${slug}/login`;
  const showQuickSlots = allowed(p.quick_slots_audience, 'off');
  const openQuickSlots = () => {
    if (!user) {
      location.assign(`/${slug}/login`);
      return;
    }
    if (blocked) {
      alert('החשבון חסום\nהחשבון שלך חסום. לא ניתן לקבוע תורים.');
      return;
    }
    if (awaiting) {
      alert('ממתין לאישור\nההרשמה שלך ממתינה לאישור העסק. עדיין לא ניתן לקבוע תורים.');
      return;
    }
    setQuickOpen(true);
  };
  const socials = [
    p.instagram_url && { href: p.instagram_url, label: 'אינסטגרם', Icon: InstagramIcon, color: '#E4405F' },
    p.facebook_url && { href: p.facebook_url, label: 'פייסבוק', Icon: FacebookIcon, color: '#1877F2' },
    p.tiktok_url && { href: p.tiktok_url, label: 'טיקטוק', Icon: TikTokIcon, color: '#000000' },
    phone && {
      href: whatsappLink(phone, 'שלום, אשמח ליצור קשר'),
      label: 'שליחת הודעה בוואטסאפ',
      Icon: WhatsAppIcon,
      color: '#25D366',
    },
  ].filter(Boolean) as any[];

  return (
    <div className="ch">
      <div className="ch-section ch-first">
        {loading ? (
          <div className="ch-loading">טוען את התורים שלך...</div>
        ) : next ? (
          <>
            <article className="ch-next">
              <div className="ch-card-head">
                <button type="button" className="ch-next-date ch-next-open" onClick={actions.openAppointments}>
                  {new Date(next.slot_date + 'T12:00:00Z').toLocaleDateString('he-IL', {
                    day: 'numeric',
                    month: 'long',
                    timeZone: 'UTC',
                  })}
                </button>
                <span className="ch-next-tools">
                  <button type="button" className="ch-next-label ch-next-open" onClick={actions.openAppointments}>
                    התור הבא שלך
                  </button>
                  {showQuickSlots && (
                    <button type="button" className="ch-quick-dot" aria-label="תורים זריזים" onClick={openQuickSlots}>
                      <Zap size={16} />
                    </button>
                  )}
                </span>
              </div>
              <button type="button" className="ch-next-tap" onClick={actions.openAppointments} aria-label="התורים שלי">
                <div className="ch-next-body">
                  <span className="ch-avatar">
                    <BrandImage
                      sources={[barber?.image_url].filter((u) => u && !logos.includes(u))}
                      alt=""
                      fallback={<User size={22} />}
                    />
                  </span>
                  <span className="ch-next-copy">
                    <strong>{next.service_name || 'Service'}</strong>
                    {barber?.name && <small>{barber.name}</small>}
                  </span>
                  <i className="ch-hairline" />
                  <b className="ch-next-time">{next.slot_time.slice(0, 5)}</b>
                </div>
              </button>
            </article>
            {user.user_type !== 'admin' && (
              <div className="ch-next-actions">
                {swapOn ? (
                  <>
                    <button
                      type="button"
                      className="ch-pill"
                      onClick={() => actions.swap(next)}
                      aria-label={swapOffer ? 'יש הצעה להחלפה' : swapSearch ? 'מחפשים לך תור' : 'להחלפת תור'}
                    >
                      {swapOffer ? (
                        <>
                          <Mail size={18} />
                          יש הצעה להחלפה
                        </>
                      ) : swapSearch ? (
                        <span className="ch-search">
                          <i className="ch-ring" aria-hidden />
                          מחפשים לך תור
                        </span>
                      ) : (
                        <>
                          <ArrowLeftRight size={18} />
                          להחלפת תור
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className={`ch-cancel-dot${locked ? ' is-locked' : ''}`}
                      aria-label="ביטול התור"
                      onClick={() => actions.cancel(next)}
                    >
                      <X size={20} strokeWidth={2.6} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={`ch-pill is-cancel${locked ? ' is-locked' : ''}`}
                    onClick={() => actions.cancel(next)}
                  >
                    <X size={18} strokeWidth={2.6} />
                    ביטול התור
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className={`ch-book-host${blocked || awaiting ? ' is-disabled' : ''}`}>
            <Link
              className="ch-book"
              href={bookLink}
              onClick={(e) => {
                if (!blocked && !awaiting) return;
                e.preventDefault();
                alert(
                  blocked
                    ? 'החשבון חסום\nהחשבון שלך חסום. לא ניתן לקבוע תורים.'
                    : 'ממתין לאישור\nההרשמה שלך ממתינה לאישור העסק. עדיין לא ניתן לקבוע תורים.',
                );
              }}
            >
              <span className="ch-lava" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              <span className="ch-book-copy">
                <strong>{user?.name ? `שלום ${String(user.name).trim().split(/\s+/)[0]}` : 'שלום'}</strong>
                <small>לחץ כאן כדי לקבוע תור חדש</small>
              </span>
              <span className="ch-book-plus">
                <Plus size={26} strokeWidth={2.4} />
              </span>
            </Link>
            {showQuickSlots && (
              <button type="button" className="ch-quick-tab" onClick={openQuickSlots}>
                <Zap size={14} />
                <span>10 התורים הכי קרובים</span>
                <ChevronLeft size={14} />
              </button>
            )}
          </div>
        )}

        {waiting.length > 0 && (
          <Link className="ch-wait" href={`/${slug}/waitlist`}>
            <div className="ch-card-head">
              <span className="ch-next-date">{hebrewDay(waiting[0].requested_date)}</span>
              <span className="ch-wait-label">רשימת המתנה</span>
            </div>
            <div className="ch-next-body">
              <span className="ch-wait-icon">
                <Clock size={22} />
              </span>
              <span className="ch-next-copy">
                <strong>{waiting[0].service_name || 'נמצאים ברשימת המתנה'}</strong>
                {(() => {
                  const period = periods[waiting[0].time_period] || periods.any;
                  return (
                    <small className="ch-period" style={period.color ? { color: period.color } : undefined}>
                      <period.Icon size={13} />
                      {period.label}
                    </small>
                  );
                })()}
              </span>
              <i className="ch-hairline" />
              <span className="ch-wait-count">
                <b>{waiting.length}</b>
                <small>הקישו לפרטים</small>
              </span>
            </div>
          </Link>
        )}

        {allowed(p.availability_meter_audience, 'everyone') && meterStaff.length > 0 && (
          <WeekMeter
            slug={slug}
            staff={meterStaff}
            disabled={blocked || awaiting}
            bookHref={(worker, date) => (user ? `/${slug}/book?worker=${worker}&date=${date}` : `/${slug}/login`)}
          />
        )}
      </div>

      {designs.length > 0 && (
        <div className="ch-carousel">
          <StoryCarousel
            items={designs}
            people={staff}
            onOpenItem={(item) => setStoryId(item.id)}
            title="ברוך הבא לעולם שלנו"
            subtitle="חלק מהעבודות האחרונות שלנו"
          />
        </div>
      )}
      {products.length > 0 && (
        <div className="ch-carousel is-products">
          <ProductCarousel
            items={products}
            onOpenItem={setProduct}
            title="המוצרים שלנו"
            subtitle="המוצרים שמתאימים בדיוק בשבילכם"
          />
        </div>
      )}

      {allowed(p.map_audience, 'everyone') && (
        <div className="ch-section">
          <a
            className="ch-map"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || 'Tel Aviv-Yafo, Israel')}`}
            target="_blank"
            rel="noreferrer"
          >
            <iframe
              title="מפה"
              tabIndex={-1}
              loading="lazy"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(address || 'Tel Aviv-Yafo, Israel')}&z=15&output=embed`}
            />
            <span className="ch-map-wash" />
            <span className="ch-map-pin" aria-hidden>
              <span className="ch-map-balloon">
                {(p.icon_url || logos.length) ? (
                  <BrandImage sources={[p.icon_url, ...logos]} alt="" fallback={<MapPin size={24} />} />
                ) : (
                  <MapPin size={24} />
                )}
              </span>
              <i className="ch-map-tip" />
              <i className="ch-map-ground" />
            </span>
            <span className="ch-map-bar">
              <strong>{p.display_name}</strong>
              <small>{address || 'Tel Aviv-Yafo, Israel'}</small>
            </span>
          </a>
        </div>
      )}

      {socials.length > 0 && (
        <div className="ch-social">
          {socials.map(({ href, label, Icon, color }) => (
            <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label} style={{ color }}>
              <Icon size={22} />
            </a>
          ))}
        </div>
      )}

      <footer className="ch-footer">
        <p>
          רוצה גם אפליקציה משלך?{' '}
          <a href="https://wetori.co.il" target="_blank" rel="noreferrer">
            לחץ כאן
          </a>
        </p>
        <img src="/branding/logotoriapp.png" alt="tori" />
      </footer>

      {p.home_fixed_message?.trim() && !(awaiting && p.home_fixed_message_audience === 'registered') && (
        <FixedMessage text={p.home_fixed_message} />
      )}
      {storyId && (
        <GalleryStory designs={designs} people={staff} initialId={storyId} onClose={() => setStoryId(null)} />
      )}
      <ProductDetail product={product} onClose={() => setProduct(null)} />
      <QuickSlots
        slug={slug}
        services={services}
        multi={Boolean(p.allow_multi_service_booking)}
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        onBooked={() => setTick((n) => n + 1)}
      />
    </div>
  );
}
