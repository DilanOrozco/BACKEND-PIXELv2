export const ventaSelect = {
  idPedido: true,
  idCliente: true,
  estadoPago: true,
  total: true,
  totalPagado: true,
  fechaCreacion: true,
  fechaFinalizado: true,
  fechaEntregado: true,
  saldoPendiente: true,
  venta: {
    select: {
      idVenta: true,
      estado: true,
      fechaPrimerPago: true,
      totalPedido: true,
      totalPagado: true,
      saldoPendiente: true,
    },
  },
  cliente: {
    select: {
      idCliente: true,
      nombre: true,
      correo: true,
      telefono: true,
    },
  },
  detalles: {
    select: {
      idDetallePedido: true,
      idTecnica: true,
      idProducto: true,
      cantidad: true,
      tecnica: {
        select: {
          idTecnica: true,
          nombre: true,
        },
      },
      producto: {
        select: {
          idProducto: true,
          nombre: true,
        },
      },
    },
    orderBy: {
      idDetallePedido: "asc",
    },
  },
} as const;
