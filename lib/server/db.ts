import { createClient, type SupabaseClient } from '@supabase/supabase-js';
let client: SupabaseClient;
export function setting(key: string): string {
  return process.env[key] || '';
}
export function db() {
  if (!client) {
    const url = setting('SUPABASE_URL'),
      key = setting('SUPABASE_ANON_KEY');
    if (!url || !key) throw new Error('חיבור העסק עדיין אינו מוגדר');
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
export async function result(
  query: PromiseLike<{ data: any; error: any }>,
): Promise<any> {
  const { data, error } = await query;
  if (error) {
    console.error('Database operation failed', error.code, error.message);
    throw new Error('לא ניתן להשלים את הפעולה כרגע. נסו שוב בעוד רגע.');
  }
  return data;
}
export const uuid = (v: unknown) =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function scoped(table: string, businessId: string) {
  if (!uuid(businessId)) throw new Error('עסק לא תקין');
  return db().from(table).select('*').eq('business_id', businessId);
}
export async function tenant(slug: string) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug)) return null;
  const { data, error } = await db()
    .from('business_profile')
    .select('*')
    .eq('web_slug', slug)
    .maybeSingle();
  if (!error && data) return data;
  if (error && error.code !== '42703' && error.code !== 'PGRST204')
    throw new Error('טעינת העסק נכשלה');
  // Native app identity is already maintained for every branded application.
  const branded = await db()
    .from('business_profile')
    .select('*')
    .eq('branding_client_name', slug)
    .maybeSingle();
  if (!branded.error && branded.data) return branded.data;
  if (branded.error && branded.error.code !== '42703' && branded.error.code !== 'PGRST204')
    throw new Error('טעינת העסק נכשלה');
  if (!error) return null;
  // Compatibility until the additive web_slug migration is applied. No cross-tenant enumeration.
  const known: Record<string, string> = {
    tori: '464cb35b-0fbb-413f-91fe-1ad49addcb77',
    linbitton: '7cf95c3f-90a5-4986-9b79-bd0340961b06',
    shirlavy: '542f799f-f360-4a90-b710-1728aabea703',
  };
  if (!known[slug]) return null;
  return result(
    db()
      .from('business_profile')
      .select('*')
      .eq('id', known[slug])
      .maybeSingle(),
  );
}
const brandingName = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
export function brandingAssetUrl(
  clientName: unknown,
  file: 'logo.png' | 'icon.png',
) {
  if (typeof clientName !== 'string' || !brandingName.test(clientName)) return null;
  const base = setting('SUPABASE_URL').replace(/\/$/, '');
  if (!/^https:\/\//.test(base)) return null;
  return `${base}/storage/v1/object/public/app_design/branding/${clientName}/${file}`;
}
export function publicProfile(p: any) {
  const fields = [
    'id',
    'branding_client_name',
    'display_name',
    'address',
    'phone',
    'instagram_url',
    'facebook_url',
    'tiktok_url',
    'home_hero_images',
    'home_hero_mode',
    'home_hero_single_url',
    'home_hero_single_kind',
    'home_logo_url',
    'icon_url',
    'home_header_show_logo',
    'home_header_logo_color_mode',
    'home_header_logo_height',
    'home_header_scrim_color',
    'home_header_text_without_logo',
    'staff_selection_style',
    'primary_color',
    'min_cancellation_hours',
    'allow_multi_service_booking',
    'require_client_approval',
    'client_swap_enabled',
    'client_swap_min_hours',
    'home_fixed_message',
    'home_fixed_message_audience',
    'availability_meter_audience',
    'quick_slots_audience',
    'booking_open_days_by_user',
    'booking_open_days',
    'map_audience',
    'home_header_name_color',
    'home_header_title_font_size',
  ];
  const profile = Object.fromEntries(fields.map((k) => [k, p[k]]));
  if (!profile.home_logo_url)
    profile.home_logo_url = brandingAssetUrl(p.branding_client_name, 'logo.png');
  if (!profile.icon_url)
    profile.icon_url = brandingAssetUrl(p.branding_client_name, 'icon.png');
  return profile;
}
