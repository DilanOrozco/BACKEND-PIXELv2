type DatosEntrada = Record<string, unknown> | undefined;

const valor = (data: DatosEntrada, campo: string) => data?.[campo];

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

const esNombreValido = (valorEntrada: unknown) =>
  typeof valorEntrada === "string" &&
  valorEntrada.trim().length >= 2 &&
  valorEntrada.trim().length <= 100;

const esTextoOpcional = (valorEntrada: unknown, maximo: number) =>
  valorEntrada === undefined ||
  valorEntrada === null ||
  (typeof valorEntrada === "string" && valorEntrada.length <= maximo);

const esBooleanoOpcional = (valorEntrada: unknown) =>
  valorEntrada === undefined || typeof valorEntrada === "boolean";

export const validarCrearCategoriaProducto = (data: DatosEntrada) => {
  const errorCampos = validarCamposPermitidos(data, [
    "nombre",
    "descripcion",
    "estado",
  ]);

  if (errorCampos) return errorCampos;

  if (!esNombreValido(valor(data, "nombre"))) {
    return "El nombre de la categoria es obligatorio y debe tener entre 2 y 100 caracteres.";
  }

  if (!esTextoOpcional(valor(data, "descripcion"), 255)) {
    return "La descripcion debe ser texto de maximo 255 caracteres, null u omitirse.";
  }

  if (!esBooleanoOpcional(valor(data, "estado"))) {
    return "El estado debe ser booleano.";
  }

  return null;
};

export const validarActualizarCategoriaProducto = (data: DatosEntrada) => {
  const errorCampos = validarCamposPermitidos(data, [
    "nombre",
    "descripcion",
    "estado",
  ]);

  if (errorCampos) return errorCampos;

  if (Object.keys(data ?? {}).length === 0) {
    return "Debe enviar al menos un campo para actualizar la categoria.";
  }

  if (valor(data, "nombre") !== undefined && !esNombreValido(valor(data, "nombre"))) {
    return "El nombre de la categoria debe tener entre 2 y 100 caracteres.";
  }

  if (!esTextoOpcional(valor(data, "descripcion"), 255)) {
    return "La descripcion debe ser texto de maximo 255 caracteres, null u omitirse.";
  }

  if (!esBooleanoOpcional(valor(data, "estado"))) {
    return "El estado debe ser booleano.";
  }

  return null;
};
