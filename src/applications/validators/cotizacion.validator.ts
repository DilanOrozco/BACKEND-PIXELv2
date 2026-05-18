export const validarCrearCotizacion = (data: any) => {
  if (!data.idCliente) {
    return "El cliente es obligatorio.";
  }

  if (
    !data.detalles ||
    !Array.isArray(data.detalles) ||
    data.detalles.length === 0
  ) {
    return "La cotización debe tener al menos un detalle.";
  }

  for (const detalle of data.detalles) {
    if (!detalle.idTecnica) {
      return "La técnica es obligatoria en cada detalle.";
    }

    if (!detalle.descripcion || detalle.descripcion.trim() === "") {
      return "La descripción del detalle no puede estar vacía.";
    }

    if (!detalle.cantidad || Number(detalle.cantidad) <= 0) {
      return "La cantidad debe ser mayor a 0.";
    }

    if (
      detalle.precioUnitario === undefined ||
      Number(detalle.precioUnitario) < 0
    ) {
      return "El precio unitario no puede ser negativo.";
    }

    if (detalle.costoDiseno !== undefined && Number(detalle.costoDiseno) < 0) {
      return "El costo de diseño no puede ser negativo.";
    }
  }

  return null;
};

export const validarActualizarCotizacion = (data: any) => {
  if (data.observaciones !== undefined && data.observaciones.trim() === "") {
    return "Las observaciones no pueden estar vacías.";
  }

  if (
    data.costosAdicionales !== undefined &&
    Number(data.costosAdicionales) < 0
  ) {
    return "Los costos adicionales no pueden ser negativos.";
  }

  return null;
};
