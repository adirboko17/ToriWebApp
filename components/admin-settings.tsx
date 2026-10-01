'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowLeftRight,
  Ban,
  Bell,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleHelp,
  ClipboardList,
  Clock,
  Gauge,
  Globe,
  Layers,
  Lock,
  LogOut,
  Mail,
  Map as MapIcon,
  MapPin,
  Megaphone,
  MessageCircle,
  Palette,
  Pencil,
  Play,
  Plus,
  Repeat,
  Scissors,
  Store,
  Trash2,
  User,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { api, applyTheme } from '@/lib/client';
import BottomSheet from './bottom-sheet';
import AdminRecurringWizard from './admin-recurring-wizard';
import { EmergencyPasscode } from './admin-clients';
import DesignTab, { SaveFn } from './settings-design';
import { BranchesTab, EmployeesTab, ServicesTab, normalizePhone } from './settings-catalog';
import {
  AlertState,
  AudienceSheet,
  CenterDialog,
  FullIntro,
  FullScreen,
  HeroCta,
  IosAlert,
  Loading,
  NumberSheet,
  RichText,
  Row,
  UField,
  compressImage,
} from './settings-kit';

type Settings = Record<string, any>;

const TABS: [string, string][] = [
  ['general', 'כללי'],
  ['appointments', 'תורים'],
  ['services', 'שירותים'],
  ['branches', 'סניפים'],
  ['employees', 'עובדים'],
  ['business', 'פרטי העסק'],
  ['design', 'עיצוב האפליקציה'],
  ['security', 'מרכז העזרה'],
];
const OWNER_TABS = new Set(['design', 'business', 'employees', 'branches']);
const LANGUAGES: [string, string, string][] = [
  ['en', '🇺🇸', 'אנגלית'],
  ['he', '🇮🇱', 'עברית'],
  ['ar', '🇸🇦', 'ערבית'],
  ['ru', '🇷🇺', 'רוסית'],
];
const AUDIENCE_SHORT: Record<string, string> = { everyone: 'כולם', registered: 'רשומים / מאושרים', off: 'כבוי' };
const AUDIENCES = {
  home_fixed_message_audience: ['מי יראה את ההודעה', 'ההודעה לא תוצג'],
  availability_meter_audience: ['מי יראה את מד הזמינות', 'מד הזמינות לא יוצג'],
  quick_slots_audience: ['מי יראה תורים זריזים', 'כפתור תורים זריזים לא יוצג'],
  map_audience: ['מי יראה את המפה', 'המפה לא תוצג'],
} as const;
type AudienceKey = keyof typeof AUDIENCES;
const HOUR_PRESETS: [number, string][] = [
  [0, 'ללא הגבלה'],
  [6, '6 שע׳'],
  [12, '12 שע׳'],
  [24, 'יום'],
  [48, 'יומיים'],
  [72, '3 ימים'],
  [168, 'שבוע'],
];
const DELETE_ITEMS = ['פרופיל המשתמש', 'כל התורים', 'אילוצי עבודה', 'שעות פעילות', 'עיצובים וגלריה', 'התראות', 'תורים חוזרים', 'רשומות רשימת המתנה'];

const hoursUnit = (n: number) => (n === 1 ? 'שעה' : 'שעות');

const brandIcon = (children: React.ReactNode, filled = false) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke={filled ? 'none' : 'currentColor'}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);
const INSTAGRAM = brandIcon(
  <>
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </>,
);
const FACEBOOK = brandIcon(<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />);
const TIKTOK = brandIcon(
  <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.6 2.6 0 0 1 0-5.2c.27 0 .53.04.78.12V9.66a5.73 5.73 0 0 0-.78-.05A5.69 5.69 0 1 0 15.55 15.3V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.3 4.3 0 0 1-3.25-1.48Z" />,
  true,
);

function TabBar({ tabs, active, onChange }: { tabs: [string, string][]; active: string; onChange: (id: string) => void }) {
  const row = useRef<HTMLDivElement>(null);
  const [line, setLine] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const button = row.current?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
      if (!button) return;
      setLine({ x: button.offsetLeft + 6, w: Math.max(12, button.offsetWidth - 12) });
      button.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [active, tabs.length]);
  return (
    <div className="st-tabs" role="tablist">
      <div className="st-tabs-row" ref={row}>
        {tabs.map(([id, label]) => (
          <button
            type="button"
            role="tab"
            aria-selected={id === active}
            key={id}
            data-tab={id}
            className={id === active ? 'is-active' : undefined}
            onClick={() => onChange(id)}
          >
            {label}
          </button>
        ))}
        {line && <i className="st-tabs-line" style={{ width: line.w, transform: `translateX(${line.x}px)` }} />}
      </div>
    </div>
  );
}

function MessageEditor({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: string;
  onClose: () => void;
  onSave: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setText(initial);
  }, [open, initial]);
  return (
    <BottomSheet open={open} onClose={onClose} title="עריכת ההודעה ללקוחות" size="auto" locked={busy} className="st-sheet st-msg">
      <div className="sheet-scroll st-msg-body">
        <p className="st-msg-hint">ירידת שורה נשמרת. אפשר להדגיש טקסט עם *כוכביות* משני הצדדים.</p>
        <textarea
          dir="rtl"
          maxLength={800}
          placeholder="הודעה ללקוחות…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="st-msg-count">{text.length}/800</p>
        <button
          type="button"
          className="st-save"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const ok = await onSave(text);
            setBusy(false);
            if (ok) onClose();
          }}
        >
          {busy ? 'שומר...' : 'שמור הודעה'}
        </button>
        <button type="button" className="st-plain" disabled={busy} onClick={onClose}>
          ביטול
        </button>
      </div>
    </BottomSheet>
  );
}

function EditAdminSheet({
  open,
  onClose,
  s,
  save,
}: {
  open: boolean;
  onClose: () => void;
  s: Settings;
  save: SaveFn;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [passcode, setPasscode] = useState(false);
  const [alert, setAlert] = useState<AlertState>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    setName(s.me?.name || '');
    setPhone(s.me?.phone || '');
  }, [open, s.me?.name, s.me?.phone]);
  const submit = async () => {
    if (!name.trim() || !phone.trim()) return setAlert({ title: 'שגיאה', message: 'אנא מלא/י שם ומספר טלפון' });
    const normalized = normalizePhone(phone);
    if (!normalized) return setAlert({ title: 'שגיאה', message: 'אנא הזן/י מספר טלפון תקין' });
    setBusy(true);
    const ok = await save({ me_name: name.trim(), me_phone: normalized }, { error: 'נכשל בשמירת פרטי המנהל/ת' });
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <BottomSheet open={open} onClose={onClose} title="עריכת מנהל" size="auto" locked={busy || uploading} className="st-sheet st-admin">
      <div className="sheet-scroll st-admin-body">
        <div className="st-admin-hero">
          <button
            type="button"
            className="st-admin-avatar"
            aria-label="החלפת תמונת פרופיל"
            disabled={uploading}
            onClick={() => file.current?.click()}
          >
            <span className="st-admin-ring">
              <span>{s.me?.image_url ? <img src={s.me.image_url} alt="" /> : <User size={42} />}</span>
            </span>
            <b className="st-admin-orb">
              <Camera size={14} />
            </b>
            {uploading && (
              <span className="st-admin-busy">
                <span className="aa-spinner" />
              </span>
            )}
          </button>
          <strong>{name || s.me?.name}</strong>
          <small dir="ltr">{phone || '-'}</small>
          <input
            ref={file}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sd-hidden-input"
            onChange={async (e) => {
              const picked = e.target.files?.[0];
              e.target.value = '';
              if (!picked) return;
              setUploading(true);
              try {
                await save({ me_image: await compressImage(picked, 600, 0.85) }, { refresh: true });
              } finally {
                setUploading(false);
              }
            }}
          />
        </div>
        <div className="st-admin-form">
          <label>
            <span>שם מנהל</span>
            <input dir="rtl" placeholder="שם מלא" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            <span>מספר טלפון</span>
            <input dir="ltr" type="tel" inputMode="tel" placeholder="(055) 123-4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <div className="st-admin-code">
            <span>
              <Lock size={14} />
              סיסמת חירום
            </span>
            <small>6 ספרות - גיבוי כש-SMS לא מגיע</small>
            <button type="button" onClick={() => setPasscode(true)}>
              {s.me?.has_code ? 'שנה קוד חירום' : 'הגדר קוד חירום'}
              <ChevronLeft size={18} />
            </button>
          </div>
        </div>
        <button type="button" className="st-save" disabled={busy} onClick={() => void submit()}>
          {busy ? <span className="aa-spinner" /> : 'שמור'}
        </button>
      </div>
      <EmergencyPasscode
        open={passcode}
        changing={Boolean(s.me?.has_code)}
        onClose={() => setPasscode(false)}
        onSubmit={async (code) => {
          if (!(await save({ me_code: code }, { refresh: true }))) throw new Error('code');
        }}
      />
      <IosAlert alert={alert} onClose={() => setAlert(null)} />
    </BottomSheet>
  );
}

function BusinessNameModal({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: string;
  onClose: () => void;
  onSave: (name: string) => Promise<boolean>;
}) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setName(initial);
  }, [open, initial]);
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="st-dialog-layer st-name-layer" dir="rtl" onClick={() => !busy && onClose()}>
      <div className="st-name-card" role="dialog" aria-modal="true" aria-label="שם העסק" onClick={(e) => e.stopPropagation()}>
        <div className="st-name-head">
          <button type="button" disabled={busy} onClick={onClose}>
            ביטול
          </button>
          <strong>שם העסק</strong>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const ok = await onSave(name.trim());
              setBusy(false);
              if (ok) onClose();
            }}
          >
            {busy ? 'שומר...' : 'שמור'}
          </button>
        </div>
        <div className="st-name-body">
          <span>שם העסק</span>
          <input autoFocus placeholder="לדוגמה: הסטודיו של הדס" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function LanguageSheet({
  open,
  value,
  onClose,
  onPick,
}: {
  open: boolean;
  value: string;
  onClose: () => void;
  onPick: (code: string) => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="שפה" size="auto" className="st-sheet st-lang">
      <div className="sheet-scroll st-lang-body">
        {LANGUAGES.map(([code, flag, label]) => (
          <button type="button" key={code} className={value === code ? 'is-selected' : undefined} onClick={() => onPick(code)}>
            <span className="st-flag">{flag}</span>
            <strong>{label}</strong>
            {value === code && (
              <span className="st-lang-check">
                <Check size={13} strokeWidth={3} />
              </span>
            )}
          </button>
        ))}
        <p className="st-lang-note">שינוי כיוון עשוי לדרוש הפעלת אפליקציה מחדש</p>
      </div>
    </BottomSheet>
  );
}

function DeleteAccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [alert, setAlert] = useState<AlertState>(null);
  return (
    <BottomSheet open={open} onClose={onClose} size="tall" className="st-sheet st-delete">
      <div className="sheet-scroll st-delete-body">
        <div className="st-delete-head">
          <span>
            <AlertTriangle size={30} strokeWidth={2.2} />
          </span>
          <h2>מחיקת חשבון</h2>
          <p>מחיקת החשבון לצמיתות</p>
        </div>
        <h3>שימו לב: הפעולה בלתי הפיכה</h3>
        <p className="st-delete-lead">מחיקת החשבון תסיר לצמיתות את:</p>
        <div className="st-delete-list">
          {DELETE_ITEMS.map((item) => (
            <div key={item}>
              <Trash2 size={17} />
              {item}
            </div>
          ))}
        </div>
        <div className="st-delete-note">לא ניתן לבטל את המחיקה. מומלץ לגבות מידע חשוב לפני ההמשך.</div>
        <button
          type="button"
          className="st-delete-go"
          onClick={() => setAlert({ title: 'מחיקת חשבון', message: 'מחיקת החשבון זמינה כרגע באפליקציה בלבד.' })}
        >
          <Trash2 size={18} />
          מחיקת חשבון
        </button>
        <button type="button" className="st-delete-cancel" onClick={onClose}>
          ביטול
        </button>
      </div>
      <IosAlert alert={alert} onClose={() => setAlert(null)} />
    </BottomSheet>
  );
}

function AddressScreen({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: string;
  onClose: () => void;
  onSave: (address: string) => Promise<boolean>;
}) {
  const [address, setAddress] = useState(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setAddress(initial);
  }, [open, initial]);
  return (
    <FullScreen open={open} onBack={onClose} backDisabled={busy}>
      <FullIntro title="כתובת העסק" subtitle="הקלידו את הכתובת המלאה של העסק" />
      <div className="st-full-form">
        <UField trailing={<MapPin size={18} strokeWidth={1.6} />}>
          <input placeholder="רחוב, מספר ועיר" value={address} onChange={(e) => setAddress(e.target.value)} />
        </UField>
        <HeroCta
          label="שמור"
          busy={busy}
          disabled={!address.trim()}
          onClick={async () => {
            setBusy(true);
            const ok = await onSave(address.trim());
            setBusy(false);
            if (ok) onClose();
          }}
        />
      </div>
    </FullScreen>
  );
}

function SocialRow({
  icon,
  iconColor,
  title,
  subtitle,
  placeholder,
  value,
  onSave,
}: {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  subtitle: string;
  placeholder: string;
  value: string;
  onSave: (url: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => setText(value), [value]);
  const valid = !text.trim() || /^https?:\/\//i.test(text.trim());
  const changed = text.trim() !== value.trim();
  return (
    <>
      <div className={`st-social${open ? ' is-open' : ''}`}>
        <button type="button" className="st-row" onClick={() => setOpen(!open)}>
          <span className="st-plate" style={{ color: iconColor }}>
            {icon}
          </span>
          <span className="st-copy">
            <strong>{title}</strong>
            <small>{subtitle}</small>
          </span>
          <ChevronLeft size={20} className="st-chev" />
        </button>
        {open && (
          <div className="st-social-edit">
            {saved ? (
              <p className="st-social-saved">
                <Check size={16} />
                נשמר
              </p>
            ) : (
              <>
                <input
                  dir="ltr"
                  type="url"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder={placeholder}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <button
                  type="button"
                  disabled={!valid || !changed || busy}
                  onClick={async () => {
                    setBusy(true);
                    const ok = await onSave(text.trim());
                    setBusy(false);
                    if (!ok) return;
                    setSaved(true);
                    setTimeout(() => {
                      setSaved(false);
                      setOpen(false);
                    }, 1500);
                  }}
                >
                  {busy ? 'שומר...' : 'שמור'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <div className="st-div" />
    </>
  );
}

const HELP_ICONS: [RegExp, typeof Calendar][] = [
  [/calendar|יומן/i, Calendar],
  [/bell|notif/i, Bell],
  [/scissor|service/i, Scissors],
  [/user|client|staff|people/i, Users],
  [/palette|design|color/i, Palette],
  [/store|business|shop/i, Store],
  [/wallet|finance|money/i, Wallet],
];

function HelpTab({ slug }: { slug: string }) {
  const [data, setData] = useState<any>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [video, setVideo] = useState<{ title: string; url: string } | null>(null);
  const load = useCallback(() => {
    setFailed(false);
    setData(null);
    api(slug, 'admin-settings-list', undefined, { part: 'help' })
      .then((next) => {
        setData(next);
        setOpen(next.categories?.[0]?.id || null);
      })
      .catch(() => setFailed(true));
  }, [slug]);
  useEffect(load, [load]);
  const categories: any[] = data?.categories || [];
  return (
    <div className="st-help">
      <div className="st-help-card st-help-intro">
        <span>
          <CircleHelp size={26} strokeWidth={2.1} />
        </span>
        <h2>איך משתמשים באפליקציה</h2>
        <p>בחרו נושא וצפו בהקלטת מסך קצרה. הכל מחולק לפי קטגוריות.</p>
      </div>
      {!data && !failed && <Loading text="טוענים את המדריכים…" />}
      {failed && (
        <div className="st-help-card st-help-empty">
          <strong>לא הצלחנו לטעון את מרכז העזרה</strong>
          <button type="button" className="st-retry" onClick={load}>
            נסו שוב
          </button>
        </div>
      )}
      {data && !categories.length && (
        <div className="st-help-card st-help-empty">
          <strong>המדריכים בדרך</strong>
          <p>סרטוני ההדרכה יופיעו כאן לפי נושאים ברגע שיפורסמו.</p>
        </div>
      )}
      {categories.map((category) => {
        const Icon = HELP_ICONS.find(([re]) => re.test(category.icon || ''))?.[1] || CircleHelp;
        const expanded = open === category.id;
        const count = category.videos.length;
        return (
          <div key={category.id} className={`st-help-card st-help-cat${expanded ? ' is-open' : ''}`}>
            <button type="button" className="st-help-head" onClick={() => setOpen(expanded ? null : category.id)}>
              <span className="st-help-icon">
                <Icon size={20} strokeWidth={2.1} />
              </span>
              <span className="st-help-copy">
                <strong>{category.title}</strong>
                <small>
                  {category.description ? `${category.description} · ` : ''}
                  {count === 1 ? 'סרטון אחד' : `${count} סרטונים`}
                </small>
              </span>
              <ChevronDown size={20} className="st-help-chev" />
            </button>
            {expanded && (
              <div className="st-help-videos">
                {category.videos.map((item: any) => (
                  <button type="button" key={item.id} onClick={() => setVideo({ title: item.title, url: item.video_url })}>
                    <span className="st-help-thumb">
                      {item.thumbnail_url && <img src={item.thumbnail_url} alt="" />}
                      <Play size={16} fill="currentColor" />
                    </span>
                    <strong>{item.title}</strong>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div className="st-help-card st-help-contact">
        <h3>עדיין צריכים עזרה?</h3>
        <p>אם לא מצאתם את מה שחיפשתם, צוות התמיכה כאן בשבילכם.</p>
        <div>
          <a href="mailto:support@wetori.co.il">
            <span>
              <Mail size={16} />
            </span>
            <strong>מייל לתמיכה</strong>
            <small>support@wetori.co.il</small>
          </a>
          <a href="https://wa.me/972535575303" target="_blank" rel="noreferrer">
            <span className="is-wa">
              <MessageCircle size={16} />
            </span>
            <strong>וואטסאפ לתמיכה</strong>
            <small dir="ltr">+972 53-557-5303</small>
          </a>
        </div>
      </div>
      {video &&
        createPortal(
          <div className="st-video-layer" dir="rtl" role="dialog" aria-modal="true" aria-label="הפעלת סרטון">
            <button type="button" className="st-video-close" onClick={() => setVideo(null)}>
              <X size={20} />
              סגירה
            </button>
            <video src={video.url} controls autoPlay playsInline />
            <p>{video.title}</p>
          </div>,
          document.body,
        )}
    </div>
  );
}

function RecurringSheets({
  slug,
  open,
  onClose,
}: {
  slug: string;
  open: boolean;
  onClose: () => void;
}) {
  const [list, setList] = useState<any[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [remove, setRemove] = useState<any>(null);
  const [removing, setRemoving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [alert, setAlert] = useState<AlertState>(null);
  const load = useCallback(
    () =>
      api(slug, 'admin-settings-list', undefined, { part: 'recurring' })
        .then((data) => setList(data.recurring || []))
        .catch(() => setList([])),
    [slug],
  );
  useEffect(() => {
    if (open) {
      setList(null);
      void load();
    }
  }, [open, load]);
  const startAdd = () => {
    onClose();
    setAdding(true);
  };
  const repeatLabel = (n: number) => (n > 1 ? `כל ${n} שבועות` : 'כל שבוע');
  return (
    <>
      <BottomSheet open={open} onClose={onClose} size={list?.length ? 'medium' : 'auto'} className="st-sheet st-rec">
        <div className="st-rec-head">
          {list && list.length > 0 ? (
            <button type="button" className="st-rec-plus" aria-label="הוספת תור קבוע" onClick={startAdd}>
              <Plus size={18} />
            </button>
          ) : (
            <span />
          )}
          <h2>תורים קבועים</h2>
          <span />
        </div>
        <div className="sheet-scroll st-rec-body">
          {!list && <Loading text="טוען..." />}
          {list && !list.length && (
            <div className="st-rec-empty">
              <span>
                <Repeat size={32} />
              </span>
              <strong>אין תורים קבועים עדיין</strong>
              <p>לחצו על + כדי להוסיף תור קבוע ללקוח</p>
              <button type="button" onClick={startAdd}>
                <Plus size={16} />
                הוספת תור קבוע
              </button>
            </div>
          )}
          {list?.map((item) => {
            const open = expanded === item.id;
            return (
              <div key={item.id} className={`st-rec-card${open ? ' is-open' : ''}`}>
                <div className="st-rec-row">
                  <button type="button" className="st-rec-main" onClick={() => setExpanded(open ? null : item.id)}>
                    <strong>{item.client_name || item.service_name}</strong>
                    <small>{repeatLabel(item.repeat_interval)}</small>
                    <ChevronDown size={18} className="st-rec-chev" />
                  </button>
                  <button type="button" className="st-rec-trash" aria-label="מחק" onClick={() => setRemove(item)}>
                    <Trash2 size={15} />
                  </button>
                </div>
                {open && (
                  <div className="st-rec-more">
                    <span className="st-rec-chip">
                      {item.day} · {item.time}
                    </span>
                    {item.client_phone && <p dir="ltr">{item.client_phone}</p>}
                    {item.service_name && <p>{item.service_name}</p>}
                    <p>תדירות: {repeatLabel(item.repeat_interval)}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </BottomSheet>
      <AdminRecurringWizard slug={slug} open={adding} onClose={() => setAdding(false)} onSaved={() => setAdding(false)} />
      <CenterDialog
        open={!!remove}
        title="מחיקת תור קבוע"
        message="האם אתה בטוח שברצונך למחוק את התור הקבוע?"
        locked={removing}
        onClose={() => setRemove(null)}
        buttons={[
          { label: 'ביטול', onClick: () => setRemove(null) },
          {
            label: 'מחק',
            kind: 'danger',
            busy: removing,
            onClick: async () => {
              setRemoving(true);
              try {
                await api(slug, 'admin-settings-list', { part: 'recurring', op: 'delete', id: remove.id });
                await load();
                setRemove(null);
              } catch {
                setRemove(null);
                setAlert({ title: 'שגיאה', message: 'נכשל במחיקת התור' });
              } finally {
                setRemoving(false);
              }
            },
          },
        ]}
      />
      <IosAlert alert={alert} onClose={() => setAlert(null)} />
    </>
  );
}

type NumberKind = 'booking' | 'client' | 'self' | 'cancel' | 'swap';

export default function AdminSettings({ slug }: { slug: string }) {
  const [s, setS] = useState<Settings | null>(null);
  const [tab, setTab] = useState('general');
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState<AlertState>(null);
  const [numberSheet, setNumberSheet] = useState<NumberKind | null>(null);
  const [pending, setPending] = useState<'cancel' | 'self' | null>(null);
  const [audience, setAudience] = useState<AudienceKey | null>(null);
  const [panel, setPanel] = useState<'' | 'message' | 'language' | 'delete' | 'admin' | 'name' | 'address' | 'recurring' | 'logout' | 'cancelApp' | 'cancelDone'>('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelRequested, setCancelRequested] = useState(false);

  const reload = useCallback(async () => {
    setS(await api(slug, 'admin-settings'));
  }, [slug]);
  useEffect(() => {
    reload().catch((e) => setAlert({ title: 'שגיאה', message: e.message }));
  }, [reload]);

  const save: SaveFn = async (patch, options = {}) => {
    setBusy(true);
    try {
      await api(slug, 'admin-settings', patch);
      if (patch.primary_color) applyTheme(patch.primary_color);
      if (options.refresh) await reload();
      else
        setS((current) => {
          if (!current) return current;
          const next: Settings = { ...current, ...patch, me: { ...current.me } };
          if ('me_name' in patch) next.me.name = patch.me_name;
          if ('me_phone' in patch) next.me.phone = patch.me_phone;
          for (const key of ['language', 'notify_new_appointment', 'notify_appointment_cancel'])
            if (key in patch) next.me[key] = patch[key];
          if (patch.require_client_approval === false) next.pending_clients = 0;
          return next;
        });
      return true;
    } catch (e: any) {
      setAlert({ title: 'שגיאה', message: options.error || e.message });
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!s)
    return (
      <div className="st-screen">
        <Loading text="טוען..." />
        <IosAlert alert={alert} onClose={() => setAlert(null)} />
      </div>
    );

  const owner = Boolean(s.owner);
  const tabs = TABS.filter(([id]) => owner || !OWNER_TABS.has(id));
  const active = tabs.some(([id]) => id === tab) ? tab : tabs[0][0];
  const selfMinutes = Number(s.admin_reminder_minutes || 0);
  const cancelHours = Number(s.min_cancellation_hours || 0);
  const swapHours = Number(s.client_swap_min_hours || 0);
  const clientMinutes = Number(s.client_reminder_minutes || 0);

  const toggleApproval = (value: boolean) => {
    if (value || !s.pending_clients) return void save({ require_client_approval: value });
    setAlert({
      title: 'יש לקוחות שממתינים לאישור',
      message: `עדיין יש ${s.pending_clients} לקוחות ברשימת האישור. כיבוי «אישור לקוחות חדשים» יאשר את כולם אוטומטית ויאפשר להם לקבוע תורים. להמשיך?`,
      buttons: [{ label: 'אשר וכבה', onClick: () => void save({ require_client_approval: false }) }, { label: 'ביטול' }],
    });
  };

  const numberConfig = (() => {
    switch (numberSheet) {
      case 'booking':
        return {
          title: 'טווח תורים פתוחים - הלוח שלך',
          explainer: [
            'המספר כאן קובע כמה ימים קדימה לקוחות יכולים לקבוע תור.',
            'למשל 14 ימים - אפשר להזמין רק לשבועיים הקרובים, לא מעבר.',
            'אפשר לבחור ערך שונה לכל עובד.',
          ],
          label: 'מספר ימים פתוחים להזמנה',
          unit: 'ימים',
          min: 0,
          max: 60,
          initial: Number(s.booking_open_days ?? 7),
          placeholder: '7',
          footnote: 'אפשר לבחור בין 0 ל־60 ימים.',
          invalid: 'הזינו מספר שלם בין 0 ל־60.',
          onSave: (n: number) => save({ booking_open_days: n }),
        };
      case 'client':
        return {
          title: 'תזכורת ללקוח לפני התור',
          explainer: [
            'בזמן שבחרת לפני התור הלקוח מקבל SMS וגם הודעת פוש באפליקציה.',
            'השליחה רק בין 08:00–21:00.',
            'אם הזמן נופל מחוץ לחלון, התזכורת תישלח בערב שלפני.',
            'למשל: תור ב־09:00 ותזכורת של 4 שעות - התזכורת תישלח בערב שלפני, בסביבות 21:00.',
          ],
          label: 'שעות לפני התור',
          unit: 'שעות',
          min: 0,
          max: 24,
          initial: Math.round(clientMinutes / 60),
          placeholder: '0',
          footnote: '0–24 שעות. 0 מכבה את התזכורת.',
          invalid: 'הזינו מספר שלם בין 0 ל־24.',
          onSave: (n: number) => save({ client_reminder_minutes: n * 60 }),
        };
      case 'self':
        return {
          title: 'תזכורת עצמית לפני תור',
          explainer: [
            'תקבלו התראה במכשיר כמה דקות לפני כל תור שקבוע אצלכם.',
            'אפשר לבחור בין 5 ל־60 דקות.',
            'כדי לכבות לגמרי, השתמשו במתג בהגדרות.',
          ],
          label: 'דקות לפני התור',
          unit: 'דקות',
          min: 5,
          max: 60,
          initial: selfMinutes || 15,
          placeholder: '15',
          footnote: '5–60 דקות. לכיבוי השתמשו במתג בהגדרות.',
          invalid: 'הזינו מספר שלם בין 5 ל־60.',
          onSave: (n: number) => save({ admin_reminder_minutes: n }),
        };
      case 'cancel':
      case 'swap': {
        const swap = numberSheet === 'swap';
        return {
          title: swap ? 'מתי נסגרות החלפות תור' : 'זמן ביטול תור',
          explainer: swap
            ? ['כאן בוחרים מתי נסגרות החלפות בין לקוחות.', 'למשל 12 שעות - קרוב יותר לתור כבר אי אפשר להחליף.', 'כך נמנעות החלפות ברגע האחרון.']
            : [
                'כאן בוחרים כמה שעות לפני התור עדיין אפשר לבטל.',
                'למשל 24 שעות - ביטול באותו היום כבר לא אפשרי.',
                '0 משמעו ללא הגבלה: אפשר לבטל עד הרגע האחרון.',
              ],
          label: 'שעות לפני התור',
          unit: 'שעות',
          min: 0,
          max: 168,
          step: 6,
          maxLength: 3,
          presets: HOUR_PRESETS,
          initial: swap ? swapHours : cancelHours || 24,
          placeholder: '0',
          invalid: 'אנא הזן מספר בין 0 ל־168 שעות',
          onSave: (n: number) => save(swap ? { client_swap_min_hours: n } : { min_cancellation_hours: n }),
        };
      }
      default:
        return null;
    }
  })();

  const closeNumber = () => {
    setNumberSheet(null);
    setPending(null);
  };

  const general = (
    <>
      <div className="st-card">
        {owner && (
          <>
            <Row
              icon={<User size={20} />}
              title="אישור לקוחות חדשים"
              subtitle="כשמופעל - נרשמים חדשים ממתינים לאישורך לפני קביעת תורים"
              dim={!s.require_client_approval}
              toggle={{ checked: Boolean(s.require_client_approval), onChange: toggleApproval, disabled: busy }}
            />
            <Row
              icon={<Megaphone size={20} />}
              title="הודעה קבועה בדף הבית"
              subtitle={AUDIENCE_SHORT[s.home_fixed_message_audience]}
              disabled={busy}
              onClick={() => setAudience('home_fixed_message_audience')}
            >
              {s.home_fixed_message_audience !== 'off' && (
                <div className="st-msg-block">
                  {s.home_fixed_message?.trim() && (
                    <div className="st-msg-preview">
                      <span>כך זה יופיע אצל הלקוחות</span>
                      <div>
                        <RichText text={s.home_fixed_message} />
                      </div>
                    </div>
                  )}
                  <button type="button" className="st-msg-cta" onClick={() => setPanel('message')}>
                    <Pencil size={14} strokeWidth={2} />
                    לחץ כאן כדי לערוך את ההודעה
                  </button>
                </div>
              )}
            </Row>
            <Row
              icon={<Gauge size={20} />}
              title="מד זמינות תורים"
              subtitle={AUDIENCE_SHORT[s.availability_meter_audience]}
              disabled={busy}
              onClick={() => setAudience('availability_meter_audience')}
            />
            <Row
              icon={<Zap size={20} />}
              title="תורים זריזים"
              subtitle={AUDIENCE_SHORT[s.quick_slots_audience]}
              disabled={busy}
              onClick={() => setAudience('quick_slots_audience')}
            />
            <Row
              icon={<ClipboardList size={20} />}
              title="הצהרת בריאות"
              subtitle="טפסים ושיוך לשירותים"
              trailing={<span className="st-app-only">זמין באפליקציה בלבד</span>}
            />
          </>
        )}
        <Row
          icon={<Globe size={20} />}
          title="שפה"
          subtitle={LANGUAGES.find(([code]) => code === s.me?.language)?.[2] || 'עברית'}
          onClick={() => setPanel('language')}
        />
        <Row
          icon={<Trash2 size={20} />}
          iconColor="#FF3B30"
          title="מחיקת חשבון"
          subtitle="מחיקת החשבון לצמיתות"
          onClick={() => setPanel('delete')}
          last={!owner}
        />
        {owner &&
          (cancelRequested ? (
            <Row icon={<Clock size={20} />} iconColor="#4a4a4a" title="ביטול מתוזמן לסוף מחזור החיוב" last />
          ) : (
            <Row
              icon={<Ban size={20} />}
              iconColor="#FF3B30"
              title="ביטול האפליקציה"
              danger
              onClick={() => {
                setCancelError('');
                setPanel('cancelApp');
              }}
              trailing={null}
              last
            />
          ))}
      </div>
      <button type="button" className="st-logout" onClick={() => setPanel('logout')}>
        <LogOut size={20} />
        התנתקות
      </button>
    </>
  );

  const appointments = (
    <div className="st-card">
      {owner && (
        <Row
          icon={<Calendar size={20} />}
          title="עד כמה ימים קדימה ניתן להזמין?"
          subtitle={`${s.booking_open_days ?? 7} ימים קדימה`}
          onClick={() => setNumberSheet('booking')}
        />
      )}
      <Row icon={<Repeat size={20} />} title="תורים קבועים" subtitle="צפייה ברשימה והוספה עם +" onClick={() => setPanel('recurring')} />
      {owner && (
        <>
          <Row
            icon={<Bell size={20} />}
            title="תזכורת ללקוח לפני התור"
            subtitle={
              clientMinutes > 0
                ? Math.max(1, Math.round(clientMinutes / 60)) === 1
                  ? 'שעה לפני'
                  : `${Math.max(1, Math.round(clientMinutes / 60))} שעות לפני`
                : 'הקישו לעריכת זמן התזכורת'
            }
            onClick={() => setNumberSheet('client')}
          />
          <Row
            icon={<Clock size={20} />}
            title="זמן ביטול תור"
            dim={!(cancelHours > 0 || pending === 'cancel')}
            subtitle={
              cancelHours > 0
                ? `ניתן לבטל עד ${cancelHours} ${hoursUnit(cancelHours)} לפני מועד התור`
                : pending === 'cancel'
                  ? 'הקישו לעריכת הזמן'
                  : 'כבוי - ניתן לבטל תור בכל עת'
            }
            onTitle={cancelHours > 0 ? () => setNumberSheet('cancel') : undefined}
            toggle={{
              checked: cancelHours > 0 || pending === 'cancel',
              disabled: busy,
              onChange: (on) => {
                if (!on) return void save({ min_cancellation_hours: 0 });
                setPending('cancel');
                setNumberSheet('cancel');
              },
            }}
          />
        </>
      )}
      <Row
        icon={<Clock size={20} />}
        title="תזכורת עצמית לפני תור"
        dim={!(selfMinutes > 0 || pending === 'self')}
        subtitle={selfMinutes > 0 ? `${selfMinutes} דק׳ לפני` : pending === 'self' ? 'הקישו לעריכת הזמן' : 'כבוי'}
        onTitle={selfMinutes > 0 ? () => setNumberSheet('self') : undefined}
        toggle={{
          checked: selfMinutes > 0 || pending === 'self',
          disabled: busy,
          onChange: (on) => {
            if (!on) return void save({ admin_reminder_minutes: 0 });
            setPending('self');
            setNumberSheet('self');
          },
        }}
      />
      <Row
        icon={<Bell size={20} />}
        title="התראה על תור חדש"
        subtitle="פוש בכל פעם שלקוח קובע תור"
        dim={!s.me?.notify_new_appointment}
        toggle={{
          checked: s.me?.notify_new_appointment !== false,
          disabled: busy,
          onChange: (value) => void save({ notify_new_appointment: value }),
        }}
      />
      <Row
        icon={<Bell size={20} />}
        title="התראה על ביטול תור"
        subtitle="פוש בכל פעם שלקוח מבטל תור"
        dim={!s.me?.notify_appointment_cancel}
        last={!owner}
        toggle={{
          checked: s.me?.notify_appointment_cancel !== false,
          disabled: busy,
          onChange: (value) => void save({ notify_appointment_cancel: value }),
        }}
      />
      {owner && (
        <>
          <Row
            icon={<ArrowLeftRight size={20} />}
            title="החלפת תורים בין לקוחות"
            subtitle="לקוחות יוכלו להציע ולבצע החלפת משבצות זמן"
            dim={!s.client_swap_enabled}
            toggle={{
              checked: Boolean(s.client_swap_enabled),
              disabled: busy,
              onChange: (value) => void save({ client_swap_enabled: value }),
            }}
          />
          {s.client_swap_enabled && (
            <Row
              icon={<Clock size={20} />}
              title="סגירת החלפות לפני התור"
              subtitle={
                swapHours > 0
                  ? `בקשות יורדות אוטומטית ${swapHours} ${hoursUnit(swapHours)} לפני מועד התור`
                  : 'הבקשות נשארות עד תחילת התור'
              }
              onClick={() => setNumberSheet('swap')}
              trailing={<ChevronLeft size={18} className="st-chev is-grey" />}
            />
          )}
          <Row
            icon={<Layers size={20} />}
            title="כמה שירותים באותו תור"
            subtitle={
              <>
                כבוי: שירות אחד לתור.
                <br />
                מופעל: כמה שירותים באותו מועד
              </>
            }
            dim={!s.allow_multi_service_booking}
            last
            toggle={{
              checked: Boolean(s.allow_multi_service_booking),
              disabled: busy,
              onChange: (value) => void save({ allow_multi_service_booking: value }),
            }}
          />
        </>
      )}
    </div>
  );

  const business = (
    <div className="st-card">
      <Row
        icon={<MapPin size={20} />}
        iconColor="#FF3B30"
        title="כתובת העסק"
        subtitle={s.address || 'הוסף/י כתובת'}
        onClick={() => setPanel('address')}
      />
      <Row
        icon={<MapIcon size={20} />}
        title="מפת העסק"
        subtitle={AUDIENCE_SHORT[s.map_audience]}
        disabled={busy}
        onClick={() => setAudience('map_audience')}
      />
      <SocialRow
        icon={INSTAGRAM}
        iconColor="#E4405F"
        title="אינסטגרם"
        subtitle="קישור לעמוד או לפרופיל העסק"
        placeholder="https://instagram.com/yourpage"
        value={s.instagram_url || ''}
        onSave={(url) => save({ instagram_url: url }, { error: 'שמירת קישור אינסטגרם נכשלה' })}
      />
      <SocialRow
        icon={FACEBOOK}
        iconColor="#1877F2"
        title="פייסבוק"
        subtitle="קישור לעמוד העסק בפייסבוק"
        placeholder="https://facebook.com/yourpage"
        value={s.facebook_url || ''}
        onSave={(url) => save({ facebook_url: url }, { error: 'שמירת קישור פייסבוק נכשלה' })}
      />
      <SocialRow
        icon={TIKTOK}
        iconColor="#000000"
        title="טיקטוק"
        subtitle="קישור לפרופיל @ של העסק"
        placeholder="https://www.tiktok.com/@yourpage"
        value={s.tiktok_url || ''}
        onSave={(url) => save({ tiktok_url: url }, { error: 'שמירת קישור טיקטוק נכשלה' })}
      />
    </div>
  );

  const audienceMeta = audience ? AUDIENCES[audience] : null;

  return (
    <div className="st-screen">
      <div className="st-top">
        <div className="st-profile">
          <div className="st-profile-bg" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="st-identity">
            <button type="button" className="st-avatar" aria-label="עריכת מנהל" onClick={() => setPanel('admin')}>
              <span>{s.me?.image_url ? <img src={s.me.image_url} alt="" /> : <User size={32} strokeWidth={1.75} />}</span>
            </button>
            <div className="st-idtext">
              <button
                type="button"
                className={`st-bizname${s.display_name ? '' : ' is-empty'}`}
                onClick={() => setPanel(owner ? 'name' : 'admin')}
              >
                {s.display_name || 'הוספת שם העסק'}
              </button>
              <button type="button" className="st-idrest" onClick={() => setPanel('admin')}>
                <strong>{s.me?.name || 'Manager'}</strong>
                <span dir="ltr">{s.me?.phone || 'Phone Number'}</span>
              </button>
            </div>
          </div>
          <button type="button" className="st-pencil" aria-label="עריכת מנהל" onClick={() => setPanel('admin')}>
            <Pencil size={20} strokeWidth={2} />
          </button>
        </div>
        <TabBar tabs={tabs} active={active} onChange={setTab} />
      </div>

      <div className={`st-body is-${active}`}>
        {active === 'general' && general}
        {active === 'appointments' && appointments}
        {active === 'business' && business}
        {active === 'security' && <HelpTab slug={slug} />}
        {active === 'design' && <DesignTab s={s} slug={slug} busy={busy} save={save} reload={reload} />}
        {active === 'services' && <ServicesTab slug={slug} />}
        {active === 'employees' && <EmployeesTab slug={slug} />}
        {active === 'branches' && <BranchesTab slug={slug} />}
      </div>

      {numberConfig && (
        <NumberSheet
          open={!!numberSheet}
          onClose={closeNumber}
          {...numberConfig}
          onSave={async (n) => {
            const ok = await numberConfig.onSave(n);
            if (ok) setPending(null);
            return ok;
          }}
        />
      )}
      <AudienceSheet
        open={!!audience}
        onClose={() => setAudience(null)}
        title={audienceMeta?.[0] || ''}
        offText={audienceMeta?.[1] || ''}
        value={audience ? s[audience] : ''}
        busy={busy}
        onPick={async (value) => {
          if (!audience) return;
          if (value === s[audience]) return setAudience(null);
          const ok = await save(
            { [audience]: value },
            { error: audience === 'map_audience' ? 'לא ניתן לשמור את הגדרת המפה' : undefined },
          );
          if (ok) setAudience(null);
        }}
      />
      <MessageEditor
        open={panel === 'message'}
        initial={s.home_fixed_message || ''}
        onClose={() => setPanel('')}
        onSave={(text) => save({ home_fixed_message: text })}
      />
      <LanguageSheet
        open={panel === 'language'}
        value={s.me?.language || 'he'}
        onClose={() => setPanel('')}
        onPick={async (code) => {
          if (await save({ language: code })) setPanel('');
        }}
      />
      <DeleteAccountSheet open={panel === 'delete'} onClose={() => setPanel('')} />
      <EditAdminSheet open={panel === 'admin'} onClose={() => setPanel('')} s={s} save={save} />
      <BusinessNameModal
        open={panel === 'name'}
        initial={s.display_name || ''}
        onClose={() => setPanel('')}
        onSave={(name) => save({ display_name: name }, { error: 'שמירת שם העסק נכשלה' })}
      />
      <AddressScreen
        open={panel === 'address'}
        initial={s.address || ''}
        onClose={() => setPanel('')}
        onSave={(address) => save({ address }, { error: 'שמירת הכתובת נכשלה' })}
      />
      <RecurringSheets slug={slug} open={panel === 'recurring'} onClose={() => setPanel('')} />
      <CenterDialog
        open={panel === 'logout'}
        title="התנתקות"
        message="האם להתנתק מהחשבון?"
        onClose={() => setPanel('')}
        buttons={[
          { label: 'ביטול', onClick: () => setPanel('') },
          {
            label: 'התנתקות',
            kind: 'primary',
            onClick: async () => {
              try {
                await api(slug, 'logout', {});
              } finally {
                location.assign(`/${slug}`);
              }
            },
          },
        ]}
      />
      <CenterDialog
        open={panel === 'cancelApp'}
        title="ביטול האפליקציה"
        message="זו פעולה שאי אפשר להחזיר אחורה. בסוף התהליך כל המידע יימחק, והאפליקציה תפסיק לעבוד."
        locked={cancelBusy}
        onClose={() => setPanel('')}
        buttons={[
          { label: 'חזרה', onClick: () => setPanel('') },
          {
            label: 'אישור ביטול',
            kind: 'danger',
            busy: cancelBusy,
            onClick: async () => {
              setCancelBusy(true);
              setCancelError('');
              try {
                await api(slug, 'admin-cancel-app', {});
                setCancelRequested(true);
                setPanel('cancelDone');
              } catch {
                setCancelError('לא הצלחנו לשלוח את הבקשה. נסו שוב בעוד רגע.');
              } finally {
                setCancelBusy(false);
              }
            },
          },
        ]}
      >
        {cancelError && <p className="st-dialog-error">{cancelError}</p>}
      </CenterDialog>
      <CenterDialog
        open={panel === 'cancelDone'}
        title="ביטול האפליקציה"
        message="הבקשה נקלטה. האפליקציה תמשיך לעבוד עד סוף מחזור החיוב הנוכחי. אחר כך היא כבר לא תעבוד ולא תחויבו שוב."
        onClose={() => setPanel('')}
        buttons={[{ label: 'הבנתי', kind: 'primary', onClick: () => setPanel('') }]}
      />
      <IosAlert alert={alert} onClose={() => setAlert(null)} />
    </div>
  );
}
