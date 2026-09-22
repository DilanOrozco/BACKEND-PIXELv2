export const esCorreoValido = (correo: string) => {
  const arroba = correo.indexOf("@");

  if (
    arroba <= 0 ||
    arroba !== correo.lastIndexOf("@") ||
    /\s/u.test(correo)
  ) {
    return false;
  }

  const dominio = correo.slice(arroba + 1);
  const punto = dominio.indexOf(".");

  return punto > 0 && punto < dominio.length - 1;
};
