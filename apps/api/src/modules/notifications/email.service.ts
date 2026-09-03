import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env.js';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Email delivery abstraction. When SMTP is configured it sends via Nodemailer;
 * otherwise (local/dev) it logs the message so flows work without a mail server.
 * The transport is created lazily and reused across sends.
 */
export class EmailService {
  private transporter: Transporter | null = null;
  private initialised = false;

  private getTransporter(): Transporter | null {
    if (this.initialised) return this.transporter;
    this.initialised = true;
    if (env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      });
    }
    return this.transporter;
  }

  async send(message: EmailMessage): Promise<{ delivered: boolean }> {
    const transporter = this.getTransporter();
    if (!transporter) {
      console.info(`📧 [dev email] to=${message.to} subject="${message.subject}"`);
      return { delivered: false };
    }
    try {
      await transporter.sendMail({
        from: env.SMTP_FROM,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      return { delivered: true };
    } catch (error) {
      // Email must never break the business flow that triggered it.
      console.error('⚠️ Failed to send email:', error);
      return { delivered: false };
    }
  }
}

export const emailService = new EmailService();
