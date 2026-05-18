import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

// Encripta una contraseña antes de guardarla en la base de datos.
export const encriptarContrasena = async (
  contrasena: string,
): Promise<string> => {
  return await bcrypt.hash(contrasena, SALT_ROUNDS);
};

// Compara una contraseña normal con una contraseña encriptada.
export const compararContrasena = async (
  contrasena: string,
  contrasenaHash: string,
): Promise<boolean> => {
  return await bcrypt.compare(contrasena, contrasenaHash);
};
