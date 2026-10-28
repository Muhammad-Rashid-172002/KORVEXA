import { describe, expect, it } from 'vitest';
import { isAllowedPushEndpoint } from './room';

describe('push endpoint allow-list (SSRF guard)', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/abc',
    'https://db5p.notify.windows.com/?token=abc',
  ])('accepts %s', (u) => expect(isAllowedPushEndpoint(u)).toBe(true));
  it.each([
    'http://fcm.googleapis.com/x',
    'https://169.254.169.254/latest/meta-data',
    'https://localhost:4000/v1/admin',
    'https://fcm.googleapis.com.evil.test/x',
    'https://evilgoogleapis.com/x',
    'https://fcm.googleapis.com:8443/x',
    'not a url',
  ])('rejects %s', (u) => expect(isAllowedPushEndpoint(u)).toBe(false));
});
