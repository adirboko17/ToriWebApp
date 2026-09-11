import { setting, scoped, result } from './db';
const encoder = new TextEncoder();
const to64 = (s: Uint8Array) =>
  btoa(String.fromCharCode(...s))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
const from64 = (s: string) =>
  Uint8Array.from(atob(s.replaceAll('-', '+').replaceAll('_', '/')), (c) =>
    c.charCodeAt(0),
  );
async function key() {
  const secret = setting('SESSION_SECRET');
  if (secret.length < 32) throw new Error('ההתחברות עדיין אינה מוגדרת');
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}
export async function sessionCookie(
  userId: string,
  businessId: string,
  secure: boolean,
) {
  const data = to64(
    encoder.encode(
      JSON.stringify({ userId, businessId, exp: Date.now() + 7 * 86400000 }),
    ),
  );
  const signature = to64(
    new Uint8Array(
      await crypto.subtle.sign('HMAC', await key(), encoder.encode(data)),
    ),
  );
  return `tori_session=${data}.${signature}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure ? '; Secure' : ''}`;
}
export async function currentUser(request: Request, businessId: string) {
  try {
    const raw = request.headers
      .get('cookie')
      ?.split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith('tori_session='))
      ?.slice(13);
    if (!raw) return null;
    const [data, sig] = raw.split('.');
    if (
      !data ||
      !sig ||
      !(await crypto.subtle.verify(
        'HMAC',
        await key(),
        from64(sig),
        encoder.encode(data),
      ))
    )
      return null;
    const payload = JSON.parse(new TextDecoder().decode(from64(data)));
    if (payload.businessId !== businessId || payload.exp < Date.now())
      return null;
    const user = await result(
      scoped('users', businessId).eq('id', payload.userId).maybeSingle(),
    );
    if (user?.block) return null;
    return user;
  } catch {
    return null;
  }
}
export function safeUser(u: any) {
  if (!u) return null;
  return Object.fromEntries(
    [
      'id',
      'business_id',
      'name',
      'phone',
      'user_type',
      'birth_date',
      'image_url',
      'client_approved',
      'block',
      'language',
      'booking_allowed_weekdays',
      'booking_allowed_from',
      'booking_allowed_until',
    ].map((k) => [k, u[k]]),
  );
}
