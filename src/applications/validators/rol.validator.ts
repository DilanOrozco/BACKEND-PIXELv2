export const validarCrearRol = (nombre?: string, descripcion?: string) => {
  if (!nombre || nombre.trim() === "") {
    return "El nombre del rol no puede estar vacío.";
  }

  if (descripcion && descripcion.trim().length < 5) {
    return "La descripción debe tener mínimo 5 caracteres.";
  }

  return null;
};

export const validarActualizarRol = (
  nombre?: string,
  descripcion?: string,
  estado?: boolean,
) => {
  if (nombre !== undefined && nombre.trim() === "") {
    return "El nombre del rol no puede estar vacío.";
  }

  if (descripcion !== undefined && descripcion.trim().length < 5) {
    return "La descripción debe tener mínimo 5 caracteres.";
  }

  if (estado !== undefined && typeof estado !== "boolean") {
    return "El estado debe ser verdadero o falso.";
  }

  return null;
};
