import { prisma } from "../../config/prisma";
import type { Prisma } from "../../../generated/prisma/client";
import type { EstadoPagoVenta } from "../../applications/validators/venta.validator";
import { ventaSelect } from "../../utils/selects/venta.select";

const ESTADO_PEDIDO_FINALIZADO = "FINALIZADO" as const;

export interface VentaFiltros {
  fechaInicio?: Date;
  fechaFin?: Date;
  idCliente?: number;
  estadoPago?: EstadoPagoVenta;
}

const redondearMoneda = (valor: number) => Math.round(valor * 100) / 100;

const construirWhere = (filtros: VentaFiltros = {}): Prisma.PedidoWhereInput => {
  const where: Prisma.PedidoWhereInput = {
    estadoPedido: ESTADO_PEDIDO_FINALIZADO,
  };

  if (filtros.idCliente) {
    where.idCliente = filtros.idCliente;
  }

  if (filtros.estadoPago) {
    where.estadoPago = filtros.estadoPago;
  }

  if (filtros.fechaInicio || filtros.fechaFin) {
    where.fechaFinalizado = {
      ...(filtros.fechaInicio ? { gte: filtros.fechaInicio } : {}),
      ...(filtros.fechaFin ? { lte: filtros.fechaFin } : {}),
    };
  }

  return where;
};

const contarEstadoPago = (resultados: any[], estadoPago: EstadoPagoVenta) =>
  resultados.find((item) => item.estadoPago === estadoPago)?._count
    .estadoPago ?? 0;

export class VentaRepository {
  async listarVentas(filtros: VentaFiltros = {}) {
    return await prisma.pedido.findMany({
      where: construirWhere(filtros),
      select: ventaSelect,
      orderBy: [
        {
          fechaFinalizado: "desc",
        },
        {
          idPedido: "desc",
        },
      ],
    });
  }

  async buscarVentas(termino: string) {
    const terminoLimpio = termino.trim();
    const idNumerico = Number(terminoLimpio);
    const filtrosId = Number.isInteger(idNumerico) && idNumerico > 0
      ? [{ idPedido: idNumerico }]
      : [];

    return await prisma.pedido.findMany({
      where: {
        estadoPedido: ESTADO_PEDIDO_FINALIZADO,
        OR: [
          ...filtrosId,
          {
            cliente: {
              nombre: {
                contains: terminoLimpio,
                mode: "insensitive",
              },
            },
          },
          {
            cliente: {
              correo: {
                contains: terminoLimpio,
                mode: "insensitive",
              },
            },
          },
          {
            cliente: {
              documento: {
                contains: terminoLimpio,
                mode: "insensitive",
              },
            },
          },
        ],
      } as any,
      select: ventaSelect,
      orderBy: [
        {
          fechaFinalizado: "desc",
        },
        {
          idPedido: "desc",
        },
      ],
    });
  }

  async obtenerResumen(filtros: VentaFiltros = {}) {
    const where = construirWhere(filtros);
    const [total, cantidadVentas, porEstadoPago] = await Promise.all([
      prisma.pedido.aggregate({
        where,
        _sum: {
          total: true,
        },
      }),
      prisma.pedido.count({ where }),
      prisma.pedido.groupBy({
        by: ["estadoPago"],
        where,
        _count: {
          estadoPago: true,
        },
      }),
    ]);

    const totalVentas = redondearMoneda(Number(total._sum.total ?? 0));

    return {
      totalVentas,
      cantidadVentas,
      ticketPromedio: cantidadVentas > 0
        ? redondearMoneda(totalVentas / cantidadVentas)
        : 0,
      ventasPagadasCompletas: contarEstadoPago(porEstadoPago, "COMPLETO"),
      ventasPagadasParciales: contarEstadoPago(porEstadoPago, "PARCIAL"),
    };
  }
}
