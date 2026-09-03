import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';

interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) return this.transporter;

    if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      });
    }

    return this.transporter;
  }

  async send(params: SendEmailParams): Promise<void> {
    const transporter = this.getTransporter();

    if (transporter) {
      try {
        await transporter.sendMail({
          from: env.SMTP_FROM,
          to: params.to,
          subject: params.subject,
          text: params.text,
          html: params.html,
        });
      } catch (err) {
        console.log(`[EMAIL] Failed to send email to ${params.to}:`, err);
      }
    } else {
      console.log(`[EMAIL] To: ${params.to}`);
      console.log(`[EMAIL] Subject: ${params.subject}`);
      console.log(`[EMAIL] Body: ${params.text}`);
      if (!env.SMTP_HOST) {
        console.log(`[EMAIL] SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in .env to send real emails`);
      } else {
        console.log(`[EMAIL] SMTP configured but SMTP_USER/SMTP_PASS missing`);
      }
    }
  }

  async sendPasswordReset(email: string, token: string): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
    await this.send({
      to: email,
      subject: 'Password Reset Request - InnSight',
      text: `You requested a password reset.\n\nClick the link below to reset your password:\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you did not request this, please ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #059669, #10b981); padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">InnSight</h1>
            <p style="color: #d1fae5; margin: 4px 0 0; font-size: 14px;">Hotel Management System</p>
          </div>
          <div style="background: #1f2937; padding: 32px; border-radius: 0 0 12px 12px;">
            <h2 style="color: white; margin: 0 0 16px; font-size: 18px;">Password Reset</h2>
            <p style="color: #d1d5db; margin: 0 0 24px; font-size: 14px; line-height: 1.6;">
              You requested a password reset. Click the button below to set a new password.
            </p>
            <a href="${resetUrl}" style="display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">
              Reset Password
            </a>
            <p style="color: #6b7280; margin: 24px 0 0; font-size: 12px;">
              This link will expire in 1 hour. If you did not request this, please ignore this email.
            </p>
          </div>
        </div>
      `,
    });
  }
}

export const emailService = new EmailService();
