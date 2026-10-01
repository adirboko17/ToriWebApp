import { db, result, scoped, uuid } from './db';
import { calculateSlots, israelNow, addDays } from '../availability';
import { phoneLookupVariants, normalizeStoredPhone } from '../phone';
export async function selection(p: any, worker: string, ids: string[]) {
  if (
    !uuid(worker) ||
    !Array.isArray(ids) ||
    !ids.length ||
    ids.some((id) => !uuid(id))
  )
    throw new Error('יש לבחור צוות וטיפול');
  const staff = await result(
    scoped('users', p.id)
      .eq('id', worker)
      .eq('user_type', 'admin')
      .maybeSingle(),
  );
  if (!staff || staff.block) throw new Error('איש הצוות אינו זמין');
  const services = await result(
    scoped('services', p.id).in('id', ids).eq('is_active', true),
  );
  if (
    services.length !== new Set(ids).size ||
    services.some((s: any) => s.worker_id && s.worker_id !== worker) ||
    (!p.allow_multi_service_booking && services.length > 1)
  )
    throw new Error('הטיפול אינו זמין לצוות שנבחר');
  return {
    staff,
    services,
    duration: services.reduce(
      (n: number, s: any) => n + (s.duration_minutes || 60),
      0,
    ),
    price: services.reduce((n: number, s: any) => n + Number(s.price || 0), 0),
  };
}
export async function availability(
  p: any,
  worker: string,
  ids: string[],
  date: string,
  user: any,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)))
    throw new Error('תאריך לא תקין');
  const picked = await selection(p, worker, ids);
  const today = israelNow().date;
  const days = Math.min(60, Math.max(1, Number(p.booking_open_days_by_user?.[worker] ?? p.booking_open_days ?? 7)));
  if (
    date < today ||
    (user?.user_type !== 'admin' && date > addDays(today, days - 1))
  )
    return { ...picked, slots: [] };
  const day = new Date(date + 'T12:00:00Z').getUTCDay();
  const [hours, overrides, constraints, busy] = await Promise.all([
    result(
      scoped('business_hours', p.id)
        .eq('day_of_week', day)
        .or(`user_id.eq.${worker},user_id.is.null`),
    ),
    result(
      scoped('business_hours_overrides', p.id)
        .eq('date', date)
        .or(`user_id.eq.${worker},user_id.is.null`),
    ),
    result(
      scoped('business_constraints', p.id)
        .eq('date', date)
        .or(`user_id.eq.${worker},user_id.is.null`),
    ),
    result(
      db()
        .from('appointments')
        .select('id,slot_time,is_available,duration_minutes')
        .eq('business_id', p.id)
        .eq('slot_date', date)
        .or(`barber_id.eq.${worker},user_id.eq.${worker}`),
    ),
  ]);
  const weekly =
    hours.find((h: any) => h.user_id === worker) ||
    hours.find((h: any) => !h.user_id);
  const override =
    overrides.find((h: any) => h.user_id === worker) ||
    overrides.find((h: any) => !h.user_id);
  return {
    ...picked,
    slots: calculateSlots({
      date,
      weekly,
      override,
      constraints,
      busy,
      duration: picked.duration,
      gap: Math.max(0, p.break_by_user?.[worker] ?? p.break ?? 0),
      user: user?.user_type === 'admin' ? null : user,
    }),
  };
}
export async function availabilityDays(p: any, worker: string, ids: string[], user: any) {
  const picked = await selection(p, worker, ids);
  const today = israelNow().date;
  const open = Math.min(60, Math.max(1, Number(p.booking_open_days_by_user?.[worker] ?? p.booking_open_days ?? 7)));
  const last = addDays(today, open - 1);
  const [hours, overrides, constraints, busy] = await Promise.all([
    result(scoped('business_hours', p.id).or(`user_id.eq.${worker},user_id.is.null`)),
    result(
      scoped('business_hours_overrides', p.id)
        .gte('date', today)
        .lte('date', last)
        .or(`user_id.eq.${worker},user_id.is.null`),
    ),
    result(
      scoped('business_constraints', p.id)
        .gte('date', today)
        .lte('date', last)
        .or(`user_id.eq.${worker},user_id.is.null`),
    ),
    result(
      db()
        .from('appointments')
        .select('id,slot_date,slot_time,is_available,duration_minutes')
        .eq('business_id', p.id)
        .gte('slot_date', today)
        .lte('slot_date', last)
        .or(`barber_id.eq.${worker},user_id.eq.${worker}`),
    ),
  ]);
  const gap = Math.max(0, p.break_by_user?.[worker] ?? p.break ?? 0);
  const client = user?.user_type === 'admin' ? null : user;
  const days: Record<string, number> = {};
  for (let i = 0; i < open; i++) {
    const date = addDays(today, i);
    const day = new Date(date + 'T12:00:00Z').getUTCDay();
    const pick = (rows: any[]) => rows.find((h) => h.user_id === worker) || rows.find((h) => !h.user_id);
    const weekly = pick(hours.filter((h: any) => h.day_of_week === day));
    const override = pick(overrides.filter((h: any) => h.date === date));
    const effective = override ? (override.is_active ? { ...weekly, ...override } : null) : weekly;
    const weekdayAllowed =
      !client?.booking_allowed_weekdays?.length || client.booking_allowed_weekdays.includes(day);
    if (!effective || effective.is_active === false || !effective.start_time || !weekdayAllowed) {
      days[date] = -1;
      continue;
    }
    days[date] = calculateSlots({
      date,
      weekly,
      override,
      constraints: constraints.filter((c: any) => c.date === date),
      busy: busy.filter((b: any) => b.slot_date === date),
      duration: picked.duration,
      gap,
      user: client,
    }).length;
  }
  return { days, open };
}
export function ownAppointments(p: any, user: any) {
  return scoped('appointments', p.id).or(
    `client_user_id.eq.${user.id},client_phone.in.(${phoneLookupVariants(
      user.phone,
    )
      .map((v) => '"' + v + '"')
      .join(',')})`,
  );
}
export async function book(p: any, user: any, body: any) {
  if (
    user.user_type !== 'admin' &&
    p.require_client_approval &&
    user.client_approved === false
  )
    throw new Error('החשבון ממתין לאישור העסק');
  const checked = await availability(
    p,
    body.worker,
    body.services,
    body.date,
    user,
  );
  if (!checked.slots.includes(body.time))
    throw new Error('השעה כבר אינה פנויה. בחרו שעה אחרת.');
  let client = user;
  if (user.user_type === 'admin') {
    if (body.clientId) {
      client = await result(
        scoped('users', p.id)
          .eq('id', body.clientId)
          .eq('user_type', 'client')
          .single(),
      );
    } else {
      client = {
        name: String(body.clientName || '').trim(),
        phone: normalizeStoredPhone(body.clientPhone || ''),
      };
      if (!client.name || !/^05\d{8}$/.test(client.phone))
        throw new Error('יש להזין שם וטלפון תקין');
    }
  }
  const payload = {
    business_id: p.id,
    barber_id: body.worker,
    user_id: body.worker,
    client_user_id: client.id || null,
    client_name: client.name,
    client_phone: normalizeStoredPhone(client.phone),
    service_id: checked.services[0].id,
    service_name: checked.services.map((s: any) => s.name).join(' + '),
    slot_date: body.date,
    slot_time: body.time,
    duration_minutes: checked.duration,
    status: 'confirmed',
    is_available: false,
    client_reminder_sent_at: null,
    admin_reminder_sent_at: null,
  };
  const open = await result(
    scoped('appointments', p.id)
      .eq('slot_date', body.date)
      .eq('slot_time', body.time)
      .eq('is_available', true)
      .or(`barber_id.eq.${body.worker},user_id.eq.${body.worker}`)
      .limit(1),
  );
  if (open.length)
    return result(
      db()
        .from('appointments')
        .update(payload)
        .eq('business_id', p.id)
        .eq('id', open[0].id)
        .eq('is_available', true)
        .select()
        .single(),
    );
  // Matches native insert flow; concurrent overlapping inserts still require a database exclusion constraint.
  return result(db().from('appointments').insert(payload).select().single());
}

const QUICK_SLOTS_DAYS = 7;
const QUICK_SLOTS_LIMIT = 10;

function serviceNameKey(service: any) {
  return String(service?.name || '').trim().toLowerCase();
}

/** Nearest bookable starts for the selected treatments, earliest first. */
export async function nearestSlots(p: any, ids: string[], user: any) {
  if (!ids.length || ids.some((id) => !uuid(id))) throw new Error('יש לבחור טיפול');
  const chosen = await result(
    scoped('services', p.id).in('id', ids).eq('is_active', true),
  );
  if (chosen.length !== new Set(ids).size) throw new Error('הטיפול אינו זמין');
  if (!p.allow_multi_service_booking && chosen.length > 1)
    throw new Error('אפשר לבחור טיפול אחד');
  const catalog = await result(scoped('services', p.id).eq('is_active', true));
  const staff = await result(
    db()
      .from('users')
      .select('id,name,image_url')
      .eq('business_id', p.id)
      .eq('user_type', 'admin')
      .or('block.is.null,block.eq.false'),
  );
  const forBarber = (barberId: string, selected: any) =>
    catalog.find(
      (row: any) =>
        row.id === selected.id && (!row.worker_id || row.worker_id === barberId),
    ) ||
    catalog.find(
      (row: any) =>
        serviceNameKey(row) === serviceNameKey(selected) &&
        (!row.worker_id || row.worker_id === barberId),
    );
  const eligible = staff.filter((barber: any) =>
    chosen.every((selected: any) => forBarber(barber.id, selected)),
  );
  const today = israelNow().date;
  const mine = await result(
    ownAppointments(p, user).select('slot_date,status').gte('slot_date', today),
  );
  const busyDays = new Set(
    mine
      .filter((row: any) => row.status !== 'cancelled' && row.status !== 'canceled')
      .map((row: any) => row.slot_date),
  );
  const found: any[] = [];
  await Promise.all(
    eligible.map(async (barber: any) => {
      const rows = chosen.map((selected: any) => forBarber(barber.id, selected));
      const serviceIds = rows.map((row: any) => row.id);
      const open = Math.min(
        QUICK_SLOTS_DAYS,
        Math.max(1, Number(p.booking_open_days_by_user?.[barber.id] ?? p.booking_open_days ?? 7)),
      );
      const serviceName = rows.map((row: any) => row.name).join(' + ');
      for (let i = 0; i < open; i++) {
        const date = addDays(today, i);
        if (busyDays.has(date)) continue;
        try {
          const available = await availability(p, barber.id, serviceIds, date, user);
          for (const time of available.slots)
            found.push({
              date,
              time,
              worker: barber.id,
              worker_name: barber.name,
              worker_image: /^https:\/\//.test(barber.image_url || '') ? barber.image_url : null,
              services: serviceIds,
              service_name: serviceName,
            });
        } catch {
          continue;
        }
      }
    }),
  );
  found.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.time.localeCompare(b.time) ||
      String(a.worker).localeCompare(String(b.worker)),
  );
  return found.slice(0, QUICK_SLOTS_LIMIT);
}
