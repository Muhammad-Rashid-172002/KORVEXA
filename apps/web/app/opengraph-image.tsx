import { brand } from '@glasswork/shared/brand';
import { ImageResponse } from 'next/og';

export const alt = brand.lockup;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Default share image: brand colours only, no invented claims. */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 80,
        background: `linear-gradient(135deg, ${brand.colors.ink} 40%, #0f3d2e)`,
        color: '#e8f3ee',
      }}
    >
      <div style={{ fontSize: 28, color: brand.colors.emeraldBright, letterSpacing: 2 }}>
        {`${brand.productName} by ${brand.parentName}`.toUpperCase()}
      </div>
      <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1, marginTop: 24 }}>{brand.tagline}</div>
    </div>,
    size,
  );
}
