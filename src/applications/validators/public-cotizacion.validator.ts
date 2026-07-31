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
  if (items.length > 50) {
    return "Una solicitud puede incluir maximo 50 productos.";
  }

  for (const item of items as any[]) {
    const tipoProducto = String(
      item?.tipoProducto ??
        item?.tipo ??
        (item?.idProducto ? "CATALOGO" : "OTRO"),
    ).toUpperCase();

    if (!["CATALOGO", "OTRO"].includes(tipoProducto)) {
      return "El tipo de producto debe ser CATALOGO u OTRO.";
    }

    if (
      tipoProducto === "CATALOGO" &&
      !esEnteroPositivo(item?.idProducto)
    ) {
      return "Cada producto de catalogo debe incluir un idProducto valido.";
    }

    if (
      tipoProducto === "OTRO" &&
      !esTextoRequerido(
        item?.nombrePersonalizado ?? item?.nombreProducto ?? item?.nombre,
        150,
      )
    ) {
      return "Un producto OTRO debe incluir un nombre personalizado.";
    }

    if (!esEnteroPositivo(item?.cantidad)) {
      return "La cantidad debe ser mayor a 0.";
    }

    if (
      item?.suministradoPor !== undefined &&
      !["PIXEL", "CLIENTE"].includes(
        String(item.suministradoPor).toUpperCase(),
      )
    ) {
      return "suministradoPor debe ser PIXEL o CLIENTE.";
    }

    if (
      !esTextoOpcional(
        item?.descripcionPersonalizada ?? item?.descripcion,
        500,
      )
    ) {
      return "La descripcion personalizada debe tener maximo 500 caracteres.";
    }
    if (!esTextoOpcional(item?.materialReferencia, 255)) {
      return "El material o referencia debe tener maximo 255 caracteres.";
    }
    if (!esTextoOpcional(item?.imagenReferencia, 255)) {
      return "La imagen de referencia debe tener maximo 255 caracteres.";
    }

    const estampados = Array.isArray(item?.estampados)
      ? item.estampados
      : item?.idTecnica
        ? [item]
        : [];
    if (estampados.length > 20) {
      return "Cada producto puede incluir maximo 20 estampados.";
    }

    if (requiereTecnica && estampados.length === 0) {
      return "Cada producto debe incluir al menos un servicio o estampado.";
    }

    for (const estampado of estampados) {
      if (
        estampado?.idTecnica !== undefined &&
        estampado?.idTecnica !== null &&
        !esEnteroPositivo(estampado.idTecnica)
      ) {
        return "La tecnica del estampado debe ser valida cuando se envia.";
      }

      if (
        estampado.anchoCm !== undefined &&
        estampado.anchoCm !== null &&
        (!Number.isFinite(Number(estampado.anchoCm)) ||
          Number(estampado.anchoCm) <= 0 ||
          Number(estampado.anchoCm) > 500)
      ) {
        return "El ancho del estampado debe ser mayor a 0 y maximo 500 cm.";
      }

      if (
        estampado.altoCm !== undefined &&
        estampado.altoCm !== null &&
        (!Number.isFinite(Number(estampado.altoCm)) ||
          Number(estampado.altoCm) <= 0 ||
          Number(estampado.altoCm) > 500)
      ) {
        return "El alto del estampado debe ser mayor a 0 y maximo 500 cm.";
      }

      if (
        (estampado.anchoCm === undefined) !==
        (estampado.altoCm === undefined)
      ) {
        return "Debe enviar ancho y alto juntos.";
      }

      if (
        estampado.origenDiseno !== undefined &&
        ![
          "CLIENTE",
          "PIXEL",
          "PENDIENTE_DEFINIR",
          "NO_REQUIERE",
        ].includes(String(estampado.origenDiseno).toUpperCase())
      ) {
        return "El origen del diseno no es valido.";
      }
      if (!esTextoOpcional(estampado.ubicacion, 100)) {
        return "La ubicacion del estampado debe tener maximo 100 caracteres.";
      }
      if (!esTextoOpcional(estampado.descripcion, 500)) {
        return "La descripcion del estampado debe tener maximo 500 caracteres.";
      }
      if (!esTextoOpcional(estampado.observaciones, 500)) {
        return "Las observaciones del estampado deben tener maximo 500 caracteres.";
      }
      if (!esTextoOpcional(estampado.grupoDisenoCompartido, 100)) {
        return "El grupo de diseno compartido debe tener maximo 100 caracteres.";
      }
      if (estampado.costoDisenoSugerido !== undefined) {
        return "La solicitud no puede enviar costos internos de diseno.";
      }
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
      ![
        "CLIENTE",
        "PIXEL",
        "PENDIENTE_DEFINIR",
        "NO_REQUIERE",
      ].includes(String(item.origenDiseno).toUpperCase())
    ) {
      return "El origen del diseno no es valido.";
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

    const camposPrecio = [
      "precioBase",
      "precioUnitario",
      "subtotal",
      "subtotalBruto",
      "descuentoTotal",
      "total",
      "precioSugeridoInterno",
      "costoDisenoSugerido",
    ];

    if (camposPrecio.some((campo) => item?.[campo] !== undefined)) {
      return "El cliente no puede enviar precios ni costos internos.";
    }
  }

  return null;
};

export const validarCalcularCotizacionPublica = (data: DatosEntrada) => {
  return validarItems(valor(data, "items"), true, false);
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

  const errorItems = validarItems(valor(data, "items"), true, false);

  if (errorItems) {
    return errorItems;
  }

  if (!esTextoOpcional(valor(data, "observaciones"), 255)) {
    return "Las observaciones deben ser texto de maximo 255 caracteres, null u omitirse.";
  }

  return null;
};
