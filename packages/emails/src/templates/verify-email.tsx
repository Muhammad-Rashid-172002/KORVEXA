import { brand } from '@glasswork/shared';
import { Button, Link, Text } from '@react-email/components';
import { buttonStyle, Layout, textStyle } from './layout';

export function VerifyEmail({ name, url }: { name: string; url: string }) {
  return (
    <Layout preview={`Confirm your email for ${brand.productName}`}>
      <Text style={textStyle}>Hi {name},</Text>
      <Text style={textStyle}>
        Confirm your email address to finish creating your {brand.productName} account.
      </Text>
      <Button href={url} style={buttonStyle}>
        Verify email
      </Button>
      <Text style={{ ...textStyle, fontSize: 13 }}>
        Or paste this link into your browser: <Link href={url}>{url}</Link>
      </Text>
      <Text style={{ ...textStyle, fontSize: 13 }}>
        This link expires in 1 hour. If you didn&apos;t sign up, ignore this email.
      </Text>
    </Layout>
  );
}
