import { prisma } from "../../config/prisma";
import type { Prisma } from "../../../generated/prisma/client";
import type { EstadoAbonoPermitido, MetodoPagoPermitido } from "../../applications/validators/abono.validator";
import { abonoSelect } from "../../utils/selects/abono.select";
import { pedidoSelect } from "../../utils/selects/pedido.select";
import { DisenoRepository } from "./diseno.repository";
import type { ParsedPagination } from "../../utils/pagination.util";

type PrismaExecutor = Prisma.TransactionClient | typeof prisma;

export interface AbonoFiltros {
  idCliente?: number;
  idPedido?: number;
  estado?: EstadoAbonoPermitido;
  metodoPago?: MetodoPagoPermitido;
  desde?: string;
  hasta?: string;
}

export interface CrearAbonoData {
  idPedido: number;
  monto: number | null;
  metodoPago: MetodoPagoPermitido;
  referencia: string | null;
  fechaPago?: Date | null;
  comprobanteUrl: string | null;
  comprobantePublicId?: string | null;
  estado?: EstadoAbonoPermitido;
  confirmadoPorId?: number | null;
  fechaConfirmacion?: Date | null;
  comprobantePath?: string | null;
  nombreOriginalComprobante?: string | null;
  nombreSeguroComprobante?: string | null;
  comprobanteMimeType?: string | null;
  comprobanteFormato?: string | null;
  comprobanteResourceType?: string | null;
  comprobanteSizeBytes?: number | null;
  comprobanteHash?: string | null;
  comprobanteSubidoEn?: Date | null;
  textoOcr?: string | null;
  montoDetectadoOcr?: number | null;
  referenciaDetectadaOcr?: string | null;
  fechaDetectadaOcr?: Date | null;
  bancoDetectadoOcr?: string | null;
  confianzaOcr?: number | null;
  requiereRevisionManual?: boolean;
  origenRegistro?: string;
  observaciones?: string | null;
}

export interface ActualizarAbonoData {
  monto?: number;
  metodoPago?: MetodoPagoPermitido;
  referencia?: string | null;
  fechaPago?: Date | null;
  comprobanteUrl?: string | null;
  estado?: EstadoAbonoPermitido;
  confirmadoPorId?: number | null;
  fechaConfirmacion?: Date | null;
  rechazadoPorId?: number | null;
  fechaRechazo?: Date | null;
  motivoRechazo?: string | null;
  corregidoPorId?: number | null;
  fechaCorreccion?: Date | null;
  observaciones?: string | null;
  requiereRevisionManual?: boolean;
}

const db = (tx?: Prisma.TransactionClient): PrismaExecutor => tx ?? prisma;
const disenoRepository = new DisenoRepository();

const pedidoResumenSelect = {
  idPedido: true,
  idCliente: true,
  estadoPedido: true,
  estadoPago: true,
  total: true,
  totalPagado: true,
  saldoPendiente: true,
  cliente: {
    select: {
      idCliente: true,
      nombre: true,
      documento: true,
      correo: true,
      telefono: true,
      direccion: true,
    },
  },
} as const;

const abonoOperacionSelect = {
  idAbono: true,
  idPedido: true,
  monto: true,
  estado: true,
} as const;

const pedidoPagoSelect = {
  idPedido: true,
  estadoPedido: true,
  estadoPago: true,
  total: true,
  totalPagado: true,
  saldoPendiente: true,
} as const;

export class AbonoRepository {
  async buscarPedidoPorId(idPedido: number, tx?: Prisma.TransactionClient) {
    return await db(tx).pedido.findUnique({
      where: { idPedido },
      select: pedidoResumenSelect,
    });
  }

  async buscarPedidoCompleto(idPedido: number, tx?: Prisma.TransactionClient) {
    return await db(tx).pedido.findUnique({
      where: { idPedido },
      select: pedidoSelect,
    });
  }

  async crearAbono(data: CrearAbonoData, tx?: Prisma.TransactionClient) {
    return await db(tx).abonos.create({
      data,
      select: abonoSelect,
    });
  }

  async crearAbonoOperacion(
    data: CrearAbonoData,
    tx?: Prisma.TransactionClient,
  ) {
    return await db(tx).abonos.create({
      data,
      select: abonoOperacionSelect,
    });
  }

  async buscarPorId(idAbono: number, tx?: Prisma.TransactionClient) {
    return await db(tx).abonos.findUnique({
      where: { idAbono },
      select: abonoSelect,
    });
  }

  async buscarPorIdOperacion(
    idAbono: number,
    tx?: Prisma.TransactionClient,
  ) {
    return await db(tx).abonos.findUnique({
      where: { idAbono },
      select: abonoOperacionSelect,
    });
  }

  async listarAbonos(filtros: AbonoFiltros) {
    const where = this.buildWhere(filtros);

    return await prisma.abonos.findMany({
      where,
      select: abonoSelect,
      orderBy: {
        fechaCreacion: "desc",
      },
    });
  }

  private buildWhere(
    filtros: AbonoFiltros,
    search?: string | null,
  ): Prisma.AbonosWhereInput {
    const where: Prisma.AbonosWhereInput = {};

    if (filtros.idCliente) {
      where.pedido = { idCliente: filtros.idCliente };
    }

    if (filtros.idPedido) {
      where.idPedido = filtros.idPedido;
    }

    if (filtros.estado) {
      where.estado = filtros.estado;
    }

    if (filtros.metodoPago) {
      where.metodoPago = filtros.metodoPago;
    }

    if (filtros.desde || filtros.hasta) {
      where.fechaCreacion = {
        ...(filtros.desde ? { gte: new Date(filtros.desde) } : {}),
        ...(filtros.hasta ? { lte: new Date(filtros.hasta) } : {}),
      };
    }

    if (search) {
      const id = Number(search);
      where.OR = [
        ...(Number.isInteger(id) && id > 0
          ? [{ idAbono: id }, { idPedido: id }]
          : []),
        { referencia: { contains: search, mode: "insensitive" } },
        {
          pedido: {
            cliente: {
              nombre: { contains: search, mode: "insensitive" },
            },
          },
        },
      ];
    }

    return where;
  }

  async listarAbonosPaginado(
    filtros: AbonoFiltros,
    pagination: ParsedPagination,
  ) {
    const where = this.buildWhere(filtros, pagination.search);
    const orderBy = { [pagination.sortBy]: pagination.order };
    const [total, data] = await Promise.all([
      prisma.abonos.count({ where }),
      prisma.abonos.findMany({
        where,
        select: abonoSelect,
        orderBy,
        skip: pagination.skip,
        take: pagination.limit,
      }),
    ]);

    return { data, total };
  }

  async listarPorPedido(idPedido: number) {
    return await prisma.abonos.findMany({
      where: { idPedido },
      select: abonoSelect,
      orderBy: {
        fechaCreacion: "desc",
      },
    });
  }

  async actualizarAbono(
    idAbono: number,
    data: ActualizarAbonoData,
    tx?: Prisma.TransactionClient,
  ) {
    return await db(tx).abonos.update({
      where: { idAbono },
      data,
      select: abonoSelect,
    });
  }

  async actualizarAbonoOperacion(
    idAbono: number,
    data: ActualizarAbonoData,
    tx?: Prisma.TransactionClient,
  ) {
    return await db(tx).abonos.update({
      where: { idAbono },
      data,
      select: abonoOperacionSelect,
    });
  }

  async eliminarAbono(idAbono: number) {
    return await prisma.abonos.delete({
      where: { idAbono },
      select: { idAbono: true },
    });
  }

  async sumarAbonosConfirmados(idPedido: number, tx?: Prisma.TransactionClient) {
    const resultado = await db(tx).abonos.aggregate({
      where: {
        idPedido,
        estado: "CONFIRMADO",
      },
      _sum: {
        monto: true,
      },
    });

    return Number(resultado._sum.monto ?? 0);
  }

  async existeDisenoAprobado(idPedido: number, tx?: Prisma.TransactionClient) {
    return await disenoRepository.todosDisenosRequeridosAprobados(idPedido, tx);
  }

  async buscarPorHash(idPedido: number, comprobanteHash: string) {
    return await prisma.abonos.findFirst({
      where: { idPedido, comprobanteHash },
      select: abonoSelect,
    });
  }

  async buscarComprobanteMetadata(idAbono: number) {
    return await prisma.abonos.findUnique({
      where: { idAbono },
      select: {
        idAbono: true,
        comprobanteUrl: true,
        comprobantePublicId: true,
        comprobantePath: true,
        nombreOriginalComprobante: true,
        comprobanteMimeType: true,
        comprobanteFormato: true,
        comprobanteResourceType: true,
        comprobanteSizeBytes: true,
        pedido: {
          select: {
            idPedido: true,
            idCliente: true,
          },
        },
      },
    });
  }

  async actualizarResumenPagoPedido(
    idPedido: number,
    data: {
      totalPagado: number;
      saldoPendiente: number;
      estadoPago: "PENDIENTE" | "PARCIAL" | "COMPLETO";
    },
    tx?: Prisma.TransactionClient,
  ) {
    return await db(tx).pedido.update({
      where: { idPedido },
      data,
      select: pedidoPagoSelect,
    });
  }

  async actualizarEstadoPedido(
    idPedido: number,
    estadoPedido: "PENDIENTE" | "EN_PROCESO" | "FINALIZADO",
    tx?: Prisma.TransactionClient,
  ) {
    return await db(tx).pedido.update({
      where: { idPedido },
      data: { estadoPedido },
      select: pedidoPagoSelect,
    });
  }

  async upsertVentaDesdePago(
    data: {
      idPedido: number;
      idCliente: number;
      totalPedido: number;
      totalPagado: number;
      saldoPendiente: number;
      estado: "PARCIAL" | "COMPLETA";
      fechaPrimerPago: Date;
    },
    tx?: Prisma.TransactionClient,
  ) {
    return await db(tx).venta.upsert({
      where: { idPedido: data.idPedido },
      create: data,
      update: {
        totalPedido: data.totalPedido,
        totalPagado: data.totalPagado,
        saldoPendiente: data.saldoPendiente,
        estado: data.estado,
      },
      select: {
        idVenta: true,
        estado: true,
      },
    });
  }

  async actualizarVentaAnulada(
    idPedido: number,
    tx?: Prisma.TransactionClient,
  ) {
    return await db(tx).venta.updateMany({
      where: { idPedido },
      data: { estado: "ANULADA" },
    });
  }
}
