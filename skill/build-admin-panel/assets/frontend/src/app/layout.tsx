import type { Metadata } from 'next';
import './globals.css';
import { BRAND } from '@/lib/branding';
import { Providers } from '@/lib/providers';

export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.description,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
