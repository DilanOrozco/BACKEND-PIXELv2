export const disenoSelect = {
  idDiseno: true,
  idPedido: true,
  idDisenador: true,
  archivoUrl: true,
  descripcion: true,
  observaciones: true,
  estado: true,
  origenDiseno: true,
  medioRecepcion: true,
  recibidoPorId: true,
  fechaRecepcion: true,
  medioRespuestaCliente: true,
  observacionesCliente: true,
  fechaRespuestaCliente: true,
  respuestaRegistradaPorId: true,
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
          idCliente: true,
          nombre: true,
          documento: true,
          correo: true,
          telefono: true,
          direccion: true,
        },
      },
    },
  },
  respuestaRegistradaPor: {
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
  recibidoPor: {
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
