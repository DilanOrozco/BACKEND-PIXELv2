import { prisma, runPrismaTransaction } from "../../config/prisma";
import type { Prisma } from "../../../generated/prisma/client";
import { pedidoSelect } from "../../utils/selects/pedido.select";
import { looksNumeric, type ParsedPagination } from "../../utils/pagination.util";

const estadosPedido = [
  "PENDIENTE",
  "EN_PROCESO",
  "PENDIENTE_SALDO_FINAL",
  "FINALIZADO",
  "ENTREGADO",
  "ANULADO",
];
type PrismaExecutor = Prisma.TransactionClient | typeof prisma;

const db = (tx?: Prisma.TransactionClient): PrismaExecutor => tx ?? prisma;

const pedidoOperacionSelect = {
  idPedido: true,
  estadoPedido: true,
} as const;

const buildPedidoWhere = (
  filtros: { idCliente?: number } = {},
  search?: string | null,
): Prisma.PedidoWhereInput => {
  const where: Prisma.PedidoWhereInput = {};

  if (filtros.idCliente) {
    where.idCliente = filtros.idCliente;
  }

  if (!search) {
    return where;
  }

  const termino = search.trim();
  const terminoMinuscula = termino.toLowerCase();
  const estadosCoincidentes = estadosPedido.filter((estado) =>
    estado.toLowerCase().startsWith(terminoMinuscula),
  );

  if (looksNumeric(termino)) {
    const idNumerico = Number(termino);
    where.OR = [{ idPedido: idNumerico }, { idCotizacion: idNumerico }];
    return where;
  }

  where.OR = [
    ...(estadosCoincidentes.length > 0
      ? [{ estadoPedido: { in: estadosCoincidentes as any } }]
      : []),
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

const buildPedidoOrderBy = (pagination: ParsedPagination) => ({
  [pagination.sortBy]: pagination.order,
});

const cotizacionParaPedidoSelect = {
  idCotizacion: true,
  idCliente: true,
  creadoPorId: true,
  estado: true,
  subtotal: true,
  descuentoTotal: true,
  costosAdicionales: true,
  total: true,
  observaciones: true,
  cliente: {
    select: {
      idCliente: true,
      nombre: true,
      telefono: true,
      correo: true,
    },
  },
  creadoPor: {
    select: {
      idUsuario: true,
      nombre: true,
      correo: true,
      rol: { select: { idRol: true, nombre: true } },
    },
  },
  detalles: {
    select: {
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
      observaciones: true,
      tecnica: { select: { idTecnica: true, nombre: true } },
      producto: { select: { idProducto: true, nombre: true } },
    },
  },
};

export class PedidoRepository {
  async buscarCotizacionParaPedido(idCotizacion: number) {
    return await prisma.cotizacion.findUnique({
      where: { idCotizacion },
      select: cotizacionParaPedidoSelect,
    });
  }

  async buscarPorCotizacion(idCotizacion: number) {
    return await prisma.pedido.findFirst({
      where: { idCotizacion },
      select: { idPedido: true },
    });
  }

  async crearDesdeCotizacion(data: any) {
    const { detalles, ...pedidoData } = data;

    const pedidoCreado = await runPrismaTransaction(async (tx) => {
      const pedidoExistente = await tx.pedido.findFirst({
        where: { idCotizacion: pedidoData.idCotizacion },
        select: { idPedido: true },
      });

      if (pedidoExistente) {
        throw new Error("Ya existe un pedido creado para esta cotizacion.");
      }

      return await tx.pedido.create({
        data: {
          ...pedidoData,
          detalles: {
            create: detalles,
          },
        },
        select: { idPedido: true },
      });
    });

    const pedido = await this.buscarPorId(pedidoCreado.idPedido);

    if (!pedido) {
      throw new Error("No fue posible cargar el pedido creado.");
    }

    return pedido;
  }

  async listarPedidos() {
    return await prisma.pedido.findMany({
      select: pedidoSelect,
      orderBy: {
        idPedido: "desc",
      },
    });
  }

  async listarPorCliente(idCliente: number) {
    return await prisma.pedido.findMany({
      where: { idCliente },
      select: pedidoSelect,
      orderBy: {
        idPedido: "desc",
      },
    });
  }

  async listarPedidosPaginado(
    filtros: { idCliente?: number },
    pagination: ParsedPagination,
  ) {
    const where = buildPedidoWhere(filtros, pagination.search);
    const [total, data] = await Promise.all([
      prisma.pedido.count({ where }),
      prisma.pedido.findMany({
        where,
        select: pedidoSelect,
        orderBy: buildPedidoOrderBy(pagination),
        skip: pagination.skip,
        take: pagination.limit,
      }),
    ]);

    return { data, total };
  }

  async buscarPorId(idPedido: number, tx?: Prisma.TransactionClient) {
    return await db(tx).pedido.findUnique({
      where: { idPedido },
      select: pedidoSelect,
    });
  }

  async buscarOperacionPorId(
    idPedido: number,
    tx?: Prisma.TransactionClient,
  ) {
    return await db(tx).pedido.findUnique({
      where: { idPedido },
      select: pedidoOperacionSelect,
    });
  }

  async buscarParcial(termino: string) {
    const terminoLimpio = termino.trim();
    const terminoMinuscula = terminoLimpio.toLowerCase();
    const idNumerico = Number(terminoLimpio);
    const estadosCoincidentes = estadosPedido.filter((estado) =>
      estado.toLowerCase().includes(terminoMinuscula),
    );

    const filtrosEstado =
      estadosCoincidentes.length > 0
        ? [{ estadoPedido: { in: estadosCoincidentes } }]
        : [];

    const filtrosId = Number.isInteger(idNumerico) && idNumerico > 0
      ? [{ idPedido: idNumerico }, { idCotizacion: idNumerico }]
      : [];

    return await prisma.pedido.findMany({
      where: {
        OR: [
          ...filtrosEstado,
          ...filtrosId,
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
      select: pedidoSelect,
      orderBy: {
        idPedido: "desc",
      },
    });
  }

  async actualizarPedido(
    idPedido: number,
    data: any,
    tx?: Prisma.TransactionClient,
  ) {
    return await db(tx).pedido.update({
      where: { idPedido },
      data,
      select: pedidoSelect,
    });
  }

  async actualizarPedidoOperacion(
    idPedido: number,
    data: any,
    tx?: Prisma.TransactionClient,
  ) {
    return await db(tx).pedido.update({
      where: { idPedido },
      data,
      select: pedidoOperacionSelect,
    });
  }

  async buscarDetallePedido(
    idDetallePedido: number,
    tx?: Prisma.TransactionClient,
  ) {
    return await db(tx).detallePedido.findUnique({
      where: { idDetallePedido },
      select: {
        idDetallePedido: true,
        idPedido: true,
        requiereDiseno: true,
      },
    });
  }

  async actualizarRequiereDisenoDetalle(
    idDetallePedido: number,
    requiereDiseno: boolean,
    tx?: Prisma.TransactionClient,
  ) {
    return await db(tx).detallePedido.update({
      where: { idDetallePedido },
      data: { requiereDiseno },
      select: {
        idDetallePedido: true,
        idPedido: true,
        requiereDiseno: true,
      },
    });
  }
}
