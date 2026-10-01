const appLogos: Record<string, string> = {
  amitsenior: '/branding/amitsenior.png',
  linbitton: '/branding/linbitton.png',
  shirlavy: '/branding/shirlavy.png',
  tori: '/branding/tori.png',
};

export function headerScrim(profile: any): string {
  const custom = profile?.home_header_scrim_color;
  if (/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(custom || '')) return custom;
  return profile?.home_header_logo_color_mode === 'original' ? '#F2F2F7' : '#0000008c';
}

export function statusBarColor(profile: any): string {
  return headerScrim(profile).slice(0, 7);
}

export function businessLogos(profile: any, slug: string): string[] {
  return [
    profile?.home_logo_url,
    appLogos[String(profile?.branding_client_name || slug).toLowerCase()],
    profile?.icon_url,
  ].filter((url): url is string => typeof url === 'string' && Boolean(url));
}
