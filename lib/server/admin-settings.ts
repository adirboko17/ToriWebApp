import { db, publicProfile, result, uuid } from './db';
import { businessLogos } from '../branding';
import { isBusinessOwner } from './admin-home';
import { uploadImage } from './catalog';
import { normalizeStoredPhone, phonesMatch } from '../phone';
import { addDays, israelNow } from '../availability';
import { bookingStartStepMinutes, nextBookingStartMin } from '../booking-step';

const audiences = ['off', 'everyone', 'registered'];
const languages = ['he', 'en', 'ar', 'ru'];
const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function audience(value: unknown, fallback: string) {
  return typeof value === 'string' && audiences.includes(value) ? value : fallback;
}
function whole(value: unknown, min: number, max: number) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error('מספר לא תקין');
  return n;
}
function text(value: unknown, max: number, required = false) {
  const v = String(value ?? '').trim();
  if (required && !v) throw new Error('יש למלא את השדה');
  if (v.length > max) throw new Error('הטקסט ארוך מדי');
  return v;
}
function httpsUrl(value: string) {
  if (value && !/^https:\/\/[^\s]+$/i.test(value))
    throw new Error('הקישור צריך להתחיל ב-https://');
  return value || null;
}
function he(fallback: unknown, map: unknown) {
  if (map && typeof map === 'object' && !Array.isArray(map)) {
    const localized = (map as Record<string, unknown>).he;
    if (typeof localized === 'string' && localized.trim()) return localized.trim();
  }
  return String(fallback || '').trim();
}
function hashPassword(password: string) {
  return password === '123456' ? 'default_hash' : `hash_${password}`;
}
const videoTypes: Record<string, string> = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' };
async function uploadVideo(dataUrl: unknown) {
  const match = /^data:(video\/(?:mp4|quicktime|webm));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!match) throw new Error('לא הצלחנו לקרוא את הסרטון');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 12 * 1024 * 1024)
    throw new Error('הווידאו גדול מדי להעלאה. בחרו קליפ קצר יותר.');
  const path = `uploads/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${videoTypes[match[1]]}`;
  const storage = db().storage;
  let bucket = 'designs';
  let upload = await storage.from(bucket).upload(path, bytes, { contentType: match[1], upsert: false });
  if (upload.error && /bucket.*not found/i.test(upload.error.message)) {
    bucket = 'public';
    upload = await storage.from(bucket).upload(path, bytes, { contentType: match[1], upsert: false });
  }
  if (upload.error) throw new Error('הווידאו גדול מדי להעלאה. בחרו קליפ קצר יותר.');
  return storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
function hasCode(hash: unknown) {
  const raw = String(hash || '');
  return Boolean(raw) && !raw.startsWith('otp_only_');
}
function hex(value: unknown) {
  const color = String(value || '').trim();
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('צבע לא תקין');
  return color.toUpperCase();
}
const fonts = new Set([
  'gf_inter', 'gf_montserrat', 'gf_playfair', 'gf_roboto', 'gf_merriweather', 'gf_oswald',
  'gf_lato', 'gf_poppins', 'gf_dancing_script', 'gf_pacifico', 'gf_space_mono', 'gf_bebas_neue',
  'gf_alfa_slab', 'gf_lobster', 'gf_cinzel', 'gf_righteous', 'gf_permanent_marker', 'gf_orbitron',
  'gf_josefin_sans', 'gf_nunito', 'gf_quicksand', 'gf_raleway', 'gf_great_vibes', 'gf_satisfy',
  'gf_sacramento', 'gf_comfortaa', 'gf_rubik', 'gf_work_sans',
]);

async function removeAdmin(businessId: string, id: string) {
  const scoped = (table: string) => db().from(table).delete().eq('business_id', businessId);
  await result(scoped('appointments').or(`user_id.eq.${id},barber_id.eq.${id}`));
  for (const table of ['business_constraints', 'business_hours', 'designs', 'waitlist_entries'])
    await result(scoped(table).eq('user_id', id));
  for (const column of ['client_id', 'admin_id'])
    await result(scoped('recurring_appointments').eq(column, id));
  await result(scoped('users').eq('id', id).eq('user_type', 'admin'));
}

export async function readAdminSettings(profile: any, user: any, slug: string) {
  const me = await result(
    db()
      .from('users')
      .select(
        'id,name,phone,image_url,language,notify_new_appointment,notify_appointment_cancel,password_hash,branch_id',
      )
      .eq('business_id', profile.id)
      .eq('id', user.id)
      .single(),
  );
  const staff = await result(
    db()
      .from('users')
      .select('id,name,image_url,block')
      .eq('business_id', profile.id)
      .eq('user_type', 'admin')
      .order('name'),
  );
  const bookable = (staff || []).filter((row: any) => row.block !== true);
  const pending = await result(
    db()
      .from('users')
      .select('id')
      .eq('business_id', profile.id)
      .eq('user_type', 'client')
      .eq('client_approved', false),
  );
  const reminder = profile.reminder_minutes_by_user?.[user.id];
  return {
    owner: isBusinessOwner(profile, user),
    pending_clients: (pending || []).length,
    staff_count: bookable.length,
    staff_preview: bookable
      .filter((row: any) => String(row.name || '').trim())
      .slice(0, 3)
      .map((row: any) => ({ name: row.name, image_url: row.image_url || '' })),
    meter_staff: bookable.map((row: any) => ({
      id: row.id,
      name: row.name || '',
      image_url: row.image_url || '',
    })),
    me: {
      id: user.id,
      has_code: hasCode(me?.password_hash),
      branch_id: me?.branch_id || null,
      name: me?.name || '',
      phone: me?.phone || '',
      image_url: me?.image_url || '',
      language: languages.includes(me?.language) ? me.language : 'he',
      notify_new_appointment: me?.notify_new_appointment !== false,
      notify_appointment_cancel: me?.notify_appointment_cancel !== false,
    },
    display_name: profile.display_name || '',
    address: profile.address || '',
    phone: profile.phone || '',
    instagram_url: profile.instagram_url || '',
    facebook_url: profile.facebook_url || '',
    tiktok_url: profile.tiktok_url || '',
    require_client_approval: profile.require_client_approval !== false,
    home_fixed_message: profile.home_fixed_message || '',
    home_fixed_message_audience: audience(
      profile.home_fixed_message_audience,
      profile.home_fixed_message_enabled ? 'everyone' : 'off',
    ),
    availability_meter_audience: audience(profile.availability_meter_audience, 'off'),
    quick_slots_audience: audience(profile.quick_slots_audience, 'off'),
    map_audience: audience(profile.map_audience, 'everyone'),
    min_cancellation_hours: Number(profile.min_cancellation_hours || 0),
    client_reminder_minutes: Number(profile.client_reminder_minutes || 0),
    admin_reminder_minutes: Number(reminder || 0),
    allow_multi_service_booking: profile.allow_multi_service_booking === true,
    client_swap_enabled: profile.client_swap_enabled !== false,
    client_swap_min_hours: Number(profile.client_swap_min_hours || 0),
    booking_open_days: Number(
      profile.booking_open_days_by_user?.[user.id] ?? profile.booking_open_days ?? 7,
    ),
    primary_color: profile.primary_color || '#87937e',
    home_hero_mode: profile.home_hero_mode === 'single_fullbleed' ? 'single_fullbleed' : 'marquee',
    home_hero_images: Array.isArray(profile.home_hero_images) ? profile.home_hero_images : [],
    home_hero_single_url: profile.home_hero_single_url || '',
    home_hero_single_kind: profile.home_hero_single_kind || '',
    home_header_show_logo: profile.home_header_show_logo !== false,
    home_header_text_without_logo: profile.home_header_text_without_logo || '',
    home_logo_url: /^https?:\/\//.test(profile.home_logo_url || '') ? profile.home_logo_url : '',
    home_logos: businessLogos(await publicProfile(profile), slug),
    home_header_logo_height: Number(profile.home_header_logo_height) || 52,
    home_header_logo_color_mode:
      profile.home_header_logo_color_mode === 'original' ? 'original' : 'white',
    home_header_scrim_color: /^#[0-9a-f]{6}$/i.test(profile.home_header_scrim_color || '')
      ? profile.home_header_scrim_color
      : '#000000',
    home_header_title_font: profile.home_header_title_font || null,
    home_header_title_font_size: Number(profile.home_header_title_font_size) || 32,
    home_header_name_color: /^#[0-9a-f]{6}$/i.test(profile.home_header_name_color || '')
      ? profile.home_header_name_color
      : null,
    staff_selection_style:
      profile.staff_selection_style === 'avatar_list' ? 'avatar_list' : 'large_cards',
  };
}

export async function writeAdminSettings(profile: any, user: any, body: any) {
  const owner = isBusinessOwner(profile, user);
  const update: Record<string, any> = {};
  const me: Record<string, any> = {};
  const own = (key: string) => {
    if (!(key in body)) return false;
    if (!owner) throw new Error('רק בעל העסק יכול לשנות את ההגדרה הזו');
    return true;
  };

  if (own('display_name')) update.display_name = text(body.display_name, 80) || null;
  if (own('address')) update.address = text(body.address, 200) || null;
  for (const key of ['instagram_url', 'facebook_url', 'tiktok_url']) {
    if (!own(key)) continue;
    update[key] = httpsUrl(text(body[key], 300));
  }
  for (const key of [
    'require_client_approval',
    'allow_multi_service_booking',
    'client_swap_enabled',
    'home_header_show_logo',
  ]) {
    if (!own(key)) continue;
    if (typeof body[key] !== 'boolean') throw new Error('ערך לא תקין');
    update[key] = body[key];
  }
  for (const key of [
    'home_fixed_message_audience',
    'availability_meter_audience',
    'quick_slots_audience',
    'map_audience',
  ]) {
    if (!own(key)) continue;
    if (!audiences.includes(body[key])) throw new Error('ערך לא תקין');
    update[key] = body[key];
  }
  if ('home_fixed_message_audience' in update)
    update.home_fixed_message_enabled = update.home_fixed_message_audience !== 'off';
  if ('availability_meter_audience' in update)
    update.availability_meter_approved_only = update.availability_meter_audience === 'registered';
  if (own('home_fixed_message')) update.home_fixed_message = text(body.home_fixed_message, 1000) || null;
  if (own('home_header_text_without_logo')) {
    const title = text(body.home_header_text_without_logo, 120);
    if (title && !/^[A-Za-z0-9 \-'.&,()]+$/.test(title))
      throw new Error('רק אותיות באנגלית, ספרות וסימני פיסוק בסיסיים.');
    update.home_header_text_without_logo = title || null;
  }
  if (own('home_header_logo_height')) {
    const height = whole(body.home_header_logo_height, 28, 120);
    update.home_header_logo_height = height;
  }
  if (own('home_header_logo_color_mode')) {
    if (!['white', 'original'].includes(body.home_header_logo_color_mode))
      throw new Error('ערך לא תקין');
    update.home_header_logo_color_mode = body.home_header_logo_color_mode;
  }
  if (own('home_header_scrim_color')) update.home_header_scrim_color = hex(body.home_header_scrim_color);
  if (own('home_header_name_color'))
    update.home_header_name_color = body.home_header_name_color
      ? hex(body.home_header_name_color)
      : null;
  if (own('home_header_title_font')) {
    const font = body.home_header_title_font;
    if (font !== null && !fonts.has(font)) throw new Error('ערך לא תקין');
    update.home_header_title_font = font;
  }
  if (own('home_header_title_font_size'))
    update.home_header_title_font_size = whole(body.home_header_title_font_size, 14, 72);
  if (own('min_cancellation_hours'))
    update.min_cancellation_hours = whole(body.min_cancellation_hours, 0, 168);
  if (own('client_swap_min_hours'))
    update.client_swap_min_hours = whole(body.client_swap_min_hours, 0, 168);
  if (own('client_reminder_minutes')) {
    const minutes = whole(body.client_reminder_minutes, 0, 1440);
    update.client_reminder_minutes = minutes || null;
  }
  if (own('booking_open_days')) {
    update.booking_open_days_by_user = {
      ...(profile.booking_open_days_by_user || {}),
      [user.id]: whole(body.booking_open_days, 0, 60),
    };
  }
  if (own('primary_color')) {
    const color = String(body.primary_color || '').trim();
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('צבע לא תקין');
    update.primary_color = color;
  }
  if (own('home_hero_mode')) {
    if (!['marquee', 'single_fullbleed'].includes(body.home_hero_mode))
      throw new Error('ערך לא תקין');
    update.home_hero_mode = body.home_hero_mode;
  }
  if (own('staff_selection_style')) {
    if (!['large_cards', 'avatar_list'].includes(body.staff_selection_style))
      throw new Error('ערך לא תקין');
    update.staff_selection_style = body.staff_selection_style;
  }
  const images = Array.isArray(profile.home_hero_images) ? profile.home_hero_images : [];
  if (own('hero_add'))
    update.home_hero_images = [...images, await uploadImage(body.hero_add)].slice(0, 60);
  if (own('hero_remove'))
    update.home_hero_images = images.filter((url: string) => url !== body.hero_remove);
  if (own('hero_first')) {
    if (!images.includes(body.hero_first)) throw new Error('תמונה לא תקינה');
    update.home_hero_images = [
      body.hero_first,
      ...images.filter((url: string) => url !== body.hero_first),
    ];
  }
  if (own('hero_single')) {
    const video = /^data:video\//.test(String(body.hero_single || ''));
    update.home_hero_single_url = video
      ? await uploadVideo(body.hero_single)
      : await uploadImage(body.hero_single);
    update.home_hero_single_kind = video ? 'video' : 'image';
  }
  if ('admin_reminder_minutes' in body) {
    const minutes = whole(body.admin_reminder_minutes, 0, 60);
    if (minutes && (minutes < 5 || minutes > 60)) throw new Error('הזינו מספר שלם בין 5 ל־60');
    const map = { ...(profile.reminder_minutes_by_user || {}) };
    if (!minutes) delete map[user.id];
    else map[user.id] = minutes;
    update.reminder_minutes_by_user = map;
  }
  if ('me_name' in body) me.name = text(body.me_name, 80, true);
  if ('me_phone' in body) {
    const phone = normalizeStoredPhone(String(body.me_phone || ''));
    if (phone.replace(/\D/g, '').length < 9) throw new Error('אנא הזן/י מספר טלפון תקין');
    me.phone = phone;
  }
  if ('language' in body) {
    if (!languages.includes(body.language)) throw new Error('ערך לא תקין');
    me.language = body.language;
  }
  if ('me_code' in body) {
    if (!/^\d{6}$/.test(String(body.me_code))) throw new Error('סיסמת החירום חייבת להיות בדיוק 6 ספרות');
    me.password_hash = hashPassword(body.me_code);
  }
  if ('me_image' in body) me.image_url = await uploadImage(body.me_image);
  for (const key of ['notify_new_appointment', 'notify_appointment_cancel']) {
    if (!(key in body)) continue;
    if (typeof body[key] !== 'boolean') throw new Error('ערך לא תקין');
    me[key] = body[key];
  }
  if (!Object.keys(update).length && !Object.keys(me).length) throw new Error('אין מה לשמור');
  if (Object.keys(update).length)
    await result(db().from('business_profile').update(update).eq('id', profile.id));
  if (update.require_client_approval === false)
    await result(
      db()
        .from('users')
        .update({ client_approved: true })
        .eq('business_id', profile.id)
        .eq('user_type', 'client')
        .eq('client_approved', false),
    );
  if (Object.keys(me).length)
    await result(
      db().from('users').update(me).eq('business_id', profile.id).eq('id', user.id),
    );
  return { ok: true };
}

const clock = (t: unknown) => {
  const [h, m] = String(t || '').slice(0, 5).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const hhmm = (n: number) => {
  const v = ((n % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
};
const lengthOf = (service: any) => (service.duration_minutes > 0 ? Number(service.duration_minutes) : 60);

async function recurringServices(profile: any, user: any, raw: unknown) {
  const ids = (Array.isArray(raw) ? raw : String(raw || '').split(',')).map(String).filter(uuid);
  if (!ids.length || ids.length > 10) throw new Error('אנא מלא/י את כל השדות: לקוח, יום, שעה ושירות');
  if (ids.length > 1 && profile.allow_multi_service_booking !== true) throw new Error('פעולה לא תקינה');
  const rows = await result(
    db().from('services').select('id,name,duration_minutes,worker_id,is_active').eq('business_id', profile.id).in('id', ids),
  );
  const services = ids.map((id) => (rows || []).find((row: any) => row.id === id));
  if (services.some((row: any) => !row || row.is_active === false || (row.worker_id && row.worker_id !== user.id)))
    throw new Error('אנא מלא/י את כל השדות: לקוח, יום, שעה ושירות');
  return services as any[];
}

async function weekdayHours(profile: any, user: any) {
  const rows = await result(
    db()
      .from('business_hours')
      .select('*')
      .eq('business_id', profile.id)
      .eq('is_active', true)
      .or(`user_id.eq.${user.id},user_id.is.null`),
  );
  return Array.from({ length: 7 }, (_, day) => {
    const own = (rows || []).find((row: any) => row.day_of_week === day && row.user_id === user.id);
    const row = own || (rows || []).find((row: any) => row.day_of_week === day && !row.user_id);
    return row && row.start_time && row.end_time && clock(row.start_time) < clock(row.end_time) ? row : null;
  });
}

async function recurringBusy(profile: any, user: any, day: number) {
  const today = israelNow().date;
  const [rules, booked] = await Promise.all([
    result(
      db()
        .from('recurring_appointments')
        .select('slot_time')
        .eq('business_id', profile.id)
        .eq('day_of_week', day)
        .eq('admin_id', user.id)
        .limit(2000),
    ),
    result(
      db()
        .from('appointments')
        .select('slot_time,slot_date,duration_minutes')
        .eq('business_id', profile.id)
        .eq('is_available', false)
        .gte('slot_date', addDays(today, -30))
        .lte('slot_date', addDays(today, 30))
        .or(`barber_id.eq.${user.id},user_id.eq.${user.id},user_id.is.null`)
        .limit(8000),
    ),
  ]);
  const starts = new Set((rules || []).map((row: any) => String(row.slot_time).slice(0, 5)));
  const busy = (booked || [])
    .filter((row: any) => new Date(`${row.slot_date}T12:00:00Z`).getUTCDay() === day)
    .map((row: any) => ({ start: clock(row.slot_time), end: clock(row.slot_time) + (row.duration_minutes > 0 ? row.duration_minutes : 60) }));
  return (start: string, services: any[]) => {
    let offset = 0;
    for (const service of services) {
      const from = clock(start) + offset;
      if (starts.has(hhmm(from))) return false;
      const to = from + lengthOf(service);
      if (busy.some((b: any) => Math.max(b.start, from) < Math.min(b.end, to))) return false;
      offset += lengthOf(service);
    }
    return true;
  };
}

async function recurringTimes(profile: any, user: any, day: number, services: any[]) {
  const hours = (await weekdayHours(profile, user))[day];
  if (!hours) return [];
  let windows = [{ start: clock(hours.start_time), end: clock(hours.end_time) }];
  const breaks = [
    ...(Array.isArray(hours.breaks) ? hours.breaks : []),
    ...(hours.break_start_time && hours.break_end_time ? [{ start_time: hours.break_start_time, end_time: hours.break_end_time }] : []),
  ];
  for (const b of breaks) {
    const from = clock(b.start_time);
    const to = clock(b.end_time);
    windows = windows.flatMap((w) =>
      to <= w.start || from >= w.end
        ? [w]
        : [
            { start: w.start, end: from },
            { start: to, end: w.end },
          ].filter((part) => part.start < part.end),
    );
  }
  const free = await recurringBusy(profile, user, day);
  const total = services.reduce((n, service) => n + lengthOf(service), 0);
  const step = bookingStartStepMinutes(hours.slot_duration_minutes);
  const times: string[] = [];
  for (const w of windows.sort((a, b) => a.start - b.start)) {
    for (let t = w.start; t + total <= w.end; t = nextBookingStartMin(t, step)) {
      if (free(hhmm(t), services)) times.push(hhmm(t));
    }
  }
  return times;
}

async function requireOwner(profile: any, user: any) {
  if (!isBusinessOwner(profile, user))
    throw new Error('רק בעל העסק יכול לשנות את ההגדרה הזו');
}

export async function readSettingsList(profile: any, user: any, part: string, query: any = {}) {
  if (part === 'recurring-setup') {
    const [clients, rules, catalog, hours] = await Promise.all([
      result(
        db()
          .from('users')
          .select('id,name,phone')
          .eq('business_id', profile.id)
          .eq('user_type', 'client')
          .order('name'),
      ),
      result(
        db().from('recurring_appointments').select('client_phone').eq('business_id', profile.id).eq('admin_id', user.id),
      ),
      result(
        db()
          .from('services')
          .select('id,name,price,duration_minutes,is_active,order_index,worker_id')
          .eq('business_id', profile.id),
      ),
      weekdayHours(profile, user),
    ]);
    const taken = new Set((rules || []).map((row: any) => String(row.client_phone || '').trim()).filter(Boolean));
    const services = (catalog || []).filter(
      (row: any) => row.is_active !== false && (!row.worker_id || row.worker_id === user.id),
    );
    services.sort(
      (a: any, b: any) =>
        (a.order_index ?? Infinity) - (b.order_index ?? Infinity) ||
        String(a.name || '').localeCompare(String(b.name || ''), 'he', { numeric: true }),
    );
    return {
      clients: (clients || []).filter(
        (row: any) => String(row.phone || '').trim() && !taken.has(String(row.phone).trim()),
      ),
      services,
      days: hours.flatMap((row, day) => (row ? [day] : [])),
      multi: profile.allow_multi_service_booking === true,
    };
  }
  if (part === 'recurring-times') {
    const day = whole(query.day, 0, 6);
    const services = await recurringServices(profile, user, query.services);
    return { times: await recurringTimes(profile, user, day, services) };
  }
  if (part === 'services') {
    const rows = await result(
      db()
        .from('services')
        .select('id,name,price,duration_minutes,is_active,order_index,worker_id')
        .eq('business_id', profile.id)
        .order('order_index', { nullsFirst: false }),
    );
    const services = (rows || []).filter(
      (row: any) => row.is_active !== false && (!row.worker_id || row.worker_id === user.id),
    );
    services.sort(
      (a: any, b: any) =>
        (a.order_index ?? Infinity) - (b.order_index ?? Infinity) ||
        String(a.name || '').localeCompare(String(b.name || ''), 'he', { numeric: true }),
    );
    return { services };
  }
  if (part === 'employees') {
    await requireOwner(profile, user);
    const [people, branches] = await Promise.all([
      result(
        db()
          .from('users')
          .select('id,name,phone,image_url,block,branch_id,password_hash')
          .eq('business_id', profile.id)
          .eq('user_type', 'admin')
          .neq('id', user.id)
          .order('name'),
      ).then((rows) =>
        (rows || []).map(({ password_hash, ...row }: any) => ({ ...row, has_code: hasCode(password_hash) })),
      ),
      result(
        db()
          .from('branches')
          .select('id,name,is_default')
          .eq('business_id', profile.id)
          .order('sort_order'),
      ).catch(() => []),
    ]);
    return { employees: people || [], branches: branches || [] };
  }
  if (part === 'branches') {
    await requireOwner(profile, user);
    const [rows, me] = await Promise.all([
      result(
        db()
          .from('branches')
          .select('id,name,address,phone,is_default,is_active,sort_order,created_at')
          .eq('business_id', profile.id)
          .order('sort_order')
          .order('created_at'),
      ),
      result(
        db().from('users').select('id,branch_id').eq('business_id', profile.id).eq('user_type', 'admin'),
      ),
    ]);
    const staff = new Map<string, number>();
    for (const row of me || []) if (row.branch_id) staff.set(row.branch_id, (staff.get(row.branch_id) || 0) + 1);
    return {
      branches: (rows || []).map((row: any) => ({ ...row, staff: staff.get(row.id) || 0 })),
      my_branch: (me || []).find((row: any) => row.id === user.id)?.branch_id || null,
    };
  }
  if (part === 'health') {
    await requireOwner(profile, user);
    const [forms, assignments] = await Promise.all([
      result(
        db()
          .from('health_forms')
          .select('id,title,is_active')
          .eq('business_id', profile.id)
          .order('created_at', { ascending: false }),
      ),
      result(
        db()
          .from('health_form_assignments')
          .select('form_id,service_id')
          .eq('business_id', profile.id),
      ).catch(() => []),
    ]);
    const counts = new Map<string, number>();
    for (const row of assignments || []) {
      if (!row.service_id) continue;
      counts.set(row.form_id, (counts.get(row.form_id) || 0) + 1);
    }
    return {
      forms: (forms || []).map((form: any) => ({
        ...form,
        services: counts.get(form.id) || 0,
      })),
    };
  }
  if (part === 'recurring') {
    const rows = await result(
      db()
        .from('recurring_appointments')
        .select('*')
        .eq('business_id', profile.id)
        .eq('admin_id', user.id),
    );
    return {
      recurring: (rows || []).map((row: any) => ({
        id: row.id,
        client_name: row.client_name || '',
        client_phone: row.client_phone || '',
        service_name: row.service_name || '',
        day_of_week: Number(row.day_of_week),
        day: days[Number(row.day_of_week)] || '',
        time: String(row.slot_time || row.time || '').slice(0, 5),
        repeat_interval: Number(row.repeat_interval || 1),
      })),
    };
  }
  if (part === 'help') {
    const categories = await result(
      db()
        .from('help_categories')
        .select('id,title,title_i18n,description,description_i18n,icon,sort_order,audience')
        .eq('is_published', true)
        .in('audience', ['admin', 'all'])
        .order('sort_order'),
    );
    const ids = (categories || []).map((row: any) => row.id);
    const videos = ids.length
      ? await result(
          db()
            .from('help_videos')
            .select('id,category_id,title,title_i18n,video_url,thumbnail_url,sort_order')
            .eq('is_published', true)
            .in('category_id', ids)
            .order('sort_order'),
        )
      : [];
    return {
      categories: (categories || []).map((category: any) => ({
        id: category.id,
        title: he(category.title, category.title_i18n),
        description: he(category.description, category.description_i18n),
        icon: category.icon || '',
        videos: (videos || [])
          .filter((video: any) => video.category_id === category.id)
          .map((video: any) => ({
            id: video.id,
            title: he(video.title, video.title_i18n),
            video_url: video.video_url,
            thumbnail_url: video.thumbnail_url || '',
          })),
      })),
    };
  }
  if (part === 'clients') {
    const rows = await result(
      db()
        .from('users')
        .select('id,name,phone')
        .eq('business_id', profile.id)
        .eq('user_type', 'client')
        .order('name'),
    );
    return { clients: rows || [] };
  }
  throw new Error('פעולה לא תקינה');
}

export async function writeSettingsList(profile: any, user: any, body: any) {
  const part = String(body.part || '');
  const op = String(body.op || '');
  if (part === 'services') {
    if (op === 'reorder') {
      const ids = Array.isArray(body.ids) ? body.ids : [];
      if (!ids.length || ids.length > 300 || !ids.every((id: unknown) => uuid(id)))
        throw new Error('לא ניתן לשמור את סדר השירות. נסה/י שוב.');
      await Promise.all(
        ids.map((id: string, index: number) =>
          result(
            db().from('services').update({ order_index: index }).eq('business_id', profile.id).eq('id', id),
          ),
        ),
      );
      return { ok: true };
    }
    if (op === 'delete') {
      if (!uuid(body.id)) throw new Error('פעולה לא תקינה');
      await result(
        db().from('services').delete().eq('business_id', profile.id).eq('id', body.id),
      );
      return { ok: true };
    }
    const name = text(body.name, 80, true);
    const price = Number(body.price);
    const duration = whole(body.duration_minutes, 5, 480);
    if (!Number.isFinite(price) || price < 0 || price > 100000) throw new Error('נא להזין מחיר תקין');
    const row = {
      name,
      price: Math.round(price * 100) / 100,
      duration_minutes: duration,
    };
    if (body.id) {
      if (!uuid(body.id)) throw new Error('פעולה לא תקינה');
      await result(
        db()
          .from('services')
          .update({ ...row, worker_id: user.id })
          .eq('business_id', profile.id)
          .eq('id', body.id),
      );
    } else {
      const existing = await result(
        db().from('services').select('order_index').eq('business_id', profile.id).eq('worker_id', user.id),
      );
      const next = (existing || []).length
        ? Math.max(...(existing || []).map((item: any) => Number(item.order_index || 0))) + 1
        : 0;
      await result(
        db().from('services').insert({
          ...row,
          business_id: profile.id,
          worker_id: user.id,
          is_active: true,
          order_index: next,
        }),
      );
    }
    return { ok: true };
  }
  if (part === 'employees') {
    await requireOwner(profile, user);
    if (op === 'remove') {
      if (!uuid(body.id) || body.id === user.id) throw new Error('לא ניתן להסיר את עצמך.');
      await removeAdmin(profile.id, body.id).catch(() => {
        throw new Error('כשל בהסרת העובד');
      });
      return { ok: true };
    }
    const name = text(body.name, 80, true);
    const phone = normalizeStoredPhone(String(body.phone || ''));
    if (!/^05\d{8}$/.test(phone))
      throw new Error('אנא הזן/י מספר טלפון תקין (לדוגמה: (055) 123-4567)');
    const password = String(body.password || '');
    if (body.id) {
      if (!uuid(body.id)) throw new Error('פעולה לא תקינה');
      const patch: Record<string, any> = { name, phone };
      if (uuid(body.branch_id)) patch.branch_id = body.branch_id;
      if (password) {
        if (!/^\d{6}$/.test(password)) throw new Error('סיסמת החירום חייבת להיות בדיוק 6 ספרות');
        patch.password_hash = hashPassword(password);
      }
      await result(
        db()
          .from('users')
          .update(patch)
          .eq('business_id', profile.id)
          .eq('id', body.id)
          .eq('user_type', 'admin'),
      );
      return { ok: true };
    }
    if (!/^\d{6}$/.test(password)) throw new Error('סיסמת החירום חייבת להיות בדיוק 6 ספרות');
    const people = await result(
      db().from('users').select('id,phone').eq('business_id', profile.id),
    );
    if ((people || []).some((row: any) => phonesMatch(row.phone, phone)))
      throw new Error('שגיאה ביצירת המשתמש. ייתכן שמספר הטלפון כבר קיים במערכת');
    const row: Record<string, any> = {
      name,
      phone,
      user_type: 'admin',
      business_id: profile.id,
      password_hash: hashPassword(password),
      language: 'he',
    };
    if (uuid(body.branch_id)) row.branch_id = body.branch_id;
    await result(db().from('users').insert(row));
    return { ok: true };
  }
  if (part === 'branches') {
    await requireOwner(profile, user);
    if (op === 'assign') {
      if (!uuid(body.id)) throw new Error('לא ניתן לעדכן את הסניף שלך');
      await result(
        db()
          .from('users')
          .update({ branch_id: body.id })
          .eq('business_id', profile.id)
          .eq('id', user.id)
          .eq('user_type', 'admin'),
      );
      return { ok: true };
    }
    if (op === 'delete') {
      if (!uuid(body.id)) throw new Error('פעולה לא תקינה');
      const row = await result(
        db()
          .from('branches')
          .select('name,is_default')
          .eq('business_id', profile.id)
          .eq('id', body.id)
          .maybeSingle(),
      );
      if (row?.is_default) throw new Error('סניף ברירת המחדל נשאר תמיד. אפשר רק לערוך אותו.');
      const staff = await result(
        db()
          .from('users')
          .select('id')
          .eq('business_id', profile.id)
          .eq('user_type', 'admin')
          .eq('branch_id', body.id),
      );
      if ((staff || []).length)
        throw new Error(
          `בסניף ${row?.name || ''} יש ${(staff || []).length} עובדים. הסירו אותם מהסניף או העבירו אותם לסניף אחר, ורק אז אפשר למחוק.`,
        );
      await result(db().from('branches').delete().eq('business_id', profile.id).eq('id', body.id));
      return { ok: true };
    }
    const name = text(body.name, 80, true);
    const address = text(body.address, 200) || null;
    const phone = text(body.phone, 20) || null;
    if (body.id) {
      if (!uuid(body.id)) throw new Error('פעולה לא תקינה');
      await result(
        db()
          .from('branches')
          .update({ name, address, phone })
          .eq('business_id', profile.id)
          .eq('id', body.id),
      );
    } else {
      const existing = await result(
        db().from('branches').select('id').eq('business_id', profile.id),
      );
      await result(
        db().from('branches').insert({
          business_id: profile.id,
          name,
          address,
          phone,
          is_default: !(existing || []).length,
          is_active: true,
          sort_order: (existing || []).length,
        }),
      );
    }
    return { ok: true };
  }
  if (part === 'health') throw new Error('זמין באפליקציה בלבד');
  if (part === 'recurring') {
    if (op === 'delete') {
      if (!uuid(body.id)) throw new Error('פעולה לא תקינה');
      await result(
        db()
          .from('recurring_appointments')
          .delete()
          .eq('business_id', profile.id)
          .eq('admin_id', user.id)
          .eq('id', body.id),
      );
      return { ok: true };
    }
    const missing = 'אנא מלא/י את כל השדות: לקוח, יום, שעה ושירות';
    const taken = 'השעה שנבחרה כבר נתפסת השבוע. אנא בחר/י שעה אחרת.';
    if (!uuid(body.client_id)) throw new Error(missing);
    const day = whole(body.day_of_week, 0, 6);
    const time = String(body.time || '');
    if (!/^\d{2}:\d{2}$/.test(time)) throw new Error(missing);
    const repeat = whole(body.repeat_interval || 1, 1, 4);
    const services = await recurringServices(profile, user, body.service_ids || body.service_id);
    const client = await result(
      db()
        .from('users')
        .select('id,name,phone')
        .eq('business_id', profile.id)
        .eq('id', body.client_id)
        .eq('user_type', 'client')
        .maybeSingle(),
    );
    if (!client?.phone) throw new Error(missing);
    if (!(await weekdayHours(profile, user))[day]) throw new Error(taken);
    const free = await recurringBusy(profile, user, day);
    if (!free(time, services)) throw new Error(taken);
    const today = israelNow().date;
    const first = addDays(today, (day - new Date(`${today}T12:00:00Z`).getUTCDay() + 7) % 7);
    const created: string[] = [];
    try {
      let cursor = clock(time);
      for (const service of services) {
        const slot = hhmm(cursor);
        const [rule, booked] = await Promise.all([
          result(
            db()
              .from('recurring_appointments')
              .select('id')
              .eq('business_id', profile.id)
              .eq('day_of_week', day)
              .eq('slot_time', slot)
              .eq('admin_id', user.id)
              .limit(1),
          ),
          result(
            db()
              .from('appointments')
              .select('id')
              .eq('business_id', profile.id)
              .eq('slot_date', first)
              .eq('slot_time', slot)
              .eq('is_available', false)
              .or(`barber_id.eq.${user.id},user_id.eq.${user.id}`)
              .limit(1),
          ),
        ]);
        if ((rule || []).length || (booked || []).length) throw new Error(taken);
        const row = await result(
          db()
            .from('recurring_appointments')
            .insert({
              business_id: profile.id,
              admin_id: user.id,
              client_id: client.id,
              client_name: client.name,
              client_phone: normalizeStoredPhone(client.phone),
              service_id: service.id,
              service_name: service.name,
              day_of_week: day,
              slot_time: slot,
              repeat_interval: repeat,
              start_date: first,
            })
            .select('id')
            .single(),
        );
        created.push(row.id);
        cursor += lengthOf(service);
      }
    } catch (error) {
      if (created.length)
        await db().from('recurring_appointments').delete().eq('business_id', profile.id).in('id', created);
      throw error;
    }
    return { ok: true };
  }
  throw new Error('פעולה לא תקינה');
}

export async function requestAppCancellation(profile: any, user: any) {
  await requireOwner(profile, user);
  const response = await fetch('https://wetori.co.il/api/app/cancellation-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessId: profile.id,
      userId: user.id,
      phone: user.phone,
      name: user.name,
    }),
  });
  if (!response.ok && response.status !== 409) throw new Error('לא הצלחנו לשלוח את הבקשה. נסו שוב בעוד רגע.');
  return { ok: true };
}
