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

const esTextoOpcional = (valorEntrada: unknown, maximo: number) =>
  valorEntrada === undefined ||
  valorEntrada === null ||
  (typeof valorEntrada === "string" && valorEntrada.length <= maximo);

const esNombreValido = (valorEntrada: unknown) =>
  typeof valorEntrada === "string" &&
  valorEntrada.trim().length >= 2 &&
  valorEntrada.trim().length <= 150;

const esMontoPositivo = (valorEntrada: unknown) => {
  const numero = Number(valorEntrada);
  return Number.isFinite(numero) && numero > 0;
};

const esBooleanoOpcional = (valorEntrada: unknown) =>
  valorEntrada === undefined || typeof valorEntrada === "boolean";

const esEnteroPositivo = (valorEntrada: unknown) => {
  const numero = Number(valorEntrada);
  return Number.isInteger(numero) && numero > 0;
};

const esDescuentoValido = (valorEntrada: unknown) => {
  const numero = Number(valorEntrada);
  return Number.isFinite(numero) && numero >= 0 && numero <= 100;
};

export const validarCrearProducto = (data: DatosEntrada) => {
  const errorCampos = validarCamposPermitidos(data, [
    "nombre",
    "descripcion",
    "precioBase",
    "estado",
  ]);

  if (errorCampos) return errorCampos;

  if (!esNombreValido(valor(data, "nombre"))) {
    return "El nombre del producto es obligatorio y debe tener entre 2 y 150 caracteres.";
  }

  if (!esTextoOpcional(valor(data, "descripcion"), 255)) {
    return "La descripcion debe ser texto de maximo 255 caracteres, null u omitirse.";
  }

  if (!esMontoPositivo(valor(data, "precioBase"))) {
    return "El precio base debe ser mayor a 0.";
  }

  if (!esBooleanoOpcional(valor(data, "estado"))) {
    return "El estado debe ser booleano.";
  }

  return null;
};

export const validarActualizarProducto = (data: DatosEntrada) => {
  const errorCampos = validarCamposPermitidos(data, [
    "nombre",
    "descripcion",
    "precioBase",
    "estado",
  ]);

  if (errorCampos) return errorCampos;

  if (Object.keys(data ?? {}).length === 0) {
    return "Debe enviar al menos un campo para actualizar el producto.";
  }

  if (valor(data, "nombre") !== undefined && !esNombreValido(valor(data, "nombre"))) {
    return "El nombre del producto debe tener entre 2 y 150 caracteres.";
  }

  if (!esTextoOpcional(valor(data, "descripcion"), 255)) {
    return "La descripcion debe ser texto de maximo 255 caracteres, null u omitirse.";
  }

  if (valor(data, "precioBase") !== undefined && !esMontoPositivo(valor(data, "precioBase"))) {
    return "El precio base debe ser mayor a 0.";
  }

  if (!esBooleanoOpcional(valor(data, "estado"))) {
    return "El estado debe ser booleano.";
  }

  return null;
};

export const validarRangosProducto = (data: DatosEntrada) => {
  if (!Array.isArray(valor(data, "rangos"))) {
    return "Los rangos deben enviarse como un arreglo.";
  }

  const cantidades = new Set<number>();

  for (const rango of valor(data, "rangos") as any[]) {
    if (!esEnteroPositivo(rango?.cantidadMin)) {
      return "La cantidad minima debe ser mayor a 0.";
    }

    const cantidadMin = Number(rango.cantidadMin);

    if (cantidades.has(cantidadMin)) {
      return "No se pueden repetir cantidades minimas para el mismo producto.";
    }

    cantidades.add(cantidadMin);

    if (!esDescuentoValido(rango?.descuentoPorcentaje)) {
      return "El descuento debe estar entre 0 y 100.";
    }

    if (!esBooleanoOpcional(rango?.estado)) {
      return "El estado del rango debe ser booleano.";
    }
  }

  return null;
};
