import { brand } from '@glasswork/shared';
import { Button, Text } from '@react-email/components';
import { buttonStyle, Layout, textStyle } from './layout';

export function ResetPassword({ name, url }: { name: string; url: string }) {
  return (
    <Layout preview={`Reset your ${brand.productName} password`}>
      <Text style={textStyle}>Hi {name},</Text>
      <Text style={textStyle}>Someone asked to reset your password. If it was you, use the button below.</Text>
      <Button href={url} style={buttonStyle}>
        Reset password
      </Button>
      <Text style={{ ...textStyle, fontSize: 13 }}>This link expires in 1 hour. If you didn&apos;t ask, ignore this email.</Text>
    </Layout>
  );
}
