import {
  bookingStartStepMinutes,
  nextBookingStartMin,
  advanceBookingCursor,
} from './booking-step';
export function israelNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const v = (k: string) => parts.find((p) => p.type === k)!.value;
  return {
    date: `${v('year')}-${v('month')}-${v('day')}`,
    minute: +v('hour') * 60 + +v('minute'),
  };
}
export const minutes = (t: string) => {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + m;
};
export const timeString = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
export function addDays(date: string, n: number) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function calculateSlots({
  date,
  weekly,
  override,
  constraints,
  busy,
  duration,
  gap,
  user,
  now = new Date(),
}: any): string[] {
  const clock = israelNow(now);
  if (date < clock.date) return [];
  const day = new Date(date + 'T12:00:00Z').getUTCDay();
  if (
    user?.booking_allowed_weekdays?.length &&
    !user.booking_allowed_weekdays.includes(day)
  )
    return [];
  const hours = override
    ? override.is_active
      ? { ...weekly, ...override, break_start_time: null, break_end_time: null }
      : null
    : weekly;
  if (!hours || hours.is_active === false) return [];
  let windows = [
    { start: minutes(hours.start_time), end: minutes(hours.end_time) },
  ];
  const breaks = [
    ...(hours.breaks || []),
    ...(hours.break_start_time && hours.break_end_time
      ? [{ start_time: hours.break_start_time, end_time: hours.break_end_time }]
      : []),
    ...constraints,
  ];
  for (const b of breaks) {
    const a = minutes(b.start_time),
      z = minutes(b.end_time);
    windows = windows.flatMap((w) =>
      z <= w.start || a >= w.end
        ? [w]
        : [
            { start: w.start, end: Math.min(a, w.end) },
            { start: Math.max(z, w.start), end: w.end },
          ].filter((w) => w.end > w.start),
    );
  }
  const occupied = busy
    .filter((s: any) => s.is_available === false)
    .map((s: any) => ({
      start: minutes(s.slot_time),
      end: minutes(s.slot_time) + (s.duration_minutes || 60),
    }));
  const step = bookingStartStepMinutes(hours.slot_duration_minutes);
  const slots: string[] = [];
  for (const w of windows) {
    let t = w.start;
    while (t + duration <= w.end) {
      const prev = Math.max(
        -1,
        ...occupied.filter((b: any) => b.end <= t).map((b: any) => b.end),
      );
      if (prev >= 0 && t < prev + gap) {
        t = advanceBookingCursor(t, prev + gap, step);
        continue;
      }
      const overlaps = occupied.some(
        (b: any) => Math.max(t, b.start) < Math.min(t + duration, b.end),
      );
      const next = Math.min(
        Infinity,
        ...occupied.filter((b: any) => b.start >= t).map((b: any) => b.start),
      );
      const permitted =
        (!user?.booking_allowed_from ||
          t >= minutes(user.booking_allowed_from)) &&
        (!user?.booking_allowed_until ||
          t <= minutes(user.booking_allowed_until));
      if (
        !overlaps &&
        t + duration + gap <= next &&
        (date !== clock.date || t >= clock.minute) &&
        permitted
      )
        slots.push(timeString(t));
      t = nextBookingStartMin(t, step);
    }
  }
  return [...new Set(slots)];
}
