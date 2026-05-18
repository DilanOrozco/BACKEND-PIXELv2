import { prisma } from "../../config/prisma";
import { usuarioSelect } from "../../utils/selects/usuario.select";
import { usuarioAuthSelect } from "../../utils/selects/usuario.select";

export class UsuarioRepository {
  async crearUsuario(data: any) {
    return await prisma.usuario.create({
      data,
      select: usuarioSelect,
    });
  }

  async listarUsuarios() {
    return await prisma.usuario.findMany({
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

  async buscarParcial(termino: string) {
    return await prisma.usuario.findMany({
      where: {
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
      },
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
      data: {
        estado: false,
      },
      select: usuarioSelect,
    });
  }
}
