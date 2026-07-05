import { prisma } from "../../config/prisma";
import type { ParsedPagination } from "../../utils/pagination.util";

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
}
