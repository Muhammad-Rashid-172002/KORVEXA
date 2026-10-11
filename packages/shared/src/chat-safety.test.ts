import { describe, expect, it } from 'vitest';
import { detectOffPlatform } from './chat-safety';

describe('detectOffPlatform', () => {
  it.each([
    ['Email me at john.doe@gmail.com', ['email']],
    ['reach me: john (at) example (dot) com', ['email']],
    ['call +92 300 1234567 anytime', ['phone']],
    ['my number is 0300 123 4567', ['phone']],
    ['text me on WhatsApp', ['external_chat']],
    ['add me on telegram @john', ['external_chat']],
    ['https://wa.me/923001234567', ['external_chat']],
    ['ping me on Signal if you like', ['external_chat']],
    ['send it via PayPal and skip the fees', ['offsite_payment']],
    ['can you pay me outside the platform?', ['offsite_payment']],
    ['I accept USDT or bank transfer', ['offsite_payment']],
    ['whatsapp me on +44 7700 900123, pay by bank transfer', ['phone', 'external_chat', 'offsite_payment']],
  ])('flags %j', (text, expected) => {
    expect(detectOffPlatform(text).sort()).toEqual([...expected].sort());
  });

  it.each([
    'The project costs $1,200 and takes 14 days.',
    'Version 2.3.10 is deployed on staging at 10:30.',
    'Our milestone 2 budget is 5000 USD, due 2026-11-05.',
    'I will send the signal handling code tomorrow.',
    'We use a message queue and an email service provider.',
    'Can you build a payment page with Stripe?',
    'Please review the design and give feedback.',
  ])('does not flag the harmless message %j', (text) => {
    expect(detectOffPlatform(text)).toEqual([]);
  });
});
