import type { RenderedEmail } from '@glasswork/emails';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import type { WorkerEnv } from '@glasswork/shared/env';

export interface Mailer {
  readonly transport: 'resend' | 'smtp';
  send(to: string, mail: RenderedEmail): Promise<{ id: string }>;
}

/** Resend in production (RESEND_API_KEY set); SMTP (Mailpit) locally. */
export function createMailer(env: WorkerEnv): Mailer {
  if (env.RESEND_API_KEY) {
    const resend = new Resend(env.RESEND_API_KEY);
    return {
      transport: 'resend',
      async send(to, mail) {
        const { data, error } = await resend.emails.send({ from: env.EMAIL_FROM, to, ...mail });
        if (error) throw new Error(`Resend error: ${error.message}`);
        return { id: data?.id ?? 'unknown' };
      },
    };
  }
  if (!env.SMTP_HOST)
    throw new Error('Set RESEND_API_KEY (prod) or SMTP_HOST (local Mailpit) for email delivery');
  const smtp = nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: false });
  return {
    transport: 'smtp',
    async send(to, mail) {
      const info = await smtp.sendMail({ from: env.EMAIL_FROM, to, ...mail });
      return { id: info.messageId };
    },
  };
}
