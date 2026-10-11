import { brand } from '@glasswork/shared';
import { Button, Text } from '@react-email/components';
import { buttonStyle, Layout, textStyle } from './layout';

export function MilestoneReminder({
  name,
  projectTitle,
  milestoneTitle,
  daysLeft,
  url,
}: {
  name: string;
  projectTitle: string;
  milestoneTitle: string;
  daysLeft: number;
  url: string;
}) {
  return (
    <Layout preview={`Review "${milestoneTitle}" on ${projectTitle}`}>
      <Text style={textStyle}>Hi {name},</Text>
      <Text style={textStyle}>
        The seller submitted <strong>{milestoneTitle}</strong> for <strong>{projectTitle}</strong>. Please
        approve it or request changes.
      </Text>
      <Text style={textStyle}>
        If you do nothing, it is approved automatically in {daysLeft} day{daysLeft === 1 ? '' : 's'} and the
        funds are released to the seller.
      </Text>
      <Button href={url} style={buttonStyle}>
        Review on {brand.productName}
      </Button>
    </Layout>
  );
}
