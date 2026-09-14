const ESTADOS_PAGO = ["PENDIENTE", "PARCIAL", "COMPLETO"] as const;

type DatosEntrada = Record<string, unknown> | undefined;

export type EstadoPagoVenta = (typeof ESTADOS_PAGO)[number];

const obtenerValorQuery = (valorEntrada: unknown) => {
  if (Array.isArray(valorEntrada)) {
    return valorEntrada[0];
  }

  return valorEntrada;
};

const valor = (data: DatosEntrada, campo: string) =>
  obtenerValorQuery(data?.[campo]);

const esEnteroPositivo = (valorEntrada: unknown) => {
  const numero = Number(valorEntrada);
  return Number.isInteger(numero) && numero > 0;
};

const esFechaOpcionalValida = (valorEntrada: unknown) => {
  if (
    valorEntrada === undefined ||
    valorEntrada === null ||
    valorEntrada === ""
  ) {
    return true;
  }

  if (typeof valorEntrada !== "string") {
    return false;
  }

  const fecha = new Date(valorEntrada);
  return !Number.isNaN(fecha.getTime());
};

const esEstadoPagoPermitido = (
  valorEntrada: unknown,
): valorEntrada is EstadoPagoVenta => {
  return ESTADOS_PAGO.includes(valorEntrada as EstadoPagoVenta);
};

const validarCamposPermitidos = (
  data: DatosEntrada,
  camposPermitidos: string[],
) => {
  const campos = Object.keys(data ?? {});
  const campoNoPermitido = campos.find(
    (campo) => !camposPermitidos.includes(campo),
  );

  if (campoNoPermitido) {
    return `El filtro ${campoNoPermitido} no esta permitido en este endpoint.`;
  }

  return null;
};

const crearFechaComparacion = (valorEntrada: unknown, finDelDia = false) => {
  const fecha = new Date(String(valorEntrada));

  if (finDelDia && /^\d{4}-\d{2}-\d{2}$/.test(String(valorEntrada))) {
    fecha.setUTCHours(23, 59, 59, 999);
  }

  return fecha;
};

const validarRangoFechas = (data: DatosEntrada, requerido = false) => {
  const fechaInicio = valor(data, "fechaInicio");
  const fechaFin = valor(data, "fechaFin");

  if (
    requerido &&
    (fechaInicio === undefined || fechaInicio === null || fechaInicio === "")
  ) {
    return "La fecha de inicio es obligatoria.";
  }

  if (
    requerido &&
    (fechaFin === undefined || fechaFin === null || fechaFin === "")
  ) {
    return "La fecha de fin es obligatoria.";
  }

  if (!esFechaOpcionalValida(fechaInicio)) {
    return "La fecha de inicio no es valida.";
  }

  if (!esFechaOpcionalValida(fechaFin)) {
    return "La fecha de fin no es valida.";
  }

  if (fechaInicio && fechaFin) {
    const inicio = crearFechaComparacion(fechaInicio);
    const fin = crearFechaComparacion(fechaFin, true);

    if (inicio.getTime() > fin.getTime()) {
      return "La fecha de inicio no puede ser mayor a la fecha de fin.";
    }
  }

  return null;
};

export const validarFiltrosVentas = (filtros: DatosEntrada) => {
  const errorCampos = validarCamposPermitidos(filtros, [
    "fechaInicio",
    "fechaFin",
    "idCliente",
    "estadoPago",
  ]);

  if (errorCampos) {
    return errorCampos;
  }

  if (
    valor(filtros, "idCliente") !== undefined &&
    !esEnteroPositivo(valor(filtros, "idCliente"))
  ) {
    return "El cliente debe ser valido.";
  }

  if (
    valor(filtros, "estadoPago") !== undefined &&
    !esEstadoPagoPermitido(valor(filtros, "estadoPago"))
  ) {
    return "El estado de pago no es valido.";
  }

  return validarRangoFechas(filtros);
};

export const validarBusquedaVentas = (filtros: DatosEntrada) => {
  const errorCampos = validarCamposPermitidos(filtros, [
    "termino",
    "q",
    "busqueda",
  ]);

  if (errorCampos) {
    return errorCampos;
  }

  const termino =
    valor(filtros, "termino") ?? valor(filtros, "q") ?? valor(filtros, "busqueda");

  if (termino === undefined || termino === null || String(termino).trim() === "") {
    return "Debe ingresar un termino de busqueda.";
  }

  return null;
};

export const validarResumenVentas = (filtros: DatosEntrada) =>
  validarCamposPermitidos(filtros, []);

export const validarResumenPeriodoVentas = (filtros: DatosEntrada) => {
  const errorCampos = validarCamposPermitidos(filtros, [
    "fechaInicio",
    "fechaFin",
  ]);

  if (errorCampos) {
    return errorCampos;
  }

  return validarRangoFechas(filtros, true);
};
