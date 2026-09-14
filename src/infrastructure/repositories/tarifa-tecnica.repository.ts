import { prisma, runPrismaTransaction } from "../../config/prisma";
import type { Prisma } from "../../../generated/prisma/client";
import type { ParsedPagination } from "../../utils/pagination.util";
import {
  descuentoTecnicaSelect,
  tarifaTecnicaSelect,
} from "../../utils/selects/tarifa-tecnica.select";
import { tarifaTecnicaPublicSelect } from "../../utils/selects/tecnica.select";

const construirWhere = (
  search?: string | null,
  idTecnica?: number,
): Prisma.TarifaTecnicaWhereInput => ({
  ...(idTecnica ? { idTecnica } : {}),
  ...(search
    ? {
        tecnica: {
          nombre: { contains: search, mode: "insensitive" },
        },
      }
    : {}),
});

export class TarifaTecnicaRepository {
  async listarActivasPublicas(idTecnica: number) {
    return await prisma.tarifaTecnica.findMany({
      where: {
        idTecnica,
        estado: true,
        tecnica: { estado: true },
      },
      select: tarifaTecnicaPublicSelect,
      orderBy: [
        { esGeneral: "desc" },
        { anchoHastaCm: "asc" },
        { altoHastaCm: "asc" },
        { idTarifa: "asc" },
      ],
    });
  }

  async listar(pagination: ParsedPagination, idTecnica?: number) {
    const where = construirWhere(pagination.search, idTecnica);
    const [total, data] = await Promise.all([
      prisma.tarifaTecnica.count({ where }),
      prisma.tarifaTecnica.findMany({
        where,
        select: tarifaTecnicaSelect,
        orderBy: idTecnica
          ? [
              { esGeneral: "desc" },
              { anchoHastaCm: "asc" },
              { altoHastaCm: "asc" },
            ]
          : { [pagination.sortBy]: pagination.order },
        skip: pagination.skip,
        take: pagination.limit,
      }),
    ]);
    return { total, data };
  }

  async buscarPorId(idTarifa: number) {
    return await prisma.tarifaTecnica.findUnique({
      where: { idTarifa },
      select: tarifaTecnicaSelect,
    });
  }

  async buscarDuplicada(
    idTecnica: number,
    anchoHastaCm: Prisma.Decimal | null,
    altoHastaCm: Prisma.Decimal | null,
    esGeneral: boolean,
    excluirId?: number,
  ) {
    return await prisma.tarifaTecnica.findFirst({
      where: {
        idTecnica,
        esGeneral,
        ...(esGeneral ? {} : { anchoHastaCm, altoHastaCm }),
        ...(excluirId ? { idTarifa: { not: excluirId } } : {}),
      },
      select: { idTarifa: true },
    });
  }

  async crear(data: Prisma.TarifaTecnicaUncheckedCreateInput) {
    return await prisma.tarifaTecnica.create({
      data,
      select: tarifaTecnicaSelect,
    });
  }

  async actualizar(
    idTarifa: number,
    data: Prisma.TarifaTecnicaUncheckedUpdateInput,
  ) {
    return await prisma.tarifaTecnica.update({
      where: { idTarifa },
      data,
      select: tarifaTecnicaSelect,
    });
  }

  async eliminar(idTarifa: number) {
    return await prisma.tarifaTecnica.delete({
      where: { idTarifa },
      select: tarifaTecnicaSelect,
    });
  }

  async listarDescuentos(idTecnica: number) {
    return await prisma.descuentoTecnica.findMany({
      where: { idTecnica },
      select: descuentoTecnicaSelect,
      orderBy: { cantidadMinima: "asc" },
    });
  }

  async reemplazarDescuentos(idTecnica: number, descuentos: any[]) {
    await runPrismaTransaction(async (tx) => {
      await tx.descuentoTecnica.deleteMany({ where: { idTecnica } });

      if (descuentos.length > 0) {
        await tx.descuentoTecnica.createMany({
          data: descuentos.map((descuento) => ({
            ...descuento,
            idTecnica,
          })),
        });
      }
    });

    return await this.listarDescuentos(idTecnica);
  }

  async cargarConfiguracionActiva(idsTecnicas: number[]) {
    if (idsTecnicas.length === 0) return [];

    return await prisma.tecnica.findMany({
      where: { idTecnica: { in: idsTecnicas }, estado: true },
      select: {
        idTecnica: true,
        nombre: true,
        requiereMedidas: true,
        tarifas: {
          where: { estado: true },
          select: tarifaTecnicaSelect,
          orderBy: [
            { esGeneral: "desc" },
            { anchoHastaCm: "asc" },
            { altoHastaCm: "asc" },
          ],
        },
      },
    });
  }
}
