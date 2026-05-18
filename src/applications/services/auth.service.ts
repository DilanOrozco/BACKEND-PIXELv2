import { UsuarioRepository } from "../../infrastructure/repositories/usuario.repository";
import { RolRepository } from "../../infrastructure/repositories/rol.repository";
import {
  encriptarContrasena,
  compararContrasena,
} from "../../utils/password.util";
import { generarToken } from "../../utils/jwt.util";
import {
  validarRegistroCliente,
  validarLogin,
} from "../../applications/validators/auth.validator";

const usuarioRepository = new UsuarioRepository();
const rolRepository = new RolRepository();

export class AuthService {
  async registrarCliente(data: any) {
    const error = validarRegistroCliente(data);

    if (error) {
      throw new Error(error);
    }

    const correoLimpio = data.correo.trim().toLowerCase();

    const correoExistente =
      await usuarioRepository.buscarPorCorreo(correoLimpio);

    if (correoExistente) {
      throw new Error("El correo ya está registrado en el sistema.");
    }

    const rolCliente = await rolRepository.buscarPorNombreExacto("Cliente");

    if (!rolCliente) {
      throw new Error("No existe el rol Cliente. Debes crearlo antes.");
    }

    const contrasenaHash = await encriptarContrasena(data.contrasena);

    const usuario = await usuarioRepository.crearUsuario({
      nombre: data.nombre.trim(),
      telefono: data.telefono.trim(),
      correo: correoLimpio,
      contrasenaHash,
      idRol: rolCliente.idRol,
      estado: true,
    });

    return usuario;
  }

  async login(data: any) {
    const error = validarLogin(data);

    if (error) {
      throw new Error(error);
    }

    const correoLimpio = data.correo.trim().toLowerCase();

    const usuario = await usuarioRepository.buscarPorCorreoConRol(correoLimpio);

    if (!usuario) {
      throw new Error("Correo o contraseña incorrectos.");
    }

    if (!usuario.estado) {
      throw new Error("El usuario se encuentra inactivo.");
    }

    const contrasenaValida = await compararContrasena(
      data.contrasena,
      usuario.contrasenaHash
    );

    if (!contrasenaValida) {
      throw new Error("Correo o contraseña incorrectos.");
    }

    const token = generarToken({
      idUsuario: usuario.idUsuario,
      correo: usuario.correo,
      idRol: usuario.idRol,
      rol: usuario.rol.nombre,
    });

    const { contrasenaHash, ...usuarioSinContrasena } = usuario;

    return {
      token,
      usuario: usuarioSinContrasena,
    };
  }
}