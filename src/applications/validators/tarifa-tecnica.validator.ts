const numeroPositivo = (valor: unknown, maximo = Number.MAX_SAFE_INTEGER) => {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 && numero <= maximo;
};

const enteroPositivo = (valor: unknown) => {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0;
};

const booleanoOpcional = (valor: unknown) =>
  valor === undefined || typeof valor === "boolean";

export const validarCrearTarifaTecnica = (data: any) => {
  if (!enteroPositivo(data?.idTecnica)) {
    return "La tecnica es obligatoria y debe ser valida.";
  }
  if (!booleanoOpcional(data?.esGeneral)) {
    return "esGeneral debe ser booleano.";
  }
  if (data?.esGeneral === true) {
    if (
      (data.anchoHastaCm !== undefined && data.anchoHastaCm !== null) ||
      (data.altoHastaCm !== undefined && data.altoHastaCm !== null)
    ) {
      return "Una tarifa general no debe incluir ancho ni alto.";
    }
  } else {
    if (!numeroPositivo(data?.anchoHastaCm, 500)) {
      return "El ancho de la tarifa debe ser mayor a 0 y maximo 500 cm.";
    }
    if (!numeroPositivo(data?.altoHastaCm, 500)) {
      return "El alto de la tarifa debe ser mayor a 0 y maximo 500 cm.";
    }
  }
  if (!numeroPositivo(data?.precioUnitario, 9999999999)) {
    return "El precio unitario debe ser mayor a 0.";
  }
  if (!booleanoOpcional(data?.estado)) {
    return "El estado debe ser booleano.";
  }
  return null;
};

export const validarActualizarTarifaTecnica = (data: any) => {
  if (!data || Object.keys(data).length === 0) {
    return "Debe enviar al menos un campo para actualizar.";
  }

  const permitidos = [
    "anchoHastaCm",
    "altoHastaCm",
    "esGeneral",
    "precioUnitario",
    "estado",
  ];
  const noPermitido = Object.keys(data).find(
    (campo) => !permitidos.includes(campo),
  );

  if (noPermitido) {
    return `El campo ${noPermitido} no se puede modificar.`;
  }
  if (!booleanoOpcional(data.esGeneral)) {
    return "esGeneral debe ser booleano.";
  }
  if (
    data.esGeneral === true &&
    ((data.anchoHastaCm !== undefined && data.anchoHastaCm !== null) ||
      (data.altoHastaCm !== undefined && data.altoHastaCm !== null))
  ) {
    return "Una tarifa general no debe incluir ancho ni alto.";
  }
  if (
    data.anchoHastaCm !== undefined &&
    data.anchoHastaCm !== null &&
    !numeroPositivo(data.anchoHastaCm, 500)
  ) {
    return "El ancho de la tarifa debe ser mayor a 0 y maximo 500 cm.";
  }
  if (
    data.altoHastaCm !== undefined &&
    data.altoHastaCm !== null &&
    !numeroPositivo(data.altoHastaCm, 500)
  ) {
    return "El alto de la tarifa debe ser mayor a 0 y maximo 500 cm.";
  }
  if (
    data.precioUnitario !== undefined &&
    !numeroPositivo(data.precioUnitario, 9999999999)
  ) {
    return "El precio unitario debe ser mayor a 0.";
  }
  if (!booleanoOpcional(data.estado)) {
    return "El estado debe ser booleano.";
  }
  return null;
};

export const validarDescuentosTecnica = (data: any) => {
  if (!Array.isArray(data?.descuentos)) {
    return "Los descuentos deben enviarse como un arreglo.";
  }

  const cantidades = new Set<number>();

  for (const descuento of data.descuentos) {
    if (!enteroPositivo(descuento?.cantidadMinima)) {
      return "La cantidad minima debe ser un entero mayor a 0.";
    }

    const cantidad = Number(descuento.cantidadMinima);
    if (cantidades.has(cantidad)) {
      return "No se pueden repetir cantidades minimas para una tecnica.";
    }
    cantidades.add(cantidad);

    const porcentaje = Number(descuento?.porcentaje);
    if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) {
      return "El porcentaje debe estar entre 0 y 100.";
    }
    if (!booleanoOpcional(descuento?.estado)) {
      return "El estado del descuento debe ser booleano.";
    }
  }

  return null;
};
