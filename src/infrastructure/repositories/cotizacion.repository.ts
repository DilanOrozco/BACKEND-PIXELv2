import { prisma, runPrismaTransaction } from "../../config/prisma";
import type { EstadoCotizacion } from "../../../generated/prisma/enums";
import type { Prisma } from "../../../generated/prisma/client";
import { cotizacionSelect } from "../../utils/selects/cotizacion.select";
import { pedidoSelect } from "../../utils/selects/pedido.select";
import { looksNumeric, type ParsedPagination } from "../../utils/pagination.util";

const estadosCotizacion = [
  "PENDIENTE",
  "APROBADA",
  "ANULADA",
];

const buildCotizacionWhere = (
  filtros: { idCliente?: number } = {},
  search?: string | null,
): Prisma.CotizacionWhereInput => {
  const where: Prisma.CotizacionWhereInput = {};

  if (filtros.idCliente) {
    where.idCliente = filtros.idCliente;
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
  // Crea la cotizacion y sus detalles en una sola transaccion para evitar
  // cabeceras sin detalle si algo falla a mitad del proceso.
  async crearCotizacionConDetalles(data: any) {
    const { detalles, ...cotizacionData } = data;

    const cotizacionCreada = await runPrismaTransaction(async (tx) => {
      return await tx.cotizacion.create({
        data: {
          ...cotizacionData,
          detalles: {
            create: detalles,
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
    return await prisma.cotizacion.findUnique({
      where: { idCotizacion },
      select: cotizacionSelect,
    });
  }

  async listarCotizaciones() {
    return await prisma.cotizacion.findMany({
      select: cotizacionSelect,
      orderBy: {
        idCotizacion: "desc",
      },
    });
  }

  async listarPorCliente(idCliente: number) {
    return await prisma.cotizacion.findMany({
      where: { idCliente },
      select: cotizacionSelect,
      orderBy: {
        idCotizacion: "desc",
      },
    });
  }

  async listarCotizacionesPaginado(
    filtros: { idCliente?: number },
    pagination: ParsedPagination,
  ) {
    const where = buildCotizacionWhere(filtros, pagination.search);
    const [total, data] = await Promise.all([
      prisma.cotizacion.count({ where }),
      prisma.cotizacion.findMany({
        where,
        select: cotizacionSelect,
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
      select: cotizacionSelect,
      orderBy: {
        idCotizacion: "desc",
      },
    });
  }

  // Edicion de solicitud: solo actualiza el detalle existente. Si el cliente
  // quiere otra prenda o producto, debe crear una nueva cotizacion.
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
            "No se pueden agregar detalles al editar una solicitud. Crea una nueva cotizacion.",
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

  // Cotizar tambien es transaccional: primero actualiza todos los detalles y
  // luego recalcula los importes de la cabecera en el mismo commit.
  async cotizarCotizacion(
    idCotizacion: number,
    cotizacionData: any,
    detalles: any[],
  ) {
    await runPrismaTransaction(async (tx) => {
      for (const detalle of detalles) {
        const { idDetalleCotizacion, ...detalleData } = detalle;

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
