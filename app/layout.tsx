import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Tori | קביעת תורים',
  description: 'הזמן שלך לעצמך. בחירת טיפול וקביעת תור בקלות.',
  icons: { icon: '/favicon.svg' },
};
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
