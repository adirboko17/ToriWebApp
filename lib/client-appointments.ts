import { israelNow, minutes } from './availability';

export function minutesUntil(row: { slot_date: string; slot_time: string }) {
  const now = israelNow();
  const days = (Date.parse(row.slot_date + 'T00:00:00Z') - Date.parse(now.date + 'T00:00:00Z')) / 86400000;
  return days * 1440 + minutes(row.slot_time) - now.minute;
}

export function isUpcoming(row: any) {
  return ['confirmed', 'pending'].includes(row.status) && row.is_available !== true && minutesUntil(row) >= 0;
}

export function cancelLocked(row: any, hours: unknown) {
  const limit = Number(hours ?? 24);
  return minutesUntil(row) < (Number.isFinite(limit) ? limit : 24) * 60;
}

export function hebrewDay(date: string, options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('he-IL', { timeZone: 'UTC', ...options });
}
