import { encriptarContrasena } from "../../utils/password.util";
import { UsuarioRepository } from "../../infrastructure/repositories/usuario.repository";
import { RolRepository } from "../../infrastructure/repositories/rol.repository";
import {
  validarCrearUsuario,
  validarActualizarUsuario,
} from "../validators/usuario.validator";

const usuarioRepository = new UsuarioRepository();
const rolRepository = new RolRepository();

export class UsuarioService {
  async crearUsuario(data: any) {
    const error = validarCrearUsuario(data);

    if (error) {
      throw new Error(error);
    }

    const rol = await rolRepository.buscarPorId(Number(data.idRol));

    if (!rol) {
      throw new Error("El rol debe existir.");
    }

    const correoExistente = await usuarioRepository.buscarPorCorreo(
      data.correo.trim().toLowerCase()
    );

    if (correoExistente) {
      throw new Error("El correo debe ser único en todo el sistema.");
    }

    if (data.documento) {
      const documentoExistente = await usuarioRepository.buscarPorDocumento(
        data.documento.trim()
      );

      if (documentoExistente) {
        throw new Error("El documento debe ser único.");
      }
    }

    const contrasenaHash = await encriptarContrasena(data.contrasena);

    return await usuarioRepository.crearUsuario({
      nombre: data.nombre.trim(),
      documento: data.documento?.trim(),
      telefono: data.telefono?.trim(),
      direccion: data.direccion?.trim(),
      correo: data.correo.trim().toLowerCase(),
      contrasenaHash,
      idRol: Number(data.idRol),
      estado: true,
    });
  }

  async listarUsuarios() {
    const usuarios = await usuarioRepository.listarUsuarios();

    if (usuarios.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    return usuarios;
  }

  async buscarPorId(idUsuario: number) {
    if (isNaN(idUsuario) || idUsuario <= 0) {
      throw new Error("El ID del usuario no es válido.");
    }

    const usuario = await usuarioRepository.buscarPorId(idUsuario);

    if (!usuario) {
      throw new Error("No se encontraron resultados.");
    }

    return usuario;
  }

  async buscarParcial(termino: string) {
    if (!termino || termino.trim() === "") {
      throw new Error("Debe ingresar un término de búsqueda.");
    }

    const usuarios = await usuarioRepository.buscarParcial(termino.trim());

    if (usuarios.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    return usuarios;
  }

  async actualizarUsuario(idUsuario: number, data: any) {
    if (isNaN(idUsuario) || idUsuario <= 0) {
      throw new Error("El ID del usuario no es válido.");
    }

    const error = validarActualizarUsuario(data);

    if (error) {
      throw new Error(error);
    }

    const usuario = await usuarioRepository.buscarPorId(idUsuario);

    if (!usuario) {
      throw new Error("No se encontraron resultados.");
    }

    const dataActualizar: any = {};

    if (data.nombre !== undefined) {
      dataActualizar.nombre = data.nombre.trim();
    }

    if (data.documento !== undefined) {
      const documentoLimpio = data.documento.trim();

      const documentoExistente =
        await usuarioRepository.buscarPorDocumento(documentoLimpio);

      if (
        documentoExistente &&
        documentoExistente.idUsuario !== idUsuario
      ) {
        throw new Error("El documento debe ser único.");
      }

      dataActualizar.documento = documentoLimpio;
    }

    if (data.correo !== undefined) {
      const correoLimpio = data.correo.trim().toLowerCase();

      const correoExistente = await usuarioRepository.buscarPorCorreo(correoLimpio);

      if (correoExistente && correoExistente.idUsuario !== idUsuario) {
        throw new Error("El correo debe ser único en todo el sistema.");
      }

      dataActualizar.correo = correoLimpio;
    }

    if (data.telefono !== undefined) {
      dataActualizar.telefono = data.telefono.trim();
    }

    if (data.direccion !== undefined) {
      dataActualizar.direccion = data.direccion.trim();
    }

    if (data.contrasena !== undefined) {
      dataActualizar.contrasenaHash = await encriptarContrasena(data.contrasena);
    }

    if (data.estado !== undefined) {
      dataActualizar.estado = data.estado;
    }

    if (data.idRol !== undefined) {
      const rol = await rolRepository.buscarPorId(Number(data.idRol));

      if (!rol) {
        throw new Error("El rol debe existir.");
      }

      // Más adelante esto solo lo debe hacer el Admin con JWT.
      dataActualizar.idRol = Number(data.idRol);
    }

    return await usuarioRepository.actualizarUsuario(idUsuario, dataActualizar);
  }

  async desactivarUsuario(idUsuario: number) {
    if (isNaN(idUsuario) || idUsuario <= 0) {
      throw new Error("El ID del usuario no es válido.");
    }

    const usuario = await usuarioRepository.buscarPorId(idUsuario);

    if (!usuario) {
      throw new Error("No se encontraron resultados.");
    }

    return await usuarioRepository.desactivarUsuario(idUsuario);
  }
}