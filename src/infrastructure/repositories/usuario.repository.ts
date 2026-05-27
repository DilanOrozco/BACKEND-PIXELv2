// backend/src/infrastructure/repositories/usuario.repository.ts
import { prisma } from "../../config/prisma";
import { usuarioSelect, usuarioAuthSelect } from "../../utils/selects/usuario.select";

export class UsuarioRepository {
  async crearUsuario(data: any) {
    return await prisma.usuario.create({
      data,
      select: usuarioSelect,
    });
  }

  async listarUsuarios(filtros?: { idRol?: number }) {
    const where: any = {};

    if (filtros?.idRol) {
      where.idRol = filtros.idRol;
    }

    return await prisma.usuario.findMany({
      where,
      select: usuarioSelect,
      orderBy: {
        idUsuario: "asc",
      },
    });
  }

  async buscarPorId(idUsuario: number) {
    return await prisma.usuario.findUnique({
      where: { idUsuario },
      select: usuarioSelect,
    });
  }

  async buscarPorCorreo(correo: string) {
    return await prisma.usuario.findUnique({
      where: { correo },
    });
  }

  async buscarPorCorreoConRol(correo: string) {
    return await prisma.usuario.findUnique({
      where: { correo },
      select: usuarioAuthSelect,
    });
  }

  async buscarPorDocumento(documento: string) {
    return await prisma.usuario.findUnique({
      where: { documento },
    });
  }

  async buscarParcial(termino: string, idRol?: number) {
    const where: any = {
      OR: [
        {
          nombre: {
            contains: termino,
            mode: "insensitive",
          },
        },
        {
          correo: {
            contains: termino,
            mode: "insensitive",
          },
        },
        {
          documento: {
            contains: termino,
            mode: "insensitive",
          },
        },
      ],
    };

    if (idRol) {
      where.idRol = idRol;
    }

    return await prisma.usuario.findMany({
      where,
      select: usuarioSelect,
      orderBy: {
        idUsuario: "asc",
      },
    });
  }

  async actualizarUsuario(idUsuario: number, data: any) {
    return await prisma.usuario.update({
      where: { idUsuario },
      data,
      select: usuarioSelect,
    });
  }

  async desactivarUsuario(idUsuario: number) {
    return await prisma.usuario.update({
      where: { idUsuario },
      data: { estado: false },
      select: usuarioSelect,
    });
  }

  async eliminarUsuario(idUsuario: number) {
    return await prisma.usuario.delete({
      where: { idUsuario },
      select: { idUsuario: true },
    });
  }
}
