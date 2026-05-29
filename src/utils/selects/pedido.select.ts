export const pedidoSelect = {
  idPedido: true,
  idCotizacion: true,
  idCliente: true,
  estadoPedido: true,
  estadoPago: true,
  total: true,
  totalPagado: true,
  saldoPendiente: true,
  fechaCreacion: true,
  fechaEntregaEstimada: true,
  fechaFinalizado: true,
  fechaEntregado: true,
  observaciones: true,
  cliente: {
    select: {
      idUsuario: true,
      nombre: true,
      telefono: true,
      correo: true,
    },
  },
  cotizacion: {
    select: {
      idCotizacion: true,
      estado: true,
      subtotal: true,
      costosAdicionales: true,
      total: true,
      observaciones: true,
      creadoPor: {
        select: {
          idUsuario: true,
          nombre: true,
          correo: true,
          rol: { select: { idRol: true, nombre: true } },
        },
      },
    },
  },
  detalles: {
    select: {
      idDetallePedido: true,
      idTecnica: true,
      descripcion: true,
      cantidad: true,
      precioUnitario: true,
      subtotal: true,
      observaciones: true,
      tecnica: { select: { idTecnica: true, nombre: true } },
    },
  },
  abonos: {
    select: {
      idAbono: true,
      idPedido: true,
      monto: true,
      metodoPago: true,
      referencia: true,
      estado: true,
      fechaCreacion: true,
      confirmadoPorId: true,
      fechaConfirmacion: true,
      confirmadoPor: {
        select: {
          idUsuario: true,
          nombre: true,
          correo: true,
        },
      },
    },
    orderBy: {
      fechaCreacion: "asc",
    },
  },
  _count: {
    select: {
      abonos: true,
    },
  },
} as const;
