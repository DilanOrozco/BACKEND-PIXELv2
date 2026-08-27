// backend/src/infrastructure/repositories/usuario.repository.ts
import { prisma, runPrismaTransaction } from "../../config/prisma";
import { Prisma } from "../../../generated/prisma/client";
import { usuarioSelect, usuarioAuthSelect } from "../../utils/selects/usuario.select";
import {
  looksLikeEmail,
  looksNumeric,
  type ParsedPagination,
} from "../../utils/pagination.util";

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

const buildUsuarioWhere = (
  filtros?: { idRol?: number },
  search?: string | null,
): Prisma.UsuarioWhereInput => {
  const where: Prisma.UsuarioWhereInput = {};

  if (filtros?.idRol) {
    where.idRol = filtros.idRol;
  }

  if (!search) {
    return where;
  }

  if (looksLikeEmail(search)) {
    where.correo = {
      startsWith: search.toLowerCase(),
      mode: "insensitive",
    };
    return where;
  }

  if (looksNumeric(search)) {
    where.OR = [
      { documento: { startsWith: search } },
      { telefono: { startsWith: search } },
    ];
    return where;
  }

  where.OR = [
    { nombre: { contains: search, mode: "insensitive" } },
    { correo: { startsWith: search.toLowerCase(), mode: "insensitive" } },
  ];

  return where;
};

const buildUsuarioOrderBy = (pagination: ParsedPagination) => ({
  [pagination.sortBy]: pagination.order,
});

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
    const where = buildUsuarioWhere(filtros);

    return await prisma.usuario.findMany({
      where,
      select: usuarioSelect,
      orderBy: {
        idUsuario: "asc",
      },
    });
  }

  async listarUsuariosPaginado(
    filtros: { idRol?: number } | undefined,
    pagination: ParsedPagination,
  ) {
    const where = buildUsuarioWhere(filtros, pagination.search);
    const [total, data] = await Promise.all([
      prisma.usuario.count({ where }),
      prisma.usuario.findMany({
        where,
        select: usuarioSelect,
        orderBy: buildUsuarioOrderBy(pagination),
        skip: pagination.skip,
        take: pagination.limit,
      }),
    ]);

    return { data, total };
  }

  async buscarPorId(idUsuario: number) {
    return await prisma.usuario.findUnique({
      where: { idUsuario },
      select: usuarioSelect,
    });
  }

  async buscarUsuarioAuthPorId(idUsuario: number) {
    return await prisma.usuario.findUnique({
      where: { idUsuario },
      select: {
        idUsuario: true,
        correo: true,
        idRol: true,
        estado: true,
        rol: {
          select: {
            nombre: true,
            estado: true,
          },
        },
        cliente: {
          select: {
            idCliente: true,
            estado: true,
          },
        },
      },
    });
  }

  async buscarPorCorreo(correo: string) {
    return await prisma.usuario.findFirst({
      where: { correo },
      orderBy: { idUsuario: "asc" },
    });
  }

  async buscarPorCorreoConRol(correo: string) {
    return await prisma.usuario.findFirst({
      where: { correo },
      select: usuarioAuthSelect,
      orderBy: { idUsuario: "asc" },
    });
  }

  async buscarPorCorreoConRolYCliente(correo: string) {
    return await prisma.usuario.findFirst({
      where: { correo },
      select: {
        ...usuarioAuthSelect,
        cliente: {
          select: {
            idCliente: true,
            nombre: true,
            correo: true,
            telefono: true,
            estado: true,
          },
        },
      },
      orderBy: { idUsuario: "asc" },
    });
  }

  async buscarPorDocumento(documento: string) {
    return await prisma.usuario.findUnique({
      where: { documento },
    });
  }

  async buscarParcial(termino: string, idRol?: number) {
    const where = buildUsuarioWhere(idRol ? { idRol } : undefined, termino);

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

  async actualizarPerfilPropio(
    idUsuario: number,
    dataUsuario: any,
    dataCliente: any,
  ) {
    try {
      return await runPrismaTransaction(async (tx) => {
        await tx.usuario.update({
          where: { idUsuario },
          data: dataUsuario,
        });

        const cliente = await tx.cliente.findUnique({
          where: { idUsuario },
          select: {
            idCliente: true,
            estado: true,
          },
        });

        if (cliente?.estado) {
          await tx.cliente.update({
            where: { idCliente: cliente.idCliente },
            data: dataCliente,
          });
        }

        return await tx.usuario.findUnique({
          where: { idUsuario },
          select: usuarioSelect,
        });
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
