'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
  Plus,
  Settings,
  Wallet,
} from 'lucide-react';
import { api, theme } from '@/lib/client';
import BookingFlow from './booking-flow';
import HomeSurface, { type HomeActions } from './home-surface';
import Link from 'next/link';
import ClientPages from './client-pages';
import ClientProfile from './client-profile';
import ClientAppointments, { type AppointmentsRequest } from './client-appointments';
import AdminPanel from './admin-panel';
import AuthForm from './auth-form';
import BrandImage from './brand-image';
import BrandSplash from './brand-splash';
import { businessLogos, headerScrim, statusBarColor } from '@/lib/branding';
function ToriMark({ size = 22, strokeWidth = 1.8 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="5" fill="none" />
      <path d="m8 8.5 2.5 1.5L8 11.5" fill="none" />
      <path d="M15.5 10h.01" fill="none" />
      <path d="M8.5 14.5c2.2 1.4 4.8 1.4 7 0" fill="none" />
    </svg>
  );
}
function heroRows(images: string[]) {
  const urls = images.filter((url) => /^https?:\/\//.test(url));
  const rows: string[][] = [[], [], []];
  urls.forEach((url, index) => rows[index % 3].push(url));
  const fallback = urls[0];
  if (!fallback) return rows;
  for (const row of rows) {
    if (!row.length) row.push(fallback);
    while (row.length < 4) row.push(...row.slice());
  }
  return rows;
}
function HeroMarquee({ images }: { images: string[] }) {
  const rows = heroRows(images);
  if (!rows[0]?.length) return null;
  return (
    <div className="hero-marquee">
      <div className="hero-marquee-plane">
        {rows.map((row, rowIndex) => (
          <div
            className={`hero-marquee-row${rowIndex % 2 ? ' is-reverse' : ''}`}
            key={rowIndex}
            style={{ '--tiles': row.length } as React.CSSProperties}
          >
            <div className="hero-marquee-track">
              {[...row, ...row].map((src, index) => (
                <img src={src} alt="" key={`${rowIndex}-${index}`} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function screenFromPath(pathname: string, slug: string) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== slug) return 'home';
  return parts[1] || 'home';
}

export default function BookingApp({ slug }: { slug: string; screen?: string }) {
  const pathname = usePathname() || `/${slug}`;
  const screen = screenFromPath(pathname, slug);
  const [data, setData] = useState<any>(null),
    [error, setError] = useState('');
  const [kept, setKept] = useState<string[]>([]);
  useEffect(() => {
    setKept((list) => (list.includes(screen) ? list : [...list, screen]));
  }, [screen]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);
  useEffect(() => {
    let active = true;
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
    return () => {
      active = false;
    };
  }, [slug]);
  const updateUser = (user: any) => setData((d: any) => ({ ...d, user }));
  const p = data?.profile;
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(screen === 'appointments');
  const [chatHint, setChatHint] = useState(false);
  const chatRef = useRef<HTMLButtonElement>(null);
  const [request, setRequest] = useState<AppointmentsRequest | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (screen === 'appointments') setSheetOpen(true);
  }, [screen]);
  const [chatBox, setChatBox] = useState<{ x: number; y: number } | null>(null);
  function placeChatBubble() {
    const button = chatRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setChatBox({ x: rect.left + rect.width / 2, y: rect.top });
  }
  function toggleChat(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (chatHint) {
      setChatHint(false);
      return;
    }
    placeChatBubble();
    setChatHint(true);
  }
  useEffect(() => {
    if (!chatHint) return;
    placeChatBubble();
    const timer = window.setTimeout(() => setChatHint(false), 3200);
    const close = (event: PointerEvent) => {
      if (!chatRef.current?.contains(event.target as Node)) setChatHint(false);
    };
    const arm = window.setTimeout(() => document.addEventListener('pointerdown', close), 0);
    const place = () => placeChatBubble();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(arm);
      document.removeEventListener('pointerdown', close);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [chatHint]);
  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    if (screen === 'appointments') router.replace(`/${slug}`, { scroll: false });
  }, [screen, router, slug]);
  const homeActions = useMemo<HomeActions>(
    () => ({
      openAppointments: () => setSheetOpen(true),
      cancel: (appointment) => setRequest((r) => ({ type: 'cancel', appointment, n: (r?.n || 0) + 1 })),
      swap: (appointment) => setRequest((r) => ({ type: 'swap', appointment, n: (r?.n || 0) + 1 })),
    }),
    [],
  );
  const startBooking = (e: React.MouseEvent) => {
    const user = data?.user;
    if (!user || user.user_type === 'admin') return;
    if (user.block) {
      e.preventDefault();
      alert('החשבון שלך חסום. לא ניתן לקבוע תורים.');
    } else if (user.client_approved === false) {
      e.preventDefault();
      alert('ההרשמה שלך ממתינה לאישור העסק. עדיין לא ניתן לקבוע תורים.');
    }
  };
  useEffect(() => {
    const colors = theme(p?.primary_color);
    for (const [key, value] of Object.entries(colors))
      document.documentElement.style.setProperty(key, String(value));
    return () => {
      for (const key of Object.keys(colors))
        document.documentElement.style.removeProperty(key);
    };
  }, [p?.primary_color]);
  const home = screen === 'home' || screen === 'appointments';
  const isAdmin = data?.user?.user_type === 'admin';
  const requestedView = useSearchParams().get('v') || 'home';
  const adminView = ['home', 'calendar', 'hours', 'notifications', 'waitlist', 'settings', 'finance'].includes(requestedView)
    ? requestedView
    : 'home';
  const heroScreen = home || (screen === 'admin' && isAdmin && adminView === 'home');
  const topColor = p && heroScreen ? statusBarColor(p) : null;
  useEffect(() => {
    if (!heroScreen) return;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = Math.max(0, window.scrollY);
      const fade = Math.max(0, 1 - y / 220);
      root.style.setProperty('--hero-fade', fade.toFixed(3));
      root.style.setProperty('--hero-shift', `${(-Math.min(y, 900) * 0.22).toFixed(1)}px`);
      root.toggleAttribute('data-hero-faded', fade < 0.05);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
      root.style.removeProperty('--hero-fade');
      root.style.removeProperty('--hero-shift');
      root.removeAttribute('data-hero-faded');
    };
  }, [heroScreen]);
  useEffect(() => {
    if (!topColor) return;
    const root = document.documentElement;
    const previous = root.style.backgroundColor;
    root.style.backgroundColor = topColor;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const created = !meta;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    const previousMeta = meta.content;
    meta.content = topColor;
    return () => {
      root.style.backgroundColor = previous;
      if (created) meta.remove();
      else meta.content = previousMeta;
    };
  }, [topColor]);
  const hero =
    p?.home_hero_mode === 'single_fullbleed'
      ? p?.home_hero_single_url
      : p?.home_hero_images?.[0];
  const adminEntry = isAdmin && (home || screen === 'login');
  useEffect(() => {
    if (adminEntry) location.assign(`/${slug}/admin`);
  }, [adminEntry, slug]);
  const valid = [
    'home',
    'login',
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
  const logoMode = p?.home_header_logo_color_mode === 'original' ? 'original' : 'white';
  const scrim = headerScrim(p);
  const logoHeight = Number(p?.home_header_logo_height);
  const titleSize = Number(p?.home_header_title_font_size);
  const showDock =
    screen !== 'book' &&
    screen !== 'login' &&
    !adminEntry &&
    (!home || Boolean(data?.user));
  const adminDock = showDock && isAdmin;
  const clientScreen = screen === 'appointments' ? 'home' : screen;
  const nativeClient = !isAdmin && ['book', 'profile'].includes(screen);
  return (
    <div
      className={`site-shell screen-${clientScreen}${nativeClient ? ` shell-native shell-client-${screen}` : ''} ${heroScreen ? 'home-screen' : 'inner-screen'}${showDock ? ' has-dock' : ''}${screen === 'admin' && isAdmin && ['calendar', 'hours', 'notifications', 'settings', 'finance'].includes(adminView) ? ` shell-native shell-${adminView}` : ''}`}
      data-logo-mode={logoMode}
      style={{
        ...theme(p?.primary_color),
        '--header-scrim': scrim,
        '--scrim-base': p ? statusBarColor(p) : '#000',
        '--logo-height': `${logoHeight > 0 ? Math.min(120, Math.max(28, logoHeight)) : 52}px`,
        ...(titleSize > 0 ? { '--title-size': `${Math.min(56, Math.max(18, titleSize))}px` } : {}),
        ...(p?.home_header_name_color ? { '--title-color': p.home_header_name_color } : {}),
      } as React.CSSProperties}
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
      </aside>
      <main className="app-panel">
        <header>
          <a className="wordmark" href={`/${slug}`}>
            {p?.home_header_show_logo !== false && businessLogos(p, slug).length ? (
              <BrandImage sources={businessLogos(p, slug)} alt={p?.display_name || 'לוגו העסק'} fallback={<span>{p?.display_name || 'Tori'}</span>} shadeIfLight />
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
        </header>
        {heroScreen && (
          <div className="mobile-hero">
            {p?.home_hero_mode === 'marquee' && p.home_hero_images?.length ? (
              <HeroMarquee images={p.home_hero_images} />
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
            <BrandSplash />
          ) : !valid ? (
            <div className="empty-state">
              <h1>העמוד לא נמצא</h1>
              <a href={`/${slug}`}>חזרה לעסק</a>
            </div>
          ) : (home || screen === 'login') && !data.user ? (
            <section className="business-sign-in">
              <AuthForm slug={slug} onDone={(user) => {
                updateUser(user);
                if (user?.user_type === 'admin') location.assign(`/${slug}/admin`);
                else if (screen === 'login') location.assign(`/${slug}`);
              }} />
            </section>
          ) : adminEntry ? (
            <BrandSplash />
          ) : (
            <>
              {(home || screen === 'login' || kept.includes('home')) && data.user && !isAdmin && (
                <div className="kept-screen" hidden={!(home || screen === 'login')}>
                  <HomeSurface slug={slug} data={data} actions={homeActions} version={version} />
                </div>
              )}
              {(screen === 'profile' || (kept.includes('profile') && data.user)) && !isAdmin && (
                <div className="kept-screen" hidden={screen !== 'profile'}>
                  <ClientProfile slug={slug} data={data} onUser={updateUser} />
                </div>
              )}
              {screen === 'book' ? (
                <BookingFlow slug={slug} data={data} onUser={updateUser} />
              ) : screen === 'admin' ? (
                <AdminPanel slug={slug} data={data} view={adminView} onUser={updateUser} />
              ) : !home && screen !== 'login' && screen !== 'profile' ? (
                <ClientPages slug={slug} screen={screen} data={data} onUser={updateUser} />
              ) : null}
            </>
          )}
        </div>
        {adminDock ? (
          <nav className="native-dock" aria-label="ניווט ניהול">
            <div className="dock-group">
              {[
                [Settings, 'הגדרות', 'settings'],
                [ToriMark, 'תורי הצ׳אט AI', 'chat'],
                [Wallet, 'הכנסות והוצאות', 'finance'],
                [Clock, 'שעות פעילות', 'hours'],
                [CalendarDays, 'יומן', 'calendar'],
                [Home, 'בית', 'home'],
              ].map(([Icon, label, view]: any) => {
                if (view === 'chat') {
                  return (
                    <button
                      type="button"
                      key={view}
                      ref={chatRef}
                      className="dock-chat"
                      aria-label={label}
                      title={label}
                      aria-expanded={chatHint}
                      onPointerDown={toggleChat}
                    >
                      <Icon size={22} strokeWidth={1.8} />
                    </button>
                  );
                }
                const active = screen === 'admin' && adminView === view;
                return (
                  <Link
                    href={`/${slug}/admin${view === 'home' ? '' : `?v=${view}`}`}
                    aria-label={label}
                    title={label}
                    className={active ? 'active' : ''}
                    aria-current={active ? 'page' : undefined}
                    key={view}
                  >
                    <Icon size={22} strokeWidth={1.8} />
                  </Link>
                );
              })}
            </div>
          </nav>
        ) : showDock && (
          <nav className="native-dock client-dock" aria-label="ניווט ראשי">
            <span className="dock-create">
              <Link
                href={data?.user ? `/${slug}/book` : `/${slug}/login`}
                aria-label="קביעת תור חדש"
                onClick={startBooking}
              >
                <Plus className="dock-plus" size={22} strokeWidth={2.4} />
              </Link>
            </span>
            <div className="dock-group">
              <Link
                href={`/${slug}/profile`}
                aria-label="פרופיל"
                title="פרופיל"
                className={screen === 'profile' && !sheetOpen ? 'active' : ''}
                aria-current={screen === 'profile' ? 'page' : undefined}
              >
                <UserRound size={22} strokeWidth={2} />
              </Link>
              <button
                type="button"
                aria-label="התורים שלי"
                title="התורים שלי"
                className={sheetOpen ? 'active' : ''}
                aria-expanded={sheetOpen}
                onClick={() => (sheetOpen ? closeSheet() : data?.user ? setSheetOpen(true) : router.push(`/${slug}/login`))}
              >
                <CalendarDays size={22} strokeWidth={2} />
              </button>
              <Link
                href={`/${slug}`}
                aria-label="בית"
                title="בית"
                className={home && !sheetOpen ? 'active' : ''}
                aria-current={home ? 'page' : undefined}
              >
                <Home size={22} strokeWidth={2} />
              </Link>
            </div>
          </nav>
        )}
        {chatHint &&
          chatBox &&
          createPortal(
            <span className="dock-chat-bubble" role="status" style={{ left: chatBox.x, top: chatBox.y }}>
              זמין רק באפליקציה
            </span>,
            document.body,
          )}
        {data?.user && !isAdmin && (
          <ClientAppointments
            slug={slug}
            data={data}
            open={sheetOpen}
            request={request}
            onClose={closeSheet}
            onChanged={() => setVersion((v) => v + 1)}
          />
        )}
      </main>
    </div>
  );
}
