import { prisma } from "../../config/prisma";
import type { Prisma } from "../../../generated/prisma/client";
import {
  productoPublicSelect,
  productoSelect,
  rangoProductoSelect,
} from "../../utils/selects/producto.select";
import type { ParsedPagination } from "../../utils/pagination.util";

export interface ProductoData {
  nombre: string;
  idCategoriaProducto: number;
  descripcion?: string | null;
  precioBase?: Prisma.Decimal | number | string | null;
  requiereDiseno?: boolean;
  estado?: boolean;
}

export interface RangoData {
  cantidadMin: number;
  descuentoPorcentaje: Prisma.Decimal | number | string;
  estado?: boolean;
}

const buildProductoWhere = (
  search?: string | null,
  filtros?: { idCategoriaProducto?: number },
): Prisma.ProductoCotizableWhereInput => {
  const where: Prisma.ProductoCotizableWhereInput = {};

  if (filtros?.idCategoriaProducto) {
    where.idCategoriaProducto = filtros.idCategoriaProducto;
  }

  if (!search) {
    return where;
  }

  where.nombre = {
      contains: search,
      mode: "insensitive",
  };

  return where;
};

const buildProductoOrderBy = (pagination: ParsedPagination) => ({
  [pagination.sortBy]: pagination.order,
});

export class ProductoRepository {
  async listarProductosPublicos(filtros?: { idCategoriaProducto?: number }) {
    return await prisma.productoCotizable.findMany({
      where: {
        estado: true,
        ...(filtros?.idCategoriaProducto
          ? { idCategoriaProducto: filtros.idCategoriaProducto }
          : {}),
      },
      select: productoPublicSelect,
      orderBy: { nombre: "asc" },
    });
  }

  async listarProductosPaginado(
    pagination: ParsedPagination,
    filtros?: { idCategoriaProducto?: number },
  ) {
    const where = buildProductoWhere(pagination.search, filtros);
    const [total, data] = await Promise.all([
      prisma.productoCotizable.count({ where }),
      prisma.productoCotizable.findMany({
        where,
        select: productoSelect,
        orderBy: buildProductoOrderBy(pagination),
        skip: pagination.skip,
        take: pagination.limit,
      }),
    ]);

    return { data, total };
  }

  async buscarPorId(idProducto: number) {
    return await prisma.productoCotizable.findUnique({
      where: { idProducto },
      select: productoSelect,
    });
  }

  async buscarActivoPorId(idProducto: number) {
    return await prisma.productoCotizable.findFirst({
      where: { idProducto, estado: true },
      select: productoSelect,
    });
  }

  async buscarActivosPorIds(idsProductos: number[]) {
    if (idsProductos.length === 0) {
      return [];
    }

    return await prisma.productoCotizable.findMany({
      where: {
        idProducto: { in: idsProductos },
        estado: true,
      },
      select: productoSelect,
    });
  }

  async buscarPorNombreExacto(nombre: string) {
    return await prisma.productoCotizable.findUnique({
      where: { nombre },
      select: productoSelect,
    });
  }

  async crearProducto(data: ProductoData) {
    return await prisma.productoCotizable.create({
      data: {
        ...data,
        estado: data.estado ?? true,
      },
      select: productoSelect,
    });
  }

  async actualizarProducto(idProducto: number, data: Partial<ProductoData>) {
    return await prisma.productoCotizable.update({
      where: { idProducto },
      data,
      select: productoSelect,
    });
  }

  async desactivarProducto(idProducto: number) {
    return await prisma.productoCotizable.update({
      where: { idProducto },
      data: { estado: false },
      select: productoSelect,
    });
  }

  async eliminarProducto(idProducto: number) {
    return await prisma.productoCotizable.delete({
      where: { idProducto },
      select: productoSelect,
    });
  }

  async listarRangos(idProducto: number) {
    return await prisma.precioProductoRango.findMany({
      where: { idProducto },
      select: rangoProductoSelect,
      orderBy: { cantidadMin: "asc" },
    });
  }

  async reemplazarRangos(idProducto: number, rangos: RangoData[]) {
    await prisma.$transaction(async (tx) => {
      await tx.precioProductoRango.deleteMany({
        where: { idProducto },
      });

      if (rangos.length > 0) {
        await tx.precioProductoRango.createMany({
          data: rangos.map((rango) => ({
            idProducto,
            cantidadMin: rango.cantidadMin,
            descuentoPorcentaje: rango.descuentoPorcentaje,
            estado: rango.estado ?? true,
          })),
          skipDuplicates: true,
        });
      }

    });

    return await prisma.productoCotizable.findUnique({
      where: { idProducto },
      select: productoSelect,
    });
  }
}
