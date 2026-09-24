import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../lib/logger';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

/** Development provider: writes emails to the log instead of sending them. */
export class LogEmailProvider implements EmailProvider {
  public readonly sent: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
    if (this.sent.length > 100) this.sent.shift();
    logger.info({ email: { to: message.to, subject: message.subject } }, `[mock email]\n${message.text}`);
  }
}

export class SmtpEmailProvider implements EmailProvider {
  private transporter: Transporter;
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    });
  }
  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({ from: env.EMAIL_FROM, ...message });
  }
}

export const emailProvider: EmailProvider = env.EMAIL_DRIVER === 'smtp' ? new SmtpEmailProvider() : new LogEmailProvider();

/** Fire-and-forget: email failures must never break a guest's RSVP. */
export function sendEmailSafely(message: EmailMessage): void {
  emailProvider.send(message).catch((err) => logger.error({ err }, 'email send failed'));
}
