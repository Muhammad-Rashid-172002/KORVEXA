import { brand } from '@glasswork/shared';
import { Button, Text } from '@react-email/components';
import { buttonStyle, Layout, textStyle } from './layout';

export function OrgInvite({
  inviterName,
  orgName,
  url,
}: {
  inviterName: string;
  orgName: string;
  url: string;
}) {
  return (
    <Layout preview={`${inviterName} invited you to ${orgName}`}>
      <Text style={textStyle}>
        {inviterName} invited you to join {orgName} on {brand.productName}.
      </Text>
      <Button href={url} style={buttonStyle}>
        Accept invitation
      </Button>
      <Text style={{ ...textStyle, fontSize: 13 }}>
        This link expires in 7 days. If you weren&apos;t expecting it, ignore this email.
      </Text>
    </Layout>
  );
}
