import { brand } from '@glasswork/shared';
import { Body, Container, Head, Hr, Html, Preview, Section, Text } from '@react-email/components';
import type { ReactNode } from 'react';

const colors = { ink: brand.colors.ink, emerald: brand.colors.emerald, muted: '#4E6159', bg: '#F6FAF8' };

export function Layout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: colors.bg, fontFamily: 'Helvetica, Arial, sans-serif', margin: 0 }}>
        <Container style={{ maxWidth: 560, margin: '32px auto', backgroundColor: '#ffffff', borderRadius: 12, padding: 32 }}>
          <Text style={{ fontSize: 20, fontWeight: 700, color: colors.ink, margin: 0 }}>
            {brand.productName}
            <span style={{ fontSize: 13, fontWeight: 400, color: colors.muted }}> by {brand.parentName}</span>
          </Text>
          <Section style={{ marginTop: 24 }}>{children}</Section>
          <Hr style={{ borderColor: '#D9E6E0', margin: '32px 0 16px' }} />
          <Text style={{ fontSize: 12, color: colors.muted, margin: 0 }}>
            {brand.lockup} · {brand.legalEntity} · {brand.parentDomain}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const buttonStyle = {
  backgroundColor: colors.emerald,
  color: '#ffffff',
  borderRadius: 8,
  padding: '12px 20px',
  fontWeight: 600,
  fontSize: 15,
  textDecoration: 'none',
} as const;

export const textStyle = { fontSize: 15, lineHeight: '24px', color: colors.ink } as const;
