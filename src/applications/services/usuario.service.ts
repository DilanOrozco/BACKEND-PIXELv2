// backend/src/applications/services/usuario.service.ts
import { encriptarContrasena } from "../../utils/password.util";
import { UsuarioRepository } from "../../infrastructure/repositories/usuario.repository";
import { RolRepository } from "../../infrastructure/repositories/rol.repository";
import {
  validarCrearUsuario,
  validarActualizarUsuario,
} from "../validators/usuario.validator";
import {
  paginatedResponse,
  parsePaginationQuery,
  type PaginationQuery,
} from "../../utils/pagination.util";

const usuarioRepository = new UsuarioRepository();
const rolRepository = new RolRepository();

const limpiarTextoOpcional = (valor: unknown) => {
  if (typeof valor !== "string") {
    return null;
  }

  const texto = valor.trim();
  return texto === "" ? null : texto;
};

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

    const correoLimpio = data.correo.trim().toLowerCase();
    const documentoLimpio = limpiarTextoOpcional(data.documento);

    const correoExistente = await usuarioRepository.buscarPorCorreo(
      correoLimpio
    );

    if (correoExistente) {
      throw new Error("El correo debe ser único en todo el sistema.");
    }

    if (documentoLimpio) {
      const documentoExistente = await usuarioRepository.buscarPorDocumento(
        documentoLimpio
      );

      if (documentoExistente) {
        throw new Error("El documento ya esta registrado.");
      }
    }

    const contrasenaHash = await encriptarContrasena(data.contrasena);

    const dataCrear = {
      nombre: data.nombre.trim(),
      documento: documentoLimpio,
      telefono: limpiarTextoOpcional(data.telefono),
      direccion: limpiarTextoOpcional(data.direccion),
      correo: correoLimpio,
      contrasenaHash,
      idRol: Number(data.idRol),
    };

    return await usuarioRepository.crearUsuario(dataCrear);
  }

  // 🎯 Modificado para recibir y delegar los filtros de rol al repositorio
  async listarUsuarios(query: PaginationQuery & { idRol?: unknown } = {}) {
    const idRol = query.idRol ? Number(query.idRol) : undefined;
    const filtros = idRol ? { idRol } : undefined;
    const pagination = parsePaginationQuery(query, {
      defaultSortBy: "idUsuario",
      allowedSortBy: ["idUsuario", "nombre", "correo", "fechaCreacion"],
      maxLimit: 10,
    });

    if (!pagination.isPaginated) {
      return { data: await usuarioRepository.listarUsuarios(filtros) };
    }

    const resultado = await usuarioRepository.listarUsuariosPaginado(
      filtros,
      pagination,
    );

    return paginatedResponse(resultado.data, pagination, resultado.total);
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
  async buscarParcial(
    termino: string,
    idRol?: number,
    query: PaginationQuery = {},
  ) {
    const pagination = parsePaginationQuery(
      { ...query, search: query.search ?? termino },
      {
        defaultSortBy: "idUsuario",
        allowedSortBy: ["idUsuario", "nombre", "correo", "fechaCreacion"],
        maxLimit: 10,
      },
    );

    if (!pagination.search) {
      throw new Error("Debe ingresar un termino de busqueda.");
    }

    if (!pagination.isPaginated) {
      return {
        data: await usuarioRepository.buscarParcial(pagination.search, idRol),
      };
    }

    const filtros = idRol ? { idRol } : undefined;
    const resultado = await usuarioRepository.listarUsuariosPaginado(
      filtros,
      pagination,
    );

    return paginatedResponse(resultado.data, pagination, resultado.total);
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
      const docLimpio = limpiarTextoOpcional(data.documento);

      if (docLimpio) {
        const docExistente = await usuarioRepository.buscarPorDocumento(docLimpio);
        if (docExistente && docExistente.idUsuario !== idUsuario) {
          throw new Error("El documento ya esta registrado.");
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
      dataActualizar.telefono = limpiarTextoOpcional(data.telefono);
    }

    if (data.direccion !== undefined) {
      dataActualizar.direccion = limpiarTextoOpcional(data.direccion);
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

  async actualizarPerfilPropio(idUsuario: number, data: any) {
    if (isNaN(idUsuario) || idUsuario <= 0) {
      throw new Error("El id del usuario no es vÃ¡lido.");
    }

    const dataPerfil = {
      nombre: data.nombre,
      documento: data.documento,
      telefono: data.telefono,
      direccion: data.direccion,
      correo: data.correo,
    };

    const error = validarActualizarUsuario(dataPerfil);
    if (error) {
      throw new Error(error);
    }

    const usuarioExistente = await usuarioRepository.buscarPorId(idUsuario);
    if (!usuarioExistente) {
      throw new Error("El usuario a actualizar no existe.");
    }

    const dataActualizar: any = {};

    if (dataPerfil.nombre !== undefined) {
      dataActualizar.nombre = dataPerfil.nombre.trim();
    }

    if (dataPerfil.documento !== undefined) {
      const docLimpio = limpiarTextoOpcional(dataPerfil.documento);

      if (docLimpio) {
        const docExistente = await usuarioRepository.buscarPorDocumento(docLimpio);
        if (docExistente && docExistente.idUsuario !== idUsuario) {
          throw new Error("El documento ya esta registrado.");
        }
      }
      dataActualizar.documento = docLimpio;
    }

    if (dataPerfil.correo !== undefined) {
      const correoLimpio = dataPerfil.correo.trim().toLowerCase();
      const correoExistente = await usuarioRepository.buscarPorCorreo(correoLimpio);

      if (correoExistente && correoExistente.idUsuario !== idUsuario) {
        throw new Error("El correo debe ser Ãºnico en todo el sistema.");
      }

      dataActualizar.correo = correoLimpio;
    }

    if (dataPerfil.telefono !== undefined) {
      dataActualizar.telefono = limpiarTextoOpcional(dataPerfil.telefono);
    }

    if (dataPerfil.direccion !== undefined) {
      dataActualizar.direccion = limpiarTextoOpcional(dataPerfil.direccion);
    }

    return await usuarioRepository.actualizarPerfilPropio(
      idUsuario,
      dataActualizar,
      dataActualizar,
    );
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

    await usuarioRepository.eliminarUsuario(idUsuario);

    return usuarioExistente;
  }
}
