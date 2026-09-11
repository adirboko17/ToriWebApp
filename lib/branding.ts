const appLogos: Record<string, string> = {
  amitsenior: '/branding/amitsenior.png',
  linbitton: '/branding/linbitton.png',
  shirlavy: '/branding/shirlavy.png',
  tori: '/branding/tori.png',
};

export function businessLogos(profile: any, slug: string): string[] {
  return [
    profile?.home_logo_url,
    appLogos[String(profile?.branding_client_name || slug).toLowerCase()],
    profile?.icon_url,
  ].filter((url): url is string => typeof url === 'string' && Boolean(url));
}
