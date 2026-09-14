import { prisma } from "../../config/prisma";
import { Prisma } from "../../../generated/prisma/client";

const ESTADOS_PEDIDO = [
  "PENDIENTE",
  "EN_PROCESO",
  "PENDIENTE_SALDO_FINAL",
  "FINALIZADO",
  "ENTREGADO",
  "ANULADO",
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
  precioSugeridoInterno: true,
  requiereRevisionPrecio: true,
  advertenciasInternas: true,
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
  requiereDiseno: true,
  origenDiseno: true,
  archivoDisenoInicialUrl: true,
  esDisenoGeneral: true,
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
  idDetallePedido: true,
  esDisenoGeneral: true,
  archivoUrl: true,
  descripcion: true,
  observaciones: true,
  estado: true,
  origenDiseno: true,
  medioRecepcion: true,
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
  cotizacion: {
    select: {
      subtotal: true,
      descuentoTotal: true,
      costosAdicionales: true,
      total: true,
    },
  },
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
  fechaEntregaEstimada: true,
  fechaFinalizado: true,
  fechaEntregado: true,
  cotizacion: {
    select: {
      subtotal: true,
      descuentoTotal: true,
      costosAdicionales: true,
      total: true,
    },
  },
  cliente: {
    select: clienteResumenSelect,
  },
} as const;

const detalleCotizacionClienteSelect = {
  idDetalleCotizacion: true,
  idTecnica: true,
  idProducto: true,
  tipoProducto: true,
  nombrePersonalizado: true,
  descripcionPersonalizada: true,
  materialReferencia: true,
  suministradoPor: true,
  descripcion: true,
  cantidad: true,
  imagenReferencia: true,
  requiereDiseno: true,
  origenDiseno: true,
  archivoDisenoInicialUrl: true,
  esDisenoGeneral: true,
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
  estampados: {
    select: {
      idDetalleEstampadoCotizacion: true,
      idTecnica: true,
      ubicacion: true,
      anchoCm: true,
      altoCm: true,
      descripcion: true,
      observaciones: true,
      origenDiseno: true,
      grupoDisenoCompartido: true,
      tecnica: {
        select: {
          idTecnica: true,
          nombre: true,
        },
      },
    },
  },
} as const;

const cotizacionPendienteClienteSelect = {
  idCotizacion: true,
  estado: true,
  fechaCreacion: true,
  fechaActualizacion: true,
  observaciones: true,
  detalles: {
    select: detalleCotizacionClienteSelect,
    orderBy: {
      idDetalleCotizacion: "asc",
    },
  },
  versiones: {
    where: {
      esVigente: true,
      estado: {
        in: ["ENVIADA", "ACEPTADA", "AJUSTE_SOLICITADO"] as any,
      },
    },
    select: {
      idVersion: true,
      numeroVersion: true,
      precioFinal: true,
      descuentoManual: true,
      costosAdicionales: true,
      desgloseVisible: true,
      observacionesCliente: true,
      mensajeCliente: true,
      validaHasta: true,
      enviadaAt: true,
      estado: true,
      respuesta: {
        select: {
          decision: true,
          medio: true,
          fechaRespuesta: true,
          observaciones: true,
        },
      },
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

export type GranularidadTendencia = "DIA" | "SEMANA" | "MES" | "ANIO";

export interface TendenciaAdminRaw {
  fecha: string;
  ingresos: unknown;
  ventas: number | bigint | string;
  pedidos: number | bigint | string;
  cotizaciones: number | bigint | string;
}

const UNIDAD_SQL_POR_GRANULARIDAD: Record<GranularidadTendencia, string> = {
  DIA: "day",
  SEMANA: "week",
  MES: "month",
  ANIO: "year",
};

export const construirConsultaTendenciasAdmin = (
  fechaInicio: string,
  fechaFinExclusiva: string,
  granularidad: GranularidadTendencia,
) => {
  const unidadSql = UNIDAD_SQL_POR_GRANULARIDAD[granularidad];

  return Prisma.sql`
    WITH limites AS (
      SELECT
        ((CAST(${fechaInicio} AS date)::timestamp AT TIME ZONE 'America/Bogota') AT TIME ZONE 'UTC') AS inicio,
        ((CAST(${fechaFinExclusiva} AS date)::timestamp AT TIME ZONE 'America/Bogota') AT TIME ZONE 'UTC') AS fin
    ),
    eventos AS (
      SELECT
        date_trunc(${unidadSql}, ((a."fecha_confirmacion" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Bogota'))::date AS periodo,
        COALESCE(SUM(a."monto"), 0)::numeric AS ingresos,
        0::bigint AS ventas,
        0::bigint AS pedidos,
        0::bigint AS cotizaciones
      FROM "abonos" a
      CROSS JOIN limites l
      WHERE a."estado" = 'CONFIRMADO'
        AND a."fecha_confirmacion" >= l.inicio
        AND a."fecha_confirmacion" < l.fin
      GROUP BY 1

      UNION ALL

      SELECT
        date_trunc(${unidadSql}, ((v."fecha_primer_pago" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Bogota'))::date AS periodo,
        0::numeric AS ingresos,
        COUNT(*)::bigint AS ventas,
        0::bigint AS pedidos,
        0::bigint AS cotizaciones
      FROM "ventas" v
      CROSS JOIN limites l
      WHERE v."estado" <> 'ANULADA'
        AND v."fecha_primer_pago" >= l.inicio
        AND v."fecha_primer_pago" < l.fin
      GROUP BY 1

      UNION ALL

      SELECT
        date_trunc(${unidadSql}, ((p."fecha_creacion" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Bogota'))::date AS periodo,
        0::numeric AS ingresos,
        0::bigint AS ventas,
        COUNT(*)::bigint AS pedidos,
        0::bigint AS cotizaciones
      FROM "pedidos" p
      CROSS JOIN limites l
      WHERE p."fecha_creacion" >= l.inicio
        AND p."fecha_creacion" < l.fin
      GROUP BY 1

      UNION ALL

      SELECT
        date_trunc(${unidadSql}, ((c."fecha_creacion" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Bogota'))::date AS periodo,
        0::numeric AS ingresos,
        0::bigint AS ventas,
        0::bigint AS pedidos,
        COUNT(*)::bigint AS cotizaciones
      FROM "cotizaciones" c
      CROSS JOIN limites l
      WHERE c."fecha_creacion" >= l.inicio
        AND c."fecha_creacion" < l.fin
      GROUP BY 1
    )
    SELECT
      TO_CHAR(periodo, 'YYYY-MM-DD') AS fecha,
      COALESCE(SUM(ingresos), 0) AS ingresos,
      COALESCE(SUM(ventas), 0)::bigint AS ventas,
      COALESCE(SUM(pedidos), 0)::bigint AS pedidos,
      COALESCE(SUM(cotizaciones), 0)::bigint AS cotizaciones
    FROM eventos
    GROUP BY periodo
    ORDER BY periodo ASC
  `;
};

export class DashboardRepository {
  async obtenerTendenciasPorRango(
    fechaInicio: string,
    fechaFinExclusiva: string,
    granularidad: GranularidadTendencia,
  ) {
    return await prisma.$queryRaw<TendenciaAdminRaw[]>(
      construirConsultaTendenciasAdmin(
        fechaInicio,
        fechaFinExclusiva,
        granularidad,
      ),
    );
  }

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
        estado: {
          in: [
            "PENDIENTE",
            "SOLICITUD_RECIBIDA",
            "EN_REVISION",
            "PENDIENTE_APROBACION_CLIENTE",
            "AJUSTE_SOLICITADO",
          ],
        },
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
        estado: {
          in: [
            "PENDIENTE",
            "SOLICITUD_RECIBIDA",
            "EN_REVISION",
            "PENDIENTE_APROBACION_CLIENTE",
            "AJUSTE_SOLICITADO",
          ],
        },
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
        estado: {
          in: [
            "PENDIENTE",
            "SOLICITUD_RECIBIDA",
            "EN_REVISION",
            "PENDIENTE_APROBACION_CLIENTE",
            "AJUSTE_SOLICITADO",
            "VENCIDA",
          ],
        },
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
        estadoPedido: { in: ["FINALIZADO", "ENTREGADO", "ANULADO"] },
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
        estado: {
          in: [
            "PENDIENTE",
            "SOLICITUD_RECIBIDA",
            "EN_REVISION",
            "PENDIENTE_APROBACION_CLIENTE",
            "AJUSTE_SOLICITADO",
            "VENCIDA",
          ],
        },
      },
      take: limite,
      select: cotizacionPendienteClienteSelect,
      orderBy: {
        fechaCreacion: "desc",
      },
    });
  }
}
