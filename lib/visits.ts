export const VISIT_CHAIN_GAP_MINUTES = 5;

export type VisitRow = {
  id: string;
  business_id?: string | null;
  client_phone?: string | null;
  client_name?: string | null;
  slot_date: string;
  slot_time: string;
  barber_id?: string | null;
  duration_minutes?: number | null;
  service_name?: string | null;
  [key: string]: any;
};

export type Visit<T extends VisitRow = VisitRow> = T & { rows: T[] };

export function slotMinutes(time: string) {
  const [h, m] = String(time || '00:00').slice(0, 5).split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

export function durationOf(row: Pick<VisitRow, 'duration_minutes'>) {
  const n = Math.floor(Number(row.duration_minutes));
  return Number.isFinite(n) && n > 0 ? n : 60;
}

function groupKey(row: VisitRow) {
  return [
    row.business_id || '',
    String(row.client_phone || '').replace(/\D/g, ''),
    String(row.slot_date || '').slice(0, 10),
    row.barber_id || '',
  ].join('|');
}

const byStart = (a: VisitRow, b: VisitRow) =>
  slotMinutes(a.slot_time) - slotMinutes(b.slot_time) ||
  String(a.id).localeCompare(String(b.id));

export function clusterVisits<T extends VisitRow>(rows: T[]): T[][] {
  const buckets = new Map<string, T[]>();
  for (const row of rows) {
    const key = groupKey(row);
    buckets.set(key, [...(buckets.get(key) || []), row]);
  }
  const clusters: T[][] = [];
  for (const list of buckets.values()) {
    list.sort(byStart);
    let current: T[] = [];
    let chainEnd = -1;
    for (const row of list) {
      const start = slotMinutes(row.slot_time);
      if (!current.length || start <= chainEnd + VISIT_CHAIN_GAP_MINUTES) {
        current.push(row);
        chainEnd = Math.max(chainEnd, start + durationOf(row));
      } else {
        clusters.push(current);
        current = [row];
        chainEnd = start + durationOf(row);
      }
    }
    if (current.length) clusters.push(current);
  }
  return clusters;
}

export function asVisit<T extends VisitRow>(rows: T[]): Visit<T> {
  const sorted = [...rows].sort(byStart);
  const first = sorted[0];
  const start = slotMinutes(first.slot_time);
  const end = Math.max(...sorted.map((r) => slotMinutes(r.slot_time) + durationOf(r)));
  const services = sorted
    .map((r) => String(r.service_name ?? '').trim())
    .filter(Boolean)
    .join(' + ');
  return {
    ...first,
    duration_minutes: end - start,
    service_name: services || first.service_name,
    rows: sorted,
  };
}

export const visitsOf = <T extends VisitRow>(rows: T[]) =>
  clusterVisits(rows)
    .map(asVisit)
    .sort(
      (a, b) =>
        a.slot_date.localeCompare(b.slot_date) || slotMinutes(a.slot_time) - slotMinutes(b.slot_time),
    );
