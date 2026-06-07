const ESTADOS_DISENO = ["PENDIENTE", "ENVIADO", "APROBADO"] as const;

type DatosEntrada = Record<string, unknown> | undefined;

export type EstadoDisenoPermitido = (typeof ESTADOS_DISENO)[number];

const valor = (data: DatosEntrada, campo: string) => data?.[campo];

export const esEnteroPositivo = (valorEntrada: unknown) => {
  const numero = Number(valorEntrada);
  return Number.isInteger(numero) && numero > 0;
};

const esEstadoDisenoPermitido = (
  valorEntrada: unknown,
): valorEntrada is EstadoDisenoPermitido => {
  return ESTADOS_DISENO.includes(valorEntrada as EstadoDisenoPermitido);
};

const esTextoOpcional = (valorEntrada: unknown, maximo: number) => {
  return (
    valorEntrada === undefined ||
    valorEntrada === null ||
    (typeof valorEntrada === "string" && valorEntrada.length <= maximo)
  );
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
    "idDisenador",
    "archivoUrl",
    "descripcion",
    "observaciones",
  ]);

  if (errorCampos) {
    return errorCampos;
  }

  if (!esEnteroPositivo(valor(data, "idPedido"))) {
    return "El pedido es obligatorio y debe ser valido.";
  }

  if (
    valor(data, "idDisenador") !== undefined &&
    !esEnteroPositivo(valor(data, "idDisenador"))
  ) {
    return "El diseñador debe ser valido.";
  }

  if (valor(data, "idDisenador") !== undefined && rolUsuario === "Diseñador") {
    return "Solo Admin o Secretaria pueden asignar un diseñador.";
  }

  if (!esTextoOpcional(valor(data, "archivoUrl"), 500)) {
    return "El archivo del diseño debe ser texto de maximo 500 caracteres, null u omitirse.";
  }

  if (!esTextoOpcional(valor(data, "descripcion"), 500)) {
    return "La descripcion debe ser texto de maximo 500 caracteres, null u omitirse.";
  }

  if (!esTextoOpcional(valor(data, "observaciones"), 500)) {
    return "Las observaciones deben ser texto de maximo 500 caracteres, null u omitirse.";
  }

  return null;
};

export const validarActualizarDiseno = (data: DatosEntrada) => {
  const errorCampos = validarCamposPermitidos(data, [
    "archivoUrl",
    "descripcion",
    "observaciones",
  ]);

  if (errorCampos) {
    return errorCampos;
  }

  const campos = Object.keys(data ?? {});

  if (campos.length === 0) {
    return "Debe enviar al menos un campo para actualizar el diseño.";
  }

  if (!esTextoOpcional(valor(data, "archivoUrl"), 500)) {
    return "El archivo del diseño debe ser texto de maximo 500 caracteres, null u omitirse.";
  }

  if (!esTextoOpcional(valor(data, "descripcion"), 500)) {
    return "La descripcion debe ser texto de maximo 500 caracteres, null u omitirse.";
  }

  if (!esTextoOpcional(valor(data, "observaciones"), 500)) {
    return "Las observaciones deben ser texto de maximo 500 caracteres, null u omitirse.";
  }

  return null;
};

export const validarAprobarDiseno = (data: DatosEntrada) => {
  const errorCampos = validarCamposPermitidos(data, ["observaciones"]);

  if (errorCampos) {
    return errorCampos;
  }

  if (!esTextoOpcional(valor(data, "observaciones"), 500)) {
    return "Las observaciones deben ser texto de maximo 500 caracteres, null u omitirse.";
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
    return "El diseñador debe ser valido.";
  }

  if (
    valor(filtros, "estado") !== undefined &&
    !esEstadoDisenoPermitido(valor(filtros, "estado"))
  ) {
    return "El estado del diseño no es valido.";
  }

  return null;
};
