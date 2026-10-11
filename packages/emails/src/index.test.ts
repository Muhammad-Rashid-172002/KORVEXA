import { brand } from '@glasswork/shared';
import { describe, expect, it } from 'vitest';
import { renderEmail } from './index';

describe('renderEmail', () => {
  it('renders the verification email with the link and the brand lockup', async () => {
    const url = 'http://localhost:4000/v1/auth/verify-email?token=abc';
    const mail = await renderEmail({ template: 'verify-email', to: 'a@b.co', data: { name: 'Ali', url } });
    expect(mail.subject).toContain(brand.productName);
    expect(mail.html).toContain(url.replace(/&/g, '&amp;'));
    expect(mail.text).toContain(brand.lockup);
    expect(mail.text).toContain('Hi Ali');
  });
});
