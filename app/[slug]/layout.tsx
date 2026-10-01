import BookingApp from '@/components/booking-app';
import { tenant } from '@/lib/server/db';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!(await tenant(slug))) notFound();
  return (
    <>
      <BookingApp slug={slug} />
      <div hidden>{children}</div>
    </>
  );
}
