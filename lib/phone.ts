/**
 * Israeli mobile in national format: 10 digits, prefix 05 (e.g. 0501234567).
 * Accepts common inputs: spaces, dashes, +972 / 972 international prefix.
 */
export function parseIsraeliMobileNational10(raw: string): string | null {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return null;
  if (/^05\d{8}$/.test(d)) return d;
  if (/^9725\d{8}$/.test(d)) return `0${d.slice(3)}`;
  if (d.length === 9 && /^5\d{8}$/.test(d)) return `0${d}`;
  return null;
}

export function isIsraeliMobileNational10(raw: string): boolean {
  return parseIsraeliMobileNational10(raw) !== null;
}

/**
 * Digit strings that represent the same Israeli number (local 05… and intl +972…).
 * Partial prefixes are expanded so search "05" matches a stored "+97254…".
 */
export function israeliPhoneDigitVariants(raw: string): string[] {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return [];
  const out = new Set<string>([d]);

  if (d.startsWith('972') && d.length > 3) {
    const rest = d.slice(3);
    out.add(`0${rest}`);
    out.add(rest);
  } else if (d.startsWith('0') && d.length >= 2) {
    const rest = d.slice(1);
    out.add(`972${rest}`);
    out.add(rest);
  } else if (d.startsWith('5')) {
    out.add(`0${d}`);
    out.add(`972${d}`);
  }

  return [...out];
}

export function israeliPhoneMatchesQuery(storedPhone: string, query: string): boolean {
  const qDigits = String(query || '').replace(/\D/g, '');
  if (!qDigits) return false;
  const stored = israeliPhoneDigitVariants(storedPhone);
  const queries = israeliPhoneDigitVariants(query);
  for (const q of queries) {
    for (const s of stored) {
      if (s.includes(q)) return true;
    }
  }
  return false;
}

export function clientMatchesTextSearch(
  name: string | null | undefined,
  phone: string | null | undefined,
  query: string,
): boolean {
  const raw = String(query || '').trim();
  if (!raw) return true;
  if (String(name || '').toLowerCase().includes(raw.toLowerCase())) return true;
  return israeliPhoneMatchesQuery(String(phone || ''), raw);
}

/**
 * Persist this whenever a client/admin phone is saved.
 * Israeli mobile → `05XXXXXXXX`. Strips WhatsApp/contacts bidi marks and `+972`.
 */
export function normalizeStoredPhone(raw: string): string {
  const national = parseIsraeliMobileNational10(raw);
  if (national) return national;
  const digits = String(raw || '').replace(/\D/g, '');
  return digits || String(raw || '').trim();
}

/**
 * Stable identity for matching: Israeli mobiles become `05XXXXXXXX`.
 * Anything else falls back to digits-only so equality still works.
 */
export function canonicalPhoneIdentity(raw: string): string {
  return normalizeStoredPhone(raw);
}

/** `0504423441` and `+972 50-442-3441` are the same number. */
export function phonesMatch(a?: string | null, b?: string | null): boolean {
  const left = canonicalPhoneIdentity(a || '');
  const right = canonicalPhoneIdentity(b || '');
  return left.length >= 9 && left === right;
}

/** 9-digit Israeli mobile core (`5XXXXXXXX`) for ILIKE when stored format is unknown. */
export function israeliMobileCore9(raw: string): string | null {
  const national = parseIsraeliMobileNational10(raw);
  return national ? national.slice(1) : null;
}

/**
 * Common stored spellings of the same Israeli mobile.
 * Used for `.in('client_phone', variants)` — never treat these as different people.
 */
export function phoneLookupVariants(raw: string): string[] {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return [];
  const variants = new Set<string>();
  variants.add(trimmed);
  const national = parseIsraeliMobileNational10(trimmed);
  if (national) {
    const rest = national.slice(1);
    const area = rest.slice(0, 2);
    const mid = rest.slice(2, 5);
    const end = rest.slice(5);
    variants.add(national);
    variants.add(`+972${rest}`);
    variants.add(`+972 ${rest}`);
    variants.add(`+972 ${area}-${mid}-${end}`);
    variants.add(`+972 ${area}-${rest.slice(2)}`);
    variants.add(`0${area}-${mid}-${end}`);
    variants.add(`0${area}-${rest.slice(2)}`);
    variants.add(`972${rest}`);
  }
  const onlyDigits = trimmed.replace(/\D/g, '');
  if (onlyDigits) variants.add(onlyDigits);
  return Array.from(variants).filter(Boolean);
}

/** PostgREST `.or(...)` so client_user_id or any phone spelling of the same number matches. */
export function clientAppointmentOrFilter(opts: {
  userId?: string | null;
  userPhone?: string | null;
}): string | null {
  const parts: string[] = [];
  const uid = String(opts.userId || '').trim();
  if (uid) {
    parts.push(`client_user_id.eq.${uid}`);
  }
  const phone = String(opts.userPhone || '').trim();
  const core = israeliMobileCore9(phone);
  if (core) {
    parts.push(`client_phone.ilike.%${core}%`);
  } else if (phone) {
    parts.push(`client_phone.eq.${phone}`);
  }
  return parts.length > 0 ? parts.join(',') : null;
}
