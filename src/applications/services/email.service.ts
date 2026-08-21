import nodemailer from "nodemailer";
import { formatEmailDateTime } from "./email-formatters";
import { buildEmailLayout, emailButton, emailCallout } from "./email-layout";
import { escapeHtml } from "./email-html.util";

export { escapeHtml } from "./email-html.util";

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

  async sendPasswordReset(
    to: string,
    nombre: string,
    resetUrl: string,
    fechaExpiracion?: Date,
  ) {
    const subject = "Restablece tu contraseña - PIXEL";
    const text = [
      `Hola ${nombre}.`,
      "",
      "Recibimos una solicitud para recuperar tu contrasena.",
      `Cambia tu contrasena aqui: ${resetUrl}`,
      ...(fechaExpiracion
        ? [`Este enlace estara disponible hasta ${formatEmailDateTime(fechaExpiracion)}.`]
        : []),
      "",
      "Si no solicitaste este cambio, puedes ignorar este correo.",
    ].join("\n");

    const html = buildEmailLayout({
      title: "Restablece tu contraseña",
      preheader: "Usa el enlace seguro para elegir una nueva contraseña.",
      tone: "primary",
      body: `<p style="margin:0 0 14px;font-size:16px;line-height:24px;">Hola, <strong>${escapeHtml(nombre)}</strong>.</p>
        <p style="margin:0 0 14px;font-size:15px;line-height:24px;color:#3f384b;">Recibimos una solicitud para cambiar la contraseña de tu cuenta PIXEL.</p>
        ${fechaExpiracion ? emailCallout(`Este enlace estará disponible hasta el <strong>${escapeHtml(formatEmailDateTime(fechaExpiracion))}</strong>.`, "warning") : ""}
        ${emailButton("Cambiar contraseña", resetUrl)}
        ${emailCallout("Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña actual seguirá funcionando.", "primary")}`,
    });

    return await this.sendMail({ to, subject, text, html });
  }
}
