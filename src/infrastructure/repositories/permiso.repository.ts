import { prisma, runPrismaTransaction } from "../../config/prisma";
import { PERMISOS_SISTEMA } from "../../utils/permisos";

export class PermisoRepository {
  async sincronizarPermisosSistema() {
    await prisma.permiso.createMany({
      data: PERMISOS_SISTEMA.map((permiso) => ({ ...permiso })),
      skipDuplicates: true,
    });

    const batchSize = 25;
    for (let index = 0; index < PERMISOS_SISTEMA.length; index += batchSize) {
      const batch = PERMISOS_SISTEMA.slice(index, index + batchSize);
      await Promise.all(
        batch.map((permiso) =>
          prisma.permiso.update({
            where: { codigo: permiso.codigo },
            data: {
              modulo: permiso.modulo,
              accion: permiso.accion,
              descripcion: permiso.descripcion,
              estado: true,
            },
          }),
        ),
      );
    }

    return await prisma.permiso.findMany({
      orderBy: [{ modulo: "asc" }, { accion: "asc" }],
    });
  }

  async reemplazarPermisosARol(
    idRol: number,
    permisos: { idPermiso: number }[],
  ) {
    await runPrismaTransaction(async (tx) => {
      await tx.rolPermiso.deleteMany({
        where: { idRol },
      });

      if (permisos.length > 0) {
        await tx.rolPermiso.createMany({
          data: permisos.map((permiso) => ({
            idRol,
            idPermiso: permiso.idPermiso,
          })),
          skipDuplicates: true,
        });
      }

    });

    return await prisma.rol.findUnique({
      where: { idRol },
      include: {
        permisos: {
          include: {
            permiso: true,
          },
          orderBy: {
            permiso: {
              codigo: "asc",
            },
          },
        },
      },
    });
  }

  async listarPermisos() {
    return await prisma.permiso.findMany({
      where: { estado: true },
      orderBy: [{ modulo: "asc" }, { accion: "asc" }],
    });
  }

  async listarPermisosActivosPorCodigos(codigos: string[]) {
    if (codigos.length === 0) {
      return [];
    }

    return await prisma.permiso.findMany({
      where: {
        codigo: {
          in: codigos,
        },
        estado: true,
      },
      select: {
        idPermiso: true,
        codigo: true,
      },
    });
  }

  async listarPermisosPorRol(idRol: number) {
    return await prisma.rolPermiso.findMany({
      where: {
        idRol,
        permiso: {
          estado: true,
        },
      },
      select: {
        permiso: true,
      },
      orderBy: {
        permiso: {
          codigo: "asc",
        },
      },
    });
  }

  async listarCodigosPorRol(idRol: number) {
    const permisos = await this.listarPermisosPorRol(idRol);

    return permisos.map((item) => item.permiso.codigo);
  }

  async rolTienePermiso(idRol: number, codigo: string) {
    const permiso = await prisma.rolPermiso.findFirst({
      where: {
        idRol,
        permiso: {
          codigo,
          estado: true,
        },
        rol: {
          estado: true,
        },
      },
      select: {
        idPermiso: true,
      },
    });

    return Boolean(permiso);
  }

  async asignarPermisosARol(idRol: number, codigos: string[]) {
    const permisos = await this.listarPermisosActivosPorCodigos(codigos);
    const codigosExistentes = new Set(
      permisos.map((permiso) => permiso.codigo),
    );
    const codigosInexistentes = codigos.filter(
      (codigo) => !codigosExistentes.has(codigo),
    );

    if (codigosInexistentes.length > 0) {
      throw new Error(
        "Algunos permisos no existen en el catálogo. Sincroniza permisos primero.",
      );
    }

    return await this.reemplazarPermisosARol(idRol, permisos);
  }
}
