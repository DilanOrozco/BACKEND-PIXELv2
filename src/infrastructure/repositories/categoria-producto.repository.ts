import { prisma } from "../../config/prisma";
import type { Prisma } from "../../../generated/prisma/client";
import type { ParsedPagination } from "../../utils/pagination.util";
import {
  categoriaProductoPublicSelect,
  categoriaProductoSelect,
} from "../../utils/selects/categoria-producto.select";

export interface CategoriaProductoData {
  nombre: string;
  descripcion?: string | null;
  estado?: boolean;
}

const buildCategoriaWhere = (
  search?: string | null,
): Prisma.CategoriaProductoWhereInput => {
  if (!search) {
    return {};
  }

  return {
    nombre: {
      contains: search,
      mode: "insensitive",
    },
  };
};

const buildCategoriaOrderBy = (pagination: ParsedPagination) => ({
  [pagination.sortBy]: pagination.order,
});

export class CategoriaProductoRepository {
  async listarCategoriasPublicas() {
    return await prisma.categoriaProducto.findMany({
      where: { estado: true },
      select: categoriaProductoPublicSelect,
      orderBy: { nombre: "asc" },
    });
  }

  async listarCategoriasPaginado(pagination: ParsedPagination) {
    const where = buildCategoriaWhere(pagination.search);
    const [total, data] = await Promise.all([
      prisma.categoriaProducto.count({ where }),
      prisma.categoriaProducto.findMany({
        where,
        select: categoriaProductoSelect,
        orderBy: buildCategoriaOrderBy(pagination),
        skip: pagination.skip,
        take: pagination.limit,
      }),
    ]);

    return { data, total };
  }

  async buscarPorId(idCategoriaProducto: number) {
    return await prisma.categoriaProducto.findUnique({
      where: { idCategoriaProducto },
      select: categoriaProductoSelect,
    });
  }

  async buscarActivaPorId(idCategoriaProducto: number) {
    return await prisma.categoriaProducto.findFirst({
      where: { idCategoriaProducto, estado: true },
      select: categoriaProductoSelect,
    });
  }

  async buscarPorNombreExacto(nombre: string) {
    return await prisma.categoriaProducto.findUnique({
      where: { nombre },
      select: categoriaProductoSelect,
    });
  }

  async contarProductos(idCategoriaProducto: number) {
    return await prisma.productoCotizable.count({
      where: { idCategoriaProducto },
    });
  }

  async crearCategoria(data: CategoriaProductoData) {
    return await prisma.categoriaProducto.create({
      data: {
        ...data,
        estado: data.estado ?? true,
      },
      select: categoriaProductoSelect,
    });
  }

  async actualizarCategoria(
    idCategoriaProducto: number,
    data: Partial<CategoriaProductoData>,
  ) {
    return await prisma.categoriaProducto.update({
      where: { idCategoriaProducto },
      data,
      select: categoriaProductoSelect,
    });
  }

  async desactivarCategoria(idCategoriaProducto: number) {
    return await prisma.categoriaProducto.update({
      where: { idCategoriaProducto },
      data: { estado: false },
      select: categoriaProductoSelect,
    });
  }

  async eliminarCategoria(idCategoriaProducto: number) {
    return await prisma.categoriaProducto.delete({
      where: { idCategoriaProducto },
      select: categoriaProductoSelect,
    });
  }
}
