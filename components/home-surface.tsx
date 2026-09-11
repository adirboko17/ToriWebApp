'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Clock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Phone,
  Camera,
  Bell,
  Images,
  Heart,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import { api, dateLabel } from '@/lib/client';
import { israelNow, addDays } from '@/lib/availability';
export default function HomeSurface({
  slug,
  data,
  messages,
}: {
  slug: string;
  data: any;
  messages: any[];
}) {
  const { profile: p, user, staff, services } = data;
  const [next, setNext] = useState<any>(null),
    [designs, setDesigns] = useState<any[]>([]),
    [products, setProducts] = useState<any[]>([]),
    [worker, setWorker] = useState(
      staff.find((s: any) =>
        services.some((v: any) => !v.worker_id || v.worker_id === s.id),
      )?.id || '',
    ),
    [week, setWeek] = useState<Record<string, number>>({}),
    [weekError, setWeekError] = useState(false);
  const today = israelNow().date;
  const showMeter =
    p.availability_meter_audience === 'everyone' ||
    (p.availability_meter_audience === 'registered' && user);
  useEffect(() => {
    let active = true;
    api(slug, 'gallery')
      .then((r) => active && setDesigns(r.slice(0, 8)))
      .catch(() => {});
    api(slug, 'products')
      .then((r) => active && setProducts(r.slice(0, 6)))
      .catch(() => {});
    if (user)
      api(slug, 'appointments')
        .then((r) => {
          const now = israelNow();
          const future = r.filter(
            (a: any) =>
              ['confirmed', 'pending'].includes(a.status) &&
              (a.slot_date > now.date ||
                (a.slot_date === now.date &&
                  +a.slot_time.slice(0, 2) * 60 + +a.slot_time.slice(3, 5) >=
                    now.minute)),
          );
          if (active) setNext(future[0] || null);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [slug, user?.id]);
  useEffect(() => {
    if (!showMeter || !worker) return;
    let active = true;
    setWeek({});
    setWeekError(false);
    api(slug, 'week', undefined, { worker })
      .then((r) => active && setWeek(r.days))
      .catch(() => active && setWeekError(true));
    return () => {
      active = false;
    };
  }, [slug, worker, !!showMeter, user?.id]);
  return (
    <div className="native-home">
      {next ? (
        <Link className="next-visit-card" href={`/b/${slug}/appointments`}>
          <div className="card-caption">
            <span className="tile-icon">
              <Clock size={20} />
            </span>
            <h2>התור הבא שלך</h2>
            <ChevronLeft size={18} />
          </div>
          <div className="next-visit-body">
            <div className="next-visit-date">
              <strong>{+next.slot_date.slice(8)}</strong>
              <span>
                {new Date(next.slot_date + 'T12:00:00Z').toLocaleDateString(
                  'he-IL',
                  { month: 'short', weekday: 'short' },
                )}
              </span>
            </div>
            <div>
              <strong>{next.service_name}</strong>
              <p>{staff.find((s: any) => s.id === next.barber_id)?.name}</p>
            </div>
            <b>{next.slot_time.slice(0, 5)}</b>
          </div>
        </Link>
      ) : (
        <Link className="native-book-card" href={`/b/${slug}/book`}>
          <div>
            <h1>
              {user ? `היי ${user.name.split(' ')[0]},` : 'ברוכים הבאים,'}
            </h1>
            <p>התור הבא שלך מתחיל כאן</p>
          </div>
          <span className="native-plus">
            <Plus size={27} />
          </span>
        </Link>
      )}
      {user && p.require_client_approval && user.client_approved === false && (
        <p className="pending-approval">
          <Clock size={17} /> ההרשמה הושלמה, ממתינים לאישור העסק
        </p>
      )}
      {showMeter && (
        <section className="availability-card">
          <div className="card-caption">
            <span className="tile-icon">
              <CalendarDays size={20} />
            </span>
            <h2>הזמינות הקרובה</h2>
            {staff.length > 1 && (
              <select
                aria-label="זמינות לפי איש צוות"
                value={worker}
                onChange={(e) => setWorker(e.target.value)}
              >
                {staff
                  .filter((s: any) =>
                    services.some(
                      (v: any) => !v.worker_id || v.worker_id === s.id,
                    ),
                  )
                  .map((s: any) => (
                    <option value={s.id} key={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            )}
          </div>
          <div className="native-week">
            {Array.from({ length: 7 }, (_, i) => addDays(today, i)).map(
              (d, i) => (
                <Link
                  key={d}
                  className={
                    week[d] === 0
                      ? 'full'
                      : week[d] > 0
                        ? 'available'
                        : 'pending'
                  }
                  href={`/b/${slug}/book?worker=${worker}&date=${d}`}
                  aria-label={`${dateLabel(d)}${week[d] > 0 ? ', יש תורים פנויים' : week[d] === 0 ? ', אין תורים פנויים' : ''}`}
                >
                  <span>
                    {i === 0
                      ? 'היום'
                      : new Date(d + 'T12:00:00Z').toLocaleDateString('he-IL', {
                          weekday: 'short',
                        })}
                  </span>
                  <strong>{+d.slice(8)}</strong>
                  <i />
                </Link>
              ),
            )}
          </div>
          <div className="availability-footer">
            {weekError ? (
              <span>הזמינות מתעדכנת במסך קביעת התור</span>
            ) : (
              <>
                <span>
                  <i />
                  יש מקום
                </span>
                <span>בחרו יום כדי לקבוע תור</span>
              </>
            )}
          </div>
        </section>
      )}
      <div className="home-shortcuts">
        {[
          [CalendarDays, 'התורים שלי', 'appointments'],
          [Images, 'גלריה', 'gallery'],
          [Bell, 'עדכונים', 'notifications'],
        ].map(([Icon, label, route]: any) => (
          <Link href={`/b/${slug}/${route}`} key={route}>
            <span>
              <Icon size={24} strokeWidth={1.6} />
            </span>
            <strong>{label}</strong>
          </Link>
        ))}
      </div>
      {p.home_fixed_message && (
        <div className="studio-message">
          <span className="tile-icon">
            <Heart size={19} />
          </span>
          <p>{p.home_fixed_message}</p>
        </div>
      )}
      {messages.map((m) => (
        <div className="studio-message" key={m.id}>
          <Bell size={19} />
          <div>
            <strong>{m.title}</strong>
            <p>{m.content}</p>
          </div>
        </div>
      ))}
      {!!designs.length && (
        <section className="home-gallery">
          <div className="section-heading">
            <h2>מהסטודיו, באהבה</h2>
            <Link href={`/b/${slug}/gallery`}>
              לכל העבודות
              <ChevronLeft size={16} />
            </Link>
          </div>
          <div className="home-carousel">
            {designs.map((d) => (
              <Link href={`/b/${slug}/gallery`} key={d.id}>
                <img
                  src={d.image_urls?.[0] || d.image_url}
                  alt={d.name}
                  loading="lazy"
                />
                <span>{d.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      {!!products.length && (
        <section>
          <div className="section-heading">
            <h2>המוצרים שלנו</h2>
            <Link href={`/b/${slug}/products`}>
              לכל המוצרים
              <ChevronLeft size={16} />
            </Link>
          </div>
          <div className="home-carousel products-carousel">
            {products.map((d) => (
              <Link href={`/b/${slug}/products`} key={d.id}>
                {d.image_url && (
                  <img src={d.image_url} alt={d.name} loading="lazy" />
                )}
                <span>
                  {d.name}
                  <b>₪{d.price}</b>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
      <Link className="book-secondary" href={`/b/${slug}/book`}>
        <CalendarDays size={21} />
        <span>קביעת תור חדש</span>
        <Plus size={20} />
      </Link>
      {p.address && (
        <a
          className="studio-address"
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}`}
          target="_blank"
          rel="noreferrer"
        >
          <span className="address-pin">
            <MapPin size={28} />
          </span>
          <div>
            <h2>מחכים לך כאן</h2>
            <p>{p.address}</p>
          </div>
          <ChevronLeft size={19} />
        </a>
      )}
      <div className="contact-actions">
        {p.phone && (
          <a href={`tel:${p.phone.replace(/[^+\d]/g, '')}`}>
            <Phone size={19} />
            לדבר איתנו
          </a>
        )}
        {p.instagram_url && /^https:\/\//.test(p.instagram_url) && (
          <a href={p.instagram_url} target="_blank" rel="noreferrer">
            <Camera size={19} />
            אינסטגרם
          </a>
        )}
      </div>
      <footer>
        <span>Tori ♡</span>
        <small>הזמן שלך. המקום שלך.</small>
      </footer>
    </div>
  );
}
