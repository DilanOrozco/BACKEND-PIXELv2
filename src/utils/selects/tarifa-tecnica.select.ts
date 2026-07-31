export const tarifaTecnicaSelect = {
  idTarifa: true,
  idTecnica: true,
  anchoHastaCm: true,
  altoHastaCm: true,
  esGeneral: true,
  precioUnitario: true,
  estado: true,
  fechaCreacion: true,
  fechaActualizacion: true,
  tecnica: {
    select: {
      idTecnica: true,
      nombre: true,
      estado: true,
    },
  },
} as const;

export const descuentoTecnicaSelect = {
  idDescuento: true,
  idTecnica: true,
  cantidadMinima: true,
  porcentaje: true,
  estado: true,
  fechaCreacion: true,
  fechaActualizacion: true,
} as const;
