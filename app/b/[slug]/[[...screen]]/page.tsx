import BookingApp from '@/components/booking-app';
import { publicProfile, tenant } from '@/lib/server/db';
import { notFound } from 'next/navigation';
import { statusBarColor } from '@/lib/branding';
export const dynamic = 'force-dynamic';
export async function generateViewport({
  params,
}: {
  params: Promise<{ slug: string; screen?: string[] }>;
}) {
  const { slug, screen } = await params;
  if (screen?.[0] && screen[0] !== 'home') return {};
  const p = await tenant(slug);
  return p ? { themeColor: statusBarColor(p) } : {};
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await tenant(slug);
  if (!p) return { title: 'העסק לא נמצא' };
  const profile = publicProfile(p);
  const image = profile.home_logo_url || profile.icon_url;
  return {
    title: `${p.display_name || 'Tori'} | קביעת תורים`,
    description: `קביעת תור ב${p.display_name || 'עסק'} — בחירת טיפול, יום ושעה`,
    openGraph: {
      title: p.display_name || 'Tori',
      description: 'הזמן שלך לעצמך. קביעת תורים אונליין.',
      ...(image && /^https:\/\//.test(image) ? { images: [image] } : {}),
    },
    icons: profile.icon_url ? { icon: profile.icon_url } : undefined,
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string; screen?: string[] }>;
}) {
  const p = await params;
  if (!(await tenant(p.slug))) notFound();
  if (p.screen && p.screen.length > 1) notFound();
  if (p.screen?.[0] && !['home', 'login', 'book', 'appointments', 'gallery', 'products', 'profile', 'notifications', 'waitlist', 'admin'].includes(p.screen[0])) notFound();
  return <BookingApp slug={p.slug} screen={p.screen?.[0] || 'home'} />;
}
