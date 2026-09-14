export const esFechaOpcionalValida = (valor: unknown) => {
  if (valor === undefined || valor === null || valor === "") {
    return true;
  }

  const fecha = new Date(String(valor));
  return !Number.isNaN(fecha.getTime());
};

export const prepararFechaOpcional = (valor: unknown) => {
  if (valor === undefined || valor === null || valor === "") {
    return null;
  }

  return new Date(String(valor));
};

export const prepararFechaCalendario = (valor: unknown) => {
  if (valor === undefined || valor === null || valor === "") {
    return null;
  }

  const texto = String(valor);
  const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const fecha = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );

  return fecha.getUTCFullYear() === Number(match[1]) &&
    fecha.getUTCMonth() + 1 === Number(match[2]) &&
    fecha.getUTCDate() === Number(match[3])
    ? fecha
    : null;
};

export const esFechaCalendarioValida = (valor: unknown) =>
  prepararFechaCalendario(valor) !== null;

export const formatearFechaCalendario = (valor: unknown) => {
  if (!valor) {
    return null;
  }

  const fecha = new Date(String(valor));
  return Number.isNaN(fecha.getTime())
    ? null
    : fecha.toISOString().slice(0, 10);
};

export const formatearFechaLegible = (valor: unknown) => {
  if (!valor) {
    return null;
  }

  const fecha = new Date(String(valor));

  if (Number.isNaN(fecha.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(fecha);
};
