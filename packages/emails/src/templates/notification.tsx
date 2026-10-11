import { brand } from '@glasswork/shared';
import { Button, Text } from '@react-email/components';
import { buttonStyle, Layout, textStyle } from './layout';

export function NotificationEmail({
  name,
  title,
  body,
  url,
}: {
  name: string;
  title: string;
  body: string | null;
  url: string;
}) {
  return (
    <Layout preview={title}>
      <Text style={textStyle}>Hi {name},</Text>
      <Text style={textStyle}>
        <strong>{title}</strong>
      </Text>
      {body && <Text style={textStyle}>{body}</Text>}
      <Button href={url} style={buttonStyle}>
        Open in {brand.productName}
      </Button>
      <Text style={{ ...textStyle, fontSize: 12 }}>
        You can change which emails you get under Settings → Notifications.
      </Text>
    </Layout>
  );
}
