const correoRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validarRegistroCliente = (data: any) => {
  if (!data.nombre || data.nombre.trim() === "") {
    return "El nombre no puede estar vacío.";
  }

  if (!data.telefono || data.telefono.trim() === "") {
    return "El teléfono no puede estar vacío.";
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

  return null;
};

export const validarLogin = (data: any) => {
  if (!data.correo || data.correo.trim() === "") {
    return "El correo no puede estar vacío.";
  }

  if (!correoRegex.test(data.correo)) {
    return "El correo debe tener formato válido.";
  }

  if (!data.contrasena || data.contrasena.trim() === "") {
    return "La contraseña no puede estar vacía.";
  }

  return null;
};

export const validarForgotPassword = (data: any) => {
  if (!data.correo || data.correo.trim() === "") {
    return "El correo no puede estar vacio.";
  }

  if (!correoRegex.test(data.correo)) {
    return "El correo debe tener formato valido.";
  }

  return null;
};

export const validarResetPassword = (data: any) => {
  if (!data.token || typeof data.token !== "string" || data.token.trim() === "") {
    return "El token es obligatorio.";
  }

  if (!data.password || data.password.trim() === "") {
    return "La contrasena no puede estar vacia.";
  }

  if (data.password.length < 6) {
    return "La contrasena debe tener minimo 6 caracteres.";
  }

  return null;
};
