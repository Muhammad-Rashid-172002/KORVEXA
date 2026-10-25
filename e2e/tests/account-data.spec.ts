import { expect, test } from '@playwright/test';
import { signUpAndVerify, uniqueEmail } from './helpers';

test.describe('Phase 9 data export and deletion', () => {
  test('a user downloads their data, deletes the account and is signed out', async ({ page }, info) => {
    const email = uniqueEmail(`${info.project.name}-delete`);
    await signUpAndVerify(page, email, 'Dana Delete', 'e2e-password-123');
    await page.goto('/settings');

    const panel = page.getByTestId('data-panel');
    const download = page.waitForEvent('download');
    await panel.getByRole('link', { name: 'Download my data' }).click();
    expect((await download).suggestedFilename()).toBe('glasswork-data-export.json');

    await panel.getByTestId('delete-account-start').click();
    const submit = panel.getByRole('button', { name: 'Permanently delete my account' });
    await expect(submit).toBeDisabled();
    await panel.getByLabel('Your email').fill(email);
    await submit.click();
    await expect(page).toHaveURL('/');

    await page.goto('/settings');
    await expect(page).toHaveURL(/\/login/);
  });
});
