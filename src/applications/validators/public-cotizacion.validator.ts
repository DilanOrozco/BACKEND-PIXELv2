type DatosEntrada = Record<string, unknown> | undefined;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const valor = (data: DatosEntrada, campo: string) => data?.[campo];

const esTextoOpcional = (valorEntrada: unknown, maximo: number) =>
  valorEntrada === undefined ||
  valorEntrada === null ||
  valorEntrada === "" ||
  (typeof valorEntrada === "string" && valorEntrada.length <= maximo);

const esTextoRequerido = (valorEntrada: unknown, maximo: number) =>
  typeof valorEntrada === "string" &&
  valorEntrada.trim().length > 0 &&
  valorEntrada.trim().length <= maximo;

const esCorreoOpcional = (valorEntrada: unknown) =>
  valorEntrada === undefined ||
  valorEntrada === null ||
  valorEntrada === "" ||
  (typeof valorEntrada === "string" &&
    valorEntrada.length <= 100 &&
    EMAIL_REGEX.test(valorEntrada.trim()));

const esEnteroPositivo = (valorEntrada: unknown) => {
  const numero = Number(valorEntrada);
  return Number.isInteger(numero) && numero > 0;
};

const validarItems = (
  items: unknown,
  permiteObservaciones = false,
  requiereTecnica = false,
) => {
  if (!Array.isArray(items) || items.length === 0) {
    return "Debe enviar al menos un producto para cotizar.";
  }

  for (const item of items as any[]) {
    if (!esEnteroPositivo(item?.idProducto)) {
      return "Cada item debe incluir un producto valido.";
    }

    if (!esEnteroPositivo(item?.cantidad)) {
      return "La cantidad debe ser mayor a 0.";
    }

    if (requiereTecnica && !esEnteroPositivo(item?.idTecnica)) {
      return "La tecnica es obligatoria para cotizar.";
    }

    if (
      permiteObservaciones &&
      !esTextoOpcional(item?.observaciones, 255)
    ) {
      return "Las observaciones del item deben ser texto de maximo 255 caracteres, null u omitirse.";
    }

    if (
      item?.requiereDiseno !== undefined &&
      typeof item.requiereDiseno !== "boolean"
    ) {
      return "requiereDiseno debe ser booleano.";
    }

    if (
      item?.origenDiseno !== undefined &&
      !["CLIENTE", "PIXEL"].includes(String(item.origenDiseno).toUpperCase())
    ) {
      return "origenDiseno debe ser CLIENTE o PIXEL.";
    }

    if (
      item?.esDisenoGeneral !== undefined &&
      typeof item.esDisenoGeneral !== "boolean"
    ) {
      return "esDisenoGeneral debe ser booleano.";
    }

    if (!esTextoOpcional(item?.archivoDisenoInicialUrl, 500)) {
      return "El archivo inicial de diseno debe ser texto de maximo 500 caracteres.";
    }
  }

  return null;
};

export const validarCalcularCotizacionPublica = (data: DatosEntrada) => {
  return validarItems(valor(data, "items"));
};

export const validarCrearCotizacionPublica = (data: DatosEntrada) => {
  const cliente = valor(data, "cliente") as DatosEntrada;

  if (!cliente || typeof cliente !== "object" || Array.isArray(cliente)) {
    return "Los datos del cliente son obligatorios.";
  }

  if (!esTextoRequerido(valor(cliente, "nombre"), 100)) {
    return "El nombre del cliente es obligatorio.";
  }

  if (!esCorreoOpcional(valor(cliente, "correo"))) {
    return "El correo del cliente no es valido.";
  }

  if (!esTextoOpcional(valor(cliente, "telefono"), 20)) {
    return "El telefono debe ser texto de maximo 20 caracteres, null u omitirse.";
  }

  if (!esTextoOpcional(valor(cliente, "documento"), 30)) {
    return "El documento debe ser texto de maximo 30 caracteres, null u omitirse.";
  }

  if (!esTextoOpcional(valor(cliente, "direccion"), 150)) {
    return "La direccion debe ser texto de maximo 150 caracteres, null u omitirse.";
  }

  if (!valor(cliente, "correo") && !valor(cliente, "telefono")) {
    return "Debe enviar correo o telefono para contactar al cliente.";
  }

  const errorItems = validarItems(valor(data, "items"), true, true);

  if (errorItems) {
    return errorItems;
  }

  if (!esTextoOpcional(valor(data, "observaciones"), 255)) {
    return "Las observaciones deben ser texto de maximo 255 caracteres, null u omitirse.";
  }

  return null;
};
