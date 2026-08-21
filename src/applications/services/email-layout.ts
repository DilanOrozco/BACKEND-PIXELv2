import { escapeHtml } from "./email-html.util";

type EmailTone = "primary" | "success" | "warning" | "danger";

const COLORS: Record<EmailTone, { accent: string; soft: string }> = {
  primary: { accent: "#6d28d9", soft: "#f5f3ff" },
  success: { accent: "#15803d", soft: "#f0fdf4" },
  warning: { accent: "#c2410c", soft: "#fff7ed" },
  danger: { accent: "#b91c1c", soft: "#fef2f2" },
};

export const emailButton = (label: string, url: string) => `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 12px;">
    <tr><td bgcolor="#6d28d9" style="border-radius:6px;">
      <a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 22px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px;">${escapeHtml(label)}</a>
    </td></tr>
  </table>
  <p style="margin:0 0 18px;color:#6b7280;font-size:12px;line-height:18px;word-break:break-all;">Si el botón no funciona, abre este enlace:<br><a href="${escapeHtml(url)}" style="color:#6d28d9;">${escapeHtml(url)}</a></p>
`;

export const emailCallout = (
  content: string,
  tone: EmailTone = "primary",
) => {
  const color = COLORS[tone];
  return `<div style="margin:20px 0;padding:16px 18px;background:${color.soft};border-left:4px solid ${color.accent};border-radius:4px;color:#312e3f;line-height:23px;">${content}</div>`;
};

export const emailInfoRows = (
  rows: Array<{ label: string; value: unknown; strong?: boolean }>,
) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:18px 0;border-collapse:collapse;">
  ${rows
    .filter((row) => row.value !== null && row.value !== undefined && row.value !== "")
    .map(
      (row) => `<tr>
        <td style="padding:9px 0;border-bottom:1px solid #eeeaf5;color:#6b7280;font-size:14px;">${escapeHtml(row.label)}</td>
        <td align="right" style="padding:9px 0;border-bottom:1px solid #eeeaf5;color:#241f2e;font-size:14px;${row.strong ? "font-weight:bold;" : ""}">${escapeHtml(row.value)}</td>
      </tr>`,
    )
    .join("")}
</table>`;

export const emailProductCard = (options: {
  title: string;
  subtitle?: string;
  rows: Array<{ label: string; value: unknown }>;
  servicesHtml?: string;
}) => `<div style="margin:14px 0;padding:17px;border:1px solid #e7e2ef;border-radius:6px;background:#ffffff;">
  <h3 style="margin:0;color:#312843;font-size:17px;line-height:23px;">${escapeHtml(options.title)}</h3>
  ${options.subtitle ? `<p style="margin:4px 0 10px;color:#6b7280;font-size:13px;">${escapeHtml(options.subtitle)}</p>` : ""}
  ${emailInfoRows(options.rows)}
  ${options.servicesHtml ?? ""}
</div>`;

export const buildEmailLayout = (options: {
  title: string;
  preheader?: string;
  body: string;
  tone?: EmailTone;
}) => {
  const color = COLORS[options.tone ?? "primary"];
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(options.title)}</title></head>
<body style="margin:0;padding:0;background:#f4f3f7;font-family:Arial,Helvetica,sans-serif;color:#241f2e;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(options.preheader ?? options.title)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f4f3f7"><tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;">
      <tr><td bgcolor="#4c1d95" style="padding:22px 28px;border-radius:8px 8px 0 0;color:#ffffff;">
        <div style="font-size:24px;font-weight:bold;letter-spacing:0;">PIXEL</div>
        <div style="margin-top:3px;font-size:12px;color:#ddd6fe;">Diseño y estampación</div>
      </td></tr>
      <tr><td bgcolor="#ffffff" style="padding:30px 28px;border-top:4px solid ${color.accent};">
        <h1 style="margin:0 0 16px;color:#241f2e;font-size:26px;line-height:33px;font-weight:bold;">${escapeHtml(options.title)}</h1>
        ${options.body}
      </td></tr>
      <tr><td bgcolor="#faf9fc" style="padding:20px 28px;border-top:1px solid #ebe7f1;border-radius:0 0 8px 8px;color:#6b7280;font-size:12px;line-height:18px;">
        <strong style="color:#4c1d95;">PIXEL</strong><br>
        Este correo fue enviado para mantenerte al tanto de tu solicitud o pedido. Si necesitas ayuda, responde a este mensaje y nuestro equipo te acompañará.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
};
