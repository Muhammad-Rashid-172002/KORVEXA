import type { MetadataRoute } from 'next';
import { WEB_URL } from '@/lib/config';
import { publicGw } from '@/lib/public-api';
import type { ServicePageView } from '@glasswork/shared';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const urls: MetadataRoute.Sitemap = [{ url: `${WEB_URL}/` }, { url: `${WEB_URL}/services` }];
  let cursor: string | null = null;
  for (let page = 0; page < 20; page++) {
    const res: { data: ServicePageView | null } = await publicGw<ServicePageView>(
      `/services?limit=50${cursor ? `&cursor=${cursor}` : ''}`,
    );
    if (!res.data) break;
    for (const s of res.data.items) urls.push({ url: `${WEB_URL}/services/${s.slug}` });
    cursor = res.data.nextCursor;
    if (!cursor) break;
  }
  return urls;
}
