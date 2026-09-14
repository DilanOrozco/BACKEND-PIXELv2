export const clienteSelect = {
  idCliente: true,
  idUsuario: true,
  nombre: true,
  documento: true,
  correo: true,
  telefono: true,
  direccion: true,
  estado: true,
  fechaCreacion: true,
  fechaActualizacion: true,
} as const;

export const clienteDetalleSelect = {
  ...clienteSelect,
  cotizaciones: {
    select: {
      idCotizacion: true,
      tipoCotizacion: true,
      estado: true,
      total: true,
      fechaCreacion: true,
    },
    orderBy: {
      fechaCreacion: "desc",
    },
    take: 10,
  },
  pedidos: {
    select: {
      idPedido: true,
      idCotizacion: true,
      estadoPedido: true,
      estadoPago: true,
      total: true,
      fechaCreacion: true,
    },
    orderBy: {
      fechaCreacion: "desc",
    },
    take: 10,
  },
  _count: {
    select: {
      cotizaciones: true,
      pedidos: true,
    },
  },
} as const;
