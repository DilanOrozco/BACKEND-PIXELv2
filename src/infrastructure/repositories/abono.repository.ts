import { prisma } from "../../config/prisma";
import type { Prisma } from "../../../generated/prisma/client";
import type { EstadoAbonoPermitido, MetodoPagoPermitido } from "../../applications/validators/abono.validator";
import { abonoSelect } from "../../utils/selects/abono.select";
import { pedidoSelect } from "../../utils/selects/pedido.select";

type PrismaExecutor = Prisma.TransactionClient | typeof prisma;

export interface AbonoFiltros {
  idPedido?: number;
  estado?: EstadoAbonoPermitido;
  metodoPago?: MetodoPagoPermitido;
  desde?: string;
  hasta?: string;
}

export interface CrearAbonoData {
  idPedido: number;
  monto: number;
  metodoPago: MetodoPagoPermitido;
  referencia: string | null;
  comprobanteUrl: string | null;
  estado?: EstadoAbonoPermitido;
  confirmadoPorId?: number | null;
  fechaConfirmacion?: Date | null;
}

export interface ActualizarAbonoData {
  monto?: number;
  metodoPago?: MetodoPagoPermitido;
  referencia?: string | null;
  comprobanteUrl?: string | null;
  estado?: EstadoAbonoPermitido;
  confirmadoPorId?: number | null;
  fechaConfirmacion?: Date | null;
  rechazadoPorId?: number | null;
  fechaRechazo?: Date | null;
  motivoRechazo?: string | null;
}

const db = (tx?: Prisma.TransactionClient): PrismaExecutor => tx ?? prisma;

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
      idUsuario: true,
      nombre: true,
      correo: true,
      telefono: true,
    },
  },
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

  async buscarPorId(idAbono: number, tx?: Prisma.TransactionClient) {
    return await db(tx).abonos.findUnique({
      where: { idAbono },
      select: abonoSelect,
    });
  }

  async listarAbonos(filtros: AbonoFiltros) {
    const where: Prisma.AbonosWhereInput = {};

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

    return await prisma.abonos.findMany({
      where,
      select: abonoSelect,
      orderBy: {
        fechaCreacion: "desc",
      },
    });
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
    const diseno = await db(tx).diseno.findFirst({
      where: {
        idPedido,
        estado: "APROBADO",
      },
      select: {
        idDiseno: true,
      },
    });

    return Boolean(diseno);
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
      select: pedidoSelect,
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
      select: pedidoSelect,
    });
  }
}
