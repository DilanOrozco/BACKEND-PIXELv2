import { prisma } from "../../config/prisma";
import { proveedorSelect } from "../../utils/selects/proveedor.select";
import {
  looksLikeEmail,
  looksNumeric,
  type ParsedPagination,
} from "../../utils/pagination.util";

export interface ProveedorFiltros {
  estado?: boolean;
}

const buildProveedorWhere = (
  filtros: ProveedorFiltros,
  search?: string | null,
) => {
  const where: any = {
    ...(filtros.estado !== undefined ? { estado: filtros.estado } : {}),
  };

  if (!search) {
    return where;
  }

  if (looksLikeEmail(search)) {
    where.correo = { startsWith: search.toLowerCase(), mode: "insensitive" };
    return where;
  }

  if (looksNumeric(search)) {
    where.telefono = { startsWith: search };
    return where;
  }

  where.nombre = { contains: search, mode: "insensitive" };
  return where;
};

const buildProveedorOrderBy = (pagination: ParsedPagination) => ({
  [pagination.sortBy]: pagination.order,
});

export class ProveedorRepository {
  async crearProveedor(data: {
    nombre: string;
    telefono: string | null;
    correo: string | null;
    direccion: string | null;
    estado: boolean;
  }) {
    return await prisma.proveedor.create({
      data,
      select: proveedorSelect,
    });
  }

  async listarProveedores(filtros: ProveedorFiltros) {
    return await prisma.proveedor.findMany({
      where: buildProveedorWhere(filtros),
      select: proveedorSelect,
      orderBy: {
        nombre: "asc",
      },
    });
  }

  async listarProveedoresPaginado(
    filtros: ProveedorFiltros,
    pagination: ParsedPagination,
  ) {
    const where = buildProveedorWhere(filtros, pagination.search);
    const [total, data] = await Promise.all([
      prisma.proveedor.count({ where }),
      prisma.proveedor.findMany({
        where,
        select: proveedorSelect,
        orderBy: buildProveedorOrderBy(pagination),
        skip: pagination.skip,
        take: pagination.limit,
      }),
    ]);

    return { data, total };
  }

  async buscarPorId(idProveedor: number) {
    return await prisma.proveedor.findUnique({
      where: { idProveedor },
      select: proveedorSelect,
    });
  }

  async buscarPorNombreExacto(nombre: string) {
    return await prisma.proveedor.findUnique({
      where: { nombre },
      select: proveedorSelect,
    });
  }

  async buscarParcial(termino: string) {
    return await prisma.proveedor.findMany({
      where: buildProveedorWhere({}, termino),
      select: proveedorSelect,
      orderBy: {
        nombre: "asc",
      },
    });
  }

  async actualizarProveedor(
    idProveedor: number,
    data: Partial<{
      nombre: string;
      telefono: string | null;
      correo: string | null;
      direccion: string | null;
      estado: boolean;
    }>,
  ) {
    return await prisma.proveedor.update({
      where: { idProveedor },
      data,
      select: proveedorSelect,
    });
  }

  async desactivarProveedor(idProveedor: number) {
    return await prisma.proveedor.update({
      where: { idProveedor },
      data: { estado: false },
      select: proveedorSelect,
    });
  }

  async contarCompras(idProveedor: number) {
    return await prisma.compra.count({
      where: { idProveedor },
    });
  }

  async eliminarProveedor(idProveedor: number) {
    return await prisma.proveedor.delete({
      where: { idProveedor },
      select: proveedorSelect,
    });
  }
}
