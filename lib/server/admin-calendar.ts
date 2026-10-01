import { db, result, uuid } from './db';
import { addDays, israelNow, minutes } from '@/lib/availability';
import { clusterVisits, durationOf } from '@/lib/visits';

const ymd = /^\d{4}-\d{2}-\d{2}$/;
const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
export const reminderColors = ['blue', 'coral', 'yellow', 'green', 'purple', 'gray'];
export const breakMinuteOptions = [0, 5, 10, 15, 20, 25, 30];
const appointmentColumns =
  'id,business_id,slot_date,slot_time,duration_minutes,client_name,client_phone,service_name,service_id,barber_id,user_id,client_user_id,status,is_available';

function range(from: unknown, to: unknown, maxDays: number) {
  if (typeof from !== 'string' || typeof to !== 'string' || !ymd.test(from) || !ymd.test(to) || from > to)
    throw new Error('טווח תאריכים לא תקין');
  if ((Date.parse(to) - Date.parse(from)) / 86400000 > maxDays)
    throw new Error('טווח תאריכים ארוך מדי');
  return { from, to };
}

async function pages(build: (first: number, last: number) => PromiseLike<{ data: any; error: any }>) {
  const rows: any[] = [];
  for (let first = 0; first < 20000; first += 1000) {
    const page = (await result(build(first, first + 999))) || [];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

function ownAppointments(businessId: string, userId: string, columns = appointmentColumns) {
  return db()
    .from('appointments')
    .select(columns)
    .eq('business_id', businessId)
    .eq('is_available', false)
    .or(`barber_id.eq.${userId},user_id.eq.${userId}`);
}

export async function weekCounts(businessId: string, userId: string, from: unknown) {
  if (typeof from !== 'string' || !ymd.test(from)) throw new Error('תאריך לא תקין');
  const rows = await pages((first, last) =>
    ownAppointments(businessId, userId, 'slot_date')
      .gte('slot_date', from)
      .lte('slot_date', addDays(from, 6))
      .in('status', ['pending', 'confirmed', 'completed'])
      .range(first, last),
  );
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const r of rows) {
    const i = Math.round((Date.parse(r.slot_date) - Date.parse(from)) / 86400000);
    if (i >= 0 && i < 7) counts[i]++;
  }
  return counts;
}

async function reminders(businessId: string, userId: string, from: string, to: string, columns = '*') {
  const { data, error } = await db()
    .from('calendar_reminders')
    .select(columns)
    .eq('business_id', businessId)
    .eq('user_id', userId)
    .gte('event_date', from)
    .lte('event_date', to)
    .order('event_date')
    .order('start_time');
  if (error) {
    console.error('Calendar reminders unavailable', error.code, error.message);
    return [];
  }
  return data || [];
}

export async function calendarRange(businessId: string, userId: string, query: any) {
  const { from, to } = range(query.from, query.to, 200);
  const [appointments, constraints, notes, hours, overrides] = await Promise.all([
    pages((a, b) =>
      ownAppointments(businessId, userId)
        .gte('slot_date', from)
        .lte('slot_date', to)
        .order('slot_date')
        .order('slot_time')
        .range(a, b),
    ),
    result(
      db()
        .from('business_constraints')
        .select('*')
        .eq('business_id', businessId)
        .eq('user_id', userId)
        .gte('date', from)
        .lte('date', to)
        .order('date')
        .order('start_time'),
    ),
    reminders(businessId, userId, from, to),
    result(
      db()
        .from('business_hours')
        .select('*')
        .eq('business_id', businessId)
        .eq('user_id', userId)
        .order('day_of_week'),
    ),
    result(
      db()
        .from('business_hours_overrides')
        .select('*')
        .eq('business_id', businessId)
        .eq('user_id', userId)
        .gte('date', from)
        .lte('date', to),
    ),
  ]);
  return { appointments, constraints, reminders: notes, hours, overrides };
}

export async function calendarMonths(businessId: string, userId: string, query: any) {
  const { from, to } = range(query.from, query.to, 800);
  const [appointments, constraints, notes] = await Promise.all([
    pages((a, b) =>
      ownAppointments(businessId, userId, 'id,business_id,slot_date,slot_time,duration_minutes,client_phone,barber_id')
        .gte('slot_date', from)
        .lte('slot_date', to)
        .order('slot_date')
        .range(a, b),
    ),
    pages((a, b) =>
      db()
        .from('business_constraints')
        .select('date')
        .eq('business_id', businessId)
        .eq('user_id', userId)
        .gte('date', from)
        .lte('date', to)
        .range(a, b),
    ),
    reminders(businessId, userId, from, to, 'event_date'),
  ]);
  const counts: Record<string, number> = {};
  for (const visit of clusterVisits(appointments))
    counts[visit[0].slot_date] = (counts[visit[0].slot_date] || 0) + 1;
  return {
    counts,
    constraintDates: [...new Set(constraints.map((c: any) => c.date))],
    reminderDates: [...new Set(notes.map((r: any) => r.event_date))],
  };
}

export async function calendarSearch(businessId: string, userId: string, query: any) {
  const raw = String(query.q || '').trim().slice(0, 40);
  const token = raw.replace(/[%_\\,()*.:"']/g, '').trim();
  const digits = raw.replace(/\D/g, '').replace(/^972/, '').replace(/^0/, '');
  const parts: string[] = [];
  if (token.length >= 2) parts.push(`client_name.ilike.%${token}%`);
  if (digits.length >= 2) parts.push(`client_phone.ilike.%${digits}%`);
  if (!parts.length) return [];
  const rows = await result(
    db()
      .from('appointments')
      .select(appointmentColumns)
      .eq('business_id', businessId)
      .eq('is_available', false)
      .neq('status', 'cancelled')
      .eq('barber_id', userId)
      .or(parts.join(','))
      .order('slot_date', { ascending: false })
      .limit(60),
  );
  const today = israelNow().date;
  return rows.sort((a: any, b: any) => {
    const af = a.slot_date >= today ? 0 : 1;
    const bf = b.slot_date >= today ? 0 : 1;
    if (af !== bf) return af - bf;
    if (a.slot_date !== b.slot_date)
      return af === 0 ? a.slot_date.localeCompare(b.slot_date) : b.slot_date.localeCompare(a.slot_date);
    return String(a.slot_time).localeCompare(String(b.slot_time));
  });
}

export async function removeAppointment(businessId: string, userId: string, id: unknown) {
  if (!uuid(id)) throw new Error('תור לא תקין');
  const row = await result(ownAppointments(businessId, userId).eq('id', id).maybeSingle());
  if (!row) throw new Error('התור לא נמצא');
  const now = israelNow();
  const end = minutes(row.slot_time) + durationOf(row);
  const past = row.slot_date < now.date || (row.slot_date === now.date && end < now.minute);
  if (past) {
    await result(db().from('appointments').delete().eq('business_id', businessId).eq('id', row.id));
  } else {
    await result(
      db()
        .from('appointments')
        .update({
          status: 'cancelled',
          is_available: true,
          client_name: null,
          client_phone: null,
          service_name: 'Available Slot',
          client_reminder_sent_at: null,
          admin_reminder_sent_at: null,
        })
        .eq('business_id', businessId)
        .eq('id', row.id)
        .eq('is_available', false),
    );
  }
  return { ok: true, deleted: past };
}

export async function saveReminder(businessId: string, userId: string, body: any) {
  if (body.id !== undefined && !uuid(body.id)) throw new Error('תזכורת לא תקינה');
  if (body.remove) {
    if (!body.id) throw new Error('תזכורת חסרה');
    await result(
      db()
        .from('calendar_reminders')
        .delete()
        .eq('business_id', businessId)
        .eq('user_id', userId)
        .eq('id', body.id),
    );
    return { ok: true };
  }
  const title = String(body.title || '').trim();
  if (!title || title.length > 80) throw new Error('יש להזין כותרת לתזכורת');
  const notes = String(body.notes || '').trim();
  if (notes.length > 500) throw new Error('ההערה ארוכה מדי');
  if (!ymd.test(body.date) || !hhmm.test(body.time)) throw new Error('תאריך או שעה לא תקינים');
  const duration = Number(body.duration);
  if (!Number.isInteger(duration) || duration < 5 || duration > 720) throw new Error('משך לא תקין');
  if (!reminderColors.includes(body.color)) throw new Error('צבע לא תקין');
  const payload = {
    event_date: body.date,
    start_time: `${body.time}:00`,
    duration_minutes: duration,
    title,
    notes: notes || null,
    color_key: body.color,
  };
  if (body.id) {
    const updated = await result(
      db()
        .from('calendar_reminders')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('business_id', businessId)
        .eq('user_id', userId)
        .eq('id', body.id)
        .select('id'),
    );
    if (!updated?.length) throw new Error('התזכורת לא נמצאה');
  } else {
    await result(
      db()
        .from('calendar_reminders')
        .insert({ ...payload, business_id: businessId, user_id: userId }),
    );
  }
  return { ok: true };
}

export async function hoursData(profile: any, userId: string) {
  const today = israelNow().date;
  const [weekly, overrides, booked] = await Promise.all([
    result(
      db()
        .from('business_hours')
        .select('*')
        .eq('business_id', profile.id)
        .eq('user_id', userId)
        .order('day_of_week'),
    ),
    result(
      db()
        .from('business_hours_overrides')
        .select('*')
        .eq('business_id', profile.id)
        .eq('user_id', userId)
        .gte('date', today)
        .order('date'),
    ),
    pages((a, b) =>
      ownAppointments(profile.id, userId, 'slot_date')
        .gte('slot_date', today)
        .lte('slot_date', addDays(today, 180))
        .range(a, b),
    ),
  ]);
  return {
    weekly,
    overrides,
    bookedDates: [...new Set(booked.map((r: any) => r.slot_date))],
    breakMinutes: Math.max(0, Math.min(180, Number(profile.break_by_user?.[userId] ?? 0) || 0)),
  };
}

export async function saveBreakMinutes(profile: any, userId: string, value: unknown) {
  const minutesValue = Number(value);
  if (!breakMinuteOptions.includes(minutesValue)) throw new Error('ערך לא תקין');
  await result(
    db()
      .from('business_profile')
      .update({ break_by_user: { ...(profile.break_by_user || {}), [userId]: minutesValue } })
      .eq('id', profile.id),
  );
  return { ok: true, breakMinutes: minutesValue };
}
