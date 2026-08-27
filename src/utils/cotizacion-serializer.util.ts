const CAMPOS_PRECIO_INTERNO_DETALLE = new Set([
  "precioBase",
  "idRangoDescuentoAplicado",
  "cantidadMinimaDescuentoSnapshot",
  "rangoDescuentoAplicado",
  "descuentoPorcentaje",
  "descuentoValorUnitario",
  "precioUnitario",
  "costoDiseno",
  "subtotal",
  "subtotalBruto",
  "descuentoTotal",
  "subtotalConDescuento",
  "precioSugeridoInterno",
  "subtotalSugeridoInterno",
  "requiereRevisionPrecio",
  "rangoDescuentoProducto",
  "porcentajeDescuentoProducto",
  "montoDescuentoProducto",
  "subtotalServiciosBruto",
  "subtotalServiciosConDescuento",
  "calculoCompleto",
]);

const limpiarDetalleCliente = (detalle: any) => {
  const limpio = Object.fromEntries(
    Object.entries(detalle ?? {}).filter(
      ([campo]) => !CAMPOS_PRECIO_INTERNO_DETALLE.has(campo),
    ),
  );

  return {
    ...limpio,
    producto: detalle?.producto
      ? {
          idProducto: detalle.producto.idProducto,
          idCategoriaProducto: detalle.producto.idCategoriaProducto,
          nombre: detalle.producto.nombre,
          categoriaProducto: detalle.producto.categoriaProducto,
        }
      : null,
    estampados: Array.isArray(detalle?.estampados)
      ? detalle.estampados.map((estampado: any) => ({
          idDetalleEstampadoCotizacion:
            estampado.idDetalleEstampadoCotizacion,
          idTecnica: estampado.idTecnica,
          ubicacion: estampado.ubicacion,
          anchoCm: estampado.anchoCm,
          altoCm: estampado.altoCm,
          descripcion: estampado.descripcion,
          observaciones: estampado.observaciones,
          origenDiseno: estampado.origenDiseno,
          grupoDisenoCompartido: estampado.grupoDisenoCompartido,
          requiereRevisionManual: Boolean(
            estampado.requiereRevisionPrecio,
          ),
          tecnica: estampado.tecnica,
        }))
      : [],
  };
};

export const serializarCotizacionCliente = (cotizacion: any) => {
  if (!cotizacion) return cotizacion;

  const versiones = Array.isArray(cotizacion.versiones)
    ? cotizacion.versiones
    : [];
  const versionVigente = versiones.find(
    (version: any) =>
      version.esVigente &&
      ["ENVIADA", "ACEPTADA", "RECHAZADA", "AJUSTE_SOLICITADO"].includes(
        version.estado,
      ),
  );
  const esPropuestaLegacy =
    versiones.length === 0 &&
    ["PENDIENTE", "APROBADA"].includes(String(cotizacion.estado)) &&
    Number(cotizacion.total ?? 0) > 0;
  const {
    subtotal: _subtotal,
    descuentoTotal: _descuentoTotal,
    costosAdicionales: _costosAdicionales,
    total: _total,
    precioSugeridoInterno: _precioSugeridoInterno,
    subtotalServiciosBrutoSugerido: _subtotalServiciosBrutoSugerido,
    montoDescuentoProductoSugerido: _montoDescuentoProductoSugerido,
    subtotalServiciosConDescuentoSugerido:
      _subtotalServiciosConDescuentoSugerido,
    costoDisenoSugerido: _costoDisenoSugerido,
    calculoCompleto: _calculoCompleto,
    requiereRevisionPrecio: _requiereRevisionPrecio,
    advertenciasInternas: _advertenciasInternas,
    propuestaAdministrativa: _propuestaAdministrativa,
    propuestaActual: _propuestaActual,
    observacionesInternas: _observacionesInternas,
    creadoPor: _creadoPor,
    versiones: _versiones,
    ...base
  } = cotizacion;

  return {
    ...base,
    requiereRevisionManual: Boolean(
      cotizacion.requiereRevisionPrecio,
    ),
    estadoPrecio: versionVigente || esPropuestaLegacy
      ? "PROPUESTA_OFICIAL_DISPONIBLE"
      : "PENDIENTE_CONFIRMACION",
    mensaje: versionVigente || esPropuestaLegacy
      ? "PIXEL envio una propuesta oficial para tu revision."
      : "El equipo de PIXEL revisara la solicitud y confirmara el precio.",
    detalles: Array.isArray(cotizacion.detalles)
      ? cotizacion.detalles.map((detalle: any) => ({
          ...limpiarDetalleCliente(detalle),
          requiereRevisionManual: Boolean(
            detalle.requiereRevisionPrecio,
          ),
        }))
      : [],
    propuesta: versionVigente
      ? {
          idVersion: versionVigente.idVersion,
          numeroVersion: versionVigente.numeroVersion,
          precioFinal: versionVigente.precioFinal,
          descuentoManual: versionVigente.descuentoManual,
          costosAdicionales: versionVigente.costosAdicionales,
          desgloseVisible: versionVigente.desgloseVisible,
          observacionesCliente: versionVigente.observacionesCliente,
          mensajeCliente: versionVigente.mensajeCliente,
          validaHasta: versionVigente.validaHasta,
          enviadaAt: versionVigente.enviadaAt,
          estado: versionVigente.estado,
          respuesta: versionVigente.respuesta
            ? {
                decision: versionVigente.respuesta.decision,
                medio: versionVigente.respuesta.medio,
                fechaRespuesta: versionVigente.respuesta.fechaRespuesta,
                observaciones: versionVigente.respuesta.observaciones,
              }
            : null,
        }
      : esPropuestaLegacy
        ? {
            idVersion: null,
            numeroVersion: 0,
            precioFinal: cotizacion.total,
            descuentoManual: cotizacion.descuentoTotal ?? 0,
            costosAdicionales: cotizacion.costosAdicionales ?? 0,
            desgloseVisible: {
              items: (cotizacion.detalles ?? []).map((detalle: any) => ({
                idDetalleCotizacion: detalle.idDetalleCotizacion,
                nombre:
                  detalle.producto?.nombre ??
                  detalle.nombrePersonalizado ??
                  detalle.descripcion,
                cantidad: detalle.cantidad,
                precioUnitario: detalle.precioUnitario,
                subtotal:
                  detalle.subtotalConDescuento ?? detalle.subtotal,
              })),
              total: cotizacion.total,
            },
            observacionesCliente: cotizacion.observaciones,
            mensajeCliente: "Propuesta historica anterior al versionado.",
            validaHasta: null,
            enviadaAt: cotizacion.fechaActualizacion,
            estado:
              cotizacion.estado === "APROBADA" ? "ACEPTADA" : "ENVIADA",
            respuesta: null,
          }
        : null,
  };
};
