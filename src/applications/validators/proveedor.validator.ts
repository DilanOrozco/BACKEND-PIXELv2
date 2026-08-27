type DatosEntrada = Record<string, unknown> | undefined;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

const esTextoOpcional = (valorEntrada: unknown, maximo: number) => {
  return (
    valorEntrada === undefined ||
    valorEntrada === null ||
    (typeof valorEntrada === "string" && valorEntrada.length <= maximo)
  );
};

const esNombreValido = (valorEntrada: unknown) => {
  return (
    typeof valorEntrada === "string" &&
    valorEntrada.trim().length >= 2 &&
    valorEntrada.trim().length <= 100
  );
};

const esCorreoOpcional = (valorEntrada: unknown) => {
  return (
    valorEntrada === undefined ||
    valorEntrada === null ||
    valorEntrada === "" ||
    (typeof valorEntrada === "string" &&
      valorEntrada.length <= 100 &&
      EMAIL_REGEX.test(valorEntrada.trim()))
  );
};

const esBooleanoOpcional = (valorEntrada: unknown) => {
  return valorEntrada === undefined || typeof valorEntrada === "boolean";
};

const validarCamposProveedor = (data: DatosEntrada, requiereNombre: boolean) => {
  if (requiereNombre && !esNombreValido(valor(data, "nombre"))) {
    return "El nombre del proveedor es obligatorio y debe tener entre 2 y 100 caracteres.";
  }

  if (
    !requiereNombre &&
    valor(data, "nombre") !== undefined &&
    !esNombreValido(valor(data, "nombre"))
  ) {
    return "El nombre del proveedor debe tener entre 2 y 100 caracteres.";
  }

  if (!esTextoOpcional(valor(data, "telefono"), 20)) {
    return "El telefono debe ser texto de maximo 20 caracteres, null u omitirse.";
  }

  if (!esCorreoOpcional(valor(data, "correo"))) {
    return "El correo del proveedor no es valido.";
  }

  if (!esTextoOpcional(valor(data, "direccion"), 150)) {
    return "La direccion debe ser texto de maximo 150 caracteres, null u omitirse.";
  }

  if (!esBooleanoOpcional(valor(data, "estado"))) {
    return "El estado debe ser booleano.";
  }

  return null;
};

export const validarCrearProveedor = (data: DatosEntrada) => {
  const errorCampos = validarCamposPermitidos(data, [
    "nombre",
    "telefono",
    "correo",
    "direccion",
  ]);

  if (errorCampos) {
    return errorCampos;
  }

  return validarCamposProveedor(data, true);
};

export const validarActualizarProveedor = (data: DatosEntrada) => {
  const errorCampos = validarCamposPermitidos(data, [
    "nombre",
    "telefono",
    "correo",
    "direccion",
    "estado",
  ]);

  if (errorCampos) {
    return errorCampos;
  }

  if (Object.keys(data ?? {}).length === 0) {
    return "Debe enviar al menos un campo para actualizar el proveedor.";
  }

  return validarCamposProveedor(data, false);
};

export const validarFiltrosProveedor = (filtros: DatosEntrada) => {
  const estado = valor(filtros, "estado");

  if (
    estado !== undefined &&
    estado !== "true" &&
    estado !== "false" &&
    typeof estado !== "boolean"
  ) {
    return "El filtro estado debe ser true o false.";
  }

  return null;
};
