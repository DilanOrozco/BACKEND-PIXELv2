export const tecnicaSelect = {
  idTecnica: true,
  nombre: true,
  descripcion: true,
  requiereMedidas: true,
  estado: true,
  fechaCreacion: true,
  fechaActualizacion: true,
};

export const tecnicaPublicSelect = {
  idTecnica: true,
  nombre: true,
  descripcion: true,
  requiereMedidas: true,
  estado: true,
};

export const tarifaTecnicaPublicSelect = {
  idTarifa: true,
  nombre: true,
  anchoHastaCm: true,
  altoHastaCm: true,
  esGeneral: true,
} as const;
