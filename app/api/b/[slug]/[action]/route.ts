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
  book,
  ownAppointments,
  selection,
} from '@/lib/server/booking';
import {
  parseIsraeliMobileNational10,
  phoneLookupVariants,
  phonesMatch,
} from '@/lib/phone';
import { israelNow, minutes, addDays } from '@/lib/availability';
export const dynamic = 'force-dynamic';
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
    if (req.method === 'POST' && req.headers.get('origin') !== url.origin)
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
            .select('id,name,image_url')
            .eq('business_id', p.id)
            .eq('user_type', 'admin')
            .or('block.is.null,block.eq.false'),
        ),
      ]);
      const profile = publicProfile(p);
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
      if (!response?.ok)
        return json(
          { error: response?.error || 'לא ניתן להשלים את ההתחברות. נסו שוב.' },
          400,
        );
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
      action !== 'profile'
    )
      return json({ error: 'החשבון ממתין לאישור העסק' }, 403);
    if (action === 'book' && write) {
      if (body.waitlistId && user.user_type === 'admin') {
        const waiting = await result(
          scoped('waitlist_entries', p.id)
            .eq('id', body.waitlistId)
            .eq('status', 'waiting')
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
            .eq('status', 'waiting'),
        );
      return json(booked);
    }
    if (action === 'appointments' && !write)
      return json(
        await result(
          ownAppointments(p, user).order('slot_date').order('slot_time'),
        ),
      );
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
              preferred_time_slots: [],
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
      if (
        user.user_type !== 'admin' &&
        remaining < Number(p.min_cancellation_hours || 0) * 60
      )
        throw new Error('חלון הביטול נסגר. יש להתקשר לעסק.');
      if (!['confirmed', 'pending'].includes(row.status))
        throw new Error('לא ניתן לבטל את התור הזה');
      await result(
        db()
          .from('appointments')
          .update({
            status: 'cancelled',
            is_available: true,
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
      const periods =
        body.period === 'any'
          ? ['morning', 'afternoon', 'evening']
          : [body.period];
      if (
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
      const updated = await result(
        db()
          .from('users')
          .update({
            name,
            birth_date: body.birth_date || null,
            language: body.language === 'en' ? 'en' : 'he',
          })
          .eq('business_id', p.id)
          .eq('id', user.id)
          .select()
          .single(),
      );
      return json(safeUser(updated));
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
              .eq('status', 'waiting')
              .order('requested_date'),
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
    if (action === 'admin-client' && write) {
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
          slot_duration_minutes: Number(body.step) || 15,
        });
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
      else await result(db().from(table).insert(payload));
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
