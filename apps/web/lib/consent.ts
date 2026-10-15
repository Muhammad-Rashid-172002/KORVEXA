export type Consent = 'all' | 'essential';
const KEY = 'gw-consent-v1';
export const CONSENT_EVENT = 'gw:consent';

/** localStorage can throw (private mode, blocked storage); a failed read means "not decided yet". */
export function readConsent(): Consent | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === 'all' || v === 'essential' ? v : null;
  } catch {
    return null;
  }
}

export function writeConsent(value: Consent | null): void {
  try {
    if (value) window.localStorage.setItem(KEY, value);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* ignore: the banner simply shows again next visit */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}
