'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, CircleHelp, CircleUserRound, Eye, EyeOff, Plus, Users } from 'lucide-react';
import BottomSheet from './bottom-sheet';

export type AlertButton = { label: string; destructive?: boolean; onClick?: () => void };
export type AlertState = { title: string; message?: string; buttons?: AlertButton[] } | null;

export function IosAlert({ alert, onClose }: { alert: AlertState; onClose: () => void }) {
  if (!alert || typeof document === 'undefined') return null;
  const buttons = alert.buttons?.length ? alert.buttons : [{ label: 'אישור' }];
  return createPortal(
    <div className="ios-alert-layer st-alert-layer" dir="rtl" role="alertdialog" aria-modal="true" aria-label={alert.title}>
      <div className="ios-alert">
        <div className="ios-alert-copy">
          <strong>{alert.title}</strong>
          {alert.message && <p>{alert.message}</p>}
        </div>
        <div className="ios-alert-buttons">
          {buttons.map((button) => (
            <button
              type="button"
              key={button.label}
              className={button.destructive ? 'is-destructive' : undefined}
              onClick={() => {
                onClose();
                button.onClick?.();
              }}
            >
              {button.label}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`ios-switch st-switch${checked ? ' is-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <i />
    </button>
  );
}

export function Row({
  icon,
  iconColor,
  title,
  subtitle,
  danger,
  dim,
  disabled,
  onClick,
  onTitle,
  toggle,
  trailing,
  last,
  onPreview,
  children,
}: {
  icon: React.ReactNode;
  iconColor?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  danger?: boolean;
  dim?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onTitle?: () => void;
  toggle?: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean };
  trailing?: React.ReactNode;
  last?: boolean;
  onPreview?: () => void;
  children?: React.ReactNode;
}) {
  const plate = (
    <span className="st-plate" style={iconColor ? { color: iconColor } : undefined}>
      {icon}
    </span>
  );
  const copy = (
    <span className={`st-copy${dim ? ' is-dim' : ''}${danger ? ' is-danger' : ''}`}>
      <strong>{title}</strong>
      {subtitle ? <small>{subtitle}</small> : null}
    </span>
  );
  const eye = onPreview ? (
    <button type="button" className="st-eye" aria-label="תצוגה מקדימה" onClick={onPreview}>
      <Eye size={17} strokeWidth={1.9} />
    </button>
  ) : null;
  const trail = toggle ? (
    <Switch
      checked={toggle.checked}
      onChange={toggle.onChange}
      disabled={toggle.disabled}
      label={typeof title === 'string' ? title : ''}
    />
  ) : trailing !== undefined ? (
    trailing
  ) : onClick ? (
    <ChevronLeft size={20} className="st-chev" />
  ) : null;
  return (
    <>
      {toggle || !onClick ? (
        <div className={`st-row${disabled ? ' is-disabled' : ''}`}>
          {plate}
          {onTitle ? (
            <button type="button" className="st-copy-btn" onClick={onTitle} disabled={disabled}>
              {copy}
            </button>
          ) : (
            copy
          )}
          {trail}
        </div>
      ) : onPreview ? (
        <div className={`st-row${disabled ? ' is-disabled' : ''}`}>
          <button type="button" className="st-row-hit" disabled={disabled} onClick={onClick}>
            {plate}
            {copy}
          </button>
          {eye}
          <button type="button" className="st-chev-btn" disabled={disabled} onClick={onClick} tabIndex={-1} aria-hidden>
            <ChevronLeft size={20} className="st-chev" />
          </button>
        </div>
      ) : (
        <button type="button" className="st-row" disabled={disabled} onClick={onClick}>
          {plate}
          {copy}
          {trail}
        </button>
      )}
      {children}
      {!last && <div className="st-div" />}
    </>
  );
}

export function ListHead({
  title,
  subtitle,
  addLabel,
  onAdd,
}: {
  title: string;
  subtitle: string;
  addLabel: string;
  onAdd: () => void;
}) {
  return (
    <div className="st-lhead">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <button type="button" className="st-plus" aria-label={addLabel} onClick={onAdd}>
        <Plus size={22} strokeWidth={2.4} />
      </button>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  cta,
  onCta,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  cta: string;
  onCta: () => void;
}) {
  return (
    <div className="st-empty">
      <span>{icon}</span>
      <strong>{title}</strong>
      <p>{text}</p>
      <button type="button" onClick={onCta}>
        <Plus size={16} strokeWidth={2.5} />
        {cta}
      </button>
    </div>
  );
}

export function Loading({ text }: { text: string }) {
  return (
    <div className="st-loading" role="status">
      <span className="aa-spinner is-dark" />
      <p>{text}</p>
    </div>
  );
}

export type DialogButton = { label: string; kind?: 'cancel' | 'primary' | 'danger'; onClick: () => void; busy?: boolean };

export function CenterDialog({
  open,
  title,
  message,
  buttons,
  onClose,
  locked,
  children,
}: {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  buttons: DialogButton[];
  onClose: () => void;
  locked?: boolean;
  children?: React.ReactNode;
}) {
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="st-dialog-layer" dir="rtl" onClick={() => !locked && onClose()}>
      <div className="st-dialog" role="alertdialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {message && <div className="st-dialog-msg">{message}</div>}
        {children}
        <div className={`st-dialog-buttons${buttons.length === 1 ? ' is-single' : ''}`}>
          {buttons.map((button) => (
            <button
              type="button"
              key={button.label}
              className={`is-${button.kind || 'cancel'}`}
              disabled={button.busy || (locked && button.kind === 'cancel')}
              onClick={button.onClick}
            >
              {button.busy ? <span className={`aa-spinner${button.kind === 'danger' ? ' is-danger' : ''}`} /> : button.label}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function FullScreen({
  open,
  onBack,
  backDisabled,
  className = '',
  style,
  back = 'right',
  children,
}: {
  open: boolean;
  onBack: () => void;
  backDisabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  back?: 'right' | 'left' | 'none';
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
    };
  }, [open]);
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className={`aa st-full ${className}`} dir="rtl" style={style}>
      {back !== 'none' && (
        <button
          type="button"
          className={`aa-back${back === 'left' ? ' is-left' : ''}`}
          aria-label="חזרה"
          disabled={backDisabled}
          onClick={onBack}
        >
          {back === 'left' ? <ArrowLeft size={22} /> : <ArrowRight size={22} />}
        </button>
      )}
      <div className="st-full-body">{children}</div>
    </div>,
    document.body,
  );
}

export function FullIntro({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="st-full-intro">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}

export function UField({
  icon,
  trailing,
  error,
  children,
}: {
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="st-ufield">
      <label className="aa-field">
        {icon}
        {children}
        {trailing}
      </label>
      {error && <p className="st-ferr">{error}</p>}
    </div>
  );
}

export function HeroCta({
  label,
  disabled,
  busy,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="st-cta" disabled={disabled || busy} onClick={onClick}>
      {busy ? <span className="aa-spinner is-dark" /> : label}
    </button>
  );
}

export const durations = Array.from({ length: 36 }, (_, i) => (i + 1) * 5);

export function DurationPicker({
  open,
  value,
  onPick,
  onClose,
}: {
  open: boolean;
  value: number;
  onPick: (minutes: number) => void;
  onClose: () => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    list.current?.querySelector('.is-selected')?.scrollIntoView({ block: 'center' });
  }, [open]);
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="st-pick-layer" dir="rtl" onClick={onClose}>
      <div className="st-pick" role="dialog" aria-modal="true" aria-label="משך (דקות)" onClick={(e) => e.stopPropagation()}>
        <div className="st-pick-head">משך (דקות)</div>
        <div className="st-pick-list" ref={list}>
          {durations.map((minutes) => (
            <button
              type="button"
              key={minutes}
              className={minutes === value ? 'is-selected' : undefined}
              onClick={() => {
                onPick(minutes);
                onClose();
              }}
            >
              <span>{minutes} דק׳</span>
              {minutes === value && <Check size={18} />}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const audienceIcons = { everyone: Users, registered: CircleUserRound, off: EyeOff } as const;

export function AudienceSheet({
  open,
  onClose,
  title,
  offText,
  value,
  busy,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  offText: string;
  value: string;
  busy?: boolean;
  onPick: (value: string) => void;
}) {
  const options: [keyof typeof audienceIcons, string, string][] = [
    ['everyone', 'כולם', 'כל מי שהוריד ופתח את האפליקציה'],
    ['registered', 'רשומים / מאושרים', 'לקוחות מחוברים (מאושרים כשנדרש אישור)'],
    ['off', 'כבוי', offText],
  ];
  return (
    <BottomSheet open={open} onClose={onClose} title={title} size="auto" locked={busy} className="st-sheet st-aud">
      <div className="st-aud-list">
        {options.map(([id, label, text]) => {
          const Icon = audienceIcons[id];
          const selected = value === id;
          return (
            <button
              type="button"
              key={id}
              className={selected ? 'is-selected' : undefined}
              disabled={busy}
              onClick={() => onPick(id)}
            >
              <span className="st-aud-icon">
                <Icon size={20} />
              </span>
              <span className="st-aud-copy">
                <strong>{label}</strong>
                <small>{text}</small>
              </span>
              <span className="st-aud-check">{selected && <Check size={13} strokeWidth={3} />}</span>
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}

const TICK = 14;

function Ruler({
  min,
  max,
  step,
  value,
  onChange,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const emitted = useRef(value);
  const count = Math.floor((max - min) / step) + 1;
  const index = Math.min(count - 1, Math.max(0, Math.round((value - min) / step)));
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    emitted.current = min + index * step;
    if (Math.round(el.scrollLeft / TICK) !== index) el.scrollLeft = index * TICK;
  }, [index, min, step]);
  const major = step === 1 ? 5 : 4;
  return (
    <div className="st-ruler">
      <div
        className="st-ruler-track"
        ref={track}
        onScroll={(e) => {
          const i = Math.min(count - 1, Math.max(0, Math.round(e.currentTarget.scrollLeft / TICK)));
          const next = min + i * step;
          if (next !== emitted.current) {
            emitted.current = next;
            onChange(next);
          }
        }}
      >
        <span className="st-ruler-pad" />
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className={`st-tick${i % major === 0 ? ' is-major' : ''}`}>
            <i />
            {i % major === 0 && <small>{min + i * step}</small>}
          </span>
        ))}
        <span className="st-ruler-pad" />
      </div>
      <b className="st-ruler-needle" />
    </div>
  );
}

function hoursPreview(hours: number) {
  if (hours === 0) return 'ללא הגבלה';
  if (hours === 1) return 'שעה אחת';
  if (hours % 24 === 0) {
    const days = hours / 24;
    return `${hours} שעות · ${days} ${days === 1 ? 'יום' : 'ימים'}`;
  }
  return `${hours} שעות`;
}

export function NumberSheet({
  open,
  onClose,
  title,
  explainer,
  label,
  unit,
  min,
  max,
  step = 1,
  initial,
  placeholder,
  footnote,
  invalid,
  presets,
  maxLength = 2,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  explainer: string[];
  label: string;
  unit: string;
  min: number;
  max: number;
  step?: number;
  initial: number;
  placeholder: string;
  footnote?: string;
  invalid: string;
  presets?: [number, string][];
  maxLength?: number;
  onSave: (value: number) => Promise<boolean>;
}) {
  const [value, setValue] = useState(initial);
  const [text, setText] = useState(String(initial));
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const [custom, setCustom] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertState>(null);
  useEffect(() => {
    if (!open) return;
    setValue(initial);
    setText(String(initial));
    setHelp(false);
    setCustom(null);
  }, [open, initial]);

  const submit = async () => {
    const n = text.trim() === '' ? value : Number(text);
    if (!Number.isInteger(n) || n < min || n > max) {
      setAlert({ title: 'שגיאה', message: invalid });
      return;
    }
    setBusy(true);
    const ok = await onSave(n);
    setBusy(false);
    if (ok) onClose();
  };
  const customHours = custom === null ? NaN : Number(custom);
  return (
    <BottomSheet open={open} onClose={onClose} size="auto" locked={busy} className="st-sheet st-num">
      <div className="sheet-scroll st-num-body">
        <h2 className="st-sheet-title">{title}</h2>
        <button type="button" className="st-howto" onClick={() => setHelp(true)}>
          <span>
            <CircleHelp size={14} />
          </span>
          איך זה עובד? לחצו כאן
        </button>
        <div className="st-ruler-card">
          <small>{label}</small>
          <div className="st-ruler-value">
            <b>{value}</b>
            <span>{unit}</span>
          </div>
          <Ruler
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(next) => {
              setValue(next);
              setText(String(next));
            }}
          />
          <small className="st-or">או הקלידו מספר</small>
          <input
            dir="ltr"
            inputMode="numeric"
            maxLength={maxLength}
            placeholder={placeholder}
            value={text}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, '');
              setText(raw);
              const n = Number(raw);
              if (raw && n >= min && n <= max) setValue(n);
            }}
          />
        </div>
        {footnote && <p className="st-footnote">{footnote}</p>}
        {presets && (
          <>
            <p className="st-presets-label">בחירה מהירה</p>
            <div className="st-presets">
              {presets.map(([hours, name]) => (
                <button
                  type="button"
                  key={hours}
                  className={value === hours ? 'is-selected' : undefined}
                  onClick={() => {
                    setValue(hours);
                    setText(String(hours));
                  }}
                >
                  {name}
                </button>
              ))}
              <button
                type="button"
                className={presets.some(([hours]) => hours === value) ? undefined : 'is-selected'}
                onClick={() => setCustom(String(value))}
              >
                מותאם אישית
              </button>
            </div>
          </>
        )}
        <button type="button" className="st-save" disabled={busy} onClick={() => void submit()}>
          {busy ? 'שומר...' : 'שמור'}
        </button>
      </div>
      <CenterDialog
        open={help}
        title="איך זה עובד?"
        onClose={() => setHelp(false)}
        buttons={[{ label: 'הבנתי', kind: 'primary', onClick: () => setHelp(false) }]}
        message={
          <div className="st-explain">
            {explainer.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        }
      />
      <CenterDialog
        open={custom !== null}
        title="בחירת שעות"
        onClose={() => setCustom(null)}
        message="הזינו כמה שעות לפני התור. 0 = ללא הגבלה."
        buttons={[
          { label: 'ביטול', onClick: () => setCustom(null) },
          {
            label: 'אישור',
            kind: 'primary',
            onClick: () => {
              if (!Number.isInteger(customHours) || customHours < 0 || customHours > max) {
                setAlert({ title: 'שגיאה', message: invalid });
                return;
              }
              setValue(customHours);
              setText(String(customHours));
              setCustom(null);
            },
          },
        ]}
      >
        <div className="st-custom-hours">
          <input
            dir="ltr"
            inputMode="numeric"
            maxLength={3}
            placeholder="0"
            value={custom ?? ''}
            onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))}
          />
          <span>שעות</span>
        </div>
        <p className="st-custom-preview">
          {custom !== null && custom !== '' && Number.isFinite(customHours) ? hoursPreview(customHours) : '\u00a0'}
        </p>
      </CenterDialog>
      <IosAlert alert={alert} onClose={() => setAlert(null)} />
    </BottomSheet>
  );
}

export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*\n]+\*)/g).map((part, i) =>
        /^\*[^*\n]+\*$/.test(part) ? <b key={i}>{part.slice(1, -1)}</b> : <span key={i}>{part}</span>,
      )}
    </>
  );
}

export function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('read'));
    reader.readAsDataURL(file);
  });
}

export async function compressImage(file: File, maxEdge: number, quality: number) {
  const source = await readFile(file);
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('image'));
    image.src = source;
  });
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}
