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
