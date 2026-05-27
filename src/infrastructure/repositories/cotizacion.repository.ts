import { prisma } from "../../config/prisma";
import type { EstadoCotizacion } from "../../../generated/prisma/enums";
import { cotizacionSelect } from "../../utils/selects/cotizacion.select";

const estadosCotizacion = [
  "PENDIENTE",
  "APROBADA",
  "ANULADA",
];

export class CotizacionRepository {
  // Crea la cotizacion y sus detalles en una sola transaccion para evitar
  // cabeceras sin detalle si algo falla a mitad del proceso.
  async crearCotizacionConDetalles(data: any) {
    const { detalles, ...cotizacionData } = data;

    return await prisma.$transaction(async (tx: any) => {
      return await tx.cotizacion.create({
        data: {
          ...cotizacionData,
          detalles: {
            create: detalles,
          },
        },
        select: cotizacionSelect,
      });
    });
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
    return await prisma.$transaction(async (tx: any) => {
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

      return await tx.cotizacion.findUnique({
        where: { idCotizacion },
        select: cotizacionSelect,
      });
    });
  }

  // Cotizar tambien es transaccional: primero actualiza todos los detalles y
  // luego recalcula los importes de la cabecera en el mismo commit.
  async cotizarCotizacion(
    idCotizacion: number,
    cotizacionData: any,
    detalles: any[],
  ) {
    return await prisma.$transaction(async (tx: any) => {
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

      return await tx.cotizacion.findUnique({
        where: { idCotizacion },
        select: cotizacionSelect,
      });
    });
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

  async eliminarCotizacion(idCotizacion: number) {
    return await prisma.cotizacion.delete({
      where: { idCotizacion },
      select: { idCotizacion: true },
    });
  }
}
