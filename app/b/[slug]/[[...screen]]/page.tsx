import BookingApp from '@/components/booking-app';
import { tenant } from '@/lib/server/db';
import { notFound } from 'next/navigation';
export const dynamic = 'force-dynamic';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await tenant(slug);
  if (!p) return { title: 'העסק לא נמצא' };
  const image = p.home_logo_url || p.icon_url;
  return {
    title: `${p.display_name || 'Tori'} | קביעת תורים`,
    description: `קביעת תור ב${p.display_name || 'עסק'} — בחירת טיפול, יום ושעה`,
    openGraph: {
      title: p.display_name || 'Tori',
      description: 'הזמן שלך לעצמך. קביעת תורים אונליין.',
      ...(image && /^https:\/\//.test(image) ? { images: [image] } : {}),
    },
    icons: p.icon_url ? { icon: p.icon_url } : undefined,
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
  return <BookingApp slug={p.slug} screen={p.screen?.[0] || 'home'} />;
}
