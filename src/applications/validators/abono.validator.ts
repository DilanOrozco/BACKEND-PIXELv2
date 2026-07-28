const METODOS_PAGO_PERMITIDOS = ["EFECTIVO", "TRANSFERENCIA"] as const;
const ESTADOS_ABONO = ["PENDIENTE", "CONFIRMADO", "RECHAZADO"] as const;

type DatosEntrada = Record<string, unknown> | undefined;

export type MetodoPagoPermitido = (typeof METODOS_PAGO_PERMITIDOS)[number];
export type EstadoAbonoPermitido = (typeof ESTADOS_ABONO)[number];
export type SugerenciasComprobante = {
  montoDetectado: number | null;
  referenciaDetectada: string | null;
  fechaDetectada: Date | null;
  bancoDetectado: string | null;
  calidadLectura: number | null;
  requiereRevisionManual: boolean;
  tieneAnalisisFrontend: boolean;
};

const valor = (data: DatosEntrada, campo: string) => data?.[campo];

export const esEnteroPositivo = (valorEntrada: unknown) => {
  const numero = Number(valorEntrada);
  return Number.isInteger(numero) && numero > 0;
};

export const esMontoValido = (valorEntrada: unknown) => {
  if (valorEntrada === undefined || valorEntrada === null || valorEntrada === "") {
    return false;
  }

  const numero = Number(valorEntrada);
  return Number.isFinite(numero) && numero > 0;
};

export const esMetodoPagoPermitido = (
  valorEntrada: unknown,
): valorEntrada is MetodoPagoPermitido => {
  return METODOS_PAGO_PERMITIDOS.includes(valorEntrada as MetodoPagoPermitido);
};

const esEstadoAbonoPermitido = (
  valorEntrada: unknown,
): valorEntrada is EstadoAbonoPermitido => {
  return ESTADOS_ABONO.includes(valorEntrada as EstadoAbonoPermitido);
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
    valorEntrada.length <= maximo
  );
};

const esBooleanoOpcional = (valorEntrada: unknown) => {
  return (
    valorEntrada === undefined ||
    typeof valorEntrada === "boolean" ||
    valorEntrada === "true" ||
    valorEntrada === "false"
  );
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

const validarCamposPermitidos = (
  data: DatosEntrada,
  camposPermitidos: string[],
) => {
  const campos = Object.keys(data ?? {});
  const campoNoPermitido = campos.find(
    (campo) => !camposPermitidos.includes(campo),
  );

  if (campoNoPermitido) {
    return `El campo ${campoNoPermitido} no se puede modificar en este endpoint.`;
  }

  return null;
};

const textoFormDataOpcional = (valorEntrada: unknown) => {
  if (valorEntrada === undefined || valorEntrada === null) {
    return null;
  }

  if (typeof valorEntrada !== "string") {
    return undefined;
  }

  const texto = valorEntrada.trim();
  return texto === "" ? null : texto;
};

const fechaDetectadaValida = (valorEntrada: string) => {
  const componentes = valorEntrada.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!componentes) {
    return null;
  }

  const fechaCalendario = new Date(
    Date.UTC(
      Number(componentes[1]),
      Number(componentes[2]) - 1,
      Number(componentes[3]),
    ),
  );
  const fechaCalendarioValida =
    fechaCalendario.getUTCFullYear() === Number(componentes[1]) &&
    fechaCalendario.getUTCMonth() + 1 === Number(componentes[2]) &&
    fechaCalendario.getUTCDate() === Number(componentes[3]);

  if (!fechaCalendarioValida) {
    return null;
  }

  const fecha = new Date(valorEntrada);

  if (Number.isNaN(fecha.getTime())) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(valorEntrada)) {
    return fecha.toISOString().slice(0, 10) === valorEntrada ? fecha : null;
  }

  return /^\d{4}-\d{2}-\d{2}T/.test(valorEntrada) ? fecha : null;
};

export const normalizarSugerenciasComprobante = (
  data: DatosEntrada,
): SugerenciasComprobante => {
  const permitidos = [
    "observaciones",
    "montoDetectado",
    "referenciaDetectada",
    "fechaDetectada",
    "bancoDetectado",
    "calidadLectura",
    "requiereRevisionManual",
    "origenAnalisis",
  ];
  const campoNoPermitido = Object.keys(data ?? {}).find(
    (campo) => !permitidos.includes(campo),
  );

  if (campoNoPermitido) {
    throw new Error(
      `El campo ${campoNoPermitido} no se puede enviar con el comprobante.`,
    );
  }

  const montoTexto = textoFormDataOpcional(valor(data, "montoDetectado"));
  const referencia = textoFormDataOpcional(valor(data, "referenciaDetectada"));
  const fechaTexto = textoFormDataOpcional(valor(data, "fechaDetectada"));
  const banco = textoFormDataOpcional(valor(data, "bancoDetectado"));
  const calidadTexto = textoFormDataOpcional(valor(data, "calidadLectura"));
  const revisionEntrada = valor(data, "requiereRevisionManual");
  const origen = textoFormDataOpcional(valor(data, "origenAnalisis"));

  if (montoTexto === undefined) {
    throw new Error("El monto detectado debe enviarse como texto numerico.");
  }

  const monto = montoTexto === null ? null : Number(montoTexto);

  if (
    monto !== null &&
    (!Number.isFinite(monto) || monto <= 0 || monto > 99_999_999.99)
  ) {
    throw new Error("El monto detectado debe ser numerico y mayor a 0.");
  }

  if (referencia === undefined || (referencia && referencia.length > 100)) {
    throw new Error("La referencia detectada debe tener maximo 100 caracteres.");
  }

  if (banco === undefined || (banco && banco.length > 100)) {
    throw new Error("El banco detectado debe tener maximo 100 caracteres.");
  }

  if (fechaTexto === undefined) {
    throw new Error("La fecha detectada debe enviarse como texto ISO.");
  }

  const fechaDetectada =
    fechaTexto === null ? null : fechaDetectadaValida(fechaTexto);

  if (fechaTexto !== null && !fechaDetectada) {
    throw new Error("La fecha detectada debe tener formato ISO valido.");
  }

  if (calidadTexto === undefined) {
    throw new Error("La calidad de lectura debe enviarse como texto numerico.");
  }

  const calidad = calidadTexto === null ? null : Number(calidadTexto);

  if (
    calidad !== null &&
    (!Number.isFinite(calidad) || calidad < 0 || calidad > 100)
  ) {
    throw new Error("La calidad de lectura debe estar entre 0 y 100.");
  }

  if (
    revisionEntrada !== undefined &&
    revisionEntrada !== true &&
    revisionEntrada !== false &&
    revisionEntrada !== "true" &&
    revisionEntrada !== "false"
  ) {
    throw new Error("requiereRevisionManual debe ser true o false.");
  }

  if (origen === undefined || (origen && origen.toUpperCase() !== "FRONTEND")) {
    throw new Error("El origen del analisis debe ser FRONTEND.");
  }

  const tieneAnalisisFrontend =
    origen?.toUpperCase() === "FRONTEND" ||
    [
      montoTexto,
      referencia,
      fechaTexto,
      banco,
      calidadTexto,
      revisionEntrada,
    ].some((item) => item !== null && item !== undefined);
  const revisionExplicita =
    revisionEntrada === true || revisionEntrada === "true"
      ? true
      : revisionEntrada === false || revisionEntrada === "false"
        ? false
        : null;

  return {
    montoDetectado: monto,
    referenciaDetectada: referencia,
    fechaDetectada,
    bancoDetectado: banco,
    calidadLectura: calidad,
    requiereRevisionManual:
      revisionExplicita ??
      (monto === null || (calidad !== null && calidad < 60)),
    tieneAnalisisFrontend,
  };
};

export const validarCrearAbono = (
  data: DatosEntrada,
  rolUsuario: string | undefined,
) => {
  const errorCampos = validarCamposPermitidos(data, [
    "idPedido",
    "monto",
    "metodoPago",
    "referencia",
    "fechaPago",
    "observaciones",
    "comprobanteUrl",
    "confirmar",
  ]);

  if (errorCampos) {
    return errorCampos;
  }

  if (!esEnteroPositivo(valor(data, "idPedido"))) {
    return "El pedido es obligatorio y debe ser valido.";
  }

  if (!esMontoValido(valor(data, "monto"))) {
    return "El monto del abono debe ser mayor a cero.";
  }

  if (!esMetodoPagoPermitido(valor(data, "metodoPago"))) {
    return "Método de pago no válido. Solo se permite EFECTIVO o TRANSFERENCIA.";
  }

  if (!esTextoOpcional(valor(data, "referencia"), 255)) {
    return "La referencia debe ser texto de maximo 255 caracteres, null u omitirse.";
  }

  if (!esFechaOpcionalValida(valor(data, "fechaPago"))) {
    return "La fecha del pago no es valida.";
  }

  if (!esTextoOpcional(valor(data, "observaciones"), 500)) {
    return "Las observaciones deben ser texto de maximo 500 caracteres.";
  }

  if (!esTextoOpcional(valor(data, "comprobanteUrl"), 500)) {
    return "El comprobante debe ser texto de maximo 500 caracteres, null u omitirse.";
  }

  if (!esBooleanoOpcional(valor(data, "confirmar"))) {
    return "El campo confirmar debe ser booleano.";
  }

  if (rolUsuario === "Cliente" && valor(data, "confirmar") === true) {
    return "El cliente solo puede registrar abonos pendientes.";
  }

  return null;
};

export const validarConfirmarAbono = (data: DatosEntrada) => {
  const errorCampos = validarCamposPermitidos(data, [
    "referencia",
    "observaciones",
  ]);

  if (errorCampos) {
    return errorCampos;
  }

  if (!esTextoOpcional(valor(data, "referencia"), 255)) {
    return "La referencia debe ser texto de maximo 255 caracteres, null u omitirse.";
  }

  if (!esTextoOpcional(valor(data, "observaciones"), 500)) {
    return "Las observaciones deben ser texto de maximo 500 caracteres, null u omitirse.";
  }

  return null;
};

export const validarRechazarAbono = (data: DatosEntrada) => {
  const errorCampos = validarCamposPermitidos(data, ["motivoRechazo"]);

  if (errorCampos) {
    return errorCampos;
  }

  if (!esTextoRequerido(valor(data, "motivoRechazo"), 500)) {
    return "El motivo de rechazo es obligatorio.";
  }

  return null;
};

export const validarActualizarAbono = (data: DatosEntrada) => {
  const errorCampos = validarCamposPermitidos(data, [
    "monto",
    "metodoPago",
    "referencia",
    "fechaPago",
    "observaciones",
    "comprobanteUrl",
    "requiereRevisionManual",
  ]);

  if (errorCampos) {
    return errorCampos;
  }

  const campos = Object.keys(data ?? {});

  if (campos.length === 0) {
    return "Debe enviar al menos un campo para actualizar el abono.";
  }

  if (valor(data, "monto") !== undefined && !esMontoValido(valor(data, "monto"))) {
    return "El monto del abono debe ser mayor a cero.";
  }

  if (
    valor(data, "metodoPago") !== undefined &&
    !esMetodoPagoPermitido(valor(data, "metodoPago"))
  ) {
    return "Método de pago no válido. Solo se permite EFECTIVO o TRANSFERENCIA.";
  }

  if (!esTextoOpcional(valor(data, "referencia"), 255)) {
    return "La referencia debe ser texto de maximo 255 caracteres, null u omitirse.";
  }

  if (!esTextoOpcional(valor(data, "comprobanteUrl"), 500)) {
    return "El comprobante debe ser texto de maximo 500 caracteres, null u omitirse.";
  }

  if (!esFechaOpcionalValida(valor(data, "fechaPago"))) {
    return "La fecha del pago no es valida.";
  }

  if (!esTextoOpcional(valor(data, "observaciones"), 500)) {
    return "Las observaciones deben ser texto de maximo 500 caracteres.";
  }

  if (
    valor(data, "requiereRevisionManual") !== undefined &&
    typeof valor(data, "requiereRevisionManual") !== "boolean"
  ) {
    return "requiereRevisionManual debe ser booleano.";
  }

  return null;
};

export const validarFiltrosAbono = (filtros: DatosEntrada) => {
  if (
    valor(filtros, "idCliente") !== undefined &&
    !esEnteroPositivo(valor(filtros, "idCliente"))
  ) {
    return "El cliente debe ser valido.";
  }

  if (
    valor(filtros, "idPedido") !== undefined &&
    !esEnteroPositivo(valor(filtros, "idPedido"))
  ) {
    return "El pedido debe ser valido.";
  }

  if (
    valor(filtros, "estado") !== undefined &&
    !esEstadoAbonoPermitido(valor(filtros, "estado"))
  ) {
    return "El estado del abono no es valido.";
  }

  if (
    valor(filtros, "metodoPago") !== undefined &&
    !esMetodoPagoPermitido(valor(filtros, "metodoPago"))
  ) {
    return "Método de pago no válido. Solo se permite EFECTIVO o TRANSFERENCIA.";
  }

  if (!esFechaOpcionalValida(valor(filtros, "desde"))) {
    return "La fecha desde no es valida.";
  }

  if (!esFechaOpcionalValida(valor(filtros, "hasta"))) {
    return "La fecha hasta no es valida.";
  }

  return null;
};
