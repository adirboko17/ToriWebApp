import { db, result, setting, uuid } from '@/lib/server/db';
import { canonicalPhoneIdentity, phonesMatch } from '@/lib/phone';
import { addDays, israelNow } from '@/lib/availability';

export const SMS_MONTHLY_QUOTA = 1000;
export const SMS_TOPUP_URL = 'https://www.wetori.co.il/sms';
export const broadcastChannels = ['push', 'sms', 'both'] as const;
export const broadcastAudiences = ['all', 'appointments', 'selected', 'inactive'] as const;
export const inactivePeriods = [30, 45, 60, 90, 180];
type Channel = (typeof broadcastChannels)[number];
type Audience = (typeof broadcastAudiences)[number];
type Recipient = { id?: string; name: string; phone: string };

const ISRAEL_TZ = 'Asia/Jerusalem';
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

function credits(v: unknown) {
  const n =
    typeof v === 'number' ? v : Number.parseInt(String(v ?? '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function israelClock(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ISRAEL_TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);
  const map: Record<string, number> = {};
  for (const part of parts) if (part.type !== 'literal') map[part.type] = Number(part.value);
  return map;
}

export function israelWallToUtc(year: number, month: number, day: number, hour = 0, minute = 0) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const shown = israelClock(new Date(guess));
  const shownUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute);
  return new Date(guess + (guess - shownUtc));
}

function resetHint(now = new Date()) {
  const clock = israelClock(now);
  const nextMonth = clock.month === 12 ? [clock.year + 1, 1] : [clock.year, clock.month + 1];
  const ms = Math.max(0, israelWallToUtc(nextMonth[0], nextMonth[1], 1).getTime() - now.getTime());
  if (ms < HOUR_MS) return `מתאפס תוך פחות משעה ל-${SMS_MONTHLY_QUOTA} הודעות`;
  if (ms < DAY_MS) {
    const hours = Math.max(1, Math.ceil(ms / HOUR_MS));
    return hours === 1
      ? `מתאפס עוד שעה ל-${SMS_MONTHLY_QUOTA} הודעות`
      : `מתאפס עוד ${hours} שעות ל-${SMS_MONTHLY_QUOTA} הודעות`;
  }
  const days = Math.max(1, Math.floor(ms / DAY_MS));
  return days === 1
    ? `מתאפס עוד יום ל-${SMS_MONTHLY_QUOTA} הודעות`
    : `מתאפס עוד ${days} ימים ל-${SMS_MONTHLY_QUOTA} הודעות`;
}

export async function smsBalance(businessId: string) {
  const key = setting('SUPABASE_SERVICE_ROLE_KEY');
  const base = setting('SUPABASE_URL').replace(/\/$/, '');
  if (!key || !base) return { ok: false as const, reason: 'not_configured' };
  try {
    const res = await fetch(`${base}/functions/v1/pulseem-tenant-direct-sms-balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, apikey: key },
      body: JSON.stringify({ businessId }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json().catch(() => null);
    if (!data?.ok || data.directSmsCredits == null || data.directSmsCredits === '')
      return { ok: false as const, reason: 'unavailable' };
    const total = credits(data.directSmsCredits);
    const prepaid = Math.min(credits(data.prepaidSmsCredits), total);
    return {
      ok: true as const,
      total,
      prepaid,
      packageLeft: total - prepaid,
      resetHint: resetHint(),
      topupUrl: SMS_TOPUP_URL,
    };
  } catch {
    return { ok: false as const, reason: 'unavailable' };
  }
}

export function isBusinessOwner(profile: any, user: any) {
  return phonesMatch(profile.phone, user.phone);
}

function dedupe(rows: Recipient[]) {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = canonicalPhoneIdentity(r.phone);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function clientsWithPhone(businessId: string, approvedOnly: boolean) {
  let query = db()
    .from('users')
    .select('id,name,phone')
    .eq('business_id', businessId)
    .eq('user_type', 'client')
    .not('phone', 'is', null)
    .neq('phone', '')
    .order('name');
  if (approvedOnly) query = query.or('client_approved.is.null,client_approved.eq.true');
  const rows: any[] = (await result(query)) || [];
  return dedupe(
    rows.map((r) => ({ id: r.id, name: String(r.name || '').trim() || 'לקוח', phone: String(r.phone).trim() })),
  );
}

async function bookedOn(businessId: string, dates: string[]) {
  if (!dates.length) return [];
  const rows: any[] =
    (await result(
      db()
        .from('appointments')
        .select('slot_date,client_name,client_phone')
        .eq('business_id', businessId)
        .eq('is_available', false)
        .in('slot_date', dates)
        .in('status', ['confirmed', 'pending']),
    )) || [];
  return rows
    .filter((r) => String(r.client_phone || '').trim())
    .map((r) => ({
      date: String(r.slot_date).slice(0, 10),
      name: String(r.client_name || '').trim() || 'לקוח',
      phone: String(r.client_phone).trim(),
    }));
}

export async function inactiveClients(businessId: string, days: number) {
  const cutoff = addDays(israelNow().date, -days);
  const [clients, recent] = await Promise.all([
    clientsWithPhone(businessId, true),
    result(
      db()
        .from('appointments')
        .select('user_id,client_phone')
        .eq('business_id', businessId)
        .eq('is_available', false)
        .gte('slot_date', cutoff)
        .in('status', ['confirmed', 'pending', 'completed']),
    ),
  ]);
  const ids = new Set<string>();
  const phones = new Set<string>();
  for (const r of recent || []) {
    if (r.user_id) ids.add(String(r.user_id));
    const key = canonicalPhoneIdentity(String(r.client_phone || ''));
    if (key) phones.add(key);
  }
  return clients.filter((c) => !ids.has(c.id!) && !phones.has(canonicalPhoneIdentity(c.phone)));
}

export async function bookedMonth(businessId: string, month: unknown) {
  if (typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) throw new Error('חודש לא תקין');
  const today = israelNow().date;
  const dates: string[] = [];
  for (let d = `${month}-01`; d.startsWith(month); d = addDays(d, 1)) if (d >= today) dates.push(d);
  const byDate: Record<string, string[]> = Object.fromEntries(dates.map((d) => [d, []]));
  for (const row of await bookedOn(businessId, dates)) {
    const key = canonicalPhoneIdentity(row.phone);
    if (key && !byDate[row.date].includes(key)) byDate[row.date].push(key);
  }
  return byDate;
}

const scheduledColumns =
  'id,title,content,channel,audience,appointment_dates,recipient_user_ids,inactive_days,scheduled_at,status';

export async function broadcastOverview(businessId: string) {
  const today = israelNow().date;
  const nextMonth = addDays(`${today.slice(0, 7)}-28`, 7).slice(0, 7);
  const [all, pickable, current, next, scheduled] = await Promise.all([
    clientsWithPhone(businessId, false),
    clientsWithPhone(businessId, true),
    bookedMonth(businessId, today.slice(0, 7)),
    bookedMonth(businessId, nextMonth),
    result(
      db()
        .from('scheduled_broadcasts')
        .select(scheduledColumns)
        .eq('business_id', businessId)
        .in('status', ['scheduled', 'sending'])
        .order('scheduled_at', { ascending: true }),
    ),
  ]);
  return {
    allCount: all.length,
    clients: pickable,
    booked: { ...current, ...next },
    scheduled: scheduled || [],
  };
}

export async function deleteScheduledBroadcast(businessId: string, id: unknown) {
  if (!uuid(id)) throw new Error('פעולה לא תקינה');
  const rows = await result(
    db()
      .from('scheduled_broadcasts')
      .delete()
      .eq('business_id', businessId)
      .eq('id', id)
      .eq('status', 'scheduled')
      .select('id'),
  );
  if (!rows?.length) throw new Error('ההודעה כבר נשלחה או נמחקה');
  return { ok: true };
}

function clean(value: unknown, max: number, label: string) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`יש למלא ${label}`);
  if (text.length > max) throw new Error(`${label} ארוך מדי`);
  return text;
}

function scheduledTime(value: unknown) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!match) throw new Error('מועד השליחה אינו תקין');
  const [, y, m, d, h, min] = match.map(Number);
  const at = israelWallToUtc(y, m, d, h, min);
  if (at.getTime() <= Date.now() + 30_000)
    throw new Error('בחרו תאריך ושעה עתידיים לפי שעון ישראל');
  if (at.getTime() > Date.now() + 366 * DAY_MS) throw new Error('מועד השליחה רחוק מדי');
  return at.toISOString();
}

export async function sendBroadcast(profile: any, user: any, body: any) {
  const businessId = profile.id;
  const title = clean(body.title, 80, 'כותרת');
  const content = clean(body.content, 1000, 'תוכן');
  const channel = body.channel as Channel;
  const audience = body.audience as Audience;
  if (!broadcastChannels.includes(channel) || !broadcastAudiences.includes(audience))
    throw new Error('בחירה לא תקינה');
  const dates: string[] =
    audience === 'appointments' && Array.isArray(body.dates) ? body.dates : [];
  if (
    audience === 'appointments' &&
    (!dates.length || dates.length > 31 || dates.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d)))
  )
    throw new Error('בחרו לפחות יום אחד');
  const ids: string[] =
    (audience === 'selected' || audience === 'inactive') && Array.isArray(body.ids)
      ? Array.from(new Set<string>(body.ids.filter(uuid)))
      : [];
  if ((audience === 'selected' || audience === 'inactive') && (!ids.length || ids.length > 5000))
    throw new Error('בחרו לפחות לקוח אחד');
  const inactiveDays =
    audience === 'inactive' && inactivePeriods.includes(Number(body.inactiveDays))
      ? Number(body.inactiveDays)
      : null;
  if (audience === 'inactive' && !inactiveDays) throw new Error('בחרו תקופה');

  if (body.scheduledAt) {
    const row = {
      channel,
      audience,
      appointment_dates: dates,
      recipient_user_ids: ids,
      inactive_days: inactiveDays,
      title,
      content,
      scheduled_at: scheduledTime(body.scheduledAt),
      status: 'scheduled',
    };
    if (body.editId) {
      if (!uuid(body.editId)) throw new Error('פעולה לא תקינה');
      const rows = await result(
        db()
          .from('scheduled_broadcasts')
          .update(row)
          .eq('business_id', businessId)
          .eq('id', body.editId)
          .eq('status', 'scheduled')
          .select('id'),
      );
      if (!rows?.length) throw new Error('ההודעה כבר נשלחה או נמחקה');
    } else
      await result(
        db()
          .from('scheduled_broadcasts')
          .insert({ ...row, business_id: businessId, created_by: user.id }),
      );
    return { scheduled: true, count: 0, banner: false };
  }
  if (body.editId) await deleteScheduledBroadcast(businessId, body.editId);

  let recipients: Recipient[];
  if (audience === 'all') recipients = await clientsWithPhone(businessId, false);
  else if (audience === 'appointments') recipients = dedupe(await bookedOn(businessId, dates));
  else {
    const rows: any[] = [];
    for (let i = 0; i < ids.length; i += 100)
      rows.push(
        ...((await result(
          db()
            .from('users')
            .select('id,name,phone')
            .eq('business_id', businessId)
            .eq('user_type', 'client')
            .in('id', ids.slice(i, i + 100)),
        )) || []),
      );
    recipients = dedupe(
      rows
        .filter((r) => String(r.phone || '').trim())
        .map((r) => ({ id: r.id, name: String(r.name || '').trim() || 'לקוח', phone: String(r.phone).trim() })),
    );
  }

  const banner = audience === 'all' && channel !== 'sms';
  if (banner)
    await result(
      db()
        .from('messages')
        .insert({ title, content, ttl_hours: 720, user_id: user.id, business_id: businessId }),
    );
  const type =
    channel === 'sms' ? 'home_broadcast_sms' : channel === 'both' ? 'home_broadcast_both' : 'home_broadcast';
  for (let i = 0; i < recipients.length; i += 500)
    await result(
      db()
        .from('notifications')
        .insert(
          recipients.slice(i, i + 500).map((r) => ({
            title,
            content,
            type,
            recipient_name: r.name,
            recipient_phone: r.phone,
            business_id: businessId,
          })),
        ),
    );
  return { scheduled: false, count: recipients.length, banner };
}
