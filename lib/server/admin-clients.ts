import { db, result, scoped, uuid } from './db';
import { israelNow } from '../availability';
import { phoneLookupVariants } from '../phone';

const CLIENT_FIELDS = 'id,name,phone,image_url,created_at,client_approved,block';

function israelMidnightIso(date: string) {
  const noon = new Date(`${date}T12:00:00Z`);
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', hourCycle: 'h23' }).format(noon),
  );
  return new Date(Date.parse(`${date}T00:00:00Z`) - (hour - 12) * 3600000).toISOString();
}

async function bookedRows(businessId: string) {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const page = await result(
      db()
        .from('appointments')
        .select('user_id,client_user_id,status,service_id,service_name,slot_date')
        .eq('business_id', businessId)
        .eq('is_available', false)
        .range(from, from + 999),
    );
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

function statsFor(rows: any[], services: any[]) {
  const byId = new Map(services.map((s: any) => [s.id, Number(s.price) || 0]));
  const byName = new Map(services.map((s: any) => [String(s.name || '').trim().toLowerCase(), Number(s.price) || 0]));
  const stats = new Map<string, { visits: number; months: Map<string, number> }>();
  for (const r of rows) {
    for (const id of new Set([r.client_user_id, r.user_id].filter(Boolean))) {
      const s = stats.get(id) || { visits: 0, months: new Map() };
      if (r.status !== 'cancelled') s.visits++;
      if (r.status === 'confirmed' || r.status === 'completed') {
        const price = byId.get(r.service_id) ?? byName.get(String(r.service_name || '').trim().toLowerCase()) ?? 0;
        if (price > 0) {
          const month = String(r.slot_date).slice(0, 7);
          s.months.set(month, (s.months.get(month) || 0) + price);
        }
      }
      stats.set(id, s);
    }
  }
  return (id: string) => {
    const s = stats.get(id);
    const totals = s ? [...s.months.values()] : [];
    return {
      visits: s?.visits || 0,
      avgMonth: totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : null,
    };
  };
}

export async function clientsOverview(p: any) {
  const approval = p.require_client_approval !== false;
  const today = israelNow().date;
  const monthFrom = israelMidnightIso(`${today.slice(0, 7)}-01`);
  const [y, m] = today.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const monthTo = israelMidnightIso(next);
  const base = () => db().from('users').select(CLIENT_FIELDS).eq('business_id', p.id).eq('user_type', 'client');
  const [approved, month, pending, rows, services] = await Promise.all([
    result(base().eq('client_approved', true).order('name')),
    result(base().gte('created_at', monthFrom).lt('created_at', monthTo).order('created_at', { ascending: false })),
    approval ? result(base().eq('client_approved', false).order('created_at', { ascending: false })) : Promise.resolve([]),
    bookedRows(p.id),
    result(db().from('services').select('id,name,price').eq('business_id', p.id)),
  ]);
  const withBooking = new Set(rows.flatMap((r: any) => [r.user_id, r.client_user_id]).filter(Boolean));
  const stat = statsFor(rows, services);
  const decorate = (list: any[]) => list.map((c) => ({ ...c, ...stat(c.id) }));
  return {
    approval,
    approved: decorate(approved),
    month: decorate(month),
    pending: pending.filter((c: any) => !withBooking.has(c.id)),
  };
}

function emergencyCode(hash: string | null | undefined) {
  const raw = String(hash || '');
  if (!raw || raw.startsWith('otp_only_')) return null;
  const plain = raw === 'default_hash' ? '123456' : raw.startsWith('hash_') ? raw.slice(5) : '';
  return /^\d{6}$/.test(plain) ? plain : null;
}

async function resolveClient(p: any, body: any) {
  const fields = `${CLIENT_FIELDS},password_hash`;
  for (const id of [body.id, body.alt]) {
    if (!uuid(id)) continue;
    const row = await result(
      db().from('users').select(fields).eq('business_id', p.id).eq('id', id).eq('user_type', 'client').maybeSingle(),
    );
    if (row) return row;
  }
  const digits = String(body.phone || '').replace(/\D/g, '');
  if (digits.length < 8) return null;
  const variants = phoneLookupVariants(body.phone);
  const rows = await result(
    db().from('users').select(fields).eq('business_id', p.id).eq('user_type', 'client').in('phone', variants).limit(1),
  );
  return rows[0] || null;
}

export async function clientProfile(p: any, body: any) {
  const found = await resolveClient(p, body);
  if (!found) throw new Error('לא נמצא כרטיס לקוח לתור הזה');
  const { password_hash, ...client } = found;
  const id = client.id;
  const variants = phoneLookupVariants(client.phone || '');
  const filters = [`client_user_id.eq.${id}`, `user_id.eq.${id}`];
  if (variants.length) filters.push(`client_phone.in.(${variants.map((v) => `"${v}"`).join(',')})`);
  const appointments = await result(
    scoped('appointments', p.id)
      .eq('is_available', false)
      .or(filters.join(','))
      .order('slot_date', { ascending: false })
      .order('slot_time', { ascending: false })
      .limit(300),
  );
  const slotStart = (a: any) =>
    Date.parse(israelMidnightIso(a.slot_date)) +
    (Number(a.slot_time.slice(0, 2)) * 60 + Number(a.slot_time.slice(3, 5))) * 60000;
  const now = Date.now();
  const upcomingOf = (a: any) => !['completed', 'no_show'].includes(a.status) && slotStart(a) >= now;
  const live = appointments.filter((a: any) => a.status !== 'cancelled');
  const services = await result(db().from('services').select('id,name,price').eq('business_id', p.id));
  const tagged = appointments.map((a: any) => ({ ...a, client_user_id: id, user_id: null }));
  return {
    client,
    emergency: emergencyCode(password_hash),
    avgMonth: statsFor(tagged, services)(id).avgMonth,
    visits: live.length,
    cancellations: appointments
      .filter((a: any) => a.status === 'cancelled')
      .map((a: any) => ({
        ...a,
        minutes_before: Math.round((slotStart(a) - Date.parse(a.updated_at || a.created_at)) / 60000),
      })),
    upcoming: live.filter(upcomingOf).reverse(),
    history: live.filter((a: any) => !upcomingOf(a)),
  };
}

export async function declineClient(p: any, id: string) {
  if (!uuid(id)) throw new Error('פעולה לא תקינה');
  await result(
    db()
      .from('users')
      .delete()
      .eq('business_id', p.id)
      .eq('id', id)
      .eq('user_type', 'client')
      .eq('client_approved', false),
  );
  return { ok: true };
}

export async function adminNotifications(p: any, user: any, markRead: boolean) {
  const variants = phoneLookupVariants(user.phone || '');
  if (!variants.length) return [];
  if (markRead)
    await result(
      db()
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('business_id', p.id)
        .in('recipient_phone', variants)
        .eq('is_read', false),
    );
  return result(
    db()
      .from('notifications')
      .select('id,title,content,type,is_read,read_at,created_at,recipient_name,recipient_phone,appointment_id')
      .eq('business_id', p.id)
      .in('recipient_phone', variants)
      .gte('created_at', new Date(Date.now() - 2 * 86400000).toISOString())
      .order('created_at', { ascending: false })
      .limit(100),
  );
}
