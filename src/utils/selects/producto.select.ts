export const rangoProductoSelect = {
  idRango: true,
  idProducto: true,
  cantidadMin: true,
  descuentoPorcentaje: true,
  estado: true,
  fechaCreacion: true,
  fechaActualizacion: true,
} as const;

export const productoSelect = {
  idProducto: true,
  nombre: true,
  descripcion: true,
  precioBase: true,
  estado: true,
  fechaCreacion: true,
  fechaActualizacion: true,
  rangos: {
    select: rangoProductoSelect,
    orderBy: {
      cantidadMin: "asc",
    },
  },
} as const;

export const productoPublicSelect = {
  idProducto: true,
  nombre: true,
  descripcion: true,
  precioBase: true,
  rangos: {
    where: {
      estado: true,
    },
    select: {
      idRango: true,
      cantidadMin: true,
      descuentoPorcentaje: true,
    },
    orderBy: {
      cantidadMin: "asc",
    },
  },
} as const;
