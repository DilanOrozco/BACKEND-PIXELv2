import { prisma, runPrismaTransaction } from "../../config/prisma";
import type { EstadoCotizacion } from "../../../generated/prisma/enums";
import type { Prisma } from "../../../generated/prisma/client";
import {
  cotizacionListadoSelect,
  cotizacionSelect,
} from "../../utils/selects/cotizacion.select";
import { pedidoSelect } from "../../utils/selects/pedido.select";
import { looksNumeric, type ParsedPagination } from "../../utils/pagination.util";

const estadosCotizacion = [
  "PENDIENTE",
  "APROBADA",
  "ANULADA",
  "BORRADOR",
  "SOLICITUD_RECIBIDA",
  "EN_REVISION",
  "PENDIENTE_APROBACION_CLIENTE",
  "AJUSTE_SOLICITADO",
  "ACEPTADA",
  "RECHAZADA_CLIENTE",
  "VENCIDA",
  "CONVERTIDA_EN_PEDIDO",
] as const;

export type CotizacionListadoFiltros = {
  idCliente?: number;
  estado?: EstadoCotizacion;
  excluirConvertidas?: boolean;
};

const buildCotizacionWhere = (
  filtros: CotizacionListadoFiltros = {},
  search?: string | null,
): Prisma.CotizacionWhereInput => {
  const where: Prisma.CotizacionWhereInput = {};

  if (filtros.idCliente) {
    where.idCliente = filtros.idCliente;
  }

  if (filtros.estado) {
    where.estado = filtros.estado;
  } else if (filtros.excluirConvertidas) {
    where.estado = { not: "CONVERTIDA_EN_PEDIDO" };
  }

  if (!search) {
    return where;
  }

  const termino = search.trim();
  const terminoMinuscula = termino.toLowerCase();
  const estadosCoincidentes = estadosCotizacion.filter((estado) =>
    estado.toLowerCase().startsWith(terminoMinuscula),
  );

  if (looksNumeric(termino)) {
    where.idCotizacion = Number(termino);
    return where;
  }

  where.OR = [
    ...(estadosCoincidentes.length > 0
      ? [{ estado: { in: estadosCoincidentes as any } }]
      : []),
    {
      tipoCotizacion: {
        startsWith: termino,
        mode: "insensitive",
      },
    },
    {
      cliente: {
        nombre: {
          contains: termino,
          mode: "insensitive",
        },
      },
    },
  ];

  return where;
};

const buildCotizacionOrderBy = (pagination: ParsedPagination) => ({
  [pagination.sortBy]: pagination.order,
});

export class CotizacionRepository {
  private async marcarPropuestasVencidas() {
    const ahora = new Date();
    await prisma.cotizacion.updateMany({
      where: {
        estado: "PENDIENTE_APROBACION_CLIENTE",
        versiones: {
          some: {
            esVigente: true,
            estado: "ENVIADA",
            validaHasta: { lte: ahora },
          },
        },
      },
      data: { estado: "VENCIDA" },
    });
    await prisma.cotizacionVersion.updateMany({
      where: {
        esVigente: true,
        estado: "ENVIADA",
        validaHasta: { lte: ahora },
      },
      data: { estado: "VENCIDA", esVigente: false },
    });
  }

  // Crea la cotizacion y sus detalles en una sola transaccion para evitar
  // cabeceras sin detalle si algo falla a mitad del proceso.
  async crearCotizacionConDetalles(data: any) {
    const { detalles, ...cotizacionData } = data;

    const cotizacionCreada = await runPrismaTransaction(async (tx) => {
      return await tx.cotizacion.create({
        data: {
          ...cotizacionData,
          detalles: {
            create: detalles.map((detalle: any) => {
              const { estampados = [], ...detalleData } = detalle;
              return {
                ...detalleData,
                ...(estampados.length > 0
                  ? { estampados: { create: estampados } }
                  : {}),
              };
            }),
          },
        },
        select: { idCotizacion: true },
      });
    });

    const cotizacion = await this.buscarPorId(cotizacionCreada.idCotizacion);

    if (!cotizacion) {
      throw new Error("No fue posible cargar la cotizacion creada.");
    }

    return cotizacion;
  }

  async buscarPorId(idCotizacion: number) {
    await this.marcarPropuestasVencidas();
    return await prisma.cotizacion.findUnique({
      where: { idCotizacion },
      select: cotizacionSelect,
    });
  }

  async listarCotizaciones(filtros: CotizacionListadoFiltros = {}) {
    await this.marcarPropuestasVencidas();
    return await prisma.cotizacion.findMany({
      where: buildCotizacionWhere(filtros),
      select: cotizacionListadoSelect,
      orderBy: {
        idCotizacion: "desc",
      },
    });
  }

  async listarPorCliente(idCliente: number) {
    await this.marcarPropuestasVencidas();
    return await prisma.cotizacion.findMany({
      where: { idCliente },
      select: cotizacionListadoSelect,
      orderBy: {
        idCotizacion: "desc",
      },
    });
  }

  async reemplazarSolicitud(
    idCotizacion: number,
    cotizacionData: any,
    detalles: any[],
  ) {
    await runPrismaTransaction(async (tx) => {
      await tx.detalleCotizacion.deleteMany({ where: { idCotizacion } });

      for (const detalle of detalles) {
        const { estampados = [], ...detalleData } = detalle;
        await tx.detalleCotizacion.create({
          data: {
            ...detalleData,
            idCotizacion,
            ...(estampados.length > 0
              ? { estampados: { create: estampados } }
              : {}),
          },
        });
      }

      await tx.cotizacionVersion.updateMany({
        where: { idCotizacion, esVigente: true },
        data: { esVigente: false, estado: "INVALIDADA" },
      });
      await tx.cotizacion.update({
        where: { idCotizacion },
        data: cotizacionData,
      });
    });

    return await this.buscarPorId(idCotizacion);
  }

  async listarCotizacionesPaginado(
    filtros: CotizacionListadoFiltros,
    pagination: ParsedPagination,
  ) {
    await this.marcarPropuestasVencidas();
    const where = buildCotizacionWhere(filtros, pagination.search);
    const [total, data] = await Promise.all([
      prisma.cotizacion.count({ where }),
      prisma.cotizacion.findMany({
        where,
        select: cotizacionListadoSelect,
        orderBy: buildCotizacionOrderBy(pagination),
        skip: pagination.skip,
        take: pagination.limit,
      }),
    ]);

    return { data, total };
  }

  async buscarParcial(termino: string) {
    const terminoLimpio = termino.trim();
    const terminoMinuscula = terminoLimpio.toLowerCase();
    const estadosCoincidentes = estadosCotizacion.filter((estado) =>
      estado.toLowerCase().includes(terminoMinuscula),
    );

    const filtrosEstado =
      estadosCoincidentes.length > 0
        ? [{ estado: { in: estadosCoincidentes } }]
        : [];

    return await prisma.cotizacion.findMany({
      where: {
        OR: [
          ...filtrosEstado,
          {
            tipoCotizacion: {
              contains: terminoLimpio,
              mode: "insensitive",
            },
          },
          {
            cliente: {
              nombre: {
                contains: terminoLimpio,
                mode: "insensitive",
              },
            },
          },
        ],
      } as any,
      select: cotizacionListadoSelect,
      orderBy: {
        idCotizacion: "desc",
      },
    });
  }

  // La edicion del cliente actualiza los detalles existentes sin alterar sus
  // relaciones ni permitir que se adjunten detalles de otra cotizacion.
  async actualizarSolicitudCliente(
    idCotizacion: number,
    cotizacionData: any,
    detalles: any[],
  ) {
    await runPrismaTransaction(async (tx) => {
      await tx.cotizacion.update({
        where: { idCotizacion },
        data: cotizacionData,
      });

      for (const detalle of detalles) {
        const { idDetalleCotizacion, ...detalleData } = detalle;

        if (!idDetalleCotizacion) {
          throw new Error(
            "No se pueden agregar detalles desde esta edicion.",
          );
        }

        const resultado = await tx.detalleCotizacion.updateMany({
          where: {
            idDetalleCotizacion,
            idCotizacion,
          },
          data: detalleData,
        });

        if (resultado.count === 0) {
          throw new Error(
            `El detalle ${idDetalleCotizacion} no pertenece a esta cotizacion.`,
          );
        }
      }

    });

    return await this.buscarPorId(idCotizacion);
  }

  // Cotizar permite actualizar, agregar y quitar items. La lectura completa se
  // hace despues del commit para mantener corta la transaccion.
  async cotizarCotizacion(
    idCotizacion: number,
    cotizacionData: any,
    detalles: any[],
  ) {
    await runPrismaTransaction(async (tx) => {
      const idsConservados = detalles
        .map((detalle) => Number(detalle.idDetalleCotizacion))
        .filter((idDetalle) => Number.isInteger(idDetalle) && idDetalle > 0);

      await tx.detalleCotizacion.deleteMany({
        where: {
          idCotizacion,
          ...(idsConservados.length > 0
            ? { idDetalleCotizacion: { notIn: idsConservados } }
            : {}),
        },
      });

      const detallesNuevos = [];

      for (const detalle of detalles) {
        const { idDetalleCotizacion, ...detalleData } = detalle;

        if (!idDetalleCotizacion) {
          detallesNuevos.push({
            ...detalleData,
            idCotizacion,
          });
          continue;
        }

        const resultado = await tx.detalleCotizacion.updateMany({
          where: {
            idDetalleCotizacion,
            idCotizacion,
          },
          data: detalleData,
        });

        if (resultado.count === 0) {
          throw new Error(
            `El detalle ${idDetalleCotizacion} no pertenece a esta cotizacion.`,
          );
        }
      }

      if (detallesNuevos.length > 0) {
        await tx.detalleCotizacion.createMany({
          data: detallesNuevos,
        });
      }

      await tx.cotizacion.update({
        where: { idCotizacion },
        data: cotizacionData,
      });

    });

    return await this.buscarPorId(idCotizacion);
  }

  async actualizarCotizacion(idCotizacion: number, data: any) {
    return await prisma.cotizacion.update({
      where: { idCotizacion },
      data,
      select: cotizacionSelect,
    });
  }

  async cambiarEstado(idCotizacion: number, estado: EstadoCotizacion) {
    return await prisma.cotizacion.update({
      where: { idCotizacion },
      data: { estado },
      select: cotizacionSelect,
    });
  }

  async aprobarYCrearPedido(
    idCotizacion: number,
    estado: EstadoCotizacion,
    pedidoData: any,
  ) {
    const { detalles, ...pedidoCabecera } = pedidoData;

    const pedidoCreado = await runPrismaTransaction(async (tx) => {
      const pedidoExistente = await tx.pedido.findFirst({
        where: { idCotizacion },
        select: { idPedido: true },
      });

      if (pedidoExistente) {
        throw new Error("Ya existe un pedido creado para esta cotizacion.");
      }

      await tx.cotizacion.update({
        where: { idCotizacion },
        data: { estado },
      });

      const pedido = await tx.pedido.create({
        data: {
          ...pedidoCabecera,
          detalles: {
            create: detalles,
          },
        },
        select: { idPedido: true },
      });

      return pedido;
    });

    const [cotizacion, pedido] = await Promise.all([
      this.buscarPorId(idCotizacion),
      prisma.pedido.findUnique({
        where: { idPedido: pedidoCreado.idPedido },
        select: pedidoSelect,
      }),
    ]);

    if (!cotizacion || !pedido) {
      throw new Error("No fue posible cargar la cotizacion o el pedido creado.");
    }

    return { cotizacion, pedido };
  }

  async eliminarCotizacion(idCotizacion: number) {
    return await prisma.cotizacion.delete({
      where: { idCotizacion },
      select: { idCotizacion: true },
    });
  }
}
