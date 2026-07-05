export const abonoSelect = {
  idAbono: true,
  idPedido: true,
  monto: true,
  metodoPago: true,
  referencia: true,
  comprobanteUrl: true,
  estado: true,
  fechaCreacion: true,
  confirmadoPorId: true,
  fechaConfirmacion: true,
  rechazadoPorId: true,
  fechaRechazo: true,
  motivoRechazo: true,
  pedido: {
    select: {
      idPedido: true,
      total: true,
      totalPagado: true,
      saldoPendiente: true,
      estadoPedido: true,
      estadoPago: true,
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
  confirmadoPor: {
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
  rechazadoPor: {
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
