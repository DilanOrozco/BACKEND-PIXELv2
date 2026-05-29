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

  if (!esFechaOpcionalValida(data?.fechaEntregaEstimada)) {
    return "La fecha de entrega estimada no es valida.";
  }

  if (!esTextoOpcional(data?.observaciones)) {
    return "Las observaciones deben ser texto, null u omitirse.";
  }

  return null;
};

export const validarActualizarObservacionesPedido = (data: any) => {
  const errorCampos = validarCamposPermitidos(data, ["observaciones"]);

  if (errorCampos) {
    return errorCampos;
  }

  if (!esTextoNoVacio(data?.observaciones)) {
    return "Debe enviar observaciones en texto para actualizar el pedido.";
  }

  return null;
};

export const validarPasarPedidoEnProceso = (data: any) => {
  const errorCampos = validarCamposPermitidos(data, [
    "abonoConfirmado",
    "montoPrimerAbono",
    "observaciones",
  ]);

  if (errorCampos) {
    return errorCampos;
  }

  if (data?.abonoConfirmado !== true) {
    return "Debe confirmar el primer abono para pasar el pedido a EN_PROCESO.";
  }

  if (!esMontoValido(data?.montoPrimerAbono)) {
    return "El monto del primer abono es obligatorio y debe ser mayor a 0.";
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
