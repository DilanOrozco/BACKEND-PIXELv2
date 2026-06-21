// backend/src/infrastructure/repositories/usuario.repository.ts
import { prisma } from "../../config/prisma";
import { Prisma } from "../../../generated/prisma/client";
import { usuarioSelect, usuarioAuthSelect } from "../../utils/selects/usuario.select";

const manejarErrorPrismaUsuario = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.map(String)
        : [];

      if (target.includes("documento")) {
        throw new Error("El documento ya esta registrado.");
      }

      if (target.includes("correo")) {
        throw new Error("El correo ya esta registrado en el sistema.");
      }

      throw new Error("Ya existe un usuario con un dato unico registrado.");
    }

    if (error.code === "P2003") {
      throw new Error(
        "No se puede eliminar el usuario porque tiene registros relacionados.",
      );
    }

    if (error.code === "P2025") {
      throw new Error("El usuario no existe.");
    }
  }

  throw error;
};

export class UsuarioRepository {
  async crearUsuario(data: any) {
    try {
      return await prisma.usuario.create({
        data,
        select: usuarioSelect,
      });
    } catch (error) {
      manejarErrorPrismaUsuario(error);
    }
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
    try {
      return await prisma.usuario.update({
        where: { idUsuario },
        data,
        select: usuarioSelect,
      });
    } catch (error) {
      manejarErrorPrismaUsuario(error);
    }
  }

  async desactivarUsuario(idUsuario: number) {
    try {
      return await prisma.usuario.update({
        where: { idUsuario },
        data: { estado: false },
        select: usuarioSelect,
      });
    } catch (error) {
      manejarErrorPrismaUsuario(error);
    }
  }

  async eliminarUsuario(idUsuario: number) {
    try {
      return await prisma.usuario.delete({
        where: { idUsuario },
        select: { idUsuario: true },
      });
    } catch (error) {
      manejarErrorPrismaUsuario(error);
    }
  }
}
