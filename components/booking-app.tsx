'use client';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Home,
  UserRound,
  Images,
  Heart,
  ChevronLeft,
  MapPin,
  Phone,
  Camera,
  Sparkles,
  Plus,
} from 'lucide-react';
import { api, theme } from '@/lib/client';
import BookingFlow from './booking-flow';
import HomeSurface from './home-surface';
import Link from 'next/link';
import ClientPages from './client-pages';
import AdminPanel from './admin-panel';
export default function BookingApp({
  slug,
  screen,
}: {
  slug: string;
  screen: string;
}) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(''),
    [messages, setMessages] = useState<any[]>([]);
  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    api(slug, 'bootstrap')
      .then((r) => {
        if (active) {
          setData(r);
          document.title = `${r.profile.display_name || 'Tori'} | קביעת תורים`;
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    api(slug, 'messages')
      .then((r) => {
        if (active) setMessages(r);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [slug]);
  const updateUser = (user: any) => setData((d: any) => ({ ...d, user }));
  const p = data?.profile;
  useEffect(() => {
    const colors = theme(p?.primary_color);
    for (const [key, value] of Object.entries(colors))
      document.documentElement.style.setProperty(key, String(value));
    return () => {
      for (const key of Object.keys(colors))
        document.documentElement.style.removeProperty(key);
    };
  }, [p?.primary_color]);
  const hero =
    p?.home_hero_mode === 'single_fullbleed'
      ? p?.home_hero_single_url
      : p?.home_hero_images?.[0];
  const home = screen === 'home';
  const valid = [
    'home',
    'book',
    'appointments',
    'gallery',
    'products',
    'profile',
    'notifications',
    'waitlist',
    'admin',
  ].includes(screen);
  const background =
    hero && /^https?:\/\//.test(hero)
      ? { backgroundImage: `url(${JSON.stringify(hero)})` }
      : undefined;
  return (
    <div
      className={`site-shell screen-${screen} ${home ? 'home-screen' : 'inner-screen'}`}
      style={theme(p?.primary_color)}
    >
      <aside className="visual-panel">
        {p?.home_hero_mode === 'marquee' && p.home_hero_images?.length ? (
          <div className="hero-mosaic">
            {p.home_hero_images.slice(0, 9).map((src: string, i: number) => (
              <img src={src} alt="" key={i} />
            ))}
          </div>
        ) : (
          <div className="photo-wall" style={background} />
        )}
        {p?.home_hero_mode === 'single_fullbleed' &&
          p?.home_hero_single_kind === 'video' &&
          hero && (
            <video
              className="hero-video"
              src={hero}
              autoPlay
              muted
              loop
              playsInline
            />
          )}
        <div className="visual-caption">
          <span>{p?.display_name || 'TORI · YOUR TIME'}</span>
          <h1>
            קצת זמן.
            <br />
            רק לעצמך.
          </h1>
          <p>היופי נמצא בפרטים הקטנים.</p>
        </div>
      </aside>
      <main className="app-panel">
        <header>
          <a className="wordmark" href={`/b/${slug}`}>
            {p?.home_header_show_logo !== false && p?.home_logo_url ? (
              <img src={p.home_logo_url} alt={p.display_name || 'לוגו העסק'} />
            ) : p?.home_header_show_logo === false ? (
              <span className="business-title">
                {p.home_header_text_without_logo || p.display_name}
              </span>
            ) : (
              <>
                Tori<span>♡</span>
              </>
            )}
          </a>
          <span className="header-note">
            {p?.display_name || 'YOUR TIME · YOUR BEAUTY'}
          </span>
          <a
            className="icon-button"
            href={`/b/${slug}/profile`}
            aria-label="הפרופיל שלי"
          >
            <UserRound size={21} />
          </a>
        </header>
        {home && (
          <div className="mobile-hero">
            {p?.home_hero_mode === 'marquee' && p.home_hero_images?.length ? (
              <div className="hero-mosaic">
                {p.home_hero_images
                  .slice(0, 9)
                  .map((src: string, i: number) => (
                    <img src={src} alt="" key={i} />
                  ))}
              </div>
            ) : (
              <div className="photo-wall" style={background} />
            )}
            {p?.home_hero_mode === 'single_fullbleed' &&
              p?.home_hero_single_kind === 'video' &&
              hero && (
                <video
                  className="hero-video"
                  src={hero}
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              )}
          </div>
        )}
        <div className="content">
          {error ? (
            <div className="empty-state">
              <h1>{error}</h1>
              <p>בדקו שקישור העסק נכון ונסו שוב.</p>
              <button
                className="primary-button"
                onClick={() => location.reload()}
              >
                טעינה מחדש
              </button>
            </div>
          ) : !data ? (
            <div className="empty-state" role="status">
              <div className="loading-ring" />
              <p>מכינים את המקום שלך…</p>
            </div>
          ) : !valid ? (
            <div className="empty-state">
              <h1>העמוד לא נמצא</h1>
              <a href={`/b/${slug}`}>חזרה לעסק</a>
            </div>
          ) : home ? (
            <HomeSurface slug={slug} data={data} messages={messages} />
          ) : screen === 'book' ? (
            <BookingFlow slug={slug} data={data} onUser={updateUser} />
          ) : screen === 'admin' ? (
            <AdminPanel slug={slug} data={data} onUser={updateUser} />
          ) : (
            <ClientPages
              slug={slug}
              screen={screen}
              data={data}
              onUser={updateUser}
            />
          )}
        </div>
        {screen !== 'book' && (
          <nav className="native-dock" aria-label="ניווט ראשי">
            <Link
              className="dock-create"
              href={`/b/${slug}/book`}
              aria-label="קביעת תור חדש"
            >
              <Plus size={25} />
            </Link>
            <div className="dock-group">
              {[
                [UserRound, 'הפרופיל שלי', 'profile'],
                [CalendarDays, 'התורים שלי', 'appointments'],
                [Home, 'בית', 'home'],
              ].map(([Icon, label, path]: any) => (
                <Link
                  href={`/b/${slug}/${path === 'home' ? '' : path}`}
                  aria-label={label}
                  title={label}
                  className={screen === path ? 'active' : ''}
                  aria-current={screen === path ? 'page' : undefined}
                  key={path}
                >
                  <Icon size={23} strokeWidth={1.8} />
                </Link>
              ))}
            </div>
          </nav>
        )}
      </main>
    </div>
  );
}
