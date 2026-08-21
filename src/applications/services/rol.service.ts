import { RolRepository } from "../../infrastructure/repositories/rol.repository";
import {
  validarCrearRol,
  validarActualizarRol,
} from "../validators/rol.validator";
import {
  paginatedResponse,
  parsePaginationQuery,
  type PaginationQuery,
} from "../../utils/pagination.util";
import { buildDeletionImpact } from "../../utils/deletion-impact.util";

const rolRepository = new RolRepository();

export class RolService {
  async crearRol(nombre: string, descripcion?: string) {
    const error = validarCrearRol(nombre, descripcion);

    if (error) {
      throw new Error(error);
    }

    const rolExistente = await rolRepository.buscarPorNombreExacto(
      nombre.trim(),
    );

    if (rolExistente) {
      throw new Error("El nombre del rol no puede repetirse en el sistema.");
    }

    return await rolRepository.crearRol(nombre.trim(), descripcion?.trim());
  }

  async listarRoles(query: PaginationQuery = {}) {
    const pagination = parsePaginationQuery(query, {
      defaultSortBy: "idRol",
      allowedSortBy: ["idRol", "nombre"],
      maxLimit: 10,
    });

    if (pagination.isPaginated) {
      const resultado = await rolRepository.listarRolesPaginado(pagination);

      if (resultado.data.length === 0) {
        throw new Error("No se encontraron resultados.");
      }

      return paginatedResponse(resultado.data, pagination, resultado.total);
    }

    const roles = await rolRepository.listarRoles();

    if (roles.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    return { data: roles };
  }

  async buscarPorNombre(nombre: string) {
    const roles = await rolRepository.buscarPorNombreParcial(nombre);

    if (roles.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    return roles;
  }

  async actualizarRol(
    idRol: number,
    data: { nombre?: string; descripcion?: string; estado?: boolean },
  ) {
    if (isNaN(idRol) || idRol <= 0) {
      throw new Error("El ID del rol no es válido.");
    }

    const error = validarActualizarRol(
      data.nombre,
      data.descripcion,
      data.estado,
    );

    if (error) {
      throw new Error(error);
    }

    const rol = await rolRepository.buscarPorId(idRol);

    if (!rol) {
      throw new Error("No se encontraron resultados.");
    }

    if (data.nombre) {
      const rolExistente = await rolRepository.buscarPorNombreExacto(
        data.nombre.trim(),
      );

      if (rolExistente && rolExistente.idRol !== idRol) {
        throw new Error("El nombre del rol no puede repetirse en el sistema.");
      }

      data.nombre = data.nombre.trim();
    }

    if (data.descripcion) {
      data.descripcion = data.descripcion.trim();
    }

    return await rolRepository.actualizarRol(idRol, data);
  }

  async desactivarRol(idRol: number) {
    const rol = await rolRepository.buscarPorId(idRol);

    if (!rol) {
      throw new Error("No se encontraron resultados.");
    }

    return await rolRepository.desactivarRol(idRol);
  }

  async eliminarRol(idRol: number) {
    if (isNaN(idRol) || idRol <= 0) {
      throw new Error("El ID del rol no es valido.");
    }

    const rol = await rolRepository.buscarPorId(idRol);

    if (!rol) {
      throw new Error("No se encontraron resultados.");
    }

    return await rolRepository.eliminarRol(idRol);
  }

  async obtenerImpactoEliminacion(idRol: number) {
    if (isNaN(idRol) || idRol <= 0) {
      throw new Error("El ID del rol no es valido.");
    }

    const rol = await rolRepository.buscarPorId(idRol);

    if (!rol) {
      throw new Error("No se encontraron resultados.");
    }

    const impacto = await rolRepository.obtenerImpactoEliminacion(idRol);

    return buildDeletionImpact([
      {
        tipo: "Usuarios",
        accion: "ELIMINAR",
        cantidad: impacto.usuariosCantidad,
        registros: impacto.usuarios.map((usuario) => ({
          id: usuario.idUsuario,
          nombre: usuario.nombre,
        })),
      },
      {
        tipo: "Asignaciones de permisos",
        accion: "ELIMINAR",
        cantidad: impacto.permisosCantidad,
        registros: impacto.permisos.map(({ permiso }) => ({
          id: permiso.idPermiso,
          nombre: permiso.descripcion || permiso.codigo,
        })),
      },
      {
        tipo: "Tokens de recuperacion de contrasena",
        accion: "ELIMINAR",
        cantidad: impacto.tokensCantidad,
        registros: [],
      },
      {
        tipo: "Clientes vinculados",
        accion: "MODIFICAR",
        cantidad: impacto.clientesCantidad,
        registros: impacto.clientes.map((cliente) => ({
          id: cliente.idCliente,
          nombre: cliente.nombre,
        })),
      },
      {
        tipo: "Cotizaciones gestionadas",
        accion: "MODIFICAR",
        cantidad: impacto.cotizacionesCantidad,
        registros: impacto.cotizaciones.map((cotizacion) => ({
          id: cotizacion.idCotizacion,
          nombre: `Cotizacion #${cotizacion.idCotizacion}`,
        })),
      },
      {
        tipo: "Abonos gestionados",
        accion: "MODIFICAR",
        cantidad: impacto.abonosCantidad,
        registros: impacto.abonos.map((abono) => ({
          id: abono.idAbono,
          nombre: `Abono #${abono.idAbono}`,
        })),
      },
      {
        tipo: "Disenos gestionados",
        accion: "MODIFICAR",
        cantidad: impacto.disenosCantidad,
        registros: impacto.disenos.map((diseno) => ({
          id: diseno.idDiseno,
          nombre: diseno.descripcion || `Diseno #${diseno.idDiseno}`,
        })),
      },
      {
        tipo: "Compras registradas",
        accion: "MODIFICAR",
        cantidad: impacto.comprasCantidad,
        registros: impacto.compras.map((compra) => ({
          id: compra.idCompra,
          nombre: `Compra #${compra.idCompra}`,
        })),
      },
      {
        tipo: "Respuestas de cotizacion registradas",
        accion: "MODIFICAR",
        cantidad: impacto.respuestasCantidad,
        registros: impacto.respuestas.map((respuesta) => ({
          id: respuesta.idRespuesta,
          nombre: `Respuesta #${respuesta.idRespuesta}`,
        })),
      },
    ]);
  }
}
