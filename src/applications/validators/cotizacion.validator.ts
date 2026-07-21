const esEnteroPositivo = (valor: any) => {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0;
};

const esMontoValido = (valor: any) => {
  if (valor === undefined || valor === null || valor === "") {
    return false;
  }

  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= 0;
};

const esTextoNoVacio = (valor: any) => {
  return typeof valor === "string" && valor.trim() !== "";
};

const esTextoOpcional = (valor: any) => {
  return valor === undefined || valor === null || typeof valor === "string";
};

const clienteEnvioPrecios = (detalle: any) => {
  return (
    detalle.precioUnitario !== undefined ||
    detalle.costoDiseno !== undefined ||
    detalle.subtotal !== undefined
  );
};

const validarUnicoDetalle = (data: any) => {
  if (!data?.detalles || !Array.isArray(data.detalles)) {
    return "La cotizacion debe tener un detalle.";
  }

  if (data.detalles.length !== 1) {
    return "La cotizacion debe tener un unico detalle. Para otra prenda o producto crea una nueva cotizacion.";
  }

  return null;
};

// Regla de cliente: solo describe lo que necesita. Los precios, costos y
// subtotales siempre los calcula o asigna la empresa. Una cotizacion representa
// una sola solicitud comercial, por eso no se agregan prendas nuevas al editar.
export const validarSolicitudCliente = (
  data: any,
  opciones: { requiereDetalleExistente?: boolean } = {},
) => {
  const errorDetalleUnico = validarUnicoDetalle(data);

  if (errorDetalleUnico) {
    return errorDetalleUnico;
  }

  if (data.subtotal !== undefined || data.total !== undefined) {
    return "El cliente no puede enviar subtotales ni totales.";
  }

  if (data.costosAdicionales !== undefined) {
    return "El cliente no puede enviar costos adicionales.";
  }

  for (const detalle of data.detalles) {
    if (opciones.requiereDetalleExistente) {
      if (!esEnteroPositivo(detalle.idDetalleCotizacion)) {
        return "Debe enviar el idDetalleCotizacion del detalle existente.";
      }
    } else if (detalle.idDetalleCotizacion !== undefined) {
      return "No se debe enviar idDetalleCotizacion al crear una solicitud.";
    }

    if (!esEnteroPositivo(detalle.idTecnica)) {
      return "La tecnica es obligatoria en cada detalle.";
    }

    if (!esTextoNoVacio(detalle.descripcion)) {
      return "La descripcion del detalle no puede estar vacia.";
    }

    if (!esEnteroPositivo(detalle.cantidad)) {
      return "La cantidad debe ser mayor a 0.";
    }

    if (!esTextoOpcional(detalle.imagenReferencia)) {
      return "La imagen de referencia debe ser texto, null u omitirse.";
    }

    if (clienteEnvioPrecios(detalle)) {
      return "El cliente no puede enviar precios, costos de diseno ni subtotales.";
    }
  }

  return null;
};

// Regla de cotizar: el empleado asigna precios sobre detalles ya existentes.
export const validarCotizar = (data: any) => {
  const errorDetalleUnico = validarUnicoDetalle(data);

  if (errorDetalleUnico) {
    return errorDetalleUnico;
  }

  if (
    data.costosAdicionales !== undefined &&
    !esMontoValido(data.costosAdicionales)
  ) {
    return "Los costos adicionales no pueden ser negativos.";
  }

  if (!esTextoOpcional(data.motivoCambio)) {
    return "El motivo de cambio debe ser texto, null u omitirse.";
  }

  const idsDetalle = new Set<number>();

  for (const detalle of data.detalles) {
    if (!esEnteroPositivo(detalle.idDetalleCotizacion)) {
      return "Cada detalle a cotizar debe incluir idDetalleCotizacion.";
    }

    const idDetalle = Number(detalle.idDetalleCotizacion);

    if (idsDetalle.has(idDetalle)) {
      return "No se pueden repetir detalles en la cotizacion.";
    }

    idsDetalle.add(idDetalle);

    if (!esMontoValido(detalle.precioUnitario)) {
      return "El precio unitario es obligatorio y no puede ser negativo.";
    }

    if (!esMontoValido(detalle.costoDiseno)) {
      return "El costo de diseno es obligatorio y no puede ser negativo.";
    }
  }

  return null;
};

// Regla de actualizacion administrativa: no modifica detalles ni cambia estado;
// solo permite observaciones de empresa y costos adicionales.
export const validarActualizarCotizacion = (data: any) => {
  const camposPermitidos = ["observaciones", "costosAdicionales", "motivoCambio"];
  const campos = Object.keys(data || {});

  if (campos.length === 0) {
    return "Debe enviar al menos un campo para actualizar.";
  }

  const campoNoPermitido = campos.find(
    (campo) => !camposPermitidos.includes(campo),
  );

  if (campoNoPermitido) {
    return "Solo se pueden modificar observaciones y costos adicionales.";
  }

  if (
    data.observaciones !== undefined &&
    !esTextoNoVacio(data.observaciones)
  ) {
    return "Las observaciones deben ser texto y no pueden estar vacias.";
  }

  if (
    data.costosAdicionales !== undefined &&
    !esMontoValido(data.costosAdicionales)
  ) {
    return "Los costos adicionales no pueden ser negativos.";
  }

  if (!esTextoOpcional(data.motivoCambio)) {
    return "El motivo de cambio debe ser texto, null u omitirse.";
  }

  return null;
};

// Regla presencial: el empleado puede registrar costos operativos, pero los
// precios del producto siempre se calculan en el backend cuando llega idProducto.
// Se conserva idProducto opcional para no invalidar solicitudes antiguas que aun
// deben ser cotizadas manualmente.
export const validarCrearCotizacionPresencial = (data: any) => {
  const errorDetalleUnico = validarUnicoDetalle(data);

  if (errorDetalleUnico) {
    return errorDetalleUnico;
  }

  if (
    data.costosAdicionales !== undefined &&
    !esMontoValido(data.costosAdicionales)
  ) {
    return "Los costos adicionales no pueden ser negativos.";
  }

  if (data.idCliente === undefined && data?.cliente) {
    const telefono = data?.cliente?.telefono;

    if (typeof telefono !== "string" || telefono.trim() === "") {
      return "El telefono del cliente es obligatorio para cotizaciones presenciales.";
    }
  }

  for (const detalle of data.detalles) {
    if (detalle.idDetalleCotizacion !== undefined) {
      return "No se debe enviar idDetalleCotizacion al crear una cotizacion.";
    }

    if (!esEnteroPositivo(detalle.idTecnica)) {
      return "La tecnica es obligatoria en cada detalle.";
    }

    if (!esTextoNoVacio(detalle.descripcion)) {
      return "La descripcion del detalle no puede estar vacia.";
    }

    if (!esEnteroPositivo(detalle.cantidad)) {
      return "La cantidad debe ser mayor a 0.";
    }

    if (detalle.idProducto !== undefined && !esEnteroPositivo(detalle.idProducto)) {
      return "El producto debe ser valido.";
    }

    if (!esMontoValido(detalle.costoDiseno ?? 0)) {
      return "El costo de diseno no puede ser negativo.";
    }

    if (!esTextoOpcional(detalle.imagenReferencia)) {
      return "La imagen de referencia debe ser texto, null u omitirse.";
    }
  }

  return null;
};
