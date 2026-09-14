import { prisma } from "../../config/prisma";
import type { ParsedPagination } from "../../utils/pagination.util";
import { DELETION_IMPACT_RECORD_LIMIT } from "../../utils/deletion-impact.util";

const buildRolWhere = (search?: string | null) => {
  if (!search) {
    return {};
  }

  return {
    nombre: {
      contains: search,
      mode: "insensitive" as const,
    },
  };
};

const buildRolOrderBy = (pagination: ParsedPagination) => ({
  [pagination.sortBy]: pagination.order,
});

export class RolRepository {
  async asegurarRolConPermisos(
    nombre: string,
    descripcion: string,
    codigosPermisos: string[],
  ) {
    return await prisma.$transaction(async (tx) => {
      const rol = await tx.rol.upsert({
        where: { nombre },
        update: {
          descripcion,
          estado: true,
        },
        create: {
          nombre,
          descripcion,
          estado: true,
        },
      });

      const permisos = await tx.permiso.findMany({
        where: {
          codigo: {
            in: codigosPermisos,
          },
          estado: true,
        },
        select: {
          idPermiso: true,
        },
      });

      if (permisos.length > 0) {
        await tx.rolPermiso.createMany({
          data: permisos.map((permiso) => ({
            idRol: rol.idRol,
            idPermiso: permiso.idPermiso,
          })),
          skipDuplicates: true,
        });
      }

      return rol;
    });
  }

  async crearRol(nombre: string, descripcion?: string) {
    return await prisma.rol.create({
      data: {
        nombre,
        descripcion: descripcion ?? null,
        estado: true,
      },
    });
  }

  async buscarPorNombreExacto(nombre: string) {
    return await prisma.rol.findUnique({
      where: { nombre },
    });
  }

  async buscarPorId(idRol: number) {
    return await prisma.rol.findUnique({
      where: { idRol },
    });
  }

  async listarRoles() {
    return await prisma.rol.findMany({
      orderBy: {
        idRol: "asc",
      },
    });
  }

  async listarRolesPaginado(pagination: ParsedPagination) {
    const where = buildRolWhere(pagination.search);
    const [total, data] = await Promise.all([
      prisma.rol.count({ where }),
      prisma.rol.findMany({
        where,
        orderBy: buildRolOrderBy(pagination),
        skip: pagination.skip,
        take: pagination.limit,
      }),
    ]);

    return { data, total };
  }

  async buscarPorNombreParcial(nombre: string) {
    return await prisma.rol.findMany({
      where: {
        nombre: {
          contains: nombre,
          mode: "insensitive",
        },
      },
      orderBy: {
        idRol: "asc",
      },
    });
  }

  async actualizarRol(
    idRol: number,
    data: { nombre?: string; descripcion?: string; estado?: boolean },
  ) {
    return await prisma.rol.update({
      where: { idRol },
      data,
    });
  }

  async desactivarRol(idRol: number) {
    return await prisma.rol.update({
      where: { idRol },
      data: {
        estado: false,
      },
    });
  }

  async eliminarRol(idRol: number) {
    return await prisma.rol.delete({
      where: { idRol },
    });
  }

  async obtenerImpactoEliminacion(idRol: number) {
    const usuarioDelRol = { rol: { idRol } };
    const limite = DELETION_IMPACT_RECORD_LIMIT;

    const [
      usuariosCantidad,
      usuarios,
      permisosCantidad,
      permisos,
      tokensCantidad,
      clientesCantidad,
      clientes,
      cotizacionesCantidad,
      cotizaciones,
      abonosCantidad,
      abonos,
      disenosCantidad,
      disenos,
      comprasCantidad,
      compras,
      respuestasCantidad,
      respuestas,
    ] = await Promise.all([
      prisma.usuario.count({ where: { idRol } }),
      prisma.usuario.findMany({
        where: { idRol },
        select: { idUsuario: true, nombre: true },
        orderBy: { idUsuario: "asc" },
        take: limite,
      }),
      prisma.rolPermiso.count({ where: { idRol } }),
      prisma.rolPermiso.findMany({
        where: { idRol },
        select: {
          permiso: { select: { idPermiso: true, descripcion: true, codigo: true } },
        },
        orderBy: { idPermiso: "asc" },
        take: limite,
      }),
      prisma.passwordResetToken.count({ where: { usuario: usuarioDelRol } }),
      prisma.cliente.count({ where: { usuario: usuarioDelRol } }),
      prisma.cliente.findMany({
        where: { usuario: usuarioDelRol },
        select: { idCliente: true, nombre: true },
        orderBy: { idCliente: "asc" },
        take: limite,
      }),
      prisma.cotizacion.count({ where: { creadoPor: usuarioDelRol } }),
      prisma.cotizacion.findMany({
        where: { creadoPor: usuarioDelRol },
        select: { idCotizacion: true },
        orderBy: { idCotizacion: "asc" },
        take: limite,
      }),
      prisma.abonos.count({
        where: {
          OR: [
            { confirmadoPor: usuarioDelRol },
            { rechazadoPor: usuarioDelRol },
            { corregidoPor: usuarioDelRol },
          ],
        },
      }),
      prisma.abonos.findMany({
        where: {
          OR: [
            { confirmadoPor: usuarioDelRol },
            { rechazadoPor: usuarioDelRol },
            { corregidoPor: usuarioDelRol },
          ],
        },
        select: { idAbono: true },
        orderBy: { idAbono: "asc" },
        take: limite,
      }),
      prisma.diseno.count({
        where: {
          OR: [
            { disenador: usuarioDelRol },
            { respuestaRegistradaPor: usuarioDelRol },
            { recibidoPor: usuarioDelRol },
          ],
        },
      }),
      prisma.diseno.findMany({
        where: {
          OR: [
            { disenador: usuarioDelRol },
            { respuestaRegistradaPor: usuarioDelRol },
            { recibidoPor: usuarioDelRol },
          ],
        },
        select: { idDiseno: true, descripcion: true },
        orderBy: { idDiseno: "asc" },
        take: limite,
      }),
      prisma.compra.count({ where: { compradoPor: usuarioDelRol } }),
      prisma.compra.findMany({
        where: { compradoPor: usuarioDelRol },
        select: { idCompra: true },
        orderBy: { idCompra: "asc" },
        take: limite,
      }),
      prisma.cotizacionRespuesta.count({
        where: { usuarioInterno: usuarioDelRol },
      }),
      prisma.cotizacionRespuesta.findMany({
        where: { usuarioInterno: usuarioDelRol },
        select: { idRespuesta: true },
        orderBy: { idRespuesta: "asc" },
        take: limite,
      }),
    ]);

    return {
      usuariosCantidad,
      usuarios,
      permisosCantidad,
      permisos,
      tokensCantidad,
      clientesCantidad,
      clientes,
      cotizacionesCantidad,
      cotizaciones,
      abonosCantidad,
      abonos,
      disenosCantidad,
      disenos,
      comprasCantidad,
      compras,
      respuestasCantidad,
      respuestas,
    };
  }
}
