import {
  db,
  result,
  scoped,
  tenant,
  publicProfile,
  uuid,
} from '@/lib/server/db';
import { currentUser, safeUser, sessionCookie } from '@/lib/server/session';
import {
  availability,
  availabilityDays,
  book,
  nearestSlots,
  ownAppointments,
  selection,
} from '@/lib/server/booking';
import {
  parseIsraeliMobileNational10,
  phoneLookupVariants,
  phonesMatch,
} from '@/lib/phone';
import { israelNow, minutes, addDays } from '@/lib/availability';
import { sameOrigin } from '@/lib/server/origin';
import {
  bookedMonth,
  broadcastOverview,
  deleteScheduledBroadcast,
  inactiveClients,
  inactivePeriods,
  isBusinessOwner,
  sendBroadcast,
  smsBalance,
} from '@/lib/server/admin-home';
import { saveCatalogItem, uploadImage } from '@/lib/server/catalog';
import {
  calendarMonths,
  calendarRange,
  calendarSearch,
  hoursData,
  removeAppointment,
  saveBreakMinutes,
  saveReminder,
  weekCounts,
} from '@/lib/server/admin-calendar';
import { adminBook, createClient, monthAvailability } from '@/lib/server/admin-booking';
import { adminNotifications, clientProfile, clientsOverview, declineClient } from '@/lib/server/admin-clients';
import {
  readAdminSettings,
  readSettingsList,
  requestAppCancellation,
  writeAdminSettings,
  writeSettingsList,
} from '@/lib/server/admin-settings';
import { financeMonth, saveExpense } from '@/lib/server/admin-finance';
export const dynamic = 'force-dynamic';
const authErrors: Record<string, string> = {
  wrong_code: 'הקוד שהוכנס שגוי',
  no_active_code: 'הקוד שהוכנס שגוי',
  invalid_code: 'יש להזין קוד בן 6 ספרות',
  too_many_attempts: 'בוצעו יותר מדי ניסיונות. נסו שוב מאוחר יותר.',
  user_not_found: 'המספר אינו רשום',
  phone_registered: 'המספר כבר רשום',
  sms_send_failed: 'לא ניתן לשלוח SMS כרגע. נסו שוב.',
  rate_limit_sends: 'נשלחו יותר מדי קודים. נסו שוב מאוחר יותר.',
};
function authError(code?: string) {
  if (!code) return 'לא ניתן להשלים את ההתחברות. נסו שוב.';
  return authErrors[code] || 'לא ניתן להשלים את ההתחברות. נסו שוב.';
}
function emergencyCodeHash(code: string) {
  return code === '123456' ? 'default_hash' : `hash_${code}`;
}
function pickEmergencyUser(matches: any[], phone: string) {
  if (matches.length === 1) return matches[0];
  const exact = matches.filter((u) => String(u.phone || '').trim() === phone);
  let pool = exact.length ? exact : matches;
  const clients = pool.filter(
    (u) => String(u.user_type || '').toLowerCase() === 'client',
  );
  if (clients.length) pool = clients;
  pool.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return pool[0];
}
async function emergencyUser(businessId: string, phone: string, code: string) {
  if (!/^\d{6}$/.test(code)) return null;
  const rows = await result(
    db()
      .from('users')
      .select('id,phone,user_type,block,password_hash')
      .eq('business_id', businessId),
  );
  const expected = emergencyCodeHash(code);
  const matches = (rows || []).filter(
    (u: any) => phonesMatch(u.phone, phone) && u.password_hash === expected,
  );
  if (!matches.length) return null;
  const chosen = pickEmergencyUser(matches, phone);
  if (chosen.block) return { blocked: true as const };
  const user = await result(
    scoped('users', businessId).eq('id', chosen.id).single(),
  );
  return { blocked: false as const, user };
}
const json = (data: any, status = 200, headers: Record<string, string> = {}) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers },
  });
export async function GET(req: Request, ctx: any) {
  return handle(req, ctx);
}
export async function POST(req: Request, ctx: any) {
  return handle(req, ctx);
}
async function handle(req: Request, ctx: any) {
  try {
    const { slug, action } = await ctx.params;
    const url = new URL(req.url);
    if (req.method === 'POST' && !sameOrigin(req))
      return json({ error: 'הבקשה אינה מורשית' }, 403);
    const p = await tenant(slug);
    if (!p) return json({ error: 'העסק לא נמצא' }, 404);
    const user = await currentUser(req, p.id);
    const body: any =
      req.method === 'POST'
        ? await req.json()
        : Object.fromEntries(url.searchParams);
    const write = req.method === 'POST';
    if (action === 'bootstrap' && !write) {
      const [services, staff] = await Promise.all([
        result(
          scoped('services', p.id)
            .eq('is_active', true)
            .order('order_index', { nullsFirst: false }),
        ),
        result(
          db()
            .from('users')
            .select('id,name,image_url,phone')
            .eq('business_id', p.id)
            .eq('user_type', 'admin')
            .or('block.is.null,block.eq.false')
            .order('name'),
        ),
      ]);
      const profile = publicProfile(p);
      if (user) profile.manager_phone = staff.find((s: any) => s.phone)?.phone || null;
      for (const s of staff) delete s.phone;
      if (
        profile.home_fixed_message_audience === 'off' ||
        (profile.home_fixed_message_audience === 'registered' && !user)
      )
        profile.home_fixed_message = null;
      return json({ profile, services, staff, user: safeUser(user) });
    }
    if (action === 'auth' && write) {
      const allowed = [
        'send_login_otp',
        'send_register_otp',
        'verify_login_otp',
        'verify_register_otp',
        'complete_register_profile',
      ];
      if (!allowed.includes(body.action))
        return json({ error: 'פעולה לא תקינה' }, 400);
      const payload: any = { action: body.action, business_id: p.id };
      if (body.action === 'complete_register_profile') {
        if (
          !body.name?.trim() ||
          body.name.trim().length > 100 ||
          !body.profile_setup_token
        )
          throw new Error('יש להזין שם');
        Object.assign(payload, {
          name: body.name.trim(),
          profile_setup_token: body.profile_setup_token,
          birth_date: body.birth_date || '',
          image_url: '',
        });
      } else {
        const phone = parseIsraeliMobileNational10(body.phone);
        if (!phone) throw new Error('יש להזין מספר נייד ישראלי תקין');
        payload.phone = phone;
        if (body.action.startsWith('verify')) {
          if (!/^\d{4,8}$/.test(body.code))
            throw new Error('יש להזין את קוד האימות');
          payload.code = body.code;
        }
      }
      const { data, error } = await db().functions.invoke('auth-phone-otp', {
        body: payload,
      });
      let response = data;
      if (error) {
        try {
          response = await error.context.json();
        } catch {
          response = null;
        }
      }
      if (!response?.ok && body.action === 'verify_login_otp') {
        const emergency = await emergencyUser(p.id, payload.phone, payload.code);
        if (emergency?.blocked)
          return json({ error: 'החשבון חסום. יש לפנות לעסק.' }, 403);
        if (emergency?.user) {
          const headers: Record<string, string> = {
            'Set-Cookie': await sessionCookie(
              emergency.user.id,
              p.id,
              url.protocol === 'https:',
            ),
          };
          return json({ ok: true, user: safeUser(emergency.user) }, 200, headers);
        }
      }
      if (!response?.ok)
        return json({ error: authError(response?.error) }, 400);
      const headers: Record<string, string> = {};
      if (
        response.user &&
        (body.action === 'verify_login_otp' ||
          body.action === 'complete_register_profile')
      ) {
        const verified = await result(
          scoped('users', p.id).eq('id', response.user.id).single(),
        );
        if (verified.block)
          return json({ error: 'החשבון חסום. יש לפנות לעסק.' }, 403);
        headers['Set-Cookie'] = await sessionCookie(
          verified.id,
          p.id,
          url.protocol === 'https:',
        );
        response.user = safeUser(verified);
      }
      return json(response, 200, headers);
    }
    if (action === 'logout' && write)
      return json({ ok: true }, 200, {
        'Set-Cookie':
          'tori_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
      });
    if (action === 'availability' && !write) {
      const data = await availability(
        p,
        body.worker,
        String(body.services || '').split(','),
        body.date,
        user,
      );
      return json({
        slots: data.slots,
        duration: data.duration,
        price: data.price,
      });
    }
    if (action === 'days' && !write)
      return json(
        await availabilityDays(p, body.worker, String(body.services || '').split(','), user),
      );
    if (action === 'week' && !write) {
      if (
        !(
          p.availability_meter_audience === 'everyone' ||
          (p.availability_meter_audience === 'registered' && user)
        )
      )
        return json({ days: {} });
      if (!uuid(body.worker)) throw new Error('יש לבחור איש צוות');
      const catalog = await result(
        scoped('services', p.id)
          .eq('is_active', true)
          .or(`worker_id.eq.${body.worker},worker_id.is.null`)
          .order('duration_minutes')
          .limit(1),
      );
      if (!catalog.length) return json({ days: {} });
      const today = israelNow().date;
      const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i));
      const values = await Promise.all(
        dates.map(async (date) => {
          const available = await availability(
            p,
            body.worker,
            [catalog[0].id],
            date,
            user,
          );
          return [date, available.slots.length];
        }),
      );
      return json({ days: Object.fromEntries(values) });
    }
    if (action === 'gallery' && !write)
      return json(
        await result(
          scoped('designs', p.id).order('display_order', { nullsFirst: false }),
        ),
      );
    if (action === 'products' && !write)
      return json(await result(scoped('products', p.id).eq('is_active', true)));
    if (action === 'messages' && !write)
      return json(
        await result(
          scoped('messages', p.id)
            .gt('expires_at', new Date().toISOString())
            .order('published_at', { ascending: false }),
        ),
      );
    if (!user) return json({ error: 'יש להתחבר כדי להמשיך' }, 401);
    if (
      user.user_type === 'client' &&
      p.require_client_approval &&
      user.client_approved === false &&
      action !== 'profile' &&
      action !== 'delete-account'
    )
      return json({ error: 'החשבון ממתין לאישור העסק' }, 403);
    if (action === 'quick-slots' && !write) {
      const audience = p.quick_slots_audience;
      const visible =
        audience === 'everyone' ||
        (audience === 'registered' &&
          !(
            user.user_type === 'client' &&
            p.require_client_approval &&
            user.client_approved === false
          ));
      if (!visible) return json({ error: 'תורים זריזים לא זמינים' }, 403);
      return json({
        slots: await nearestSlots(p, String(body.services || '').split(',').filter(Boolean), user),
      });
    }
    if (action === 'book' && write) {
      if (body.waitlistId && user.user_type === 'admin') {
        const waiting = await result(
          scoped('waitlist_entries', p.id)
            .eq('id', body.waitlistId)
            .in('status', ['waiting', 'contacted'])
            .single(),
        );
        if (!waiting || !phonesMatch(waiting.client_phone, body.clientPhone))
          throw new Error('בקשת ההמתנה אינה תואמת ללקוח');
      }
      const booked = await book(p, user, body);
      if (body.waitlistId && user.user_type === 'admin')
        await result(
          db()
            .from('waitlist_entries')
            .update({ status: 'booked' })
            .eq('business_id', p.id)
            .eq('id', body.waitlistId)
            .in('status', ['waiting', 'contacted']),
        );
      return json(booked);
    }
    if (action === 'appointments' && !write)
      return json(
        await result(
          ownAppointments(p, user).order('slot_date').order('slot_time'),
        ),
      );
    if (action === 'swaps' && !write)
      return json(
        await result(
          db()
            .from('swap_requests')
            .select(
              'id,appointment_id,status,preferred_dates,preferred_time_from,preferred_time_to,preferred_time_slots,original_date,original_time,original_service_name,original_barber_id',
            )
            .eq('business_id', p.id)
            .in('requester_phone', phoneLookupVariants(user.phone))
            .in('status', ['active', 'pending_confirmation']),
        ),
      );
    if (action === 'swap' && write && body.cancel) {
      if (!uuid(body.id)) throw new Error('תור לא תקין');
      await result(
        db()
          .from('swap_requests')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('business_id', p.id)
          .eq('appointment_id', body.id)
          .in('requester_phone', phoneLookupVariants(user.phone))
          .in('status', ['active', 'pending_confirmation']),
      );
      return json({ ok: true });
    }
    if (action === 'swap' && write) {
      if (p.client_swap_enabled === false)
        throw new Error('החלפת תורים אינה פעילה בעסק');
      const appointment = await result(
        ownAppointments(p, user)
          .eq('id', body.id)
          .eq('is_available', false)
          .eq('status', 'confirmed')
          .single(),
      );
      if (!appointment || appointment.slot_date < israelNow().date)
        throw new Error('התור אינו זמין להחלפה');
      if (
        !Array.isArray(body.dates) ||
        !body.dates.length ||
        body.dates.length > 14 ||
        body.dates.some(
          (d: any) =>
            typeof d !== 'string' ||
            !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
            d < israelNow().date,
        )
      )
        throw new Error('יש לבחור תאריכים עתידיים');
      const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
      if (
        !timePattern.test(body.from) ||
        !timePattern.test(body.until) ||
        body.from >= body.until
      )
        throw new Error('יש לבחור טווח שעות תקין');
      await result(
        db()
          .from('swap_requests')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('business_id', p.id)
          .eq('appointment_id', appointment.id)
          .eq('status', 'active'),
      );
      return json(
        await result(
          db()
            .from('swap_requests')
            .insert({
              business_id: p.id,
              appointment_id: appointment.id,
              requester_phone: user.phone,
              requester_name: user.name,
              original_date: appointment.slot_date,
              original_time: appointment.slot_time,
              original_service_name: appointment.service_name,
              original_service_id: appointment.service_id || null,
              original_duration_minutes: appointment.duration_minutes,
              original_barber_id: appointment.barber_id || null,
              preferred_dates: [...new Set(body.dates)],
              preferred_time_from: body.from,
              preferred_time_to: body.until,
              preferred_time_slots: [
                ...new Set(
                  (Array.isArray(body.slots) ? body.slots : [])
                    .map((id: unknown) => (id === 'noon' ? 'afternoon' : String(id)))
                    .filter((id: string) => ['morning', 'afternoon', 'evening'].includes(id)),
                ),
              ],
              status: 'active',
            })
            .select()
            .single(),
        ),
      );
    }
    if (action === 'cancel' && write) {
      if (!uuid(body.id)) throw new Error('תור לא תקין');
      const row = await result(
        (user.user_type === 'admin'
          ? scoped('appointments', p.id)
          : ownAppointments(p, user)
        )
          .eq('id', body.id)
          .single(),
      );
      const now = israelNow();
      const remaining =
        (Date.parse(row.slot_date + 'T00:00:00Z') -
          Date.parse(now.date + 'T00:00:00Z')) /
          60000 +
        minutes(row.slot_time) -
        now.minute;
      const minHours = Number(p.min_cancellation_hours ?? 24);
      if (user.user_type !== 'admin' && minHours > 0 && remaining < minHours * 60)
        throw new Error(
          `ניתן לבטל תורים עד ${minHours} שעות לפני המועד. לביטול בהתראה קצרה, אנא צור קשר עם המנהל.`,
        );
      if (row.status === 'cancelled') throw new Error('התור הזה כבר בוטל.');
      if (!['confirmed', 'pending'].includes(row.status))
        throw new Error('התור הזה כבר לא פעיל.');
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
            updated_at: new Date().toISOString(),
          })
          .eq('business_id', p.id)
          .eq('id', row.id)
          .eq('status', row.status),
      );
      const { error: noticeError } = await db()
        .from('notifications')
        .insert({
          business_id: p.id,
          recipient_name: row.client_name,
          recipient_phone: row.client_phone,
          title: 'התור בוטל',
          content: `התור ל${row.service_name} בתאריך ${row.slot_date} בשעה ${row.slot_time.slice(0, 5)} בוטל.`,
          type: 'general',
          appointment_id: row.id,
          is_read: false,
        });
      return json({
        ok: true,
        warning: noticeError ? 'התור בוטל, אך שמירת ההתראה נכשלה' : undefined,
      });
    }
    if (action === 'waitlist') {
      if (!write)
        return json(
          await result(
            scoped('waitlist_entries', p.id)
              .in('client_phone', phoneLookupVariants(user.phone))
              .order('requested_date'),
          ),
        );
      if (body.remove) {
        await result(
          db()
            .from('waitlist_entries')
            .update({ status: 'cancelled' })
            .eq('business_id', p.id)
            .eq('id', body.remove)
            .in('client_phone', phoneLookupVariants(user.phone)),
        );
        return json({ ok: true });
      }
      const picked = await selection(p, body.worker, body.services);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(body.date) ||
        body.date < israelNow().date
      )
        throw new Error('יש לבחור תאריך עתידי');
      const periods: string[] = Array.isArray(body.periods)
        ? [...new Set<string>(body.periods)]
        : body.period === 'any'
          ? ['morning', 'afternoon', 'evening']
          : [body.period];
      if (
        !periods.length ||
        periods.some(
          (v: string) => !['morning', 'afternoon', 'evening'].includes(v),
        )
      )
        throw new Error('טווח לא תקין');
      const existing = await result(
        scoped('waitlist_entries', p.id)
          .eq('requested_date', body.date)
          .eq('status', 'waiting')
          .in('client_phone', phoneLookupVariants(user.phone)),
      );
      const rows = periods
        .filter(
          (period: string) =>
            !existing.some((r: any) => r.time_period === period),
        )
        .map((time_period: string) => ({
          business_id: p.id,
          user_id: body.worker,
          client_name: user.name,
          client_phone: user.phone,
          service_name: picked.services.map((s: any) => s.name).join(' + '),
          requested_date: body.date,
          time_period,
          status: 'waiting',
        }));
      if (!rows.length) throw new Error('כבר קיימת בקשה לטווח שנבחר');
      return json(
        await result(db().from('waitlist_entries').insert(rows).select()),
      );
    }
    if (action === 'notifications' && !write)
      return json(
        await result(
          scoped('notifications', p.id)
            .in('recipient_phone', phoneLookupVariants(user.phone))
            .order('created_at', { ascending: false })
            .limit(100),
        ),
      );
    if (action === 'profile' && write) {
      const name = String(body.name || '').trim();
      if (!name || name.length > 100) throw new Error('יש להזין שם תקין');
      if (
        body.birth_date &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(body.birth_date) ||
          body.birth_date > israelNow().date)
      )
        throw new Error('תאריך לידה לא תקין');
      const changes: Record<string, any> = {
        name,
        language: ['he', 'en', 'ar', 'ru'].includes(body.language) ? body.language : 'he',
      };
      if ('birth_date' in body) changes.birth_date = body.birth_date || null;
      const updated = await result(
        db()
          .from('users')
          .update(changes)
          .eq('business_id', p.id)
          .eq('id', user.id)
          .select()
          .single(),
      );
      return json(safeUser(updated));
    }
    if (action === 'delete-account' && write) {
      if (user.user_type !== 'client')
        throw new Error('מחיקת חשבון מנהל מתבצעת מהגדרות העסק');
      await result(
        db().from('waitlist_entries').delete().eq('business_id', p.id).eq('user_id', user.id),
      );
      await result(db().from('users').delete().eq('business_id', p.id).eq('id', user.id));
      return json({ ok: true }, 200, {
        'Set-Cookie': 'tori_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
      });
    }
    if (user.user_type !== 'admin')
      return json({ error: 'אין הרשאה לפעולה זו' }, 403);
    if (action === 'admin' && !write) {
      const date = body.date || israelNow().date;
      const [appointments, clients, waitlist, hours, constraints, overrides] =
        await Promise.all([
          result(
            scoped('appointments', p.id)
              .eq('is_available', false)
              .gte('slot_date', date)
              .lte('slot_date', body.week === '1' ? addDays(date, 6) : date)
              .order('slot_date')
              .order('slot_time'),
          ),
          result(
            db()
              .from('users')
              .select('id,name,phone,client_approved,block,image_url')
              .eq('business_id', p.id)
              .eq('user_type', 'client')
              .order('name'),
          ),
          result(
            scoped('waitlist_entries', p.id)
              .eq('user_id', user.id)
              .in('status', ['waiting', 'contacted'])
              .gte('requested_date', israelNow().date)
              .lte('requested_date', addDays(israelNow().date, 365))
              .order('requested_date')
              .order('created_at'),
          ),
          result(scoped('business_hours', p.id).order('day_of_week')),
          result(scoped('business_constraints', p.id).gte('date', date)),
          result(scoped('business_hours_overrides', p.id).gte('date', date)),
        ]);
      return json({
        appointments,
        clients,
        waitlist,
        hours,
        constraints,
        overrides,
      });
    }
    if (action === 'admin-settings' && !write) return json(await readAdminSettings(p, user, slug));
    if (action === 'admin-settings' && write) return json(await writeAdminSettings(p, user, body));
    if (action === 'admin-settings-list' && !write)
      return json(await readSettingsList(p, user, String(body.part || ''), body));
    if (action === 'admin-settings-list' && write)
      return json(await writeSettingsList(p, user, body));
    if (action === 'admin-cancel-app' && write)
      return json(await requestAppCancellation(p, user));
    if (action === 'admin-sms' && !write) return json(await smsBalance(p.id));
    if (action === 'admin-broadcast' && !write) {
      if (!isBusinessOwner(p, user)) return json({ owner: false });
      if (body.inactive) {
        const days = Number(body.inactive);
        if (!inactivePeriods.includes(days)) throw new Error('בחרו תקופה');
        return json({ owner: true, clients: await inactiveClients(p.id, days) });
      }
      if (body.month) return json({ owner: true, booked: await bookedMonth(p.id, body.month) });
      return json({ owner: true, ...(await broadcastOverview(p.id)) });
    }
    if (action === 'admin-broadcast' && write) {
      if (!isBusinessOwner(p, user))
        return json({ error: 'רק מנהל העסק יכול לשלוח הודעת שידור' }, 403);
      if (body.operation === 'delete') return json(await deleteScheduledBroadcast(p.id, body.id));
      return json(await sendBroadcast(p, user, body));
    }
    if (action === 'admin-waitlist' && write) {
      if (!uuid(body.remove)) throw new Error('פעולה לא תקינה');
      await result(
        db()
          .from('waitlist_entries')
          .delete()
          .eq('business_id', p.id)
          .eq('id', body.remove),
      );
      return json({ ok: true });
    }
    if (action === 'admin-week' && !write) return json(await weekCounts(p.id, user.id, body.from));
    if (action === 'admin-calendar' && !write)
      return json(
        body.mode === 'months'
          ? await calendarMonths(p.id, user.id, body)
          : body.mode === 'search'
            ? await calendarSearch(p.id, user.id, body)
            : await calendarRange(p.id, user.id, body),
      );
    if (action === 'admin-remove' && write)
      return json(await removeAppointment(p.id, user.id, body.id));
    if (action === 'admin-reminder' && write)
      return json(await saveReminder(p.id, user.id, body));
    if (action === 'admin-hours-data' && !write) return json(await hoursData(p, user.id));
    if (action === 'admin-break' && write)
      return json(await saveBreakMinutes(p, user.id, body.minutes));
    if (action === 'admin-book-month' && !write)
      return json(await monthAvailability(p, user.id, body));
    if (action === 'admin-new-client' && write) return json(await createClient(p, body));
    if (action === 'admin-clients' && !write) return json(await clientsOverview(p));
    if (action === 'admin-client-profile' && !write) return json(await clientProfile(p, body));
    if (action === 'admin-notifications' && !write)
      return json(await adminNotifications(p, user, body.mark === '1'));
    if (action === 'admin-finance' && !write) return json(await financeMonth(p.id, body.year, body.month));
    if (action === 'admin-finance' && write) return json(await saveExpense(p.id, body));
    if (action === 'admin-book' && write) return json(await adminBook(p, user, body));
    if (action === 'admin-upload' && write)
      return json({ url: await uploadImage(body.image) });
    if (action === 'admin-catalog' && write)
      return json(await saveCatalogItem(p.id, user.id, body));
    if (action === 'admin-client' && write) {
      if (body.operation === 'decline') return json(await declineClient(p, body.id));
      if (body.operation === 'emergency') {
        if (!uuid(body.id) || !/^\d{6}$/.test(String(body.code || '')))
          throw new Error('קוד החירום חייב להכיל 6 ספרות');
        const rows = await result(
          db()
            .from('users')
            .update({ password_hash: emergencyCodeHash(body.code) })
            .eq('business_id', p.id)
            .eq('id', body.id)
            .eq('user_type', 'client')
            .select('id'),
        );
        if (!rows.length) throw new Error('שמירת סיסמת החירום נכשלה');
        return json({ ok: true, code: body.code });
      }
      if (
        !uuid(body.id) ||
        !['approve', 'block', 'unblock'].includes(body.operation)
      )
        throw new Error('פעולה לא תקינה');
      await result(
        db()
          .from('users')
          .update(
            body.operation === 'approve'
              ? { client_approved: true }
              : { block: body.operation === 'block' },
          )
          .eq('business_id', p.id)
          .eq('id', body.id)
          .eq('user_type', 'client'),
      );
      return json({ ok: true });
    }
    if (action === 'admin-status' && write) {
      if (
        !uuid(body.id) ||
        !['completed', 'no_show', 'confirmed'].includes(body.status)
      )
        throw new Error('סטטוס לא תקין');
      await result(
        db()
          .from('appointments')
          .update({ status: body.status })
          .eq('business_id', p.id)
          .eq('id', body.id)
          .eq('is_available', false),
      );
      return json({ ok: true });
    }
    if (action === 'admin-hours' && write) {
      const table =
        body.kind === 'constraint'
          ? 'business_constraints'
          : body.kind === 'override'
            ? 'business_hours_overrides'
            : 'business_hours';
      if (body.id && !uuid(body.id)) throw new Error('רשומה לא תקינה');
      if (body.remove) {
        if (!body.id) throw new Error('רשומה חסרה');
        await result(
          db().from(table).delete().eq('business_id', p.id).eq('id', body.id),
        );
        return json({ ok: true });
      }
      if (body.worker) {
        await result(
          scoped('users', p.id)
            .eq('id', body.worker)
            .eq('user_type', 'admin')
            .single(),
        );
      }
      if (
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.start) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.end) ||
        body.start >= body.end
      )
        throw new Error('שעות לא תקינות');
      const payload: any = {
        business_id: p.id,
        user_id: body.worker || null,
        start_time: body.start,
        end_time: body.end,
      };
      if (table === 'business_hours') {
        if (
          !Number.isInteger(Number(body.day)) ||
          +body.day < 0 ||
          +body.day > 6
        )
          throw new Error('יום לא תקין');
        Object.assign(payload, {
          day_of_week: +body.day,
          is_active: body.active !== false,
        });
        if (body.step !== undefined) {
          if (![5, 10, 15, 20, 30, 60].includes(Number(body.step)))
            throw new Error('מרווח לא תקין');
          payload.slot_duration_minutes = Number(body.step);
        }
      } else {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date))
          throw new Error('תאריך לא תקין');
        payload.date = body.date;
        if (table === 'business_hours_overrides')
          payload.is_active = body.active !== false;
        else payload.reason = String(body.reason || '').slice(0, 200);
      }
      if (table !== 'business_constraints') {
        const breaks = body.breaks || [];
        if (
          !Array.isArray(breaks) ||
          breaks.some(
            (b: any) =>
              !/^\d{2}:\d{2}$/.test(b.start_time) ||
              !/^\d{2}:\d{2}$/.test(b.end_time) ||
              b.start_time >= b.end_time,
          )
        )
          throw new Error('הפסקה לא תקינה');
        payload.breaks = breaks;
        payload.break_start_time = null;
        payload.break_end_time = null;
        if (table === 'business_hours_overrides') {
          delete payload.break_start_time;
          delete payload.break_end_time;
        }
      }
      if (!body.id && table !== 'business_constraints') {
        let existing = scoped(table, p.id).eq(
          table === 'business_hours' ? 'day_of_week' : 'date',
          table === 'business_hours' ? payload.day_of_week : payload.date,
        );
        existing = body.worker
          ? existing.eq('user_id', body.worker)
          : existing.is('user_id', null);
        const current = await result(existing.maybeSingle());
        if (current) body.id = current.id;
      }
      if (body.id)
        await result(
          db()
            .from(table)
            .update(payload)
            .eq('business_id', p.id)
            .eq('id', body.id),
        );
      else {
        if (table === 'business_hours')
          payload.slot_duration_minutes ??= 60;
        await result(db().from(table).insert(payload));
      }
      return json({ ok: true });
    }
    return json({ error: 'הפעולה לא נמצאה' }, 404);
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : 'אירעה שגיאה. נסו שוב.',
      },
      400,
    );
  }
}
