import { randomUUID } from 'node:crypto';
import { db, result, scoped, uuid } from './db';
import { availability, selection } from './booking';
import { addDays, calculateSlots, israelNow, minutes, timeString } from '../availability';
import { normalizeStoredPhone, phoneLookupVariants } from '../phone';

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function monthAvailability(p: any, userId: string, body: any) {
  const ids = String(body.services || '').split(',').filter(Boolean);
  const picked = await selection(p, userId, ids);
  if (!isDate(body.from) || !isDate(body.to) || body.to < body.from) throw new Error('טווח לא תקין');
  const today = israelNow().date;
  const from = body.from < today ? today : body.from;
  if (from > body.to) return {};
  if ((Date.parse(body.to) - Date.parse(from)) / 86400000 > 45) throw new Error('טווח ארוך מדי');
  const mine = `user_id.eq.${userId},user_id.is.null`;
  const [hours, overrides, constraints, busy] = await Promise.all([
    result(scoped('business_hours', p.id).or(mine)),
    result(scoped('business_hours_overrides', p.id).gte('date', from).lte('date', body.to).or(mine)),
    result(scoped('business_constraints', p.id).gte('date', from).lte('date', body.to).or(mine)),
    result(
      db()
        .from('appointments')
        .select('slot_date,slot_time,is_available,duration_minutes')
        .eq('business_id', p.id)
        .eq('is_available', false)
        .gte('slot_date', from)
        .lte('slot_date', body.to)
        .or(`barber_id.eq.${userId},user_id.eq.${userId}`),
    ),
  ]);
  const gap = Math.max(0, p.break_by_user?.[userId] ?? p.break ?? 0);
  const out: Record<string, number> = {};
  for (let date = from; date <= body.to; date = addDays(date, 1)) {
    const day = new Date(date + 'T12:00:00Z').getUTCDay();
    const pick = (rows: any[]) => rows.find((h) => h.user_id === userId) || rows.find((h) => !h.user_id);
    const weekly = pick(hours.filter((h: any) => h.day_of_week === day));
    const override = pick(overrides.filter((h: any) => h.date === date));
    const effective = override || weekly;
    if (!effective || effective.is_active === false) {
      out[date] = -1;
      continue;
    }
    out[date] = calculateSlots({
      date,
      weekly,
      override,
      constraints: constraints.filter((c: any) => c.date === date),
      busy: busy.filter((a: any) => a.slot_date === date),
      duration: picked.duration,
      gap,
      user: null,
    }).length;
  }
  return out;
}

export async function createClient(p: any, body: any) {
  const name = String(body.name || '').trim();
  const digits = String(body.phone || '').replace(/\D/g, '');
  if (name.length < 2 || name.length > 100 || digits.length < 9 || digits.length > 15)
    throw new Error('נא למלא שם מלא (לפחות שני תווים) ומספר טלפון תקין.');
  const phone = normalizeStoredPhone(body.phone);
  const existing = await result(
    db()
      .from('users')
      .select('id')
      .eq('business_id', p.id)
      .in('phone', phoneLookupVariants(phone))
      .limit(1),
  );
  if (existing.length) throw new Error('מספר הטלפון כבר רשום אצלכם. בחרו לקוח קיים או הזינו מספר אחר.');
  try {
    return await result(
      db()
        .from('users')
        .insert({
          name,
          phone,
          user_type: 'client',
          business_id: p.id,
          password_hash: `otp_only_${randomUUID()}`,
          client_approved: true,
          language: 'he',
        })
        .select('id,name,phone,image_url')
        .single(),
    );
  } catch {
    throw new Error('לא ניתן ליצור את הלקוח. נסו שוב.');
  }
}

export async function adminBook(p: any, user: any, body: any) {
  const ids: string[] = Array.isArray(body.services) ? body.services : [];
  if (!uuid(body.clientId) || !isDate(body.date) || !/^\d{2}:\d{2}$/.test(body.time || ''))
    throw new Error('אנא מלא/י את כל השדות הנדרשים');
  const checked = await availability(p, user.id, ids, body.date, user);
  if (!checked.slots.includes(body.time))
    throw new Error('השעה שנבחרה כבר נתפסת השבוע. אנא בחר/י שעה אחרת.');
  const client = await result(
    scoped('users', p.id).eq('id', body.clientId).eq('user_type', 'client').single(),
  );
  const ordered = ids.map((id) => checked.services.find((s: any) => s.id === id));
  let start = minutes(body.time);
  const rows = ordered.map((s: any) => {
    const duration = s.duration_minutes || 60;
    const row = {
      business_id: p.id,
      slot_date: body.date,
      slot_time: `${timeString(start)}:00`,
      is_available: false,
      status: 'confirmed',
      client_name: client.name,
      client_phone: normalizeStoredPhone(client.phone),
      client_user_id: client.id,
      service_name: s.name,
      service_id: s.id,
      duration_minutes: duration,
      user_id: user.id,
      barber_id: user.id,
    };
    start += duration;
    return row;
  });
  for (const row of rows) await result(db().from('appointments').insert(row));
  return { ok: true, date: body.date, start: body.time, end: timeString(start) };
}
