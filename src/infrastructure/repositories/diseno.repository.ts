import { prisma } from "../../config/prisma";
import type { Prisma } from "../../../generated/prisma/client";
import type { EstadoDisenoPermitido } from "../../applications/validators/diseno.validator";
import { disenoSelect } from "../../utils/selects/diseno.select";
import { pedidoSelect } from "../../utils/selects/pedido.select";

type PrismaExecutor = Prisma.TransactionClient | typeof prisma;

export interface DisenoFiltros {
  idPedido?: number;
  estado?: EstadoDisenoPermitido;
  idDisenador?: number;
}

export interface CrearDisenoData {
  idPedido: number;
  idDisenador: number | null;
  archivoUrl: string | null;
  descripcion: string | null;
  observaciones: string | null;
  estado: "PENDIENTE" | "ENVIADO";
  fechaEnvio: Date | null;
}

export interface ActualizarDisenoData {
  archivoUrl?: string | null;
  descripcion?: string | null;
  observaciones?: string | null;
  estado?: "PENDIENTE" | "ENVIADO" | "APROBADO";
  fechaEnvio?: Date | null;
  fechaAprobacion?: Date | null;
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
} as const;

export class DisenoRepository {
  async buscarPedidoPorId(idPedido: number, tx?: Prisma.TransactionClient) {
    return await db(tx).pedido.findUnique({
      where: { idPedido },
      select: pedidoResumenSelect,
    });
  }

  async crearDiseno(data: CrearDisenoData) {
    return await prisma.diseno.create({
      data,
      select: disenoSelect,
    });
  }

  async listarDisenos(filtros: DisenoFiltros, idDisenador?: number) {
    const where: Prisma.DisenoWhereInput = {};

    if (filtros.idPedido) {
      where.idPedido = filtros.idPedido;
    }

    if (filtros.estado) {
      where.estado = filtros.estado;
    }

    if (filtros.idDisenador) {
      where.idDisenador = filtros.idDisenador;
    }

    if (idDisenador) {
      where.OR = [
        { idDisenador },
        { idDisenador: null },
      ];
    }

    return await prisma.diseno.findMany({
      where,
      select: disenoSelect,
      orderBy: {
        fechaCreacion: "desc",
      },
    });
  }

  async listarPorPedido(idPedido: number, idDisenador?: number) {
    const where: Prisma.DisenoWhereInput = { idPedido };

    if (idDisenador) {
      where.OR = [
        { idDisenador },
        { idDisenador: null },
      ];
    }

    return await prisma.diseno.findMany({
      where,
      select: disenoSelect,
      orderBy: {
        fechaCreacion: "desc",
      },
    });
  }

  async buscarPorId(idDiseno: number, tx?: Prisma.TransactionClient) {
    return await db(tx).diseno.findUnique({
      where: { idDiseno },
      select: disenoSelect,
    });
  }

  async buscarUsuarioDisenador(idUsuario: number) {
    return await prisma.usuario.findFirst({
      where: {
        idUsuario,
        rol: {
          nombre: "Diseñador",
        },
      },
      select: {
        idUsuario: true,
      },
    });
  }

  async buscarDisenoAprobadoPorPedido(
    idPedido: number,
    tx?: Prisma.TransactionClient,
  ) {
    return await db(tx).diseno.findFirst({
      where: {
        idPedido,
        estado: "APROBADO",
      },
      select: {
        idDiseno: true,
      },
    });
  }

  async actualizarDiseno(
    idDiseno: number,
    data: ActualizarDisenoData,
    tx?: Prisma.TransactionClient,
  ) {
    return await db(tx).diseno.update({
      where: { idDiseno },
      data,
      select: disenoSelect,
    });
  }

  async buscarPedidoCompleto(idPedido: number, tx?: Prisma.TransactionClient) {
    return await db(tx).pedido.findUnique({
      where: { idPedido },
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

  async eliminarDiseno(idDiseno: number) {
    return await prisma.diseno.delete({
      where: { idDiseno },
      select: { idDiseno: true },
    });
  }

  async listarProduccionPendiente(idDisenador?: number) {
    const where: Prisma.DisenoWhereInput = {
      estado: "APROBADO",
      pedido: {
        estadoPedido: "EN_PROCESO",
      },
    };

    if (idDisenador) {
      where.OR = [
        { idDisenador },
        { idDisenador: null },
      ];
    }

    return await prisma.diseno.findMany({
      where,
      select: disenoSelect,
      orderBy: {
        fechaAprobacion: "asc",
      },
    });
  }
}
