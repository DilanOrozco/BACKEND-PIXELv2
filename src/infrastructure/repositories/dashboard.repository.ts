import { prisma } from "../../config/prisma";

const ESTADOS_PEDIDO = [
  "PENDIENTE",
  "EN_PROCESO",
  "PENDIENTE_SALDO_FINAL",
  "FINALIZADO",
] as const;

const clienteResumenSelect = {
  idCliente: true,
  nombre: true,
  correo: true,
  telefono: true,
} as const;

const ultimoPedidoSelect = {
  idPedido: true,
  estadoPedido: true,
  estadoPago: true,
  total: true,
  totalPagado: true,
  saldoPendiente: true,
  fechaCreacion: true,
  cliente: {
    select: clienteResumenSelect,
  },
} as const;

const cotizacionPendienteAdminSelect = {
  idCotizacion: true,
  estado: true,
  total: true,
  fechaCreacion: true,
  cliente: {
    select: clienteResumenSelect,
  },
} as const;

const detallePedidoClienteSelect = {
  idDetallePedido: true,
  idTecnica: true,
  idProducto: true,
  descripcion: true,
  cantidad: true,
  precioUnitario: true,
  subtotal: true,
  observaciones: true,
  tecnica: {
    select: {
      idTecnica: true,
      nombre: true,
    },
  },
  producto: {
    select: {
      idProducto: true,
      nombre: true,
    },
  },
} as const;

const abonoClienteSelect = {
  idAbono: true,
  idPedido: true,
  monto: true,
  metodoPago: true,
  referencia: true,
  comprobanteUrl: true,
  estado: true,
  fechaCreacion: true,
  fechaConfirmacion: true,
} as const;

const disenoClienteSelect = {
  idDiseno: true,
  idPedido: true,
  archivoUrl: true,
  descripcion: true,
  observaciones: true,
  estado: true,
  fechaCreacion: true,
  fechaActualizacion: true,
  fechaEnvio: true,
  fechaAprobacion: true,
} as const;

const pedidoActivoClienteSelect = {
  idPedido: true,
  idCliente: true,
  estadoPedido: true,
  estadoPago: true,
  total: true,
  totalPagado: true,
  saldoPendiente: true,
  fechaCreacion: true,
  fechaEntregaEstimada: true,
  cliente: {
    select: clienteResumenSelect,
  },
  detalles: {
    select: detallePedidoClienteSelect,
    orderBy: {
      idDetallePedido: "asc",
    },
  },
  abonos: {
    select: abonoClienteSelect,
    orderBy: {
      fechaCreacion: "desc",
    },
  },
  disenos: {
    select: disenoClienteSelect,
    orderBy: {
      fechaCreacion: "desc",
    },
  },
} as const;

const historialPedidoClienteSelect = {
  idPedido: true,
  idCliente: true,
  estadoPedido: true,
  estadoPago: true,
  total: true,
  totalPagado: true,
  saldoPendiente: true,
  fechaCreacion: true,
  cliente: {
    select: clienteResumenSelect,
  },
} as const;

const detalleCotizacionClienteSelect = {
  idDetalleCotizacion: true,
  idTecnica: true,
  idProducto: true,
  descripcion: true,
  cantidad: true,
  precioBase: true,
  descuentoPorcentaje: true,
  descuentoValorUnitario: true,
  precioUnitario: true,
  subtotal: true,
  subtotalBruto: true,
  descuentoTotal: true,
  subtotalConDescuento: true,
  imagenReferencia: true,
  observaciones: true,
  tecnica: {
    select: {
      idTecnica: true,
      nombre: true,
    },
  },
  producto: {
    select: {
      idProducto: true,
      nombre: true,
    },
  },
} as const;

const cotizacionPendienteClienteSelect = {
  idCotizacion: true,
  estado: true,
  total: true,
  fechaCreacion: true,
  detalles: {
    select: detalleCotizacionClienteSelect,
    orderBy: {
      idDetalleCotizacion: "asc",
    },
  },
} as const;

export interface RangoFechas {
  fechaInicio: Date;
  fechaFin: Date;
}

export interface VentaPorMesRaw {
  numeroMes: number | bigint | string;
  total: unknown;
  cantidadPedidos: number | bigint | string;
}

export class DashboardRepository {
  async contarPedidos() {
    return await prisma.pedido.count();
  }

  async contarPedidosPorEstado() {
    return await prisma.pedido.groupBy({
      by: ["estadoPedido"],
      where: {
        estadoPedido: {
          in: [...ESTADOS_PEDIDO],
        },
      },
      _count: {
        _all: true,
      },
    });
  }

  async contarClientesActivos() {
    return await prisma.cliente.count({
      where: {
        estado: true,
      },
    });
  }

  async contarCotizacionesPendientes() {
    return await prisma.cotizacion.count({
      where: {
        estado: "PENDIENTE",
      },
    });
  }

  async sumarIngresosPorRango(fechaInicio: Date, fechaFin: Date) {
    const resultado = await prisma.abonos.aggregate({
      where: {
        estado: "CONFIRMADO",
        fechaConfirmacion: {
          gte: fechaInicio,
          lt: fechaFin,
        },
      },
      _sum: {
        monto: true,
      },
    });

    return Number(resultado._sum.monto ?? 0);
  }

  async ventasPorMes(anio: number) {
    const fechaInicio = new Date(anio, 0, 1);
    const fechaFin = new Date(anio + 1, 0, 1);

    return await prisma.$queryRaw<VentaPorMesRaw[]>`
      SELECT
        EXTRACT(MONTH FROM "fecha_confirmacion")::int AS "numeroMes",
        COALESCE(SUM("monto"), 0) AS "total",
        COUNT(DISTINCT "id_pedido")::int AS "cantidadPedidos"
      FROM "abonos"
      WHERE "estado" = 'CONFIRMADO'
        AND "fecha_confirmacion" >= ${fechaInicio}
        AND "fecha_confirmacion" < ${fechaFin}
      GROUP BY EXTRACT(MONTH FROM "fecha_confirmacion")
      ORDER BY "numeroMes" ASC
    `;
  }

  async obtenerUltimosPedidos(limite: number) {
    return await prisma.pedido.findMany({
      take: limite,
      select: ultimoPedidoSelect,
      orderBy: {
        fechaCreacion: "desc",
      },
    });
  }

  async obtenerCotizacionesPendientes(limite: number) {
    return await prisma.cotizacion.findMany({
      where: {
        estado: "PENDIENTE",
      },
      take: limite,
      select: cotizacionPendienteAdminSelect,
      orderBy: {
        fechaCreacion: "desc",
      },
    });
  }

  async contarPedidosCliente(idCliente: number) {
    return await prisma.pedido.count({
      where: {
        idCliente,
      },
    });
  }

  async contarPedidosClientePorEstado(idCliente: number) {
    return await prisma.pedido.groupBy({
      by: ["estadoPedido"],
      where: {
        idCliente,
        estadoPedido: {
          in: [...ESTADOS_PEDIDO],
        },
      },
      _count: {
        _all: true,
      },
    });
  }

  async contarCotizacionesPendientesCliente(idCliente: number) {
    return await prisma.cotizacion.count({
      where: {
        idCliente,
        estado: "PENDIENTE",
      },
    });
  }

  async sumarTotalGastadoCliente(idCliente: number) {
    const resultado = await prisma.abonos.aggregate({
      where: {
        estado: "CONFIRMADO",
        pedido: {
          is: {
            idCliente,
          },
        },
      },
      _sum: {
        monto: true,
      },
    });

    return Number(resultado._sum.monto ?? 0);
  }

  async sumarSaldoPendienteCliente(idCliente: number) {
    const resultado = await prisma.pedido.aggregate({
      where: {
        idCliente,
        estadoPago: {
          not: "COMPLETO",
        },
      },
      _sum: {
        saldoPendiente: true,
      },
    });

    return Number(resultado._sum.saldoPendiente ?? 0);
  }

  async obtenerPedidoActivoCliente(idCliente: number) {
    return await prisma.pedido.findFirst({
      where: {
        idCliente,
        estadoPedido: {
          in: ["PENDIENTE", "EN_PROCESO", "PENDIENTE_SALDO_FINAL"],
        },
      },
      select: pedidoActivoClienteSelect,
      orderBy: {
        fechaCreacion: "desc",
      },
    });
  }

  async obtenerPedidosActivosCliente(idCliente: number) {
    return await prisma.pedido.findMany({
      where: {
        idCliente,
        OR: [
          {
            estadoPedido: {
              in: ["PENDIENTE", "EN_PROCESO", "PENDIENTE_SALDO_FINAL"],
            },
          },
          {
            estadoPedido: "FINALIZADO",
            OR: [
              {
                saldoPendiente: {
                  gt: 0,
                },
              },
              {
                fechaEntregado: null,
              },
            ],
          },
        ],
      },
      select: pedidoActivoClienteSelect,
      orderBy: [
        {
          fechaCreacion: "desc",
        },
        {
          idPedido: "desc",
        },
      ],
    });
  }

  async obtenerHistorialPedidosCliente(idCliente: number, limite: number) {
    return await prisma.pedido.findMany({
      where: {
        idCliente,
        estadoPedido: "FINALIZADO",
      },
      take: limite,
      select: historialPedidoClienteSelect,
      orderBy: {
        fechaCreacion: "desc",
      },
    });
  }

  async obtenerCotizacionesPendientesCliente(
    idCliente: number,
    limite: number,
  ) {
    return await prisma.cotizacion.findMany({
      where: {
        idCliente,
        estado: "PENDIENTE",
      },
      take: limite,
      select: cotizacionPendienteClienteSelect,
      orderBy: {
        fechaCreacion: "desc",
      },
    });
  }
}
