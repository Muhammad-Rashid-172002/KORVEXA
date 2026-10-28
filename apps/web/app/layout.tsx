import { brand } from '@glasswork/shared/brand';
import { GeistSans } from 'geist/font/sans';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { LazyToaster } from '@/components/lazy-toaster';
import { AnalyticsProvider } from '@/components/analytics-provider';
import { CookieConsent } from '@/components/cookie-consent';
import { CommandPalette } from '@/components/command-palette';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { ThemeProvider } from '@/components/theme-provider';
import { WEB_URL } from '@/lib/config';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(WEB_URL),
  title: { default: brand.lockup, template: `%s · ${brand.productName}` },
  description: brand.tagline,
};

export const viewport: Viewport = { themeColor: brand.colors.ink, colorScheme: 'dark light' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} dark`} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col bg-bg text-fg">
        <ThemeProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50"
          >
            Skip to content
          </a>
          <SiteHeader />
          <CommandPalette />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
          <AnalyticsProvider />
          <CookieConsent />
          <LazyToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
