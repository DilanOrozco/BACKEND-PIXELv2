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
  idCategoriaProducto: true,
  nombre: true,
  descripcion: true,
  precioBase: true,
  requiereDiseno: true,
  estado: true,
  fechaCreacion: true,
  fechaActualizacion: true,
  categoriaProducto: {
    select: {
      idCategoriaProducto: true,
      nombre: true,
      descripcion: true,
      estado: true,
    },
  },
  rangos: {
    select: rangoProductoSelect,
    orderBy: {
      cantidadMin: "asc",
    },
  },
} as const;

export const productoPublicSelect = {
  idProducto: true,
  idCategoriaProducto: true,
  nombre: true,
  descripcion: true,
  requiereDiseno: true,
  estado: true,
  categoriaProducto: {
    select: {
      idCategoriaProducto: true,
      nombre: true,
      descripcion: true,
    },
  },
} as const;
