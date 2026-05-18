export const validarCrearTecnica = (data: any) => {
  if (!data.nombre || data.nombre.trim() === "") {
    return "El nombre de la técnica no puede estar vacío.";
  }

  if (data.descripcion !== undefined && data.descripcion.trim().length < 5) {
    return "La descripción debe tener mínimo 5 caracteres.";
  }

  return null;
};

export const validarActualizarTecnica = (data: any) => {
  if (data.nombre !== undefined && data.nombre.trim() === "") {
    return "El nombre de la técnica no puede estar vacío.";
  }

  if (data.descripcion !== undefined && data.descripcion.trim().length < 5) {
    return "La descripción debe tener mínimo 5 caracteres.";
  }

  if (data.estado !== undefined && typeof data.estado !== "boolean") {
    return "El estado debe ser verdadero o falso.";
  }

  return null;
};
