import { UsuarioRepository } from "../../infrastructure/repositories/usuario.repository";
import { RolRepository } from "../../infrastructure/repositories/rol.repository";
import { PasswordResetTokenRepository } from "../../infrastructure/repositories/password-reset-token.repository";
import {
  encriptarContrasena,
  compararContrasena,
} from "../../utils/password.util";
import { generarToken } from "../../utils/jwt.util";
import crypto from "node:crypto";
import { PermisoService } from "./permiso.service";
import { EmailService } from "./email.service";
import {
  validarForgotPassword,
  validarRegistroCliente,
  validarLogin,
  validarResetPassword,
} from "../../applications/validators/auth.validator";

const usuarioRepository = new UsuarioRepository();
const rolRepository = new RolRepository();
const permisoService = new PermisoService();
const passwordResetTokenRepository = new PasswordResetTokenRepository();
const emailService = new EmailService();

const MENSAJE_RECUPERACION =
  "Si el correo existe en el sistema, enviaremos instrucciones para recuperar la contrasena.";

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

const buildResetUrl = (token: string) => {
  const baseUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
  return `${baseUrl.replace(/\/$/, "")}/reset-password/${token}`;
};

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

  async obtenerPermisosUsuario(usuarioAuth: any) {
    if (!usuarioAuth?.idRol) {
      throw new Error("Usuario no autenticado.");
    }

    const permisos =
      usuarioAuth.rol === "Admin"
        ? await permisoService.listarPermisos()
        : await permisoService.listarPermisosPorRol(Number(usuarioAuth.idRol));

    return {
      usuario: {
        idUsuario: usuarioAuth.idUsuario,
        correo: usuarioAuth.correo,
        idRol: usuarioAuth.idRol,
        rol: usuarioAuth.rol,
      },
      permisos,
      codigos: permisos.map((permiso: any) => permiso.codigo),
    };
  }

  async forgotPassword(data: any) {
    const error = validarForgotPassword(data);

    if (error) {
      throw new Error(error);
    }

    const correoLimpio = data.correo.trim().toLowerCase();
    const usuario = await usuarioRepository.buscarPorCorreo(correoLimpio);

    if (!usuario || !usuario.estado) {
      return { message: MENSAJE_RECUPERACION };
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const fechaExpiracion = new Date(Date.now() + 60 * 60 * 1000);

    await passwordResetTokenRepository.invalidarTokensActivos(
      usuario.idUsuario,
    );
    await passwordResetTokenRepository.crearToken({
      idUsuario: usuario.idUsuario,
      tokenHash,
      fechaExpiracion,
    });

    try {
      await emailService.sendPasswordReset(
        usuario.correo,
        usuario.nombre,
        buildResetUrl(token),
      );
    } catch (errorEnvio) {
      console.error("Error enviando correo de recuperacion:", errorEnvio);
    }

    return { message: MENSAJE_RECUPERACION };
  }

  async resetPassword(data: any) {
    const error = validarResetPassword(data);

    if (error) {
      throw new Error(error);
    }

    const tokenHash = hashToken(data.token.trim());
    const resetToken =
      await passwordResetTokenRepository.buscarTokenValido(tokenHash);

    if (!resetToken || !resetToken.usuario.estado) {
      throw new Error("El token de recuperacion no es valido o expiro.");
    }

    const contrasenaHash = await encriptarContrasena(data.password);

    await usuarioRepository.actualizarUsuario(resetToken.idUsuario, {
      contrasenaHash,
    });
    await passwordResetTokenRepository.marcarUsado(
      resetToken.idPasswordResetToken,
    );

    return { message: "Contrasena actualizada correctamente." };
  }

  async crearPasswordCliente(data: any) {
    const error = validarResetPassword(data);

    if (error) {
      throw new Error(error);
    }

    const tokenHash = hashToken(data.token.trim());
    const resetToken =
      await passwordResetTokenRepository.buscarTokenValido(tokenHash);

    if (
      !resetToken ||
      !resetToken.usuario.estado ||
      resetToken.usuario.rol?.nombre !== "Cliente" ||
      !resetToken.usuario.cliente
    ) {
      throw new Error("El token para crear contrasena no es valido o expiro.");
    }

    const contrasenaHash = await encriptarContrasena(data.password);

    await usuarioRepository.actualizarUsuario(resetToken.idUsuario, {
      contrasenaHash,
      estado: true,
    });
    await passwordResetTokenRepository.marcarUsado(
      resetToken.idPasswordResetToken,
    );

    return { message: "Contrasena de cliente creada correctamente." };
  }
}
