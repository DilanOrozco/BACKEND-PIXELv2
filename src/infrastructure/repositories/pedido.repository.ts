import { prisma } from "../../config/prisma";
import { pedidoSelect } from "../../utils/selects/pedido.select";

const estadosPedido = ["PENDIENTE", "EN_PROCESO", "FINALIZADO", "ANULADO"];

const cotizacionParaPedidoSelect = {
  idCotizacion: true,
  idCliente: true,
  creadoPorId: true,
  estado: true,
  subtotal: true,
  costosAdicionales: true,
  total: true,
  observaciones: true,
  cliente: {
    select: {
      idUsuario: true,
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
      descripcion: true,
      cantidad: true,
      precioUnitario: true,
      subtotal: true,
      observaciones: true,
      tecnica: { select: { idTecnica: true, nombre: true } },
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

    return await prisma.$transaction(async (tx: any) => {
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
        select: pedidoSelect,
      });
    });
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

  async buscarPorId(idPedido: number) {
    return await prisma.pedido.findUnique({
      where: { idPedido },
      select: pedidoSelect,
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

  async actualizarPedido(idPedido: number, data: any) {
    return await prisma.pedido.update({
      where: { idPedido },
      data,
      select: pedidoSelect,
    });
  }
}
