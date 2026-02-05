import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly fromEmail: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'no-reply@example.com';
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async sendWelcomeEmail(to: string, name: string) {
    if (!this.resend) {
      this.logger.warn('Resend nao configurado; email de boas-vindas ignorado.');
      return;
    }

    await this.resend.emails.send({
      from: this.fromEmail,
      to,
      subject: 'Bem-vindo ao ProMeasure',
      html: `<p>Ola ${name}, sua conta foi criada com sucesso.</p>`,
    });
  }

  async sendResetEmail(to: string, resetLink: string) {
    if (!this.resend) {
      this.logger.warn('Resend nao configurado; reset de senha ignorado.');
      return;
    }

    await this.resend.emails.send({
      from: this.fromEmail,
      to,
      subject: 'Redefina sua senha',
      html: `<p>Para redefinir sua senha, acesse: <a href="${resetLink}">${resetLink}</a></p>`,
    });
  }
}
