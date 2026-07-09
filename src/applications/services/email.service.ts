import nodemailer from "nodemailer";

export type MailData = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

const smtpPort = Number(process.env.SMTP_PORT ?? 587);

const getFrom = () =>
  process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@pixel.local";

const hasSmtpConfig = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export class EmailService {
  async sendMail(data: MailData) {
    if (!hasSmtpConfig()) {
      console.warn("SMTP no configurado. Correo omitido:", data.subject);
      return { sent: false, skipped: true };
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number.isFinite(smtpPort) ? smtpPort : 587,
      secure: smtpPort === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: getFrom(),
      to: data.to,
      subject: data.subject,
      text: data.text,
      html: data.html,
    });

    return { sent: true, skipped: false };
  }

  async sendPasswordReset(to: string, nombre: string, resetUrl: string) {
    const subject = "Recuperacion de contrasena - PIXEL";
    const text = [
      `Hola ${nombre}.`,
      "",
      "Recibimos una solicitud para recuperar tu contrasena.",
      `Usa este enlace para crear una nueva contrasena: ${resetUrl}`,
      "",
      "Si no solicitaste este cambio, puedes ignorar este correo.",
    ].join("\n");

    const html = `
      <p>Hola ${escapeHtml(nombre)}.</p>
      <p>Recibimos una solicitud para recuperar tu contrasena.</p>
      <p><a href="${escapeHtml(resetUrl)}">Crear nueva contrasena</a></p>
      <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
    `;

    return await this.sendMail({ to, subject, text, html });
  }
}
