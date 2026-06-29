import { prisma, runPrismaTransaction } from "../../config/prisma";
import { PERMISOS_SISTEMA } from "../../utils/permisos";

export class PermisoRepository {
  async sincronizarPermisosSistema() {
    return await runPrismaTransaction(async (tx) => {
      for (const permiso of PERMISOS_SISTEMA) {
        await tx.permiso.upsert({
          where: { codigo: permiso.codigo },
          update: {
            modulo: permiso.modulo,
            accion: permiso.accion,
            descripcion: permiso.descripcion,
            estado: true,
          },
          create: permiso,
        });
      }

      return await tx.permiso.findMany({
        orderBy: [{ modulo: "asc" }, { accion: "asc" }],
      });
    });
  }

  async listarPermisos() {
    return await prisma.permiso.findMany({
      where: { estado: true },
      orderBy: [{ modulo: "asc" }, { accion: "asc" }],
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
    return await runPrismaTransaction(async (tx) => {
      const permisos = await tx.permiso.findMany({
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

      return await tx.rol.findUnique({
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
    });
  }
}
