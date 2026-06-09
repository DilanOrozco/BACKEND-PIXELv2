import { prisma } from "../../config/prisma";
import { proveedorSelect } from "../../utils/selects/proveedor.select";

export interface ProveedorFiltros {
  estado?: boolean;
}

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
      where: {
        ...(filtros.estado !== undefined ? { estado: filtros.estado } : {}),
      },
      select: proveedorSelect,
      orderBy: {
        nombre: "asc",
      },
    });
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
      where: {
        OR: [
          {
            nombre: {
              contains: termino,
              mode: "insensitive",
            },
          },
          {
            telefono: {
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
        ],
      },
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
