import { esFechaOpcionalValida } from "../../utils/date.util";
import { esEnteroPositivo, esMontoValido } from "../../utils/number.util";
import { esTextoNoVacio, esTextoOpcional } from "../../utils/text.util";
import { validarCamposPermitidos } from "../../utils/validation.util";

const esMetodoPagoPermitido = (valor: any) => {
  return ["EFECTIVO", "TRANSFERENCIA"].includes(valor);
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

export const validarMarcarPendienteSaldoFinal = (data: any) => {
  const errorCampos = validarCamposPermitidos(data, ["observaciones"]);

  if (errorCampos) {
    return errorCampos;
  }

  if (!esTextoOpcional(data?.observaciones)) {
    return "Las observaciones deben ser texto, null u omitirse.";
  }

  return null;
};

export const validarConfirmarEntregaPedido = (data: any) => {
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
  const errorCampos = validarCamposPermitidos(data, [
    "observaciones",
    "motivoAnulacion",
  ]);

  if (errorCampos) {
    return errorCampos;
  }

  if (!esTextoOpcional(data?.observaciones)) {
    return "Las observaciones deben ser texto, null u omitirse.";
  }

  if (!esTextoOpcional(data?.motivoAnulacion)) {
    return "El motivo de anulacion debe ser texto, null u omitirse.";
  }

  return null;
};

export const validarRequiereDisenoDetalle = (data: any) => {
  const errorCampos = validarCamposPermitidos(data, ["requiereDiseno"]);

  if (errorCampos) {
    return errorCampos;
  }

  if (typeof data?.requiereDiseno !== "boolean") {
    return "requiereDiseno es obligatorio y debe ser booleano.";
  }

  return null;
};
