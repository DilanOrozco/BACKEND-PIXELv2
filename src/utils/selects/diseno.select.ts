export const disenoSelect = {
  idDiseno: true,
  idPedido: true,
  idDisenador: true,
  archivoUrl: true,
  descripcion: true,
  observaciones: true,
  estado: true,
  fechaCreacion: true,
  fechaActualizacion: true,
  fechaEnvio: true,
  fechaAprobacion: true,
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
  disenador: {
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
} as const;
