import { prisma } from "../../config/prisma";

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

  async contarUsuariosAsociados(idRol: number) {
    return await prisma.usuario.count({
      where: { idRol },
    });
  }

  async eliminarRol(idRol: number) {
    return await prisma.rol.delete({
      where: { idRol },
    });
  }
}
