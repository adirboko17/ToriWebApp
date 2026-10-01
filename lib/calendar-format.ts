import { addDays } from './availability';

export const HE_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
export const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const HE_WEEKDAYS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];
export const HE_SHORT_WEEKDAYS = ['יום א׳', 'יום ב׳', 'יום ג׳', 'יום ד׳', 'יום ה׳', 'יום ו׳', 'שבת'];
export const HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
export const HE_MONTHS_SHORT = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יונ׳', 'יול׳', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];

export const REMINDER_PALETTE: Record<string, { bar: string; bg: string }> = {
  blue: { bar: '#1A73E8', bg: '#E8F0FE' },
  coral: { bar: '#E67C73', bg: '#FCE8E6' },
  yellow: { bar: '#F9AB00', bg: '#FEF7E0' },
  green: { bar: '#0F9D58', bg: '#E6F4EA' },
  purple: { bar: '#A142F4', bg: '#F3E8FD' },
  gray: { bar: '#5F6368', bg: '#F1F3F4' },
};
export const reminderColor = (key?: string | null) => REMINDER_PALETTE[key || ''] || REMINDER_PALETTE.blue;

export const dow = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
export const ymd = (date: string) => ({
  y: Number(date.slice(0, 4)),
  m: Number(date.slice(5, 7)) - 1,
  d: Number(date.slice(8, 10)),
});
export const weekStartOf = (date: string) => addDays(date, -dow(date));
export const monthStart = (date: string) => `${date.slice(0, 7)}-01`;
export function addMonths(date: string, n: number) {
  const { y, m } = ymd(date);
  const total = y * 12 + m + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`;
}
export function daysInMonth(date: string) {
  const { y, m } = ymd(date);
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

export const hm = (t?: string | null) => String(t || '').slice(0, 5);
export const clock = (minutes: number) => {
  const m = Math.max(0, Math.min(24 * 60, Math.round(minutes)));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

let hebrewFormat: Intl.DateTimeFormat | null | undefined;
function hebrewParts(date: string) {
  if (hebrewFormat === undefined) {
    try {
      hebrewFormat = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      });
    } catch {
      hebrewFormat = null;
    }
  }
  if (!hebrewFormat) return null;
  try {
    const parts = hebrewFormat.formatToParts(new Date(`${date}T12:00:00Z`));
    return {
      day: parts.find((p) => p.type === 'day')?.value ?? '',
      month: (parts.find((p) => p.type === 'month')?.value ?? '').replace(/\u200f/g, '').trim(),
    };
  } catch {
    return null;
  }
}
export const hebrewDay = (date: string) => hebrewParts(date)?.day ?? '';
export function hebrewDayMonth(date: string) {
  const parts = hebrewParts(date);
  return parts?.day && parts.month ? `${parts.day} ב${parts.month}` : '';
}

export function longDate(date: string) {
  const { m, d } = ymd(date);
  return `${HE_WEEKDAYS[dow(date)]}, ${d} ב${HE_MONTHS[m]}`;
}
export function numericDate(date: string) {
  const { y, m, d } = ymd(date);
  return `${String(d).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}/${y}`;
}
