'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  Check,
  ChevronLeft,
  FileText,
  Globe,
  Lock,
  LogOut,
  Phone,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { api } from '@/lib/client';
import BottomSheet from './bottom-sheet';
import BrandImage from './brand-image';

const LANGUAGES = [
  { code: 'en', flag: '🇺🇸', label: 'אנגלית' },
  { code: 'he', flag: '🇮🇱', label: 'עברית' },
  { code: 'ar', flag: '🇸🇦', label: 'ערבית' },
  { code: 'ru', flag: '🇷🇺', label: 'רוסית' },
];

const TERMS: [string, string][] = [
  ['', 'ברוכים הבאים לאפליקציית ניהול התורים. השימוש שלך באפליקציה ובשירותים הנלווים כפוף לתנאים המפורטים במסמך זה ומהווה הסכמה מלאה ומודעת לכל הוראותיו.'],
  ['1. יצירת חשבון וזיהוי', 'כדי להשתמש בשירותים ייתכן שתידרש/י למסור פרטי זיהוי כגון שם ומספר טלפון. הנך מצהיר/ה כי הפרטים שמסרת נכונים ומעודכנים ותעדכן/י אותם לפי הצורך. אין להשתמש בפרטים של אדם אחר ללא רשותו.'],
  ['2. קביעת תור ושינויים', 'קביעת תור, שינוי או ביטול נעשים באמצעות האפליקציה ובהתאם לזמינות. פרטי התור המאושר יוצגו באפליקציה ויישלחו כהתראה בהתאם להגדרות. זמני השירות משוערים ועשויים להשתנות בשל אילוצים תפעוליים.'],
  ['3. ביטולים ואי-הגעה', 'ניתן לבטל או לשנות תור בתוך זמן סביר לפני מועדו. אי-הגעה או איחור משמעותי עשויים לגרור הגבלות עתידיות על קביעת תורים, לפי שיקול דעת העסק.'],
  ['4. תשלומים וקבלות', 'אם התשלום מתבצע דרך האפליקציה, הוא עשוי לעבור באמצעות ספקי סליקה צד שלישי. פרטי אמצעי התשלום אינם נשמרים בשרתינו מעבר לנדרש לביצוע העסקה. אם התשלום מתבצע בעסק, הוא יוסדר ישירות בינך לבין העסק.'],
  ['5. התראות והודעות', 'ניתן להפעיל או לכבות התראות מהאפליקציה או דרך הגדרות המכשיר. כיבוי התראות עלול להשפיע על קבלת תזכורות ועדכונים חשובים.'],
  ['6. פרטיות ואבטחת מידע', 'אנו עשויים לאסוף ולעבד מידע הנדרש להפעלת השירות, לרבות פרטי זיהוי בסיסיים ונתוני תורים. המידע נשמר ומעובד בהתאם לדין החל ולמדיניות הפרטיות. ניתן לפנות אלינו לצורך עיון, עדכון או מחיקה של מידע אישי, בכפוף לחובותינו החוקיות.'],
  ['7. שימוש מותר והתנהגות', 'אין להשתמש בשירות באופן הפוגע בזכויות אחרים, מפר את החוק או משבש את פעילות האפליקציה. אנו רשאים להגביל או לחסום גישה במקרים של שימוש לרעה או הפרת תנאים אלו.'],
  ['8. קניין רוחני', 'כל הזכויות באפליקציה, לרבות שם, לוגו, עיצובים, תכנים, קוד ותמונות, שמורות לבעליהן. אין להעתיק, לשנות, להפיץ או ליצור יצירות נגזרות ללא אישור מראש ובכתב.'],
  ['9. הגבלת אחריות', 'השירות ניתן כפי שהוא (AS-IS) וכפוף לזמינות. איננו אחראים לנזקים עקיפים או תוצאתיים או לאובדן רווחים הנובעים מהשימוש באפליקציה. האחריות לשימוש ולתוכן שתמסרו מוטלת עליכם בלבד.'],
  ['10. זמינות ושינויים בשירות', 'ייתכנו הפסקות, תקלות או עבודות תחזוקה. אנו רשאים לעדכן, לשנות או להפסיק את השירות, כולו או חלקו, מעת לעת.'],
  ['11. צדדים שלישיים', 'האפליקציה עשויה לכלול קישורים או שירותים של צדדים שלישיים, כגון שירותי תשלום או הודעות. איננו אחראים לאתרים או שירותים אלו, והתנאים שלהם יחולו על השימוש בהם.'],
  ['12. שימוש על ידי קטינים', 'אם אינך בגיל החוקי לפי הדין החל, השימוש באפליקציה מחייב הסכמה של הורה או אפוטרופוס חוקי.'],
  ['13. עדכון התנאים', 'אנו רשאים לעדכן תנאים אלו מעת לעת. פרסום גרסה מעודכנת באפליקציה יהווה הודעה על שינוי. המשך שימוש לאחר העדכון מהווה הסכמה לטקסט המעודכן.'],
  ['14. יצירת קשר', 'לשאלות, בעיות או בקשות בנוגע לתנאים אלו או לשירות, ניתן ליצור קשר באמצעות פרטי ההתקשרות של העסק המוצגים באפליקציה.'],
];

function Dialog({
  open,
  onClose,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  className: string;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(frame);
    }
    setShown(false);
    const timer = setTimeout(() => setMounted(false), 240);
    return () => clearTimeout(timer);
  }, [open]);
  if (!mounted) return null;
  return createPortal(
    <div className={`pf-layer ${className}${shown ? ' is-open' : ''}`} dir="rtl" onClick={onClose}>
      <div className="pf-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function Row({
  icon,
  title,
  subtitle,
  danger,
  chevron = true,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  danger?: boolean;
  chevron?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`pf-row${danger ? ' is-danger' : ''}`} onClick={onClick}>
      <span className="pf-row-icon">{icon}</span>
      <span className="pf-row-copy">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      {chevron && (
        <span className="pf-row-chevron">
          <ChevronLeft size={18} />
        </span>
      )}
    </button>
  );
}

export default function ClientProfile({
  slug,
  data,
  onUser,
}: {
  slug: string;
  data: any;
  onUser: (user: any) => void;
}) {
  const user = data.user;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const language = LANGUAGES.some((l) => l.code === user?.language) ? user.language : 'he';
  useEffect(() => {
    if (!user) location.replace(`/${slug}/login`);
  }, [user, slug]);
  if (!user) return null;

  const openEdit = () => {
    setName(user.name || '');
    setEditing(true);
  };
  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      alert('נא להזין שם');
      return;
    }
    setSaving(true);
    try {
      onUser(await api(slug, 'profile', { name: trimmed, language }));
      setEditing(false);
    } catch {
      alert('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };
  const chooseLanguage = async (code: string) => {
    setLanguageOpen(false);
    try {
      onUser(await api(slug, 'profile', { name: user.name || 'לקוח', language: code }));
    } catch {}
  };
  const upload = async (picked?: File) => {
    if (!picked) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('image', picked);
      const response = await fetch(`/api/b/${slug}/avatar`, { method: 'POST', body: form });
      const updated: any = await response.json();
      if (!response.ok) throw new Error(updated.error);
      onUser(updated);
    } catch {
      alert('נכשל בהעלאת התמונה');
    } finally {
      setUploading(false);
      if (file.current) file.current.value = '';
    }
  };
  const remove = async () => {
    if (deleting || !confirm('האם למחוק את החשבון? לא ניתן לבטל פעולה זו.')) return;
    setDeleting(true);
    try {
      await api(slug, 'delete-account', {});
      onUser(null);
      location.replace(`/${slug}/login`);
    } catch {
      alert('נכשל במחיקת החשבון');
      setDeleting(false);
    }
  };
  const logout = async () => {
    setLogoutOpen(false);
    try {
      await api(slug, 'logout', {});
    } finally {
      onUser(null);
      location.assign(`/${slug}`);
    }
  };

  return (
    <div className="pf">
      <div className="pf-hero">
        <span className="pf-lava" aria-hidden>
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        <div className="pf-hero-row">
          <div className="pf-avatar-wrap">
            <span className="pf-ring">
              <span className="pf-avatar">
                {user.image_url ? (
                  <BrandImage sources={[user.image_url]} alt="" fallback={<User size={32} strokeWidth={1.75} />} />
                ) : (
                  <User size={32} strokeWidth={1.75} />
                )}
              </span>
            </span>
            <button
              type="button"
              className="pf-camera"
              aria-label="החלפת תמונת פרופיל"
              disabled={uploading}
              onClick={() => file.current?.click()}
            >
              {uploading ? <span className="cc-spinner is-tiny" /> : <Camera size={14} fill="currentColor" stroke="var(--primary)" />}
            </button>
            <input
              ref={file}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => upload(e.target.files?.[0])}
            />
          </div>
          <div className="pf-hero-copy">
            <strong>{user.name || 'לקוח יקר'}</strong>
            <span>{user.phone || 'מספר טלפון'}</span>
          </div>
        </div>
      </div>
      <div className="pf-body">
        <div className="pf-card">
          <Row icon={<User size={20} />} title="עריכת פרופיל" subtitle="עדכון פרטים אישיים" onClick={openEdit} />
          <i className="pf-divider" />
          <Row
            icon={<Globe size={20} />}
            title="שפה"
            subtitle={LANGUAGES.find((l) => l.code === language)!.label}
            onClick={() => setLanguageOpen(true)}
          />
          <i className="pf-divider" />
          <Row
            icon={<FileText size={20} />}
            title="תנאי שימוש"
            subtitle="צפייה בתנאי השימוש של האפליקציה"
            onClick={() => setTermsOpen(true)}
          />
          <i className="pf-divider" />
          <Row
            icon={<Trash2 size={20} />}
            title="מחיקת חשבון"
            subtitle="מחיקת החשבון לצמיתות"
            danger
            onClick={remove}
          />
          <i className="pf-divider" />
          <Row
            icon={<LogOut size={20} />}
            title="התנתקות"
            subtitle="ניתן להתחבר שוב בכל זמן"
            danger
            chevron={false}
            onClick={() => setLogoutOpen(true)}
          />
        </div>
      </div>

      <Dialog open={editing} onClose={() => !saving && setEditing(false)} className="pf-edit">
        <div className="pf-edit-head">
          <span />
          <div>
            <h2>עריכת פרופיל</h2>
            <p>עדכן את הפרטים האישיים שלך</p>
          </div>
          <button type="button" aria-label="סגור" onClick={() => setEditing(false)}>
            <X size={22} />
          </button>
        </div>
        <div className="pf-fields">
          <label className="pf-field">
            <span className="pf-field-icon">
              <User size={18} />
            </span>
            <input
              value={name}
              placeholder="שם מלא"
              autoComplete="name"
              autoCorrect="off"
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
            />
          </label>
          <div>
            <label className="pf-field is-locked">
              <span className="pf-field-icon">
                <Phone size={18} />
              </span>
              <input value={user.phone || ''} placeholder="מספר טלפון" readOnly dir="ltr" aria-label="טלפון" />
              <Lock size={16} className="pf-lock" />
            </label>
            <p className="pf-hint">מספר הטלפון משמש להתחברות ולא ניתן לעריכה</p>
          </div>
        </div>
        <div className="pf-edit-actions">
          <button type="button" className="is-cancel" disabled={saving} onClick={() => setEditing(false)}>
            ביטול
          </button>
          <button type="button" className="is-save" disabled={saving} onClick={save}>
            {saving ? <span className="cc-spinner is-small is-white" /> : 'שמור'}
          </button>
        </div>
      </Dialog>

      <BottomSheet open={languageOpen} onClose={() => setLanguageOpen(false)} size="auto" className="pf-sheet" title="שפה">
        <div className="pf-languages">
          {LANGUAGES.map((l) => (
            <button
              type="button"
              key={l.code}
              className={l.code === language ? 'is-on' : ''}
              aria-pressed={l.code === language}
              onClick={() => chooseLanguage(l.code)}
            >
              <span className="pf-lang-main">
                <span className="pf-flag">{l.flag}</span>
                <span>{l.label}</span>
              </span>
              {l.code === language && (
                <span className="pf-check">
                  <Check size={13} strokeWidth={3} />
                </span>
              )}
            </button>
          ))}
        </div>
        <p className="pf-note">שינוי כיוון עשוי לדרוש הפעלת אפליקציה מחדש</p>
      </BottomSheet>

      <BottomSheet open={termsOpen} onClose={() => setTermsOpen(false)} size="tall" className="pf-sheet pf-terms">
        <div className="pf-terms-head">
          <span />
          <h2>תנאי שימוש</h2>
          <button type="button" aria-label="סגור" onClick={() => setTermsOpen(false)}>
            <X size={22} />
          </button>
        </div>
        <div className="sheet-scroll pf-terms-body">
          {TERMS.map(([heading, text], index) => (
            <section key={index}>
              {heading && <h3>{heading}</h3>}
              <p>{text}</p>
            </section>
          ))}
        </div>
      </BottomSheet>

      <Dialog open={logoutOpen} onClose={() => setLogoutOpen(false)} className="pf-logout">
        <h2>התנתקות</h2>
        <p>האם להתנתק מהחשבון?</p>
        <div className="pf-logout-actions">
          <button type="button" className="is-cancel" onClick={() => setLogoutOpen(false)}>
            ביטול
          </button>
          <button type="button" className="is-confirm" onClick={logout}>
            התנתקות
          </button>
        </div>
      </Dialog>
    </div>
  );
}
