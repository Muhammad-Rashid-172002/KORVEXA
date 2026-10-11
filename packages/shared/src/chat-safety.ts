export type SafetyFlag = 'email' | 'phone' | 'external_chat' | 'offsite_payment';

export const SAFETY_WARNING =
  'Heads up: keep payments and conversations on the platform. Payments made outside it are not protected by milestone protection or dispute resolution.';

// Ambiguous words (signal, messenger) only count in a clear "contact me on …" context.
const EXTERNAL_CHAT =
  /\b(whats\s?app|telegram|skype|discord|wechat|viber)\b|\b(wa\.me|t\.me|discord\.gg)\/|\b(on|via|use|add me on|message me on)\s+(signal|messenger)\b/i;
const OFFSITE_PAYMENT =
  /\b(paypal|venmo|cash\s?app|zelle|payoneer|western\s?union|moneygram|crypto|bitcoin|btc|usdt|ethereum|binance|iban|swift\s?code|bank\s?transfer|wire\s?transfer|easypaisa|jazz\s?cash)\b|\b(pay|paid|payment)\b[^.\n]{0,40}\b(outside|off[-\s]?platform|directly|privately)\b|\b(outside|off)\s+(of\s+)?(the\s+)?(platform|site|app)\b/i;
const EMAIL = /[a-z0-9._%+-]+\s?(@|\(at\)|\[at\])\s?[a-z0-9.-]+\s?(\.|\(dot\)|\[dot\])\s?[a-z]{2,}/i;
// International or long local numbers; deliberately needs 9+ digits so prices, dates and versions don't match.
const PHONE = /(?:\+\d[\d\s().-]{8,}\d)|(?:\b\d{3,4}[\s.-]\d{3,4}[\s.-]\d{3,4}\b)|(?:\b0\d{9,11}\b)/;

/**
 * Detects off-platform contact/payment details in a pre-order chat message (brief §8.9). Heuristic and
 * intentionally conservative: it WARNS and LOGS, it never blocks a message. False negatives are expected.
 */
export function detectOffPlatform(text: string): SafetyFlag[] {
  const flags: SafetyFlag[] = [];
  if (EMAIL.test(text)) flags.push('email');
  if (PHONE.test(text)) flags.push('phone');
  if (EXTERNAL_CHAT.test(text)) flags.push('external_chat');
  if (OFFSITE_PAYMENT.test(text)) flags.push('offsite_payment');
  return flags;
}
