import type { MetadataRoute } from 'next';
import { WEB_URL } from '@/lib/config';

/** Local/staging hosts are not indexed; once a real domain is configured, public discovery pages are. */
export default function robots(): MetadataRoute.Robots {
  const local = /localhost|127\.0\.0\.1/.test(WEB_URL);
  if (local) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/services', '/u/', '/legal/'],
      disallow: ['/dashboard', '/settings', '/admin', '/me', '/sell', '/design'],
    },
    sitemap: `${WEB_URL}/sitemap.xml`,
  };
}
