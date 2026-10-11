import { brand, type EmailJob } from '@glasswork/shared';
import { render } from '@react-email/render';
import { createElement } from 'react';
import { OrgInvite } from './templates/org-invite';
import { ResetPassword } from './templates/reset-password';
import { VerifyEmail } from './templates/verify-email';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Renders a queued email job into subject/html/text. Used by the worker. */
export async function renderEmail(job: EmailJob): Promise<RenderedEmail> {
  switch (job.template) {
    case 'verify-email': {
      const el = createElement(VerifyEmail, job.data);
      return {
        subject: `Verify your email for ${brand.productName}`,
        html: await render(el),
        text: await render(el, { plainText: true }),
      };
    }
    case 'reset-password': {
      const el = createElement(ResetPassword, job.data);
      return {
        subject: `Reset your ${brand.productName} password`,
        html: await render(el),
        text: await render(el, { plainText: true }),
      };
    }
    case 'org-invite': {
      const el = createElement(OrgInvite, job.data);
      return {
        subject: `${job.data.inviterName} invited you to ${job.data.orgName} on ${brand.productName}`,
        html: await render(el),
        text: await render(el, { plainText: true }),
      };
    }
  }
}
