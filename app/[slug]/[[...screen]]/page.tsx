import { notFound } from 'next/navigation';

export { generateMetadata, generateViewport } from '../../b/[slug]/[[...screen]]/page';
export const dynamic = 'force-dynamic';

const SCREENS = [
  'home',
  'login',
  'book',
  'appointments',
  'gallery',
  'products',
  'profile',
  'notifications',
  'waitlist',
  'admin',
];

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string; screen?: string[] }>;
}) {
  const { screen } = await params;
  if (screen && screen.length > 1) notFound();
  if (screen?.[0] && !SCREENS.includes(screen[0])) notFound();
  return null;
}
