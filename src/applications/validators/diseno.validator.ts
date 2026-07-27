const ESTADOS_DISENO = ["PENDIENTE", "ENVIADO", "APROBADO", "RECHAZADO"] as const;
const MEDIOS_RESPUESTA_CLIENTE = [
  "SISTEMA",
  "WHATSAPP",
  "CORREO",
  "LLAMADA",
  "PRESENCIAL",
  "OTRO",
] as const;
const ORIGENES_DISENO = ["DISENADOR", "CLIENTE", "ADMIN", "OTRO"] as const;
const MEDIOS_RECEPCION = ["WHATSAPP", "CORREO", "PRESENCIAL", "OTRO"] as const;

type DatosEntrada = Record<string, unknown> | undefined;

export type EstadoDisenoPermitido = (typeof ESTADOS_DISENO)[number];
export type MedioRespuestaClientePermitido =
  (typeof MEDIOS_RESPUESTA_CLIENTE)[number];
export type OrigenDisenoPermitido = (typeof ORIGENES_DISENO)[number];

const valor = (data: DatosEntrada, campo: string) => data?.[campo];

export const esEnteroPositivo = (valorEntrada: unknown) => {
  const numero = Number(valorEntrada);
  return Number.isInteger(numero) && numero > 0;
};

const normalizarMayuscula = (valorEntrada: unknown) =>
  typeof valorEntrada === "string" ? valorEntrada.trim().toUpperCase() : "";

const esEstadoDisenoPermitido = (
  valorEntrada: unknown,
): valorEntrada is EstadoDisenoPermitido => {
  return ESTADOS_DISENO.includes(valorEntrada as EstadoDisenoPermitido);
};

const esMedioRespuestaClientePermitido = (
  valorEntrada: unknown,
): valorEntrada is MedioRespuestaClientePermitido => {
  return MEDIOS_RESPUESTA_CLIENTE.includes(
    valorEntrada as MedioRespuestaClientePermitido,
  );
};

const esOrigenDisenoPermitido = (
  valorEntrada: unknown,
): valorEntrada is OrigenDisenoPermitido => {
  return ORIGENES_DISENO.includes(valorEntrada as OrigenDisenoPermitido);
};

const esMedioRecepcionPermitido = (valorEntrada: unknown) => {
  return MEDIOS_RECEPCION.includes(
    valorEntrada as (typeof MEDIOS_RECEPCION)[number],
  );
};

const esTextoOpcional = (valorEntrada: unknown, maximo: number) => {
  return (
    valorEntrada === undefined ||
    valorEntrada === null ||
    (typeof valorEntrada === "string" && valorEntrada.length <= maximo)
  );
};

const textoNoVacio = (valorEntrada: unknown) =>
  typeof valorEntrada === "string" && valorEntrada.trim() !== "";

export const validarUrlDisenoCliente = (data: DatosEntrada) => {
  const errorCampos = validarCamposPermitidos(data, [
    "archivoDisenoInicialUrl",
  ]);

  if (errorCampos) {
    return errorCampos;
  }

  const archivoUrl = valor(data, "archivoDisenoInicialUrl");

  if (!textoNoVacio(archivoUrl) || String(archivoUrl).trim().length > 500) {
    return "La URL del diseno es obligatoria y debe tener maximo 500 caracteres.";
  }

  try {
    const url = new URL(String(archivoUrl).trim());

    if (!["http:", "https:"].includes(url.protocol)) {
      return "La URL del diseno debe usar http o https.";
    }
  } catch {
    return "La URL del diseno no es valida.";
  }

  return null;
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

export const validarCrearDiseno = (
  data: DatosEntrada,
  rolUsuario: string | undefined,
) => {
  const errorCampos = validarCamposPermitidos(data, [
    "idPedido",
    "idDetallePedido",
    "esDisenoGeneral",
    "idDisenador",
    "archivoUrl",
    "descripcion",
    "observaciones",
    "origenDiseno",
    "medioRecepcion",
    "observacionesCliente",
    "estado",
  ]);

  if (errorCampos) {
    return errorCampos;
  }

  if (!esEnteroPositivo(valor(data, "idPedido"))) {
    return "El pedido es obligatorio y debe ser valido.";
  }

  if (
    valor(data, "idDetallePedido") !== undefined &&
    valor(data, "idDetallePedido") !== null &&
    !esEnteroPositivo(valor(data, "idDetallePedido"))
  ) {
    return "El detalle del pedido debe ser valido.";
  }

  if (
    valor(data, "esDisenoGeneral") !== undefined &&
    typeof valor(data, "esDisenoGeneral") !== "boolean"
  ) {
    return "esDisenoGeneral debe ser booleano.";
  }

  if (
    esEnteroPositivo(valor(data, "idDetallePedido")) &&
    valor(data, "esDisenoGeneral") === true
  ) {
    return "No puedes asociar un diseno a un detalle y marcarlo como general al mismo tiempo.";
  }

  if (
    valor(data, "idDisenador") !== undefined &&
    !esEnteroPositivo(valor(data, "idDisenador"))
  ) {
    return "El disenador debe ser valido.";
  }

  if (
    valor(data, "idDisenador") !== undefined &&
    ["Disenador", "Diseñador", "DiseÃ±ador"].includes(String(rolUsuario))
  ) {
    return "Solo Admin o Secretaria pueden asignar un disenador.";
  }

  const origen = normalizarMayuscula(valor(data, "origenDiseno") ?? "DISENADOR");

  if (!esOrigenDisenoPermitido(origen)) {
    return "El origen del diseno no es valido.";
  }

  const estado = normalizarMayuscula(valor(data, "estado"));

  if (
    valor(data, "estado") !== undefined &&
    !["PENDIENTE", "ENVIADO", "APROBADO"].includes(estado)
  ) {
    return "El estado inicial del diseno no es valido.";
  }

  const medioRecepcion = normalizarMayuscula(valor(data, "medioRecepcion"));

  if (
    valor(data, "medioRecepcion") !== undefined &&
    !esMedioRecepcionPermitido(medioRecepcion)
  ) {
    return "El medio de recepcion del diseno no es valido.";
  }

  if (!esTextoOpcional(valor(data, "archivoUrl"), 500)) {
    return "El archivo del diseno debe ser texto de maximo 500 caracteres, null u omitirse.";
  }

  if (!esTextoOpcional(valor(data, "descripcion"), 500)) {
    return "La descripcion debe ser texto de maximo 500 caracteres, null u omitirse.";
  }

  if (!esTextoOpcional(valor(data, "observaciones"), 500)) {
    return "Las observaciones deben ser texto de maximo 500 caracteres, null u omitirse.";
  }

  if (!esTextoOpcional(valor(data, "observacionesCliente"), 500)) {
    return "Las observaciones del cliente deben ser texto de maximo 500 caracteres, null u omitirse.";
  }

  const descripcion = valor(data, "descripcion");

  if (
    origen === "CLIENTE" &&
    !textoNoVacio(valor(data, "archivoUrl")) &&
    !(typeof descripcion === "string" && descripcion.trim().length >= 5)
  ) {
    return "El diseno enviado por el cliente debe incluir archivo/link o una descripcion suficiente.";
  }

  return null;
};

export const validarActualizarDiseno = (data: DatosEntrada) => {
  const errorCampos = validarCamposPermitidos(data, [
    "archivoUrl",
    "descripcion",
    "observaciones",
    "origenDiseno",
    "medioRecepcion",
    "observacionesCliente",
  ]);

  if (errorCampos) {
    return errorCampos;
  }

  const campos = Object.keys(data ?? {});

  if (campos.length === 0) {
    return "Debe enviar al menos un campo para actualizar el diseno.";
  }

  if (!esTextoOpcional(valor(data, "archivoUrl"), 500)) {
    return "El archivo del diseno debe ser texto de maximo 500 caracteres, null u omitirse.";
  }

  if (!esTextoOpcional(valor(data, "descripcion"), 500)) {
    return "La descripcion debe ser texto de maximo 500 caracteres, null u omitirse.";
  }

  if (!esTextoOpcional(valor(data, "observaciones"), 500)) {
    return "Las observaciones deben ser texto de maximo 500 caracteres, null u omitirse.";
  }

  if (!esTextoOpcional(valor(data, "observacionesCliente"), 500)) {
    return "Las observaciones del cliente deben ser texto de maximo 500 caracteres, null u omitirse.";
  }

  const origen = normalizarMayuscula(valor(data, "origenDiseno"));

  if (
    valor(data, "origenDiseno") !== undefined &&
    !esOrigenDisenoPermitido(origen)
  ) {
    return "El origen del diseno no es valido.";
  }

  const medioRecepcion = normalizarMayuscula(valor(data, "medioRecepcion"));

  if (
    valor(data, "medioRecepcion") !== undefined &&
    !esMedioRecepcionPermitido(medioRecepcion)
  ) {
    return "El medio de recepcion del diseno no es valido.";
  }

  return null;
};

export const validarAprobarDiseno = (data: DatosEntrada) => {
  const errorCampos = validarCamposPermitidos(data, [
    "medioAprobacion",
    "medioRespuesta",
    "observaciones",
    "observacionesCliente",
  ]);

  if (errorCampos) {
    return errorCampos;
  }

  if (!esTextoOpcional(valor(data, "observaciones"), 500)) {
    return "Las observaciones deben ser texto de maximo 500 caracteres, null u omitirse.";
  }

  if (!esTextoOpcional(valor(data, "observacionesCliente"), 500)) {
    return "Las observaciones del cliente deben ser texto de maximo 500 caracteres, null u omitirse.";
  }

  const medio = normalizarMayuscula(
    valor(data, "medioAprobacion") ?? valor(data, "medioRespuesta"),
  );

  if (
    (valor(data, "medioAprobacion") !== undefined ||
      valor(data, "medioRespuesta") !== undefined) &&
    !esMedioRespuestaClientePermitido(medio)
  ) {
    return "El medio de respuesta del cliente no es valido.";
  }

  return null;
};

export const validarRechazarDiseno = (data: DatosEntrada) => {
  const errorCampos = validarCamposPermitidos(data, [
    "medioRespuesta",
    "observaciones",
    "observacionesCliente",
  ]);

  if (errorCampos) {
    return errorCampos;
  }

  if (!esTextoOpcional(valor(data, "observaciones"), 500)) {
    return "Las observaciones deben ser texto de maximo 500 caracteres, null u omitirse.";
  }

  if (!esTextoOpcional(valor(data, "observacionesCliente"), 500)) {
    return "Las observaciones del cliente deben ser texto de maximo 500 caracteres, null u omitirse.";
  }

  const medio = normalizarMayuscula(valor(data, "medioRespuesta"));

  if (
    valor(data, "medioRespuesta") !== undefined &&
    !esMedioRespuestaClientePermitido(medio)
  ) {
    return "El medio de respuesta del cliente no es valido.";
  }

  return null;
};

export const validarFiltrosDiseno = (filtros: DatosEntrada) => {
  if (
    valor(filtros, "idPedido") !== undefined &&
    !esEnteroPositivo(valor(filtros, "idPedido"))
  ) {
    return "El pedido debe ser valido.";
  }

  if (
    valor(filtros, "idDisenador") !== undefined &&
    !esEnteroPositivo(valor(filtros, "idDisenador"))
  ) {
    return "El disenador debe ser valido.";
  }

  if (
    valor(filtros, "estado") !== undefined &&
    !esEstadoDisenoPermitido(valor(filtros, "estado"))
  ) {
    return "El estado del diseno no es valido.";
  }

  return null;
};
