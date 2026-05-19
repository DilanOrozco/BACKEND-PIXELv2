import {prisma} from "../../config/prisma";
import { tecnicaSelect } from "../../utils/selects/tecnica.select";

export class TecnicaRepository {
  async crearTecnica(data: any) {
    return await prisma.tecnica.create({
      data,
      select: tecnicaSelect,
    });
  }

  async listarTecnicas() {
    return await prisma.tecnica.findMany({
      select: tecnicaSelect,
      orderBy: {
        idTecnica: "asc",
      },
    });
  }

  async buscarPorId(idTecnica: number) {
    return await prisma.tecnica.findUnique({
      where: { idTecnica },
      select: tecnicaSelect,
    });
  }

  async buscarPorNombreExacto(nombre: string) {
    return await prisma.tecnica.findUnique({
      where: { nombre },
      select: tecnicaSelect,
    });
  }

  async buscarParcial(termino: string) {
    return await prisma.tecnica.findMany({
      where: {
        OR: [
          {
            nombre: {
              contains: termino,
              mode: "insensitive",
            },
          },
          {
            descripcion: {
              contains: termino,
              mode: "insensitive",
            },
          },
        ],
      },
      select: tecnicaSelect,
      orderBy: {
        idTecnica: "asc",
      },
    });
  }

  async actualizarTecnica(idTecnica: number, data: any) {
    return await prisma.tecnica.update({
      where: { idTecnica },
      data,
      select: tecnicaSelect,
    });
  }

  async desactivarTecnica(idTecnica: number) {
    // 1. Buscamos la técnica usando la variable 'prisma' directa (sin 'this.')
    const tecnica = await prisma.tecnica.findUnique({
      where: { idTecnica },
    });

    if (!tecnica) {
      throw new Error("Técnica no encontrada");
    }

    // 2. Hacemos el switch/toggle: invertimos el valor actual del booleano
    return await prisma.tecnica.update({
      where: { idTecnica },
      data: {
        estado: !tecnica.estado, // Si está true pone false, si está false pone true ⚡
      },
      select: tecnicaSelect, // Mantenemos tu objeto de selección para el retorno
    });
  }
}
