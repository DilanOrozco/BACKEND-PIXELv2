import { prisma } from "../../config/prisma";
import { EstadoCotizacion } from "../../../generated/prisma/enums";
import { cotizacionSelect } from "../../utils/selects/cotizacion.select";

const estadosCotizacion = [
  "PENDIENTE",
  "APROBADA",
  "ANULADA",
];

// Convierte un string al valor real del enum EstadoCotizacion en runtime
const toEstado = (estado: string): EstadoCotizacion =>
  EstadoCotizacion[estado as keyof typeof EstadoCotizacion];

export class CotizacionRepository {
  // Crea la cotizacion y sus detalles en una sola transaccion
  async crearCotizacionConDetalles(data: any) {
    const { detalles, estado, ...cotizacionData } = data;

    // Filtramos 'tecnica' de cada detalle por seguridad si viene del frontend
    const detallesLimpios = detalles.map(({ tecnica, ...restoDetalle }: any) => restoDetalle);

    return await prisma.$transaction(async (tx: any) => {
      return await tx.cotizacion.create({
        data: {
          ...cotizacionData,
          estado: toEstado(estado),
          detalles: {
            create: detallesLimpios,
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

  // Edicion de solicitud: solo actualiza el detalle existente.
  async actualizarSolicitudCliente(
    idCotizacion: number,
    cotizacionData: any,
    detalles: any[],
  ) {
    const { estado, ...restoCotizacionData } = cotizacionData;

    return await prisma.$transaction(async (tx: any) => {
      await tx.cotizacion.update({
        where: { idCotizacion },
        data: {
          ...restoCotizacionData,
          ...(estado && { estado: toEstado(estado) }),
        },
      });

      for (const detalle of detalles) {
        const { idDetalleCotizacion, tecnica, ...detalleData } = detalle;

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

  // Cotizar tambien es transaccional
  async cotizarCotizacion(
    idCotizacion: number,
    cotizacionData: any,
    detalles: any[],
  ) {
    const { estado, ...restoCotizacionData } = cotizacionData;

    return await prisma.$transaction(async (tx: any) => {
      for (const detalle of detalles) {
        const { idDetalleCotizacion, tecnica, ...detalleData } = detalle;

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
        data: {
          ...restoCotizacionData,
          ...(estado && { estado: toEstado(estado) }),
        },
      });

      return await tx.cotizacion.findUnique({
        where: { idCotizacion },
        select: cotizacionSelect,
      });
    });
  }

  async actualizarCotizacion(idCotizacion: number, data: any) {
    const { estado, ...restoData } = data;
    return await prisma.cotizacion.update({
      where: { idCotizacion },
      data: {
        ...restoData,
        ...(estado && { estado: toEstado(estado) }),
      },
      select: cotizacionSelect,
    });
  }

  async cambiarEstado(idCotizacion: number, estado: EstadoCotizacion) {
    return await prisma.cotizacion.update({
      where: { idCotizacion },
      data: { estado: toEstado(estado as unknown as string) },
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