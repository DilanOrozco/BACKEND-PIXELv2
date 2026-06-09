export const ventaSelect = {
  idPedido: true,
  idCliente: true,
  estadoPago: true,
  total: true,
  totalPagado: true,
  fechaCreacion: true,
  fechaFinalizado: true,
  fechaEntregado: true,
  cliente: {
    select: {
      idUsuario: true,
      nombre: true,
      correo: true,
      telefono: true,
    },
  },
  detalles: {
    select: {
      idDetallePedido: true,
      idTecnica: true,
      cantidad: true,
      tecnica: {
        select: {
          idTecnica: true,
          nombre: true,
        },
      },
    },
    orderBy: {
      idDetallePedido: "asc",
    },
  },
} as const;
