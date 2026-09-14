const validarNombre = (nombre: unknown, obligatorio: boolean) => {
  if (nombre === undefined && !obligatorio) return null;
  if (
    typeof nombre !== "string" ||
    nombre.trim().length < 2 ||
    nombre.trim().length > 80
  ) {
    return "El nombre de la tecnica debe tener entre 2 y 80 caracteres.";
  }
  return null;
};

const validarDescripcion = (descripcion: unknown) => {
  if (
    descripcion === undefined ||
    descripcion === null ||
    descripcion === ""
  ) {
    return null;
  }
  if (
    typeof descripcion !== "string" ||
    descripcion.trim().length < 5 ||
    descripcion.trim().length > 255
  ) {
    return "La descripcion debe tener entre 5 y 255 caracteres.";
  }
  return null;
};

const validarBooleanoOpcional = (valor: unknown, campo: string) =>
  valor !== undefined && typeof valor !== "boolean"
    ? `${campo} debe ser verdadero o falso.`
    : null;

export const validarCrearTecnica = (data: any) =>
  validarNombre(data?.nombre, true) ??
  validarDescripcion(data?.descripcion) ??
  validarBooleanoOpcional(data?.requiereMedidas, "requiereMedidas");

export const validarActualizarTecnica = (data: any) => {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return "Debes enviar los datos de la tecnica.";
  }
  if (Object.keys(data).length === 0) {
    return "Debes enviar al menos un campo para actualizar.";
  }

  return (
    validarNombre(data.nombre, false) ??
    validarDescripcion(data.descripcion) ??
    validarBooleanoOpcional(data.estado, "El estado") ??
    validarBooleanoOpcional(data.requiereMedidas, "requiereMedidas")
  );
};
