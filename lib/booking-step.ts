/** Bookable start-time increment. Occupancy still uses the visit duration. */
export const BOOKING_START_STEP_MINUTES = 15;

/**
 * Align start times to the clock (00:00), not the day's open time.
 * Window-relative grids skip clock-aligned gaps — e.g. open 09:40 yields
 * 09:40, 09:55, 10:10… and never 11:45 even when 11:45–12:00 is free.
 */
export const BOOKING_CLOCK_ORIGIN_MINUTES = 0;

/**
 * Grid step for offering start times.
 * `slot_duration_minutes` of 60 was historically a default visit length, not a UI grid —
 * only honor 5–30 minute settings; otherwise use 15.
 */
export function bookingStartStepMinutes(slotDurationMinutes?: unknown): number {
  const n = Number(slotDurationMinutes);
  if (Number.isFinite(n) && n >= 5 && n <= 30) return Math.round(n);
  return BOOKING_START_STEP_MINUTES;
}

/** Next grid time at or after `min`, aligned to `origin`. */
export function snapMinutesUp(min: number, step: number, origin: number): number {
  const safeStep = step > 0 ? step : BOOKING_START_STEP_MINUTES;
  if (min <= origin) return origin;
  const rel = min - origin;
  return origin + Math.ceil(rel / safeStep) * safeStep;
}

export function snapToClockUp(min: number, step: number): number {
  return snapMinutesUp(min, step, BOOKING_CLOCK_ORIGIN_MINUTES);
}

/** Next clock-aligned start strictly after `currentMin` (opening can stay off-grid). */
export function nextBookingStartMin(currentMin: number, step: number): number {
  return snapToClockUp(currentMin + 1, step);
}

export function advanceBookingCursor(
  currentMin: number,
  jumpedTo: number,
  step: number,
  origin: number = BOOKING_CLOCK_ORIGIN_MINUTES
): number {
  const snapped = snapMinutesUp(jumpedTo, step, origin);
  return snapped > currentMin ? snapped : nextBookingStartMin(currentMin, step);
}

export interface CachedBookingBusySlot {
  slot_date: string;
  slot_time: string;
  is_available: boolean;
  duration_minutes?: number | null;
}

type BhGlobal = {
  __bh_windows__?: Record<string, Array<{ start: string; end: string }>>;
  __bh_slot_step__?: Record<string, number>;
  __bh_busy_slots__?: Record<string, CachedBookingBusySlot[]>;
};

export function cacheBookingWindows(
  cacheKey: string,
  windows: Array<{ start: string; end: string }>,
  slotStepMinutes: number
): void {
  const g = globalThis as unknown as BhGlobal;
  g.__bh_windows__ = g.__bh_windows__ || {};
  g.__bh_slot_step__ = g.__bh_slot_step__ || {};
  g.__bh_windows__[cacheKey] = windows;
  g.__bh_slot_step__[cacheKey] = slotStepMinutes;
}

export function getCachedBookingSlotStep(cacheKey: string): number {
  const g = globalThis as unknown as BhGlobal;
  return bookingStartStepMinutes(g.__bh_slot_step__?.[cacheKey]);
}

export function getCachedBookingWindows(
  cacheKey: string
): Array<{ start: string; end: string }> | undefined {
  const g = globalThis as unknown as BhGlobal;
  return g.__bh_windows__?.[cacheKey];
}

export function cacheBookingBusySlots(
  cacheKey: string,
  slots: CachedBookingBusySlot[]
): void {
  const g = globalThis as unknown as BhGlobal;
  g.__bh_busy_slots__ = g.__bh_busy_slots__ || {};
  g.__bh_busy_slots__[cacheKey] = slots;
}

export function getCachedBookingBusySlots(
  cacheKey: string
): CachedBookingBusySlot[] | undefined {
  const g = globalThis as unknown as BhGlobal;
  return g.__bh_busy_slots__?.[cacheKey];
}

export function clearCachedBookingWindows(): void {
  const g = globalThis as unknown as BhGlobal;
  g.__bh_windows__ = {};
  g.__bh_slot_step__ = {};
  g.__bh_busy_slots__ = {};
}
