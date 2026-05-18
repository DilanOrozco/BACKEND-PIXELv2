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
    return await prisma.tecnica.update({
      where: { idTecnica },
      data: {
        estado: false,
      },
      select: tecnicaSelect,
    });
  }
}
