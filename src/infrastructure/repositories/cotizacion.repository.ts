import {prisma} from "../../config/prisma";
import { cotizacionSelect } from "../../utils/selects/cotizacion.select";

export class CotizacionRepository {
  async crearCotizacion(data: any) {
    return await prisma.cotizacion.create({
      data,
      select: cotizacionSelect,
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
    return await prisma.cotizacion.findMany({
      where: {
        OR: [
          {
            estado: {
              contains: termino,
              mode: "insensitive",
            },
          },
          {
            tipoCotizacion: {
              contains: termino,
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
        ],
      },
      select: cotizacionSelect,
      orderBy: {
        idCotizacion: "desc",
      },
    });
  }

  async actualizarCotizacion(idCotizacion: number, data: any) {
    return await prisma.cotizacion.update({
      where: { idCotizacion },
      data,
      select: cotizacionSelect,
    });
  }

  async aprobarCotizacion(idCotizacion: number) {
    return await prisma.cotizacion.update({
      where: { idCotizacion },
      data: {
        estado: "APROBADA",
      },
      select: cotizacionSelect,
    });
  }

  async rechazarCotizacion(idCotizacion: number) {
    return await prisma.cotizacion.update({
      where: { idCotizacion },
      data: {
        estado: "RECHAZADA",
      },
      select: cotizacionSelect,
    });
  }
}