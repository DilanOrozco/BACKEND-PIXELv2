const ESTADOS_COMPRA = ["PENDIENTE", "COMPRADA", "ANULADA"] as const;

type DatosEntrada = Record<string, unknown> | undefined;

export type EstadoCompraPermitido = (typeof ESTADOS_COMPRA)[number];

const valor = (data: DatosEntrada, campo: string) => data?.[campo];

const esEnteroPositivo = (valorEntrada: unknown) => {
  const numero = Number(valorEntrada);
  return Number.isInteger(numero) && numero > 0;
};

const esMontoPositivo = (valorEntrada: unknown) => {
  if (valorEntrada === undefined || valorEntrada === null || valorEntrada === "") {
    return false;
  }

  const numero = Number(valorEntrada);
  return Number.isFinite(numero) && numero > 0;
};

const esTextoOpcional = (valorEntrada: unknown, maximo: number) => {
  return (
    valorEntrada === undefined ||
    valorEntrada === null ||
    (typeof valorEntrada === "string" && valorEntrada.length <= maximo)
  );
};

const esTextoRequerido = (valorEntrada: unknown, maximo: number) => {
  return (
    typeof valorEntrada === "string" &&
    valorEntrada.trim() !== "" &&
    valorEntrada.trim().length <= maximo
  );
};

const esBooleanoOpcional = (valorEntrada: unknown) => {
  return valorEntrada === undefined || typeof valorEntrada === "boolean";
};

const esFechaOpcionalValida = (valorEntrada: unknown) => {
  if (valorEntrada === undefined || valorEntrada === null || valorEntrada === "") {
    return true;
  }

  if (typeof valorEntrada !== "string") {
    return false;
  }

  const fecha = new Date(valorEntrada);
  return !Number.isNaN(fecha.getTime());
};

const esEstadoCompraPermitido = (
  valorEntrada: unknown,
): valorEntrada is EstadoCompraPermitido => {
  return ESTADOS_COMPRA.includes(valorEntrada as EstadoCompraPermitido);
};

const validarCamposPermitidos = (
  data: DatosEntrada,
  camposPermitidos: string[],
) => {
  const campos = Object.keys(data ?? {});

  if (campos.includes("total")) {
    return "El total de la compra se calcula automaticamente y no debe enviarse.";
  }

  if (campos.includes("subtotal")) {
    return "El subtotal de la compra se calcula automaticamente y no debe enviarse.";
  }

  const campoNoPermitido = campos.find(
    (campo) => !camposPermitidos.includes(campo),
  );

  if (campoNoPermitido) {
    return `El campo ${campoNoPermitido} no se puede modificar en este endpoint.`;
  }

  return null;
};

const validarDetalle = (detalle: unknown) => {
  if (!detalle || typeof detalle !== "object" || Array.isArray(detalle)) {
    return "Cada detalle de compra debe ser un objeto valido.";
  }

  const item = detalle as Record<string, unknown>;
  const campos = Object.keys(item);

  if (campos.includes("subtotal")) {
    return "El subtotal de cada detalle se calcula automaticamente y no debe enviarse.";
  }

  const campoNoPermitido = campos.find(
    (campo) =>
      !["descripcionInsumo", "cantidad", "costoUnitario"].includes(campo),
  );

  if (campoNoPermitido) {
    return `El campo ${campoNoPermitido} no se puede enviar en un detalle de compra.`;
  }

  if (!esTextoRequerido(item.descripcionInsumo, 255)) {
    return "La descripcion del insumo es obligatoria.";
  }

  if (!esEnteroPositivo(item.cantidad)) {
    return "La cantidad debe ser mayor a cero.";
  }

  if (!esMontoPositivo(item.costoUnitario)) {
    return "El costo unitario debe ser mayor a cero.";
  }

  return null;
};

const validarDetalles = (detalles: unknown, requerido: boolean) => {
  if (detalles === undefined) {
    return requerido ? "La compra debe tener al menos un detalle." : null;
  }

  if (!Array.isArray(detalles) || detalles.length === 0) {
    return "La compra debe tener al menos un detalle.";
  }

  for (const detalle of detalles) {
    const errorDetalle = validarDetalle(detalle);

    if (errorDetalle) {
      return errorDetalle;
    }
  }

  return null;
};

export const validarCrearCompra = (data: DatosEntrada) => {
  const errorCampos = validarCamposPermitidos(data, [
    "idPedido",
    "idProveedor",
    "observaciones",
    "confirmar",
    "detalles",
  ]);

  if (errorCampos) {
    return errorCampos;
  }

  if (!esEnteroPositivo(valor(data, "idPedido"))) {
    return "El pedido es obligatorio y debe ser valido.";
  }

  if (!esEnteroPositivo(valor(data, "idProveedor"))) {
    return "El proveedor es obligatorio y debe ser valido.";
  }

  if (!esTextoOpcional(valor(data, "observaciones"), 500)) {
    return "Las observaciones deben ser texto de maximo 500 caracteres, null u omitirse.";
  }

  if (!esBooleanoOpcional(valor(data, "confirmar"))) {
    return "El campo confirmar debe ser booleano.";
  }

  return validarDetalles(valor(data, "detalles"), true);
};

export const validarActualizarCompra = (data: DatosEntrada) => {
  const errorCampos = validarCamposPermitidos(data, [
    "idProveedor",
    "observaciones",
    "detalles",
  ]);

  if (errorCampos) {
    return errorCampos;
  }

  if (Object.keys(data ?? {}).length === 0) {
    return "Debe enviar al menos un campo para actualizar la compra.";
  }

  if (
    valor(data, "idProveedor") !== undefined &&
    !esEnteroPositivo(valor(data, "idProveedor"))
  ) {
    return "El proveedor debe ser valido.";
  }

  if (!esTextoOpcional(valor(data, "observaciones"), 500)) {
    return "Las observaciones deben ser texto de maximo 500 caracteres, null u omitirse.";
  }

  return validarDetalles(valor(data, "detalles"), false);
};

export const validarAnularCompra = (data: DatosEntrada) => {
  const errorCampos = validarCamposPermitidos(data, ["observaciones"]);

  if (errorCampos) {
    return errorCampos;
  }

  if (!esTextoOpcional(valor(data, "observaciones"), 500)) {
    return "Las observaciones deben ser texto de maximo 500 caracteres, null u omitirse.";
  }

  return null;
};

export const validarFiltrosCompra = (filtros: DatosEntrada) => {
  const errorCampos = validarCamposPermitidos(filtros, [
    "idPedido",
    "idProveedor",
    "estado",
    "compradoPorId",
    "desde",
    "hasta",
  ]);

  if (errorCampos) {
    return errorCampos;
  }

  if (
    valor(filtros, "idPedido") !== undefined &&
    !esEnteroPositivo(valor(filtros, "idPedido"))
  ) {
    return "El pedido debe ser valido.";
  }

  if (
    valor(filtros, "idProveedor") !== undefined &&
    !esEnteroPositivo(valor(filtros, "idProveedor"))
  ) {
    return "El proveedor debe ser valido.";
  }

  if (
    valor(filtros, "compradoPorId") !== undefined &&
    !esEnteroPositivo(valor(filtros, "compradoPorId"))
  ) {
    return "El usuario comprador debe ser valido.";
  }

  if (
    valor(filtros, "estado") !== undefined &&
    !esEstadoCompraPermitido(valor(filtros, "estado"))
  ) {
    return "El estado de la compra no es valido.";
  }

  if (!esFechaOpcionalValida(valor(filtros, "desde"))) {
    return "La fecha desde no es valida.";
  }

  if (!esFechaOpcionalValida(valor(filtros, "hasta"))) {
    return "La fecha hasta no es valida.";
  }

  return null;
};

export const validarFiltrosResumenCompra = (filtros: DatosEntrada) => {
  const errorCampos = validarCamposPermitidos(filtros, [
    "idPedido",
    "idProveedor",
    "desde",
    "hasta",
  ]);

  if (errorCampos) {
    return errorCampos;
  }

  if (
    valor(filtros, "idPedido") !== undefined &&
    !esEnteroPositivo(valor(filtros, "idPedido"))
  ) {
    return "El pedido debe ser valido.";
  }

  if (
    valor(filtros, "idProveedor") !== undefined &&
    !esEnteroPositivo(valor(filtros, "idProveedor"))
  ) {
    return "El proveedor debe ser valido.";
  }

  if (!esFechaOpcionalValida(valor(filtros, "desde"))) {
    return "La fecha desde no es valida.";
  }

  if (!esFechaOpcionalValida(valor(filtros, "hasta"))) {
    return "La fecha hasta no es valida.";
  }

  return null;
};
