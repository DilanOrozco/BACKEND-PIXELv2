const correoRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validarCrearUsuario = (data: any) => {
  if (!data.nombre || data.nombre.trim() === "") {
    return "El nombre no puede estar vacío.";
  }

  if (!data.correo || data.correo.trim() === "") {
    return "El correo no puede estar vacío.";
  }

  if (!correoRegex.test(data.correo)) {
    return "El correo debe tener formato válido.";
  }

  if (!data.contrasena || data.contrasena.trim() === "") {
    return "La contraseña no puede estar vacía.";
  }

  if (data.contrasena.length < 6) {
    return "La contraseña debe tener mínimo 6 caracteres.";
  }

  if (!data.idRol) {
    return "El rol es obligatorio.";
  }

  return null;
};

export const validarActualizarUsuario = (data: any) => {
  if (data.nombre !== undefined && data.nombre.trim() === "") {
    return "El nombre no puede estar vacío.";
  }

  if (data.correo !== undefined) {
    if (data.correo.trim() === "") {
      return "El correo no puede estar vacío.";
    }

    if (!correoRegex.test(data.correo)) {
      return "El correo debe tener formato válido.";
    }
  }

  if (data.contrasena !== undefined && data.contrasena.length < 6) {
    return "La contraseña debe tener mínimo 6 caracteres.";
  }

  if (data.estado !== undefined && typeof data.estado !== "boolean") {
    return "El estado debe ser verdadero o falso.";
  }

  if (data.idRol !== undefined && typeof data.idRol !== "number") {
    return "El rol debe ser válido.";
  }

  return null;
};
