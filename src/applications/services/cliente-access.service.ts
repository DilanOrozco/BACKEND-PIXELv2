import crypto from "node:crypto";
import { UsuarioRepository } from "../../infrastructure/repositories/usuario.repository";
import { ClienteRepository } from "../../infrastructure/repositories/cliente.repository";
import { PasswordResetTokenRepository } from "../../infrastructure/repositories/password-reset-token.repository";
import { encriptarContrasena } from "../../utils/password.util";
import { PermisoService } from "./permiso.service";

const usuarioRepository = new UsuarioRepository();
const clienteRepository = new ClienteRepository();
const passwordResetTokenRepository = new PasswordResetTokenRepository();
const permisoService = new PermisoService();

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

const buildCrearPasswordClienteUrl = (token: string) => {
  const baseUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
  return `${baseUrl.replace(/\/$/, "")}/crear-password-cliente/${token}`;
};

export type ClienteAccessResult = {
  usuarioCreado: boolean;
  usuarioExistente: boolean;
  linkCrearPassword?: string;
  fechaExpiracion?: Date;
  idUsuario?: number;
};

export class ClienteAccessService {
  async asegurarAccesoCliente(cliente: any): Promise<ClienteAccessResult | null> {
    const correo = typeof cliente?.correo === "string"
      ? cliente.correo.trim().toLowerCase()
      : "";

    if (!correo) {
      return null;
    }

    const rolCliente = await permisoService.asegurarRolCliente();

    const usuarioExistente =
      await usuarioRepository.buscarPorCorreoConRolYCliente(correo);

    if (usuarioExistente) {
      if (usuarioExistente.rol.nombre !== "Cliente") {
        throw new Error(
          "El correo ya pertenece a un usuario interno. Usa otro correo para el cliente.",
        );
      }

      if (
        usuarioExistente.cliente &&
        usuarioExistente.cliente.idCliente !== cliente.idCliente
      ) {
        throw new Error(
          "El correo ya esta vinculado a otro cliente. Revisa los datos antes de cotizar.",
        );
      }

      if (!cliente.idUsuario) {
        await clienteRepository.vincularUsuario(
          cliente.idCliente,
          usuarioExistente.idUsuario,
        );
      }

      return {
        usuarioCreado: false,
        usuarioExistente: true,
        idUsuario: usuarioExistente.idUsuario,
      };
    }

    const contrasenaHash = await encriptarContrasena(
      crypto.randomBytes(32).toString("hex"),
    );

    const usuario = await usuarioRepository.crearUsuario({
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      correo,
      contrasenaHash,
      idRol: rolCliente.idRol,
      estado: true,
    });

    if (!usuario) {
      throw new Error("No fue posible crear el usuario cliente.");
    }

    await clienteRepository.vincularUsuario(cliente.idCliente, usuario.idUsuario);

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const fechaExpiracion = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await passwordResetTokenRepository.invalidarTokensActivos(usuario.idUsuario);
    await passwordResetTokenRepository.crearToken({
      idUsuario: usuario.idUsuario,
      tokenHash,
      fechaExpiracion,
    });

    return {
      usuarioCreado: true,
      usuarioExistente: false,
      linkCrearPassword: buildCrearPasswordClienteUrl(token),
      fechaExpiracion,
      idUsuario: usuario.idUsuario,
    };
  }

  async obtenerClienteDeUsuario(idUsuario: number) {
    const cliente = await clienteRepository.buscarPorIdUsuario(idUsuario);

    if (!cliente || !cliente.estado) {
      throw new Error("El usuario no tiene un cliente vinculado.");
    }

    return cliente;
  }
}
