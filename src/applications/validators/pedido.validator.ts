const esEnteroPositivo = (valor: any) => {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0;
};

const esMontoValido = (valor: any) => {
  if (valor === undefined || valor === null || valor === "") {
    return false;
  }

  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0;
};

const esMetodoPagoPermitido = (valor: any) => {
  return ["EFECTIVO", "TRANSFERENCIA"].includes(valor);
};

const esTextoNoVacio = (valor: any) => {
  return typeof valor === "string" && valor.trim() !== "";
};

const esTextoOpcional = (valor: any) => {
  return valor === undefined || valor === null || typeof valor === "string";
};

const esFechaOpcionalValida = (valor: any) => {
  if (valor === undefined || valor === null || valor === "") {
    return true;
  }

  const fecha = new Date(valor);
  return !Number.isNaN(fecha.getTime());
};

const esFechaPasada = (valor: any) => {
  const fecha = new Date(valor);
  const hoy = new Date();
  const diaFecha = Date.UTC(
    fecha.getUTCFullYear(),
    fecha.getUTCMonth(),
    fecha.getUTCDate(),
  );
  const diaHoy = Date.UTC(
    hoy.getUTCFullYear(),
    hoy.getUTCMonth(),
    hoy.getUTCDate(),
  );

  return diaFecha < diaHoy;
};

const validarCamposPermitidos = (data: any, camposPermitidos: string[]) => {
  const campos = Object.keys(data || {});
  const campoNoPermitido = campos.find(
    (campo) => !camposPermitidos.includes(campo),
  );

  if (campoNoPermitido) {
    return `El campo ${campoNoPermitido} no se puede modificar en este endpoint.`;
  }

  return null;
};

const validarFechaEntregaEstimada = (valor: any) => {
  if (valor === undefined) {
    return null;
  }

  if (valor === null || valor === "") {
    return "La fecha de entrega estimada no puede estar vacia.";
  }

  if (!esFechaOpcionalValida(valor)) {
    return "La fecha de entrega estimada no es valida.";
  }

  if (esFechaPasada(valor)) {
    return "La fecha de entrega estimada no puede ser una fecha pasada.";
  }

  return null;
};

export const validarCrearPedido = (data: any) => {
  const errorCampos = validarCamposPermitidos(data, [
    "idCotizacion",
    "fechaEntregaEstimada",
    "observaciones",
  ]);

  if (errorCampos) {
    return errorCampos;
  }

  if (!esEnteroPositivo(data?.idCotizacion)) {
    return "La cotizacion es obligatoria y debe ser valida.";
  }

  const errorFechaEntrega = validarFechaEntregaEstimada(
    data?.fechaEntregaEstimada,
  );

  if (errorFechaEntrega) {
    return errorFechaEntrega;
  }

  if (!esTextoOpcional(data?.observaciones)) {
    return "Las observaciones deben ser texto, null u omitirse.";
  }

  return null;
};

export const validarActualizarPedido = (
  data: any,
  opciones: { permiteFechaEntregaEstimada?: boolean } = {},
) => {
  const camposPermitidos = opciones.permiteFechaEntregaEstimada
    ? ["observaciones", "fechaEntregaEstimada"]
    : ["observaciones"];

  const errorCampos = validarCamposPermitidos(data, camposPermitidos);

  if (errorCampos) {
    return errorCampos;
  }

  const campos = Object.keys(data || {});

  if (campos.length === 0) {
    return "Debe enviar al menos un campo para actualizar el pedido.";
  }

  if (
    data?.observaciones !== undefined &&
    !esTextoNoVacio(data.observaciones)
  ) {
    return "Las observaciones deben ser texto y no pueden estar vacias.";
  }

  if (
    !opciones.permiteFechaEntregaEstimada &&
    data?.fechaEntregaEstimada !== undefined
  ) {
    return "El cliente no puede actualizar la fecha de entrega estimada.";
  }

  const errorFechaEntrega = validarFechaEntregaEstimada(
    data?.fechaEntregaEstimada,
  );

  if (errorFechaEntrega) {
    return errorFechaEntrega;
  }

  return null;
};

export const validarPasarPedidoEnProceso = (data: any) => {
  const errorCampos = validarCamposPermitidos(data, [
    "abonoConfirmado",
    "montoPrimerAbono",
    "metodoPago",
    "referencia",
    "comprobanteUrl",
    "observaciones",
  ]);

  if (errorCampos) {
    return errorCampos;
  }

  if (data?.montoPrimerAbono !== undefined) {
    if (data?.abonoConfirmado !== true) {
      return "Debe confirmar el primer abono para pasar el pedido a EN_PROCESO.";
    }

    if (!esMontoValido(data?.montoPrimerAbono)) {
      return "El monto del primer abono es obligatorio y debe ser mayor a 0.";
    }
  }

  if (
    data?.metodoPago !== undefined &&
    !esMetodoPagoPermitido(data.metodoPago)
  ) {
    return "Método de pago no válido. Solo se permite EFECTIVO o TRANSFERENCIA.";
  }

  if (!esTextoOpcional(data?.referencia)) {
    return "La referencia debe ser texto, null u omitirse.";
  }

  if (!esTextoOpcional(data?.comprobanteUrl)) {
    return "El comprobante debe ser texto, null u omitirse.";
  }

  if (!esTextoOpcional(data?.observaciones)) {
    return "Las observaciones deben ser texto, null u omitirse.";
  }

  return null;
};

export const validarFinalizarPedido = (data: any) => {
  const errorCampos = validarCamposPermitidos(data, [
    "fechaEntregado",
    "observaciones",
  ]);

  if (errorCampos) {
    return errorCampos;
  }

  if (!esFechaOpcionalValida(data?.fechaEntregado)) {
    return "La fecha de entrega no es valida.";
  }

  if (!esTextoOpcional(data?.observaciones)) {
    return "Las observaciones deben ser texto, null u omitirse.";
  }

  return null;
};

export const validarAnularPedido = (data: any) => {
  const errorCampos = validarCamposPermitidos(data, ["observaciones"]);

  if (errorCampos) {
    return errorCampos;
  }

  if (!esTextoOpcional(data?.observaciones)) {
    return "Las observaciones deben ser texto, null u omitirse.";
  }

  return null;
};
