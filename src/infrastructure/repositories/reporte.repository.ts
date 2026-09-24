import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../config/prisma";
import type { FiltrosReporte } from "../../applications/validators/reporte.validator";

export interface ResumenVentasRaw {
  cantidadVentas: bigint | number | string;
  totalVendido: unknown;
  cantidadClientes: bigint | number | string;
}

const rangoFecha = (filtros: FiltrosReporte) =>
  filtros.fechaInicioUtc && filtros.fechaFinExclusivaUtc
    ? { gte: filtros.fechaInicioUtc, lt: filtros.fechaFinExclusivaUtc }
    : undefined;

const whereVentas = (filtros: FiltrosReporte): Prisma.VentaWhereInput => {
  const where: Prisma.VentaWhereInput = { estado: { not: "ANULADA" } };
  const fecha = rangoFecha(filtros);
  if (fecha) where.fechaPrimerPago = fecha;
  if (filtros.idCliente) where.idCliente = filtros.idCliente;
  if (filtros.estadoPago) where.pedido = { estadoPago: filtros.estadoPago };
  return where;
};

const wherePedidos = (filtros: FiltrosReporte): Prisma.PedidoWhereInput => {
  const where: Prisma.PedidoWhereInput = {};
  const fecha = rangoFecha(filtros);
  if (fecha) where.fechaCreacion = fecha;
  if (filtros.idCliente) where.idCliente = filtros.idCliente;
  if (filtros.estadoPedido) where.estadoPedido = filtros.estadoPedido;
  return where;
};

const whereCotizaciones = (filtros: FiltrosReporte): Prisma.CotizacionWhereInput => {
  const where: Prisma.CotizacionWhereInput = {};
  const fecha = rangoFecha(filtros);
  if (fecha) where.fechaCreacion = fecha;
  if (filtros.idCliente) where.idCliente = filtros.idCliente;
  if (filtros.estadoCotizacion) where.estado = filtros.estadoCotizacion;
  return where;
};

const whereAbonos = (filtros: FiltrosReporte): Prisma.AbonosWhereInput => {
  const where: Prisma.AbonosWhereInput = {};
  if (filtros.idCliente) where.pedido = { idCliente: filtros.idCliente };
  if (filtros.idPedido) where.idPedido = filtros.idPedido;
  if (filtros.estadoAbono) where.estado = filtros.estadoAbono;
  const fecha = rangoFecha(filtros);
  if (fecha) {
    where.AND = [{
      OR: [
        { estado: "CONFIRMADO", fechaConfirmacion: fecha },
        { estado: { not: "CONFIRMADO" }, fechaCreacion: fecha },
      ],
    }];
  }
  return where;
};

const condicionesVentasSql = (filtros: FiltrosReporte) => {
  const condiciones: Prisma.Sql[] = [Prisma.sql`v."estado"::text <> 'ANULADA'`];
  if (filtros.fechaInicioUtc) {
    condiciones.push(Prisma.sql`v."fecha_primer_pago" >= ${filtros.fechaInicioUtc}`);
  }
  if (filtros.fechaFinExclusivaUtc) {
    condiciones.push(Prisma.sql`v."fecha_primer_pago" < ${filtros.fechaFinExclusivaUtc}`);
  }
  if (filtros.idCliente) {
    condiciones.push(Prisma.sql`v."id_cliente" = ${filtros.idCliente}`);
  }
  if (filtros.estadoPago) {
    condiciones.push(Prisma.sql`p."estadoPago"::text = ${filtros.estadoPago}`);
  }
  return Prisma.sql`WHERE ${Prisma.join(condiciones, " AND ")}`;
};

export class ReporteRepository {
  async resumenVentas(filtros: FiltrosReporte) {
    const whereSql = condicionesVentasSql(filtros);
    const resultados = await prisma.$queryRaw<ResumenVentasRaw[]>`
      SELECT
        COUNT(*)::bigint AS "cantidadVentas",
        COALESCE(SUM(v."total_pedido"), 0) AS "totalVendido",
        COUNT(DISTINCT v."id_cliente")::bigint AS "cantidadClientes"
      FROM "ventas" v
      INNER JOIN "pedidos" p ON p."id_pedido" = v."id_pedido"
      ${whereSql}
    `;
    return resultados[0] ?? { cantidadVentas: 0, totalVendido: 0, cantidadClientes: 0 };
  }

  async listarVentas(filtros: FiltrosReporte, take: number, skip = 0) {
    return await prisma.venta.findMany({
      where: whereVentas(filtros),
      relationLoadStrategy: "join",
      select: {
        idVenta: true,
        idPedido: true,
        idCliente: true,
        totalPedido: true,
        fechaPrimerPago: true,
        estado: true,
        cliente: { select: { idCliente: true, nombre: true } },
        pedido: { select: { estadoPago: true } },
      },
      orderBy: [{ fechaPrimerPago: "desc" }, { idVenta: "desc" }],
      skip,
      take,
    });
  }

  async resumenPedidos(filtros: FiltrosReporte) {
    return await prisma.pedido.groupBy({
      by: ["estadoPedido"],
      where: wherePedidos(filtros),
      _count: { _all: true },
    });
  }

  async listarPedidos(filtros: FiltrosReporte, take: number, skip = 0) {
    return await prisma.pedido.findMany({
      where: wherePedidos(filtros),
      relationLoadStrategy: "join",
      select: {
        idPedido: true,
        idCliente: true,
        fechaCreacion: true,
        estadoPedido: true,
        fechaEntregaEstimada: true,
        total: true,
        cliente: { select: { idCliente: true, nombre: true } },
      },
      orderBy: [{ fechaCreacion: "desc" }, { idPedido: "desc" }],
      skip,
      take,
    });
  }

  async resumenCotizaciones(filtros: FiltrosReporte) {
    return await prisma.cotizacion.groupBy({
      by: ["estado"],
      where: whereCotizaciones(filtros),
      _count: { _all: true },
    });
  }

  async listarCotizaciones(filtros: FiltrosReporte, take: number, skip = 0) {
    return await prisma.cotizacion.findMany({
      where: whereCotizaciones(filtros),
      relationLoadStrategy: "join",
      select: {
        idCotizacion: true,
        idCliente: true,
        fechaCreacion: true,
        estado: true,
        cliente: { select: { idCliente: true, nombre: true } },
        versiones: {
          where: { esVigente: true },
          select: { precioFinal: true },
          orderBy: { numeroVersion: "desc" },
          take: 1,
        },
        pedidos: {
          select: { idPedido: true },
          orderBy: { idPedido: "desc" },
          take: 1,
        },
      },
      orderBy: [{ fechaCreacion: "desc" }, { idCotizacion: "desc" }],
      skip,
      take,
    });
  }

  async resumenAbonos(filtros: FiltrosReporte) {
    return await prisma.abonos.groupBy({
      by: ["estado"],
      where: whereAbonos(filtros),
      _count: { _all: true },
      _sum: { monto: true },
    });
  }

  async listarAbonos(filtros: FiltrosReporte, take: number, skip = 0) {
    return await prisma.abonos.findMany({
      where: whereAbonos(filtros),
      relationLoadStrategy: "join",
      select: {
        idAbono: true,
        idPedido: true,
        monto: true,
        referencia: true,
        estado: true,
        fechaCreacion: true,
        fechaConfirmacion: true,
        pedido: {
          select: {
            cliente: { select: { idCliente: true, nombre: true } },
          },
        },
      },
      orderBy: [{ fechaCreacion: "desc" }, { idAbono: "desc" }],
      skip,
      take,
    });
  }
}
