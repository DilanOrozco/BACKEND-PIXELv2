const MEDIOS = new Set([
  "SISTEMA",
  "WHATSAPP",
  "LLAMADA",
  "CORREO",
  "PRESENCIAL",
  "OTRO",
]);

const DECISIONES = new Set(["ACEPTAR", "RECHAZAR", "SOLICITAR_AJUSTE"]);
const MONTO_MAXIMO = 9_999_999_999.99;

const numeroNoNegativo = (valor: unknown) => {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= 0 && numero <= MONTO_MAXIMO;
};

const textoValido = (valor: unknown, maximo: number) =>
  valor === undefined ||
  valor === null ||
  (typeof valor === "string" && valor.trim().length <= maximo);

export const validarEnviarPropuesta = (data: any) => {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return "Debes enviar los datos de la propuesta.";
  }

  if (!numeroNoNegativo(data.precioFinal) || Number(data.precioFinal) <= 0) {
    return "El precio final propuesto debe ser mayor a 0.";
  }

  if (
    data.descuentoManual !== undefined &&
    !numeroNoNegativo(data.descuentoManual)
  ) {
    return "El descuento manual no puede ser negativo.";
  }

  if (
    data.costosAdicionales !== undefined &&
    !numeroNoNegativo(data.costosAdicionales)
  ) {
    return "Los costos adicionales no pueden ser negativos.";
  }

  if (data.validaHasta !== undefined) {
    const fecha = new Date(data.validaHasta);
    if (Number.isNaN(fecha.getTime()) || fecha <= new Date()) {
      return "La vigencia de la propuesta debe ser una fecha futura valida.";
    }
  }

  if (data.items !== undefined && !Array.isArray(data.items)) {
    return "Los items oficiales deben enviarse como una lista.";
  }

  if (
    data.motivoAjusteManual !== undefined &&
    !textoValido(data.motivoAjusteManual, 500)
  ) {
    return "El motivo del ajuste manual debe tener maximo 500 caracteres.";
  }

  for (const item of data.items ?? []) {
    if (
      !Number.isInteger(Number(item?.idDetalleCotizacion)) ||
      Number(item.idDetalleCotizacion) <= 0
    ) {
      return "Cada item oficial debe indicar un idDetalleCotizacion valido.";
    }

    for (const campo of [
      "subtotalServiciosOficial",
      "costoProducto",
      "otrosCostosItem",
      "subtotalOficial",
      "subtotal",
    ]) {
      if (item?.[campo] !== undefined && !numeroNoNegativo(item[campo])) {
        return `El campo ${campo} de los items debe ser un valor monetario valido.`;
      }
    }
  }

  if (
    data.conceptosAdicionales !== undefined &&
    !Array.isArray(data.conceptosAdicionales)
  ) {
    return "Los conceptos adicionales deben enviarse como una lista.";
  }

  for (const concepto of data.conceptosAdicionales ?? []) {
    if (
      typeof concepto?.concepto !== "string" ||
      concepto.concepto.trim() === "" ||
      concepto.concepto.trim().length > 120
    ) {
      return "Cada concepto adicional debe tener un nombre de maximo 120 caracteres.";
    }
    if (!numeroNoNegativo(concepto?.valor)) {
      return "El valor de cada concepto adicional debe ser valido y no negativo.";
    }
    if (
      concepto.visibleCliente !== undefined &&
      typeof concepto.visibleCliente !== "boolean"
    ) {
      return "visibleCliente debe ser booleano.";
    }
  }

  if (data.disenos !== undefined && !Array.isArray(data.disenos)) {
    return "Los costos de diseno deben enviarse como una lista.";
  }

  for (const diseno of data.disenos ?? []) {
    const tieneItem =
      Number.isInteger(Number(diseno?.idDetalleCotizacion)) &&
      Number(diseno.idDetalleCotizacion) > 0;
    const tieneDetalle =
      Number.isInteger(Number(diseno?.idDetalleEstampadoCotizacion)) &&
      Number(diseno.idDetalleEstampadoCotizacion) > 0;
    const tieneGrupo =
      typeof diseno?.grupoDisenoCompartido === "string" &&
      diseno.grupoDisenoCompartido.trim() !== "";

    if ([tieneItem, tieneDetalle, tieneGrupo].filter(Boolean).length !== 1) {
      return "Cada costo de diseno debe identificar un item, un estampado o un grupo compartido.";
    }
    if (!numeroNoNegativo(diseno?.costoDiseno)) {
      return "El costo de diseno debe ser valido y no negativo.";
    }
    if (!textoValido(diseno?.descripcionVisible, 200)) {
      return "La descripcion visible del diseno debe tener maximo 200 caracteres.";
    }
    if (
      diseno.visibleCliente !== undefined &&
      typeof diseno.visibleCliente !== "boolean"
    ) {
      return "visibleCliente debe ser booleano.";
    }
  }

  return null;
};

export const validarRespuestaCotizacion = (
  data: any,
  actor: "CLIENTE" | "USUARIO_INTERNO",
) => {
  const decision = String(data?.decision ?? "").toUpperCase();

  if (!DECISIONES.has(decision)) {
    return "La decision debe ser ACEPTAR, RECHAZAR o SOLICITAR_AJUSTE.";
  }

  if (
    decision === "SOLICITAR_AJUSTE" &&
    (typeof data?.observaciones !== "string" ||
      data.observaciones.trim() === "")
  ) {
    return "Debes indicar el motivo del ajuste solicitado.";
  }

  const medio = String(
    data?.medio ?? (actor === "CLIENTE" ? "SISTEMA" : ""),
  ).toUpperCase();

  if (!MEDIOS.has(medio)) {
    return "El medio de respuesta no es valido.";
  }

  if (actor === "CLIENTE" && medio !== "SISTEMA") {
    return "Las respuestas del portal cliente deben usar el medio SISTEMA.";
  }

  if (
    !Number.isInteger(Number(data?.idVersion)) ||
    Number(data.idVersion) <= 0
  ) {
    return "La version de cotizacion no es valida.";
  }

  if (
    data?.evidenciaUrl !== undefined &&
    data.evidenciaUrl !== null &&
    (typeof data.evidenciaUrl !== "string" ||
      data.evidenciaUrl.trim().length > 500)
  ) {
    return "La evidencia debe ser una URL o texto de maximo 500 caracteres.";
  }

  return null;
};
