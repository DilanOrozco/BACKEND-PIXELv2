export const limpiarTextoOpcional = (valor: unknown) => {
  if (typeof valor !== "string") {
    return null;
  }

  const texto = valor.trim();
  return texto === "" ? null : texto;
};

export const esTextoOpcional = (valor: unknown) => {
  return valor === undefined || valor === null || typeof valor === "string";
};

export const esTextoNoVacio = (valor: unknown) => {
  return typeof valor === "string" && valor.trim() !== "";
};
