'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Eye,
  Image as ImageIcon,
  Images,
  LayoutGrid,
  Palette,
  Play,
  RotateCcw,
  Trash2,
  User,
  Users,
  Video,
  X,
} from 'lucide-react';
import { api, theme } from '@/lib/client';
import BottomSheet from './bottom-sheet';
import { AlertState, FullScreen, IosAlert, Row, compressImage, readFile } from './settings-kit';

type Settings = Record<string, any>;
export type SaveFn = (patch: Settings, options?: { refresh?: boolean; error?: string }) => Promise<boolean>;

const FLOWER = ['#1E3A8A', '#2563EB', '#0891B2', '#0D9488', '#059669', '#16A34A', '#CA8A04', '#EA580C', '#DC2626', '#BE185D', '#7C3AED', '#581C87', '#1F2937'];
const GRID = ['#000000', '#1F2937', '#374151', '#57534E', '#78716C', '#991B1B', '#DC2626', '#EA580C', '#D97706', '#CA8A04', '#65A30D', '#16A34A', '#059669', '#0D9488', '#0891B2', '#0284C7', '#2563EB', '#1D4ED8', '#1E40AF', '#1E3A8A', '#4F46E5', '#5B21B6', '#6D28D9', '#7C3AED', '#6B21A8', '#581C87', '#86198F', '#A21CAF', '#BE185D', '#DB2777', '#EC4899', '#F43F5E', '#E11D48', '#0F766E', '#155E75', '#312E81', '#4C1D95', '#831843', '#9D174D', '#B45309', '#92400E', '#713F12', '#3F6212', '#14532D', '#134E4A'];
const SCRIMS = ['#000000', '#1C1C1E', '#FFFFFF', '#F2F2F7', '#E8D5C4'];
const RECENTS_KEY = 'tori-custom-primary-colors';

const FONTS: [string | null, string, string, number][] = [
  [null, 'ברירת מחדל של המערכת', 'inherit', 800],
  ['gf_inter', 'Inter', 'Inter', 600],
  ['gf_montserrat', 'Montserrat', 'Montserrat', 600],
  ['gf_playfair', 'Playfair Display', 'Playfair Display', 700],
  ['gf_roboto', 'Roboto', 'Roboto', 500],
  ['gf_merriweather', 'Merriweather', 'Merriweather', 700],
  ['gf_oswald', 'Oswald', 'Oswald', 600],
  ['gf_lato', 'Lato', 'Lato', 700],
  ['gf_poppins', 'Poppins', 'Poppins', 600],
  ['gf_dancing_script', 'Dancing Script', 'Dancing Script', 600],
  ['gf_pacifico', 'Pacifico', 'Pacifico', 400],
  ['gf_space_mono', 'Space Mono', 'Space Mono', 700],
  ['gf_bebas_neue', 'Bebas Neue', 'Bebas Neue', 400],
  ['gf_alfa_slab', 'Alfa Slab One', 'Alfa Slab One', 400],
  ['gf_lobster', 'Lobster', 'Lobster', 400],
  ['gf_cinzel', 'Cinzel', 'Cinzel', 700],
  ['gf_righteous', 'Righteous', 'Righteous', 400],
  ['gf_permanent_marker', 'Permanent Marker', 'Permanent Marker', 400],
  ['gf_orbitron', 'Orbitron', 'Orbitron', 700],
  ['gf_josefin_sans', 'Josefin Sans', 'Josefin Sans', 600],
  ['gf_nunito', 'Nunito', 'Nunito', 700],
  ['gf_quicksand', 'Quicksand', 'Quicksand', 600],
  ['gf_raleway', 'Raleway', 'Raleway', 600],
  ['gf_great_vibes', 'Great Vibes', 'Great Vibes', 400],
  ['gf_satisfy', 'Satisfy', 'Satisfy', 400],
  ['gf_sacramento', 'Sacramento', 'Sacramento', 400],
  ['gf_comfortaa', 'Comfortaa', 'Comfortaa', 600],
  ['gf_rubik', 'Rubik', 'Rubik', 600],
  ['gf_work_sans', 'Work Sans', 'Work Sans', 600],
];
const LEGACY_FONTS: Record<string, string> = {
  modern: 'gf_inter',
  serif: 'gf_merriweather',
  mono: 'gf_roboto',
  classic: 'gf_playfair',
  display: 'gf_oswald',
};
const fontId = (value: string | null | undefined) =>
  value ? (LEGACY_FONTS[value] || (FONTS.some(([id]) => id === value) ? value : null)) : null;
const fontStyle = (id: string | null) => {
  const font = FONTS.find(([key]) => key === id) || FONTS[0];
  return id ? { fontFamily: `'${font[2]}', system-ui`, fontWeight: font[3] } : { fontWeight: 800 };
};
function useGoogleFonts(active: boolean) {
  useEffect(() => {
    if (!active || document.getElementById('st-google-fonts')) return;
    const link = document.createElement('link');
    link.id = 'st-google-fonts';
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${FONTS.slice(1)
      .map(([, , family, weight]) => `family=${family.replace(/ /g, '+')}:wght@${weight}`)
      .join('&')}&display=swap`;
    document.head.appendChild(link);
  }, [active]);
}

function rgb(hex: string) {
  const clean = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#000000';
  return [1, 3, 5].map((i) => parseInt(clean.slice(i, i + 2), 16));
}
function isLight(hex: string) {
  const [r, g, b] = rgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5;
}
function scrimGradient(hex: string) {
  const [r, g, b] = rgb(hex);
  return `linear-gradient(180deg, rgba(${r},${g},${b},0.92) 0%, rgba(${r},${g},${b},0.82) 22%, rgba(${r},${g},${b},0.55) 52%, rgba(${r},${g},${b},0) 100%)`;
}

type Look = {
  showLogo: boolean;
  logoHeight: number;
  colorMode: 'white' | 'original';
  scrim: string;
  font: string | null;
  fontSize: number;
  nameColor: string | null;
};
function lookOf(s: Settings): Look {
  return {
    showLogo: s.home_header_show_logo !== false,
    logoHeight: Number(s.home_header_logo_height) || 52,
    colorMode: s.home_header_logo_color_mode === 'original' ? 'original' : 'white',
    scrim: s.home_header_scrim_color || '#000000',
    font: fontId(s.home_header_title_font),
    fontSize: Number(s.home_header_title_font_size) || 32,
    nameColor: s.home_header_name_color || null,
  };
}
function headerName(s: Settings) {
  return String(s.home_header_text_without_logo || '').trim() || String(s.display_name || '').trim() || 'העסק';
}

function Backdrop({
  s,
  mode,
  single,
}: {
  s: Settings;
  mode?: 'marquee' | 'single_fullbleed';
  single?: { url: string; kind: string } | null;
}) {
  const heroMode = mode || s.home_hero_mode;
  const images: string[] = s.home_hero_images || [];
  if (heroMode === 'single_fullbleed') {
    const media = single || (s.home_hero_single_url ? { url: s.home_hero_single_url, kind: s.home_hero_single_kind } : null);
    if (!media) return <div className="sd-backdrop is-empty" />;
    return (
      <div className="sd-backdrop">
        {media.kind === 'video' ? (
          <video src={media.url} autoPlay muted loop playsInline />
        ) : (
          <img src={media.url} alt="" />
        )}
      </div>
    );
  }
  const tiles = Array.from({ length: 18 }, (_, i) => images.length ? images[i % images.length] : '');
  return (
    <div className="sd-backdrop is-marquee">
      <div className="sd-plane">
        {tiles.map((src, i) => (src ? <img key={i} src={src} alt="" /> : <span key={i} />))}
      </div>
    </div>
  );
}

function LogoImage({ sources, look, fallback }: { sources: string[]; look: Look; fallback: React.ReactNode }) {
  const [index, setIndex] = useState(0);
  if (!sources[index]) return <>{fallback}</>;
  return (
    <img
      className={`sd-logo${look.colorMode === 'white' ? ' is-white' : ''}`}
      src={sources[index]}
      alt=""
      style={{ height: look.logoHeight, width: Math.round((look.logoHeight * 138) / 52) }}
      onError={() => setIndex((i) => i + 1)}
    />
  );
}

function HeaderMark({ s, look, name }: { s: Settings; look: Look; name?: boolean }) {
  const showLogo = name === undefined ? look.showLogo : !name;
  const auto = isLight(look.scrim) ? '#111111' : '#FFFFFF';
  const color = look.nameColor || auto;
  const text = (
    <span
      className="sd-name"
      style={{
        ...fontStyle(look.font),
        fontSize: look.fontSize,
        color,
        textShadow: isLight(color) ? '0 1px 6px rgba(0,0,0,0.45)' : '0 1px 6px rgba(255,255,255,0.55)',
      }}
    >
      {headerName(s)}
    </span>
  );
  const sources: string[] = [...new Set<string>([s.home_logo_url, ...(s.home_logos || [])].filter(Boolean))];
  if (showLogo && sources.length) return <LogoImage key={sources.join('|')} sources={sources} look={look} fallback={text} />;
  return text;
}

function Mini({
  s,
  look,
  mode,
  name,
}: {
  s: Settings;
  look: Look;
  mode?: 'marquee' | 'single_fullbleed';
  name?: boolean;
}) {
  const mini = { ...look, logoHeight: Math.round(look.logoHeight * 0.42), fontSize: Math.round(look.fontSize * 0.42) };
  const video = (mode || s.home_hero_mode) === 'single_fullbleed' && s.home_hero_single_kind === 'video';
  return (
    <div className="sd-mini">
      <Backdrop s={s} mode={mode} />
      <div className="sd-mini-scrim" style={{ background: scrimGradient(look.scrim) }} />
      <div className="sd-mini-mark">
        <HeaderMark s={s} look={mini} name={name} />
      </div>
      {video && (
        <span className="sd-play">
          <Play size={11} fill="#fff" />
        </span>
      )}
      <div className="sd-mini-sheet">
        <i />
      </div>
    </div>
  );
}

function Choice({
  selected,
  label,
  sub,
  onClick,
  children,
  staff,
}: {
  selected: boolean;
  label: string;
  sub: string;
  onClick: () => void;
  children: React.ReactNode;
  staff?: boolean;
}) {
  return (
    <button type="button" className={`sd-choice${selected ? ' is-selected' : ''}${staff ? ' is-staff' : ''}`} onClick={onClick}>
      {selected && (
        <span className="sd-choice-check">
          <Check size={11} strokeWidth={3} />
        </span>
      )}
      {children}
      <strong>{label}</strong>
      <small>{sub}</small>
    </button>
  );
}

function StaffMini({ s, style }: { s: Settings; style: 'large_cards' | 'avatar_list' }) {
  const people = [...(s.staff_preview || [])];
  for (const fallback of ['נועה', 'דנה', 'מאיה']) if (people.length < 3) people.push({ name: fallback, image_url: '' });
  if (style === 'large_cards')
    return (
      <div className="sd-staff-canvas">
        <div className="sd-poster">{people[0].image_url ? <img src={people[0].image_url} alt="" /> : <User size={28} />}</div>
        <b>{people[0].name}</b>
      </div>
    );
  return (
    <div className="sd-staff-canvas">
      <div className="sd-avlist">
        {people.slice(0, 3).map((person, i) => (
          <div key={i}>
            <span>{person.image_url ? <img src={person.image_url} alt="" /> : <User size={12} />}</span>
            <b>{person.name}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function Uploading({ text, progress }: { text: string; progress?: number }) {
  return (
    <div className="sd-upload" role="status">
      <span className="aa-spinner" />
      <strong>{text}</strong>
      <small>השאירו את המסך פתוח עד שההעלאה תסתיים</small>
      {progress !== undefined && (
        <div className="sd-progress">
          <i style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

function ColorScreen({
  open,
  saved,
  onClose,
  save,
}: {
  open: boolean;
  saved: string;
  onClose: () => void;
  save: SaveFn;
}) {
  const [preview, setPreview] = useState(saved);
  const [fan, setFan] = useState(false);
  const [grid, setGrid] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    setPreview(saved);
    setFan(false);
    try {
      setRecents(JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]').filter((c: string) => /^#[0-9A-F]{6}$/i.test(c)));
    } catch {
      setRecents([]);
    }
  }, [open, saved]);
  const remember = (hex: string) => {
    const next = [hex.toUpperCase(), ...recents.filter((c) => c.toUpperCase() !== hex.toUpperCase())].slice(0, 8);
    setRecents(next);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  };
  const petals = useMemo(() => {
    const custom = recents.filter((c) => !FLOWER.includes(c.toUpperCase())).slice(0, 3);
    return [...FLOWER.slice(0, FLOWER.length - custom.length), ...custom];
  }, [recents]);
  const changed = preview.toUpperCase() !== saved.toUpperCase();
  const light = isLight(preview);
  const confirm = async () => {
    setBusy(true);
    const ok = await save({ primary_color: preview }, { error: 'לא ניתן לעדכן את הצבע' });
    setBusy(false);
    if (ok) {
      remember(preview);
      onClose();
    }
  };
  return (
    <FullScreen open={open} onBack={onClose} back="none" className={`sd-color${light ? ' is-light' : ''}`} style={theme(preview)}>
      <div className="sd-color-body">
        <h1>בחר/י את צבע האפליקציה</h1>
        <i className="sd-color-rule" />
        <p>לחצו על העיגול כדי לבחור צבע ראשי</p>
        <div className={`sd-flower${fan ? ' is-open' : ''}`}>
          {fan && <button type="button" className="sd-flower-dim" aria-label="סגירת מניפת הצבעים" onClick={() => setFan(false)} />}
          {petals.map((hex, i) => (
            <button
              type="button"
              key={hex + i}
              className="sd-petal"
              aria-label={hex}
              style={{ background: hex, '--a': `${(360 / petals.length) * i}deg`, '--d': `${i * 18}ms` } as React.CSSProperties}
              onClick={() => {
                setPreview(hex);
                setFan(false);
              }}
            />
          ))}
          <button type="button" className="sd-flower-core" aria-label="בחירת צבע" onClick={() => setFan(!fan)}>
            <span />
          </button>
        </div>
        {changed && (
          <div className="sd-color-actions">
            <button type="button" className="sd-color-confirm" disabled={busy} onClick={() => void confirm()}>
              {busy ? <span className="aa-spinner" /> : 'אישור צבע'}
            </button>
            <button type="button" className="sd-color-reset" disabled={busy} onClick={() => setPreview(saved)}>
              <RotateCcw size={17} strokeWidth={2.4} />
              איפוס
            </button>
          </div>
        )}
      </div>
      <div className="sd-color-dock">
        <button type="button" aria-label="בחירת צבע מותאם אישית" onClick={() => input.current?.click()}>
          <Palette size={22} />
        </button>
        <button type="button" aria-label="לוח צבעים" onClick={() => setGrid(true)}>
          <LayoutGrid size={22} />
        </button>
        <button type="button" aria-label="חזרה" onClick={onClose}>
          <ChevronRight size={22} />
        </button>
        <input
          ref={input}
          type="color"
          className="sd-hidden-input"
          value={preview.toLowerCase()}
          onChange={(e) => {
            const hex = e.target.value.toUpperCase();
            setPreview(hex);
            remember(hex);
          }}
        />
      </div>
      <BottomSheet open={grid} onClose={() => setGrid(false)} title="לוח צבעים" size="tall" className="st-sheet sd-grid-sheet">
        <div className="sheet-scroll">
          {!!recents.length && (
            <>
              <h3 className="sd-grid-title">צבעים אחרונים בשימוש</h3>
              <div className="sd-grid">
                {recents.map((hex) => (
                  <button
                    type="button"
                    key={hex}
                    aria-label={hex}
                    className={`${hex.toUpperCase() === preview.toUpperCase() ? 'is-selected' : ''}${isLight(hex) ? ' is-light' : ''}`}
                    style={{ background: hex }}
                    onClick={() => {
                      setPreview(hex);
                      setGrid(false);
                    }}
                  />
                ))}
              </div>
            </>
          )}
          <h3 className="sd-grid-title">כל הצבעים</h3>
          <div className="sd-grid">
            {GRID.map((hex) => (
              <button
                type="button"
                key={hex}
                aria-label={hex}
                className={`${hex === preview.toUpperCase() ? 'is-selected' : ''}${isLight(hex) ? ' is-light' : ''}`}
                style={{ background: hex }}
                onClick={() => {
                  setPreview(hex);
                  setGrid(false);
                }}
              />
            ))}
          </div>
        </div>
      </BottomSheet>
    </FullScreen>
  );
}

function HeroPreview({
  s,
  look,
  mode,
  single,
  name,
  children,
}: {
  s: Settings;
  look: Look;
  mode?: 'marquee' | 'single_fullbleed';
  single?: { url: string; kind: string } | null;
  name?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="sd-hero">
      <Backdrop s={s} mode={mode} single={single} />
      <div className="sd-hero-scrim" style={{ background: scrimGradient(look.scrim) }} />
      <div className="sd-hero-mark">
        <HeaderMark s={s} look={look} name={name} />
      </div>
      {children}
    </div>
  );
}

function MarqueeEditor({
  open,
  s,
  slug,
  onClose,
  reload,
}: {
  open: boolean;
  s: Settings;
  slug: string;
  onClose: () => void;
  reload: () => Promise<void>;
}) {
  const images: string[] = s.home_hero_images || [];
  const [upload, setUpload] = useState<{ text: string; progress?: number } | null>(null);
  const [alert, setAlert] = useState<AlertState>(null);
  const input = useRef<HTMLInputElement>(null);
  const look = lookOf(s);
  const add = async (files: File[]) => {
    if (!files.length) return;
    try {
      for (let i = 0; i < files.length; i++) {
        setUpload({ text: files.length > 1 ? 'מעלים את התמונות' : 'מעלים את התמונה', progress: i / files.length });
        const data = await compressImage(files[i], 900, 0.82);
        await api(slug, 'admin-settings', { hero_add: data });
      }
      setUpload({ text: 'שומרים את הרקע החדש…', progress: 1 });
      await reload();
    } catch {
      setAlert({ title: 'שגיאה', message: 'העלאת התמונה נכשלה' });
      await reload().catch(() => {});
    } finally {
      setUpload(null);
    }
  };
  const act = async (patch: Settings) => {
    try {
      await api(slug, 'admin-settings', patch);
      await reload();
    } catch {
      setAlert({ title: 'שגיאה', message: 'שמירת התמונה נכשלה' });
    }
  };
  return (
    <FullScreen open={open} onBack={onClose} back="left" className="sd-editor" backDisabled={!!upload}>
      <HeroPreview s={s} look={look} mode="marquee">
        {!images.length && (
          <div className="sd-hero-empty">
            <Images size={34} />
            <strong>עדיין אין תמונות</strong>
            <small>לחצו על הכפתור למטה כדי לבחור תמונות. אפשר לבחור כמה בבת אחת.</small>
          </div>
        )}
      </HeroPreview>
      <div className="sd-sheet">
        <i className="sd-sheet-grip" />
        <p className="sd-sheet-hint">תצוגה כמו בדף הבית</p>
        <button type="button" className="sd-cta" disabled={!!upload} onClick={() => input.current?.click()}>
          <Images size={22} />
          {images.length ? 'הוספת תמונות' : 'בחירת תמונות מהגלריה'}
        </button>
        <p className="sd-cta-note">מומלץ לעלות 20 תמונות</p>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sd-hidden-input"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = '';
            void add(files);
          }}
        />
        {!!images.length && (
          <>
            <div className="sd-photos-head">
              <strong>התמונות שלכם</strong>
              <small>{images.length} תמונות</small>
            </div>
            <div className="sd-photos">
              {images.map((url, i) => (
                <div key={url} className="sd-photo">
                  <button
                    type="button"
                    className="sd-photo-img"
                    aria-label={i === 0 ? 'תמונה ראשונה' : 'העברה למקום הראשון'}
                    onClick={() => i > 0 && void act({ hero_first: url })}
                  >
                    <img src={url} alt="" />
                  </button>
                  <button type="button" className="sd-photo-del" aria-label="מחק" onClick={() => void act({ hero_remove: url })}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <p className="sd-tip">טיפ: הקשה על תמונה כדי להעביר אותה למקום הראשון.</p>
          </>
        )}
      </div>
      {upload && <Uploading text={upload.text} progress={upload.progress} />}
      <IosAlert alert={alert} onClose={() => setAlert(null)} />
    </FullScreen>
  );
}

function videoDuration(url: string) {
  return new Promise<number>((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => resolve(video.duration);
    video.onerror = () => reject(new Error('video'));
    video.src = url;
  });
}

function SingleEditor({
  open,
  s,
  slug,
  onClose,
  reload,
}: {
  open: boolean;
  s: Settings;
  slug: string;
  onClose: () => void;
  reload: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<{ url: string; kind: 'image' | 'video' } | null>(null);
  const [kind, setKind] = useState<'image' | 'video'>('image');
  const [busy, setBusy] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertState>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    setDraft(null);
    setKind(s.home_hero_single_kind === 'video' ? 'video' : 'image');
  }, [open, s.home_hero_single_kind]);
  const current = s.home_hero_single_url ? { url: s.home_hero_single_url, kind: s.home_hero_single_kind || 'image' } : null;
  const media = draft || current;
  const pickImage = async (file?: File) => {
    if (!file) return;
    try {
      setDraft({ url: await compressImage(file, 1920, 0.86), kind: 'image' });
      setKind('image');
    } catch {
      setAlert({ title: 'שגיאה', message: 'העלאת התמונה נכשלה' });
    }
  };
  const pickVideo = async (file?: File) => {
    if (!file) return;
    if (file.size > 12 * 1024 * 1024)
      return setAlert({ title: 'שגיאה', message: 'הווידאו גדול מדי להעלאה. בחרו קליפ קצר יותר.' });
    const blob = URL.createObjectURL(file);
    try {
      const seconds = await videoDuration(blob);
      if (seconds > 15.5) return setAlert({ title: 'הסרטון ארוך מדי', message: 'עד 15 שניות' });
      setDraft({ url: await readFile(file), kind: 'video' });
      setKind('video');
    } catch {
      setAlert({ title: 'שגיאה', message: 'לא הצלחנו לקרוא את הסרטון' });
    } finally {
      URL.revokeObjectURL(blob);
    }
  };
  const submit = async () => {
    if (!draft) return;
    setBusy(draft.kind === 'video' ? 'הסרטון עולה כרגע…' : 'התמונה עולה כרגע…');
    try {
      await api(slug, 'admin-settings', { hero_single: draft.url });
      setBusy('שומרים את הרקע החדש…');
      await reload();
      onClose();
    } catch (e: any) {
      setAlert({ title: 'שגיאה', message: e?.message || 'העלאת התמונה נכשלה' });
    } finally {
      setBusy(null);
    }
  };
  return (
    <FullScreen open={open} onBack={onClose} back="left" className="sd-editor" backDisabled={!!busy}>
      <HeroPreview s={s} look={lookOf(s)} mode="single_fullbleed" single={media}>
        {!media && (
          <div className="sd-hero-empty">
            <strong>עדיין אין תמונה או וידאו</strong>
            <small>בחר תמונה או וידאו שימלאו את ראש דף הבית</small>
          </div>
        )}
      </HeroPreview>
      <div className="sd-sheet">
        <i className="sd-sheet-grip" />
        <p className="sd-sheet-hint">תצוגה כמו בדף הבית</p>
        <h2 className="sd-sheet-title">רקע דף הבית</h2>
        <p className="sd-sheet-sub">בחר תמונה או וידאו שיוצגו ברקע</p>
        <div className="sd-kind">
          {(
            [
              ['image', ImageIcon, 'בחירת תמונה', 'JPEG • דחוסה אוטומטית'],
              ['video', Video, 'בחירת וידאו', 'עד 15 שניות'],
            ] as const
          ).map(([id, Icon, label, sub]) => (
            <button
              type="button"
              key={id}
              className={kind === id ? 'is-selected' : undefined}
              onClick={() => (id === 'image' ? imageInput.current : videoInput.current)?.click()}
            >
              <span className="sd-kind-icon">
                <Icon size={24} />
                {kind === id && (
                  <b>
                    <Check size={11} strokeWidth={3} />
                  </b>
                )}
              </span>
              <strong>{label}</strong>
              <small>{sub}</small>
            </button>
          ))}
        </div>
        <input
          ref={imageInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sd-hidden-input"
          onChange={(e) => {
            void pickImage(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <input
          ref={videoInput}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          className="sd-hidden-input"
          onChange={(e) => {
            void pickVideo(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <button type="button" className="sd-save" disabled={!draft || !!busy} onClick={() => void submit()}>
          שמור
        </button>
      </div>
      {busy && <Uploading text={busy} />}
      <IosAlert alert={alert} onClose={() => setAlert(null)} />
    </FullScreen>
  );
}

function Stepper({
  value,
  min,
  max,
  step,
  onChange,
  less,
  more,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  less: string;
  more: string;
}) {
  return (
    <div className="sd-stepper">
      <button type="button" aria-label={more} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>
        +
      </button>
      <div>
        <b>{value}</b>
        <span>px</span>
      </div>
      <button type="button" aria-label={less} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>
        −
      </button>
    </div>
  );
}

function Swatches({
  value,
  options,
  onChange,
  title,
  auto,
}: {
  value: string | null;
  options: string[];
  onChange: (value: string | null) => void;
  title: string;
  auto?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const custom = value && !options.includes(value.toUpperCase()) ? value : null;
  return (
    <div className="sd-swatches">
      {auto && (
        <button type="button" className={`sd-swatch${value === null ? ' is-selected' : ''}`} aria-label="אוטומטי" onClick={() => onChange(null)}>
          <span className="is-auto" />
          {value === null && <Check size={16} color="#111111" />}
        </button>
      )}
      {options.map((hex) => (
        <button
          type="button"
          key={hex}
          aria-label={hex}
          className={`sd-swatch${value?.toUpperCase() === hex ? ' is-selected' : ''}`}
          onClick={() => onChange(hex)}
        >
          <span style={{ background: hex }} className={isLight(hex) ? 'is-light' : undefined} />
          {value?.toUpperCase() === hex && <Check size={16} color={isLight(hex) ? '#111111' : '#FFFFFF'} />}
        </button>
      ))}
      <button type="button" className={`sd-swatch${custom ? ' is-selected' : ''}`} aria-label="צבע אחר" onClick={() => input.current?.click()}>
        {custom ? (
          <>
            <span style={{ background: custom }} />
            <Check size={16} color={isLight(custom) ? '#111111' : '#FFFFFF'} />
          </>
        ) : (
          <span className="is-wheel">
            <Palette size={15} color="#1C1C1E" />
          </span>
        )}
      </button>
      <input
        ref={input}
        type="color"
        aria-label={title}
        className="sd-hidden-input"
        value={(value || '#000000').toLowerCase()}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
      />
    </div>
  );
}

function Customizer({
  open,
  kind,
  s,
  onClose,
  save,
}: {
  open: boolean;
  kind: 'logo' | 'name';
  s: Settings;
  onClose: () => void;
  save: SaveFn;
}) {
  const base = lookOf(s);
  const [look, setLook] = useState<Look>(base);
  const [busy, setBusy] = useState(false);
  useGoogleFonts(open && kind === 'name');
  useEffect(() => {
    if (open) setLook(lookOf(s));
  }, [open]);
  const primary = String(s.primary_color || '').toUpperCase();
  const scrims = /^#[0-9A-F]{6}$/.test(primary) && !SCRIMS.includes(primary) ? [...SCRIMS, primary] : SCRIMS;
  const textColors = ['#FFFFFF', '#111111', ...(/^#[0-9A-F]{6}$/.test(primary) && !['#FFFFFF', '#111111'].includes(primary) ? [primary] : [])];
  const changed =
    kind === 'logo'
      ? look.logoHeight !== base.logoHeight || look.colorMode !== base.colorMode || look.scrim !== base.scrim
      : look.font !== base.font || look.fontSize !== base.fontSize || look.nameColor !== base.nameColor || look.scrim !== base.scrim;
  const submit = async () => {
    setBusy(true);
    const ok = await save(
      kind === 'logo'
        ? {
            home_header_logo_height: look.logoHeight,
            home_header_logo_color_mode: look.colorMode,
            home_header_scrim_color: look.scrim,
          }
        : {
            home_header_title_font: look.font,
            home_header_title_font_size: look.fontSize,
            home_header_name_color: look.nameColor,
            home_header_scrim_color: look.scrim,
          },
      { error: kind === 'logo' ? 'לא ניתן לשמור את ההגדרה' : 'לא ניתן לשמור את הגופן' },
    );
    setBusy(false);
    if (ok) onClose();
  };
  const scrimCard = (hint: string) => (
    <>
      <h4>צבע הגרדיאנט העליון</h4>
      <p className="sd-card-hint">{hint}</p>
      <div className="sd-fade" style={{ background: scrimGradient(look.scrim) }} />
      <Swatches title="צבע הגרדיאנט העליון" value={look.scrim} options={scrims} onChange={(v) => v && setLook({ ...look, scrim: v })} />
    </>
  );
  return (
    <FullScreen open={open} onBack={onClose} back="none" className="sd-editor sd-custom">
      <HeroPreview s={s} look={look} mode={s.home_hero_mode} name={kind === 'name'}>
        <button type="button" className="sd-close" aria-label="סגור" onClick={onClose} disabled={busy}>
          <X size={22} />
        </button>
      </HeroPreview>
      <div className="sd-sheet has-dock">
        <i className="sd-sheet-grip" />
        {kind === 'logo' ? (
          <>
            <div className="sd-card">
              <h4>גודל הלוגו</h4>
              <Stepper
                value={look.logoHeight}
                min={28}
                max={120}
                step={4}
                less="הקטנת הלוגו"
                more="הגדלת הלוגו"
                onChange={(v) => setLook({ ...look, logoHeight: v })}
              />
            </div>
            <div className="sd-card">
              <h4>צבע הלוגו</h4>
              <div className="sd-segment">
                {(
                  [
                    ['white', 'לבן'],
                    ['original', 'צבעים מקוריים'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    type="button"
                    key={id}
                    className={look.colorMode === id ? 'is-selected' : undefined}
                    onClick={() => setLook({ ...look, colorMode: id })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="sd-card-hint">{look.colorMode === 'white' ? 'הלוגו נצבע בלבן' : 'כמו בקובץ שהועלה'}</p>
              <i className="sd-card-div" />
              {scrimCard('הרקע שדהה מאחורי הלוגו. בחרו צבע שנראה מול הלוגו.')}
            </div>
          </>
        ) : (
          <>
            <div className="sd-card">
              <h4>גופנים</h4>
              <div className="sd-fonts">
                {FONTS.map(([id, label]) => (
                  <button
                    type="button"
                    key={label}
                    className={look.font === id ? 'is-selected' : undefined}
                    onClick={() => setLook({ ...look, font: id })}
                  >
                    <b style={fontStyle(id)}>Aa</b>
                    <small>{label}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="sd-card">
              <h4>גודל הפונט</h4>
              <Stepper
                value={look.fontSize}
                min={14}
                max={72}
                step={2}
                less="הקטנת הפונט"
                more="הגדלת הפונט"
                onChange={(v) => setLook({ ...look, fontSize: v })}
              />
            </div>
            <div className="sd-card">
              <h4>צבע הטקסט</h4>
              <p className="sd-card-hint">הצבע של שם העסק על הגרדיאנט.</p>
              <Swatches title="צבע הטקסט" auto value={look.nameColor} options={textColors} onChange={(v) => setLook({ ...look, nameColor: v })} />
              <p className="sd-card-hint">
                {look.nameColor === null ? 'מתאים את הצבע לרקע' : textColors.includes(look.nameColor) ? '\u00a0' : 'הצבע שבחרתם'}
              </p>
              <i className="sd-card-div" />
              {scrimCard('הרקע שדהה מאחורי השם. בחרו צבע שהטקסט נראה עליו.')}
            </div>
          </>
        )}
      </div>
      <div className="sd-dock">
        <button type="button" className={changed ? 'is-ready' : undefined} disabled={!changed || busy} onClick={() => void submit()}>
          {busy ? 'שומר...' : 'שמור'}
        </button>
      </div>
    </FullScreen>
  );
}

function StaffPreview({ open, s, onClose }: { open: boolean; s: Settings; onClose: () => void }) {
  const people: any[] = s.staff_preview || [];
  const [picked, setPicked] = useState(0);
  const large = s.staff_selection_style !== 'avatar_list';
  return (
    <FullScreen open={open} onBack={onClose} back="none" className="sd-staff-preview">
      <button type="button" className="sd-close" aria-label="סגור" onClick={onClose}>
        <X size={22} />
      </button>
      <span className="sd-staff-chip">
        <Eye size={14} />
        כך זה יופיע אצל הלקוחות
      </span>
      {!people.length ? (
        <p className="sd-staff-empty">אין אנשי צוות להצגה</p>
      ) : large ? (
        <div className="sd-staff-cards">
          {people.map((person, i) => (
            <button type="button" key={i} className={picked === i ? 'is-picked' : undefined} onClick={() => setPicked(i)}>
              <span>{person.image_url ? <img src={person.image_url} alt="" /> : <User size={56} />}</span>
              <strong>{person.name}</strong>
            </button>
          ))}
        </div>
      ) : (
        <div className="sd-staff-list">
          {people.map((person, i) => (
            <button type="button" key={i} className={picked === i ? 'is-picked' : undefined} onClick={() => setPicked(i)}>
              <span>{person.image_url ? <img src={person.image_url} alt="" /> : <User size={22} />}</span>
              <strong>{person.name}</strong>
              {picked === i && <Check size={18} />}
            </button>
          ))}
        </div>
      )}
    </FullScreen>
  );
}

export default function DesignTab({
  s,
  slug,
  busy,
  save,
  reload,
}: {
  s: Settings;
  slug: string;
  busy: boolean;
  save: SaveFn;
  reload: () => Promise<void>;
}) {
  const [section, setSection] = useState('');
  const [screen, setScreen] = useState<'' | 'color' | 'marquee' | 'single' | 'logo' | 'name' | 'staff'>('');
  const [englishName, setEnglishName] = useState(s.home_header_text_without_logo || '');
  useEffect(() => setEnglishName(s.home_header_text_without_logo || ''), [s.home_header_text_without_logo]);
  const look = lookOf(s);
  const heroMode: 'marquee' | 'single_fullbleed' = s.home_hero_mode === 'single_fullbleed' ? 'single_fullbleed' : 'marquee';
  const staffStyle: 'large_cards' | 'avatar_list' = s.staff_selection_style === 'avatar_list' ? 'avatar_list' : 'large_cards';
  const staffLocked = Number(s.staff_count || 0) <= 1;
  const primary = String(s.primary_color || '#000000').toUpperCase();
  const toggle = (id: string) => setSection((current) => (current === id ? '' : id));
  const chevron = (id: string) =>
    section === id ? <ChevronUp size={20} strokeWidth={2.2} className="st-chev" /> : <ChevronDown size={20} strokeWidth={2.2} className="st-chev" />;

  return (
    <div className="st-card">
      <div className="sd-colorrow">
        <span className={`sd-colorrow-dot${isLight(primary) ? ' is-light' : ''}`} style={{ background: primary }} />
        <div>
          <strong>צבע ראשי</strong>
          <small dir="ltr">{primary}</small>
        </div>
        <button
          type="button"
          className="sd-colorrow-btn"
          style={{ background: isLight(primary) ? 'var(--save-bg)' : primary }}
          onClick={() => setScreen('color')}
        >
          שנה/י צבע
        </button>
      </div>
      <div className="st-div is-full" />
      <Row
        icon={<Images size={20} />}
        title="רקע עליון של דף הבית"
        subtitle={section === 'hero' ? undefined : heroMode === 'marquee' ? 'תמונות מרובות' : 'תמונה או וידאו'}
        onClick={() => toggle('hero')}
        trailing={chevron('hero')}
        last={section === 'hero'}
      >
        {section === 'hero' && (
          <div className="sd-shell">
            <div className="sd-choices">
              <Choice
                selected={heroMode === 'marquee'}
                label="תמונות מרובות"
                sub="רשת תמונות גוללת"
                onClick={() => heroMode !== 'marquee' && void save({ home_hero_mode: 'marquee' }, { error: 'לא ניתן לשמור את סוג הרקע' })}
              >
                <Mini s={s} look={look} mode="marquee" />
              </Choice>
              <Choice
                selected={heroMode === 'single_fullbleed'}
                label="תמונה או וידאו"
                sub="קובץ אחד על כל הרקע"
                onClick={() =>
                  heroMode !== 'single_fullbleed' &&
                  void save({ home_hero_mode: 'single_fullbleed' }, { error: 'לא ניתן לשמור את סוג הרקע' })
                }
              >
                <Mini s={s} look={look} mode="single_fullbleed" />
              </Choice>
            </div>
            <button
              type="button"
              className="sd-pill"
              disabled={busy}
              onClick={() => setScreen(heroMode === 'marquee' ? 'marquee' : 'single')}
            >
              {heroMode === 'marquee' ? <Images size={18} /> : <ImageIcon size={18} />}
              {heroMode === 'marquee' ? 'עריכת התמונות' : 'בחירת תמונה או וידאו'}
            </button>
          </div>
        )}
      </Row>
      {section === 'hero' && <div className="st-div" />}
      <Row
        icon={<ImageIcon size={20} />}
        title="הצגת לוגו בדף הבית"
        subtitle={
          section === 'logo'
            ? undefined
            : !look.showLogo
              ? 'שם באנגלית'
              : look.colorMode === 'original'
                ? 'לוגו בצבעים מקוריים'
                : 'לוגו (תמונה)'
        }
        onClick={() => toggle('logo')}
        trailing={chevron('logo')}
        last={section === 'logo'}
      >
        {section === 'logo' && (
          <div className="sd-shell">
            <div className="sd-choices">
              <Choice
                selected={look.showLogo}
                label="לוגו (תמונה)"
                sub="הלוגו שהעליתם"
                onClick={() => !look.showLogo && void save({ home_header_show_logo: true }, { error: 'לא ניתן לשמור את ההגדרה' })}
              >
                <Mini s={s} look={look} name={false} />
              </Choice>
              <Choice
                selected={!look.showLogo}
                label="שם באנגלית"
                sub="במקום לוגו יוצג טקסט"
                onClick={() => look.showLogo && void save({ home_header_show_logo: false }, { error: 'לא ניתן לשמור את ההגדרה' })}
              >
                <Mini s={s} look={look} name />
              </Choice>
            </div>
            {!look.showLogo && (
              <input
                className="sd-english"
                dir="ltr"
                maxLength={120}
                aria-label="שם בראש דף הבית (בלי לוגו)"
                placeholder={String(s.display_name || '').trim() || 'העסק'}
                value={englishName}
                onChange={(e) => setEnglishName(e.target.value.replace(/[^A-Za-z0-9 \-'.&,()]/g, ''))}
                onBlur={() => {
                  const next = englishName.trim();
                  if (next !== String(s.home_header_text_without_logo || '').trim())
                    void save({ home_header_text_without_logo: next }, { error: 'לא ניתן לשמור את הטקסט' });
                }}
              />
            )}
            <button type="button" className="sd-pill" disabled={busy} onClick={() => setScreen(look.showLogo ? 'logo' : 'name')}>
              <Eye size={18} />
              התאמה אישית
            </button>
          </div>
        )}
      </Row>
      {section === 'logo' && <div className="st-div" />}
      <Row
        icon={<Users size={20} />}
        title="עיצוב בחירת אנשי צוות"
        subtitle={
          staffLocked
            ? 'זמין רק כשיש יותר מאיש צוות אחד'
            : section === 'staff'
              ? undefined
              : staffStyle === 'avatar_list'
                ? 'רשימת כרטיסים'
                : 'כרטיסים גדולים'
        }
        disabled={staffLocked}
        onClick={staffLocked ? undefined : () => toggle('staff')}
        trailing={staffLocked ? null : chevron('staff')}
        last
      >
        {section === 'staff' && !staffLocked && (
          <div className="sd-shell">
            <div className="sd-choices">
              <Choice
                staff
                selected={staffStyle === 'large_cards'}
                label="כרטיסים גדולים"
                sub="תמונה גדולה מתחלפת"
                onClick={() =>
                  staffStyle !== 'large_cards' &&
                  void save({ staff_selection_style: 'large_cards' }, { error: 'לא ניתן לשמור את עיצוב הבחירה' })
                }
              >
                <StaffMini s={s} style="large_cards" />
              </Choice>
              <Choice
                staff
                selected={staffStyle === 'avatar_list'}
                label="רשימת כרטיסים"
                sub="תמונה עגולה ושם"
                onClick={() =>
                  staffStyle !== 'avatar_list' &&
                  void save({ staff_selection_style: 'avatar_list' }, { error: 'לא ניתן לשמור את עיצוב הבחירה' })
                }
              >
                <StaffMini s={s} style="avatar_list" />
              </Choice>
            </div>
            <button type="button" className="sd-pill" disabled={busy} onClick={() => setScreen('staff')}>
              <Eye size={18} />
              תצוגה מקדימה
            </button>
          </div>
        )}
      </Row>

      <ColorScreen open={screen === 'color'} saved={primary} onClose={() => setScreen('')} save={save} />
      <MarqueeEditor open={screen === 'marquee'} s={s} slug={slug} onClose={() => setScreen('')} reload={reload} />
      <SingleEditor open={screen === 'single'} s={s} slug={slug} onClose={() => setScreen('')} reload={reload} />
      <Customizer open={screen === 'logo' || screen === 'name'} kind={screen === 'name' ? 'name' : 'logo'} s={s} onClose={() => setScreen('')} save={save} />
      <StaffPreview open={screen === 'staff'} s={s} onClose={() => setScreen('')} />
    </div>
  );
}

