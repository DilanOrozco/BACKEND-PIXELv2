export const compraSelect = {
  idCompra: true,
  idPedido: true,
  idProveedor: true,
  compradoPorId: true,
  estado: true,
  total: true,
  fechaCompra: true,
  observaciones: true,
  proveedor: {
    select: {
      idProveedor: true,
      nombre: true,
      telefono: true,
      correo: true,
      direccion: true,
      estado: true,
    },
  },
  compradoPor: {
    select: {
      idUsuario: true,
      nombre: true,
      correo: true,
      rol: {
        select: {
          idRol: true,
          nombre: true,
        },
      },
    },
  },
  pedido: {
    select: {
      idPedido: true,
      estadoPedido: true,
      estadoPago: true,
      total: true,
      totalPagado: true,
      saldoPendiente: true,
      cliente: {
        select: {
          idUsuario: true,
          nombre: true,
          correo: true,
          telefono: true,
        },
      },
    },
  },
  detalles: {
    select: {
      idDetalleCompra: true,
      descripcionInsumo: true,
      cantidad: true,
      costoUnitario: true,
      subtotal: true,
    },
    orderBy: {
      idDetalleCompra: "asc",
    },
  },
} as const;
