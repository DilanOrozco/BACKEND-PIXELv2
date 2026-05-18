export const cotizacionSelect = {
  idCotizacion: true,
  idCliente: true,
  creadoPorId: true,
  tipoCotizacion: true,
  estado: true,
  subtotal: true,
  costoDiseno: true,
  costosAdicionales: true,
  total: true,
  observaciones: true,
  fechaCreacion: true,
  fechaActualizacion: true,

  cliente: {
    select: {
      idUsuario: true,
      nombre: true,
      telefono: true,
      correo: true,
    },
  },

  creadoPor: {
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

  detalles: {
    select: {
      idDetalleCotizacion: true,
      idTecnica: true,
      descripcion: true,
      cantidad: true,
      precioUnitario: true,
      costoDiseno: true,
      subtotal: true,
      observaciones: true,
      tecnica: {
        select: {
          idTecnica: true,
          nombre: true,
        },
      },
    },
  },
};
