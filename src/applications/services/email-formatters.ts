const EMAIL_TIME_ZONE = "America/Bogota";
const EMAIL_LOCALE = "es-CO";

const numeroSeguro = (valor: unknown) => {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) ? numero : 0;
};

const fechaCalendario = (valor: string) => {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!coincidencia) return null;

  const [, anio, mes, dia] = coincidencia;
  return new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia), 12));
};

const normalizarFecha = (valor: unknown) => {
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : valor;
  }

  if (typeof valor !== "string" || valor.trim() === "") return null;
  const calendario = fechaCalendario(valor.trim());
  if (calendario) return calendario;

  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

export const formatCurrencyCOP = (valor: unknown) =>
  `$ ${new Intl.NumberFormat(EMAIL_LOCALE, {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Math.round(numeroSeguro(valor)))}`;

export const formatEmailDate = (valor: unknown, fallback = "Por definir") => {
  const fecha = normalizarFecha(valor);
  if (!fecha) return fallback;

  return new Intl.DateTimeFormat(EMAIL_LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: EMAIL_TIME_ZONE,
  }).format(fecha);
};

export const formatEmailDateShort = (
  valor: unknown,
  fallback = "Por definir",
) => {
  const fecha = normalizarFecha(valor);
  if (!fecha) return fallback;

  return new Intl.DateTimeFormat(EMAIL_LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: EMAIL_TIME_ZONE,
  }).format(fecha);
};

export const formatEmailDateTime = (
  valor: unknown,
  fallback = "Por definir",
) => {
  const fecha = normalizarFecha(valor);
  if (!fecha) return fallback;

  return new Intl.DateTimeFormat(EMAIL_LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: EMAIL_TIME_ZONE,
  })
    .format(fecha)
    .replace(/a\.\s*m\./i, "a. m.")
    .replace(/p\.\s*m\./i, "p. m.");
};

const humanizar = (valor: unknown, etiquetas: Record<string, string>) => {
  const clave = String(valor ?? "").trim().toUpperCase();
  if (!clave) return "Por definir";
  return etiquetas[clave] ?? clave.toLowerCase().replaceAll("_", " ");
};

export const humanizeOrderStatus = (valor: unknown) =>
  humanizar(valor, {
    PENDIENTE: "Pendiente de iniciar",
    EN_PROCESO: "En producción",
    PENDIENTE_SALDO_FINAL: "Pendiente de saldo final",
    FINALIZADO: "Listo para entrega",
    ENTREGADO: "Entregado",
    ANULADO: "Anulado",
  });

export const humanizePaymentStatus = (valor: unknown) =>
  humanizar(valor, {
    PENDIENTE: "Pendiente de confirmación",
    PARCIAL: "Pago parcial",
    COMPLETO: "Pago completo",
    CONFIRMADO: "Pago confirmado",
    RECHAZADO: "Pago no aprobado",
  });

export const humanizeDesignStatus = (valor: unknown) =>
  humanizar(valor, {
    PENDIENTE: "Pendiente de preparación",
    PENDIENTE_CREACION_PIXEL: "Pendiente de preparación por PIXEL",
    PENDIENTE_APROBACION: "Pendiente de tu aprobación",
    ENVIADO: "Listo para revisión",
    APROBADO: "Aprobado",
    RECHAZADO: "Requiere correcciones",
    CORRECCION: "En corrección",
  });

export const emailTimeZone = EMAIL_TIME_ZONE;
