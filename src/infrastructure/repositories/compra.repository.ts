import { prisma } from "../../config/prisma";
import type { Prisma } from "../../../generated/prisma/client";
import type { EstadoCompraPermitido } from "../../applications/validators/compra.validator";
import { compraSelect } from "../../utils/selects/compra.select";
import { proveedorSelect } from "../../utils/selects/proveedor.select";

type PrismaExecutor = Prisma.TransactionClient | typeof prisma;

export interface CompraFiltros {
  idPedido?: number;
  idProveedor?: number;
  estado?: EstadoCompraPermitido;
  compradoPorId?: number;
  desde?: Date;
  hasta?: Date;
}

export interface DetalleCompraData {
  descripcionInsumo: string;
  cantidad: number;
  costoUnitario: number;
  subtotal: number;
}

export interface CrearCompraData {
  idPedido: number;
  idProveedor: number;
  compradoPorId: number;
  estado: EstadoCompraPermitido;
  total: number;
  observaciones: string | null;
  detalles: DetalleCompraData[];
}

export interface ActualizarCompraData {
  idProveedor?: number;
  observaciones?: string | null;
  total?: number;
  detalles?: DetalleCompraData[];
}

const db = (tx?: Prisma.TransactionClient): PrismaExecutor => tx ?? prisma;

const pedidoCompraSelect = {
  idPedido: true,
  idCliente: true,
  estadoPedido: true,
  estadoPago: true,
  total: true,
  totalPagado: true,
  saldoPendiente: true,
} as const;

const construirWhere = (filtros: CompraFiltros) => {
  const where: Prisma.CompraWhereInput = {};

  if (filtros.idPedido) {
    where.idPedido = filtros.idPedido;
  }

  if (filtros.idProveedor) {
    where.idProveedor = filtros.idProveedor;
  }

  if (filtros.estado) {
    where.estado = filtros.estado;
  }

  if (filtros.compradoPorId) {
    where.compradoPorId = filtros.compradoPorId;
  }

  if (filtros.desde || filtros.hasta) {
    where.fechaCompra = {
      ...(filtros.desde ? { gte: filtros.desde } : {}),
      ...(filtros.hasta ? { lte: filtros.hasta } : {}),
    };
  }

  return where;
};

export class CompraRepository {
  async buscarPedidoPorId(idPedido: number, tx?: Prisma.TransactionClient) {
    return await db(tx).pedido.findUnique({
      where: { idPedido },
      select: pedidoCompraSelect,
    });
  }

  async buscarProveedorPorId(idProveedor: number, tx?: Prisma.TransactionClient) {
    return await db(tx).proveedor.findUnique({
      where: { idProveedor },
      select: proveedorSelect,
    });
  }

  async crearCompra(data: CrearCompraData) {
    const { detalles, ...compraData } = data;

    return await prisma.$transaction(async (tx) => {
      return await tx.compra.create({
        data: {
          ...compraData,
          detalles: {
            create: detalles,
          },
        },
        select: compraSelect,
      });
    });
  }

  async listarCompras(filtros: CompraFiltros) {
    return await prisma.compra.findMany({
      where: construirWhere(filtros),
      select: compraSelect,
      orderBy: {
        fechaCompra: "desc",
      },
    });
  }

  async listarPorPedido(idPedido: number) {
    return await prisma.compra.findMany({
      where: { idPedido },
      select: compraSelect,
      orderBy: {
        fechaCompra: "desc",
      },
    });
  }

  async buscarPorId(idCompra: number, tx?: Prisma.TransactionClient) {
    return await db(tx).compra.findUnique({
      where: { idCompra },
      select: compraSelect,
    });
  }

  async actualizarCompra(
    idCompra: number,
    data: ActualizarCompraData,
  ) {
    return await prisma.$transaction(async (tx) => {
      const { detalles, ...compraData } = data;

      if (detalles) {
        await tx.detalleCompra.deleteMany({
          where: { idCompra },
        });
      }

      return await tx.compra.update({
        where: { idCompra },
        data: {
          ...compraData,
          ...(detalles
            ? {
                detalles: {
                  create: detalles,
                },
              }
            : {}),
        },
        select: compraSelect,
      });
    });
  }

  async confirmarCompra(idCompra: number) {
    return await prisma.compra.update({
      where: { idCompra },
      data: {
        estado: "COMPRADA",
        fechaCompra: new Date(),
      },
      select: compraSelect,
    });
  }

  async anularCompra(idCompra: number, observaciones: string | null) {
    return await prisma.compra.update({
      where: { idCompra },
      data: {
        estado: "ANULADA",
        observaciones,
      },
      select: compraSelect,
    });
  }

  async eliminarCompra(idCompra: number) {
    return await prisma.compra.delete({
      where: { idCompra },
      select: compraSelect,
    });
  }

  async obtenerResumen(filtros: CompraFiltros) {
    const where = construirWhere(filtros);
    const [total, cantidadCompras, porEstado] = await Promise.all([
      prisma.compra.aggregate({
        where,
        _sum: {
          total: true,
        },
      }),
      prisma.compra.count({ where }),
      prisma.compra.groupBy({
        by: ["estado"],
        where,
        _count: {
          estado: true,
        },
      }),
    ]);

    return {
      totalCompras: Number(total._sum.total ?? 0),
      cantidadCompras,
      porEstado: {
        PENDIENTE:
          porEstado.find((item) => item.estado === "PENDIENTE")?._count
            .estado ?? 0,
        COMPRADA:
          porEstado.find((item) => item.estado === "COMPRADA")?._count
            .estado ?? 0,
        ANULADA:
          porEstado.find((item) => item.estado === "ANULADA")?._count
            .estado ?? 0,
      },
    };
  }
}
