import { prisma } from "../../config/prisma";
import type { Prisma } from "../../../generated/prisma/client";
import type {
  EstadoDisenoPermitido,
  OrigenDisenoPermitido,
} from "../../applications/validators/diseno.validator";
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
  idDetallePedido: number | null;
  esDisenoGeneral: boolean;
  idDisenador: number | null;
  archivoUrl: string | null;
  descripcion: string | null;
  observaciones: string | null;
  origenDiseno: OrigenDisenoPermitido;
  medioRecepcion: string | null;
  recibidoPorId: number | null;
  fechaRecepcion: Date | null;
  observacionesCliente?: string | null;
  estado: "PENDIENTE" | "ENVIADO" | "APROBADO";
  fechaEnvio: Date | null;
  fechaAprobacion?: Date | null;
  medioRespuestaCliente?: string | null;
  fechaRespuestaCliente?: Date | null;
  respuestaRegistradaPorId?: number | null;
}

export interface ActualizarDisenoData {
  archivoUrl?: string | null;
  descripcion?: string | null;
  observaciones?: string | null;
  estado?: "PENDIENTE" | "ENVIADO" | "APROBADO" | "RECHAZADO";
  origenDiseno?: OrigenDisenoPermitido;
  medioRecepcion?: string | null;
  recibidoPorId?: number | null;
  fechaRecepcion?: Date | null;
  medioRespuestaCliente?: string | null;
  observacionesCliente?: string | null;
  fechaRespuestaCliente?: Date | null;
  respuestaRegistradaPorId?: number | null;
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
  detalles: {
    select: {
      idDetallePedido: true,
      requiereDiseno: true,
    },
  },
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

const disenoOperacionSelect = {
  idDiseno: true,
  idPedido: true,
  idDetallePedido: true,
  esDisenoGeneral: true,
  idDisenador: true,
  estado: true,
  pedido: {
    select: {
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
        },
      },
    },
  },
} as const;

const pedidoEstadoSelect = {
  idPedido: true,
  estadoPedido: true,
} as const;

export const evaluarCoberturaDisenos = (
  detalles: Array<{ idDetallePedido: number }>,
  disenos: Array<{
    idDetallePedido: number | null;
    esDisenoGeneral: boolean;
  }>,
) => {
  if (detalles.length === 0) {
    return true;
  }

  if (disenos.some((diseno) => diseno.esDisenoGeneral)) {
    return true;
  }

  if (
    detalles.length === 1 &&
    disenos.some((diseno) => diseno.idDetallePedido === null)
  ) {
    return true;
  }

  const detallesAprobados = new Set(
    disenos
      .map((diseno) => diseno.idDetallePedido)
      .filter((id): id is number => id !== null),
  );

  return detalles.every((detalle) =>
    detallesAprobados.has(detalle.idDetallePedido),
  );
};

export class DisenoRepository {
  async buscarPedidoPorId(idPedido: number, tx?: Prisma.TransactionClient) {
    return await db(tx).pedido.findUnique({
      where: { idPedido },
      select: pedidoResumenSelect,
    });
  }

  async crearDiseno(data: CrearDisenoData, tx?: Prisma.TransactionClient) {
    return await db(tx).diseno.create({
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

  async listarPorCliente(idCliente: number) {
    return await prisma.diseno.findMany({
      where: {
        pedido: {
          idCliente,
        },
      },
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

  async buscarPorIdOperacion(
    idDiseno: number,
    tx?: Prisma.TransactionClient,
  ) {
    return await db(tx).diseno.findUnique({
      where: { idDiseno },
      select: disenoOperacionSelect,
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

  async buscarDisenoAprobadoPorDetalle(
    idPedido: number,
    idDetallePedido: number | null,
    tx?: Prisma.TransactionClient,
  ) {
    return await db(tx).diseno.findFirst({
      where: {
        idPedido,
        idDetallePedido,
        estado: "APROBADO",
      },
      select: {
        idDiseno: true,
      },
    });
  }

  async todosDisenosRequeridosAprobados(
    idPedido: number,
    tx?: Prisma.TransactionClient,
  ) {
    const pedido = await db(tx).pedido.findUnique({
      where: { idPedido },
      select: {
        detalles: {
          where: { requiereDiseno: true },
          select: { idDetallePedido: true },
        },
        disenos: {
          where: { estado: "APROBADO" },
          select: {
            idDetallePedido: true,
            esDisenoGeneral: true,
          },
        },
      },
    });

    if (!pedido) {
      return false;
    }

    return evaluarCoberturaDisenos(pedido.detalles, pedido.disenos);
  }

  async actualizarDisenoOperacion(
    idDiseno: number,
    data: ActualizarDisenoData,
    tx?: Prisma.TransactionClient,
  ) {
    return await db(tx).diseno.update({
      where: { idDiseno },
      data,
      select: disenoOperacionSelect,
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
    estadoPedido: "PENDIENTE" | "EN_PROCESO" | "PENDIENTE_SALDO_FINAL" | "FINALIZADO" | "ENTREGADO",
    tx?: Prisma.TransactionClient,
  ) {
    return await db(tx).pedido.update({
      where: { idPedido },
      data: { estadoPedido },
      select: pedidoEstadoSelect,
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
