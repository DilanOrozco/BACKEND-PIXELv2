export const usuarioSelect = {
  idUsuario: true,
  nombre: true,
  documento: true,
  telefono: true,
  direccion: true,
  correo: true,
  estado: true,
  fechaCreacion: true,
  fechaActualizacion: true,
  rol: {
    select: {
      idRol: true,
      nombre: true,
      descripcion: true,
      estado: true,
    },
  },
  cliente: {
    select: {
      idCliente: true,
      nombre: true,
      correo: true,
      telefono: true,
      estado: true,
    },
  },
};

export const usuarioAuthSelect = {
  idUsuario: true,
  nombre: true,
  telefono: true,
  correo: true,
  estado: true,
  contrasenaHash: true,
  idRol: true,
  rol: {
    select: {
      idRol: true,
      nombre: true,
      descripcion: true,
      estado: true,
    },
  },
  cliente: {
    select: {
      idCliente: true,
      nombre: true,
      correo: true,
      telefono: true,
      estado: true,
    },
  },
};
