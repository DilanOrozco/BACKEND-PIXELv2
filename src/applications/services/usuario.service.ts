// backend/src/applications/services/usuario.service.ts
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

    const dataCrear = {
      nombre: data.nombre.trim(),
      documento: data.documento ? data.documento.trim() : null,
      telefono: data.telefono ? data.telefono.trim() : null,
      direccion: data.direccion ? data.direccion.trim() : null,
      correo: data.correo.trim().toLowerCase(),
      contrasenaHash,
      idRol: Number(data.idRol),
    };

    return await usuarioRepository.crearUsuario(dataCrear);
  }

  // 🎯 Modificado para recibir y delegar los filtros de rol al repositorio
  async listarUsuarios(filtros?: { idRol?: number }) {
    return await usuarioRepository.listarUsuarios(filtros);
  }

  async buscarPorId(idUsuario: number) {
    if (isNaN(idUsuario) || idUsuario <= 0) {
      throw new Error("El id del usuario no es válido.");
    }

    const usuario = await usuarioRepository.buscarPorId(idUsuario);

    if (!usuario) {
      throw new Error("El usuario solicitado no existe.");
    }

    return usuario;
  }

  // 🎯 Modificado para recibir el idRol opcional y pasarlo a la búsqueda parcial
  async buscarParcial(termino: string, idRol?: number) {
    return await usuarioRepository.buscarParcial(termino, idRol);
  }

  async actualizarUsuario(idUsuario: number, data: any) {
    if (isNaN(idUsuario) || idUsuario <= 0) {
      throw new Error("El id del usuario no es válido.");
    }

    const error = validarActualizarUsuario(data);
    if (error) {
      throw new Error(error);
    }

    const usuarioExistente = await usuarioRepository.buscarPorId(idUsuario);
    if (!usuarioExistente) {
      throw new Error("El usuario a actualizar no existe.");
    }

    const dataActualizar: any = {};

    if (data.nombre !== undefined) {
      dataActualizar.nombre = data.nombre.trim();
    }

    if (data.documento !== undefined) {
      const docLimpio = data.documento ? data.documento.trim() : null;

      if (docLimpio) {
        const docExistente = await usuarioRepository.buscarPorDocumento(docLimpio);
        if (docExistente && docExistente.idUsuario !== idUsuario) {
          throw new Error("El documento debe ser único.");
        }
      }
      dataActualizar.documento = docLimpio;
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

      dataActualizar.idRol = Number(data.idRol);
    }

    return await usuarioRepository.actualizarUsuario(idUsuario, dataActualizar);
  }

  async desactivarUsuario(idUsuario: number) {
    if (isNaN(idUsuario) || idUsuario <= 0) {
      throw new Error("El id del usuario no es válido.");
    }

    const usuarioExistente = await usuarioRepository.buscarPorId(idUsuario);
    if (!usuarioExistente) {
      throw new Error("El usuario a desactivar no existe.");
    }

    return await usuarioRepository.desactivarUsuario(idUsuario);
  }

  async eliminarUsuario(idUsuario: number) {
    if (isNaN(idUsuario) || idUsuario <= 0) {
      throw new Error("El id del usuario no es valido.");
    }

    const usuarioExistente = await usuarioRepository.buscarPorId(idUsuario);

    if (!usuarioExistente) {
      throw new Error("El usuario a eliminar no existe.");
    }

    const cotizacionesAsociadas =
      await usuarioRepository.contarCotizacionesAsociadas(idUsuario);

    if (cotizacionesAsociadas > 0) {
      throw new Error(
        "No se puede eliminar el usuario porque tiene cotizaciones asociadas. Desactivalo en su lugar.",
      );
    }

    return await usuarioRepository.eliminarUsuario(idUsuario);
  }
}
