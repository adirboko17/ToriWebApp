import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18next from 'i18next';
if (!i18next.isInitialized)
  void i18next.init({
    lng: 'he',
    fallbackLng: 'he',
    resources: {
      he: {
        translation: {
          home: 'בית',
          appointments: 'התורים שלי',
          gallery: 'גלריה',
          profile: 'הפרופיל שלי',
          book: 'קביעת תור',
        },
      },
      en: {
        translation: {
          home: 'Home',
          appointments: 'My appointments',
          gallery: 'Gallery',
          profile: 'My profile',
          book: 'Book appointment',
        },
      },
    },
  });
export const usePreferences = create(
  persist<{ language: string; setLanguage: (s: string) => void }>(
    (set) => ({
      language: 'he',
      setLanguage: (language) => {
        void i18next.changeLanguage(language);
        set({ language });
      },
    }),
    { name: 'tori-web-preferences' },
  ),
);
export async function api(
  slug: string,
  action: string,
  body?: any,
  query?: Record<string, string>,
) {
  const response = await fetch(
    `/api/b/${encodeURIComponent(slug)}/${action}${query ? '?' + new URLSearchParams(query) : ''}`,
    {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    },
  );
  const data: any = await response.json();
  if (!response.ok) throw new Error(data.error || 'לא ניתן להשלים את הפעולה');
  return data;
}
export function theme(color?: string) {
  const primary = /^#[\da-f]{6}$/i.test(color || '') ? color! : '#87937e';
  const rgb = [1, 3, 5]
    .map((i) => parseInt(primary.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const lum = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  const heroLight = lum * 0.78 ** 2.2 <= 0.4;
  return {
    '--hero-fg': heroLight ? '#ffffff' : '#141414',
    '--hero-muted': heroLight ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.6)',
    '--hero-line': heroLight ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.22)',
    '--hero-focus': heroLight ? '#ffffff' : 'var(--on-light)',
    '--hero-placeholder': heroLight ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.4)',
    '--primary': primary,
    '--primary-foreground': lum > 0.4 ? '#172015' : '#ffffff',
    '--tint': `color-mix(in srgb, ${primary}, white 91%)`,
    '--ink': `color-mix(in srgb, ${primary}, black 35%)`,
    '--on-light': lum > 0.4 ? `color-mix(in srgb, ${primary}, black 46%)` : primary,
    '--on-primary': lum > 0.4 ? `color-mix(in srgb, ${primary}, black 62%)` : '#ffffff',
    '--on-primary-muted':
      lum > 0.4
        ? `color-mix(in srgb, color-mix(in srgb, ${primary}, black 62%) 74%, transparent)`
        : 'rgba(255,255,255,0.88)',
    '--save-bg': lum > 0.4 ? `color-mix(in srgb, ${primary}, black 52%)` : primary,
    '--save-fg': '#ffffff',
    '--ring': primary,
  } as React.CSSProperties;
}
export function applyTheme(color: string) {
  const vars = Object.entries(theme(color));
  for (const target of [document.documentElement, document.querySelector<HTMLElement>('.site-shell')])
    for (const [key, value] of vars) target?.style.setProperty(key, String(value));
}
export function dateLabel(date: string) {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
export function downloadCalendar(row: any) {
  const clean = (s: string) =>
    String(s || '')
      .replaceAll('\\', '\\\\')
      .replaceAll('\n', '\\n')
      .replaceAll(',', '\\,')
      .replaceAll(';', '\\;');
  const date = row.slot_date.replaceAll('-', '');
  const start = row.slot_time.slice(0, 5).replace(':', '') + '00';
  const end = new Date(
    row.slot_date + 'T' + row.slot_time.slice(0, 5) + ':00Z',
  );
  end.setUTCMinutes(end.getUTCMinutes() + (row.duration_minutes || 60));
  const endStamp = end
    .toISOString()
    .replaceAll('-', '')
    .replaceAll(':', '')
    .slice(0, 15);
  const text = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tori//Booking//HE',
    'BEGIN:VEVENT',
    `UID:${row.id}@tori-web`,
    `DTSTAMP:${new Date().toISOString().replaceAll('-', '').replaceAll(':', '').slice(0, 15)}Z`,
    `DTSTART;TZID=Asia/Jerusalem:${date}T${start}`,
    `DTEND;TZID=Asia/Jerusalem:${endStamp}`,
    `SUMMARY:${clean(row.service_name)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
  const url = URL.createObjectURL(
    new Blob([text], { type: 'text/calendar;charset=utf-8' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = 'appointment.ics';
  a.click();
  URL.revokeObjectURL(url);
}
