function hostname(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return '';
  try {
    return new URL(cleaned.includes('://') ? cleaned : `http://${cleaned}`).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function sameOrigin(req: Request) {
  const url = new URL(req.url);
  const allowed = new Set(
    [url.host, req.headers.get('host') || '', req.headers.get('x-forwarded-host') || '']
      .flatMap((value) => value.split(','))
      .map(hostname)
      .filter(Boolean),
  );
  const origin = req.headers.get('origin');
  if (origin && origin !== 'null') return allowed.has(hostname(origin));
  const site = req.headers.get('sec-fetch-site');
  if (site === 'same-origin' || site === 'same-site') return true;
  const referer = req.headers.get('referer');
  return referer ? allowed.has(hostname(referer)) : false;
}
