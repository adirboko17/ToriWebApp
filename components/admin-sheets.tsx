'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  Check,
  Hourglass,
  ImagePlus,
  LayoutGrid,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import BottomSheet from './bottom-sheet';
import { api } from '@/lib/client';
import { addDays, israelNow } from '@/lib/availability';
import { parseIsraeliMobileNational10, phonesMatch } from '@/lib/phone';

const periodLabels: Record<string, string> = {
  morning: 'בוקר',
  afternoon: 'צהריים',
  evening: 'ערב',
  any: 'בכל שעה',
};
const isVideo = (url: string) => /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url);

function initials(name: string) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return parts[0].charAt(0) + parts[parts.length - 1].charAt(0);
  return Array.from(String(name || '?').trim()).slice(0, 2).join('') || '?';
}
function dateHeading(date: string) {
  const today = israelNow().date;
  if (date === today) return 'היום';
  if (date === addDays(today, 1)) return 'מחר';
  return new Date(date + 'T12:00:00Z').toLocaleDateString('he-IL', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
function whatsappUrl(phone: string) {
  const national = parseIsraeliMobileNational10(phone);
  const digits = national ? `972${national.slice(1)}` : String(phone).replace(/\D/g, '');
  return `https://wa.me/${digits}`;
}
function formatPrice(price: number) {
  return `₪${price % 1 === 0 ? price.toFixed(0) : price.toFixed(2)}`;
}
async function compressImage(file: File, max: number) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('לא ניתן לקרוא את התמונה'));
      el.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function ConfirmDelete({
  target,
  title,
  busy,
  onCancel,
  onConfirm,
}: {
  target: string | null;
  title: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(v) => !v && !busy && onCancel()}>
      <DialogContent className="tori-dialog" dir="rtl">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          האם למחוק את &quot;{target}&quot;? לא ניתן לבטל פעולה זו.
        </DialogDescription>
        <div className="broadcast-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>
            ביטול
          </button>
          <button type="button" className="primary-button sheet-danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'מוחקים…' : 'מחק לצמיתות'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function WaitlistSheet({
  slug,
  open,
  onClose,
  entries,
  clients,
  onBook,
  onChanged,
}: {
  slug: string;
  open: boolean;
  onClose: () => void;
  entries: any[];
  clients: any[];
  onBook: (entry: any) => void;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const sections = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const e of entries) map.set(e.requested_date, [...(map.get(e.requested_date) || []), e]);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [entries]);
  async function remove() {
    setBusy(true);
    setError('');
    try {
      await api(slug, 'admin-waitlist', { remove: pending.id });
      setPending(null);
      onChanged();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <BottomSheet open={open} onClose={onClose} title="רשימת המתנה" size="tall">
      <div className="sheet-scroll">
        {error && (
          <p className="error-note" role="alert">
            {error}
          </p>
        )}
        {!sections.length ? (
          <div className="sheet-empty-card">
            <span>
              <i>
                <Hourglass size={30} />
              </i>
            </span>
            <strong>אין ממתינים ברשימה</strong>
            <p>כרגע אין לקוחות שממתינים לתור</p>
          </div>
        ) : (
          sections.map(([date, rows]) => (
            <section key={date}>
              <div className="sheet-date">
                <h3>{dateHeading(date)}</h3>
                <i />
              </div>
              {rows.map((entry: any) => {
                const image = clients.find((c) => phonesMatch(c.phone, entry.client_phone))?.image_url;
                return (
                  <article className="waitlist-entry" key={entry.id}>
                    <button type="button" className="waitlist-entry-main" onClick={() => onBook(entry)}>
                      <span className="waitlist-avatar">
                        <span>{image ? <img src={image} alt="" /> : initials(entry.client_name)}</span>
                      </span>
                      <span className="waitlist-entry-info">
                        <strong>{entry.client_name}</strong>
                        {entry.service_name && <em>{entry.service_name}</em>}
                        {periodLabels[entry.time_period] && <small>{periodLabels[entry.time_period]}</small>}
                      </span>
                    </button>
                    <div className="waitlist-entry-actions">
                      <a
                        className="is-whatsapp"
                        href={whatsappUrl(entry.client_phone)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="וואטסאפ"
                      >
                        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
                          <path
                            fill="currentColor"
                            d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.7-.3-1.4-.7-2-1.3-.5-.5-1-1.1-1.3-1.7-.1-.2 0-.4.1-.5l.4-.4.2-.4v-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.6.6-.9 1.3-.9 2.1 0 .9.4 1.8 1 2.5 1.1 1.6 2.4 2.8 4.1 3.5 1.4.6 2 .6 2.7.5.8-.1 1.5-.6 1.7-1.3.2-.4.2-.9.1-1.3l-.4-.2Z"
                          />
                        </svg>
                      </a>
                      <a href={`tel:${entry.client_phone}`} aria-label="התקשרות">
                        <Phone size={15} />
                      </a>
                      <button type="button" className="is-danger" aria-label="מחיקה" onClick={() => setPending(entry)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </section>
          ))
        )}
      </div>
      <ConfirmDelete
        target={pending ? pending.client_name : null}
        title="מחיקה מרשימת ההמתנה"
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={() => void remove()}
      />
    </BottomSheet>
  );
}

type Editor = {
  id?: string;
  name: string;
  description: string;
  price: string;
  image: string;
  upload?: string;
};

export function CatalogSheet({
  slug,
  kind,
  open,
  onClose,
  items,
  onChanged,
}: {
  slug: string;
  kind: 'designs' | 'products';
  open: boolean;
  onClose: () => void;
  items: any[];
  onChanged: () => void;
}) {
  const products = kind === 'products';
  const Icon = products ? ShoppingBag : LayoutGrid;
  const [search, setSearch] = useState(''),
    [reorder, setReorder] = useState<any[] | null>(null),
    [dirty, setDirty] = useState(false),
    [editor, setEditor] = useState<Editor | null>(null),
    [pending, setPending] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          (a.display_order ?? 999999) - (b.display_order ?? 999999) ||
          String(b.created_at).localeCompare(String(a.created_at)),
      ),
    [items],
  );
  const q = search.trim().toLowerCase();
  const filtered = q ? sorted.filter((d) => String(d.name || '').toLowerCase().includes(q)) : sorted;
  useEffect(() => {
    if (!open) {
      setReorder(null);
      setDirty(false);
      setSearch('');
      setError('');
    }
  }, [open]);
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await task();
      onChanged();
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const move = (index: number, delta: number) => {
    if (!reorder) return;
    const next = [...reorder];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setReorder(next);
    setDirty(true);
  };
  async function toggleReorder() {
    if (!reorder) {
      setSearch('');
      setReorder(sorted);
      return;
    }
    if (!dirty) {
      setReorder(null);
      return;
    }
    const order = reorder.map((d) => d.id);
    if (await run(() => api(slug, 'admin-catalog', { kind, order }))) {
      setReorder(null);
      setDirty(false);
    }
  }
  async function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked || !editor) return;
    try {
      const data = await compressImage(picked, products ? 1000 : 1600);
      setEditor((v) => v && { ...v, upload: data });
    } catch (err: any) {
      setError(err.message);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editor) return;
    if (!editor.upload && !editor.image) return setError('יש לבחור תמונה');
    const ok = await run(async () => {
      const image_url = editor.upload
        ? (await api(slug, 'admin-upload', { image: editor.upload })).url
        : undefined;
      await api(slug, 'admin-catalog', {
        kind,
        id: editor.id,
        name: editor.name,
        description: editor.description,
        price: editor.price,
        image_url,
      });
    });
    if (ok) setEditor(null);
  }
  const openEditor = (item?: any) => {
    setError('');
    setReorder(null);
    setEditor({
      id: item?.id,
      name: item?.name || '',
      description: item?.description || '',
      price: item?.price != null ? String(item.price) : '',
      image: item ? item.image_urls?.[0] || item.image_url || '' : '',
    });
  };
  const thumb = (d: any, cls: string) => {
    const src = d.image_urls?.find((u: string) => !isVideo(u)) || d.image_urls?.[0] || d.image_url;
    return (
      <span className={cls}>
        {!src ? (
          <Icon size={22} />
        ) : isVideo(src) ? (
          <video src={src} muted loop playsInline autoPlay preload="auto" />
        ) : (
          <img src={src} alt="" loading="lazy" />
        )}
      </span>
    );
  };
  const preview = editor?.upload || editor?.image;
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={products ? 'מוצרים' : 'גלריה'}
      size="medium"
      locked={!!editor}
    >
      <div className="catalog-toolbar">
        <button type="button" className="catalog-tool" aria-label={products ? 'הוספת מוצר' : 'הוספה לגלריה'} onClick={() => openEditor()}>
          <Plus size={20} strokeWidth={2.4} />
        </button>
        <label className="catalog-search">
          {search && (
            <button type="button" aria-label="נקה" onClick={() => setSearch('')}>
              <X size={16} />
            </button>
          )}
          <input
            placeholder={products ? 'חיפוש מוצר' : 'חיפוש לפי שם'}
            value={search}
            disabled={!!reorder}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span>
            <Search size={18} />
          </span>
        </label>
        <button
          type="button"
          className={`catalog-tool${reorder ? ' is-active' : ''}`}
          aria-label={reorder && dirty ? 'שמירת הסדר' : 'סידור'}
          disabled={busy}
          onClick={() => void toggleReorder()}
        >
          {reorder && dirty ? <Check size={20} strokeWidth={2.4} /> : <ArrowDownUp size={18} strokeWidth={2.4} />}
        </button>
      </div>
      {reorder && <p className="catalog-hint">מסדרים עם החיצים, ושומרים בסימון הוי</p>}
      {error && !editor && (
        <p className="error-note" role="alert">
          {error}
        </p>
      )}
      <div className="sheet-scroll">
        {reorder ? (
          reorder.map((d, i) => (
            <div className="catalog-reorder-row" key={d.id}>
              <span className="catalog-rail">
                <i>{i + 1}</i>
              </span>
              <div className="catalog-reorder-arrows">
                <button type="button" aria-label="למעלה" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp size={16} />
                </button>
                <button type="button" aria-label="למטה" disabled={i === reorder.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown size={16} />
                </button>
              </div>
              <span className="catalog-meta">
                <strong>{d.name}</strong>
                {products && <b>{formatPrice(Number(d.price))}</b>}
              </span>
              {thumb(d, 'catalog-thumb is-large')}
            </div>
          ))
        ) : !filtered.length ? (
          <div className="catalog-empty">
            <span>{q ? <Search size={36} /> : <Icon size={36} />}</span>
            <strong>
              {q ? (products ? 'לא נמצאו מוצרים' : 'אין עיצובים שתואמים לחיפוש') : products ? 'אין מוצרים עדיין' : 'עדיין אין עיצובים'}
            </strong>
            <p>
              {q
                ? products
                  ? 'נסו חיפוש אחר'
                  : 'נסו שם אחר או נקו את החיפוש'
                : products
                  ? 'הוסיפו את המוצר הראשון לחנות שלכם'
                  : 'הציגו ללקוחות את העבודה שלכם - הוסיפו תמונות.'}
            </p>
          </div>
        ) : (
          filtered.map((d) => (
            <div className="catalog-row" key={d.id}>
              <button type="button" className="catalog-delete" aria-label="מחיקה" onClick={() => setPending(d)}>
                <Trash2 size={16} />
              </button>
              <button type="button" className="catalog-main" onClick={() => openEditor(d)}>
                <span className="catalog-meta">
                  <strong>{d.name}</strong>
                  {products ? (
                    <b>{formatPrice(Number(d.price))}</b>
                  ) : (
                    d.description && <small>{d.description}</small>
                  )}
                </span>
                {thumb(d, 'catalog-thumb')}
              </button>
            </div>
          ))
        )}
      </div>
      <BottomSheet
        open={!!editor}
        onClose={() => !busy && setEditor(null)}
        title={editor?.id ? (products ? 'עריכת מוצר' : 'עריכת עיצוב') : products ? 'הוספת מוצר' : 'הוספה לגלריה'}
        size="auto"
        locked={busy}
      >
        <form className="catalog-editor sheet-scroll" onSubmit={save}>
          <input ref={file} type="file" accept="image/*" hidden onChange={pickImage} />
          <button type="button" className="catalog-photo" onClick={() => file.current?.click()}>
            {preview ? (
              isVideo(preview) ? (
                <video src={preview} muted loop playsInline autoPlay preload="auto" />
              ) : (
                <img src={preview} alt="" />
              )
            ) : (
              <span>
                <i>
                  <ImagePlus size={26} />
                </i>
                <strong>לחצו להוספת תמונה</strong>
                <small>תמונה אחת · דחיסה אוטומטית</small>
              </span>
            )}
            {preview && <em>בחירה מחדש</em>}
          </button>
          <label>
            {products ? 'שם מוצר *' : 'שם לתצוגה'}
            <input
              value={editor?.name || ''}
              maxLength={80}
              placeholder={products ? 'הזינו שם מוצר' : 'כתבו כותרת'}
              onChange={(e) => setEditor((v) => v && { ...v, name: e.target.value })}
              required
            />
          </label>
          {products && (
            <>
              <label>
                תיאור (אופציונלי)
                <textarea
                  rows={2}
                  maxLength={500}
                  value={editor?.description || ''}
                  placeholder="הזינו תיאור למוצר"
                  onChange={(e) => setEditor((v) => v && { ...v, description: e.target.value })}
                />
              </label>
              <label>
                מחיר *
                <input
                  inputMode="decimal"
                  dir="ltr"
                  value={editor?.price || ''}
                  placeholder="0.00"
                  onChange={(e) => setEditor((v) => v && { ...v, price: e.target.value.replace(/[^\d.]/g, '') })}
                  required
                />
              </label>
            </>
          )}
          {error && editor && (
            <p className="error-note" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button" disabled={busy}>
            {busy ? 'שומרים…' : editor?.id ? 'שמירה' : 'פרסום'}
          </button>
        </form>
      </BottomSheet>
      <ConfirmDelete
        target={pending ? pending.name : null}
        title={products ? 'מחיקת מוצר' : 'מחיקת פריט מהגלריה'}
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          if (await run(() => api(slug, 'admin-catalog', { kind, remove: pending.id }))) setPending(null);
        }}
      />
    </BottomSheet>
  );
}
