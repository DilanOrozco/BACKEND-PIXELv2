import { Prisma } from "../../../generated/prisma/client";
import { TarifaTecnicaRepository } from "../../infrastructure/repositories/tarifa-tecnica.repository";
import { TecnicaRepository } from "../../infrastructure/repositories/tecnica.repository";
import {
  paginatedResponse,
  parsePaginationQuery,
  type PaginationQuery,
} from "../../utils/pagination.util";
import {
  validarActualizarTarifaTecnica,
  validarCrearTarifaTecnica,
  validarDescuentosTecnica,
} from "../validators/tarifa-tecnica.validator";

const repository = new TarifaTecnicaRepository();
const tecnicaRepository = new TecnicaRepository();
const decimal = (valor: unknown) => new Prisma.Decimal(String(valor));

const validarId = (id: number, nombre: string) => {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`${nombre} debe ser valido.`);
  }
};

export class TarifaTecnicaService {
  async listar(query: PaginationQuery = {}) {
    const pagination = parsePaginationQuery(query, {
      defaultSortBy: "idTarifa",
      allowedSortBy: [
        "idTarifa",
        "nombre",
        "anchoHastaCm",
        "altoHastaCm",
        "precioUnitario",
        "fechaCreacion",
      ],
      maxLimit: 10,
    });
    const idTecnicaQuery = (query as Record<string, unknown>).idTecnica;
    const idTecnica = idTecnicaQuery
      ? Number(idTecnicaQuery)
      : undefined;

    if (idTecnica !== undefined) validarId(idTecnica, "La tecnica");

    const resultado = await repository.listar(pagination, idTecnica);
    return paginatedResponse(resultado.data, pagination, resultado.total);
  }

  async crear(data: any) {
    const error = validarCrearTarifaTecnica(data);
    if (error) throw new Error(error);

    const idTecnica = Number(data.idTecnica);
    const tecnica = await tecnicaRepository.buscarPorId(idTecnica);
    if (!tecnica || !tecnica.estado) {
      throw new Error("La tecnica no existe o esta inactiva.");
    }

    const esGeneral = data.esGeneral === true;
    const anchoHastaCm = esGeneral ? null : decimal(data.anchoHastaCm);
    const altoHastaCm = esGeneral ? null : decimal(data.altoHastaCm);
    const duplicada = await repository.buscarDuplicada(
      idTecnica,
      anchoHastaCm,
      altoHastaCm,
      esGeneral,
    );
    if (duplicada) {
      throw new Error(
        esGeneral
          ? "Ya existe una tarifa general para esta tecnica."
          : "Ya existe una tarifa para esta tecnica y dimensiones.",
      );
    }

    return await repository.crear({
      idTecnica,
      nombre: String(data.nombre).trim(),
      anchoHastaCm,
      altoHastaCm,
      esGeneral,
      precioUnitario: decimal(data.precioUnitario),
      estado: data.estado ?? true,
    });
  }

  async actualizar(idTarifa: number, data: any) {
    validarId(idTarifa, "La tarifa");
    const error = validarActualizarTarifaTecnica(data);
    if (error) throw new Error(error);

    const actual = await repository.buscarPorId(idTarifa);
    if (!actual) throw new Error("Tarifa no encontrada.");

    const esGeneral = data.esGeneral ?? actual.esGeneral;
    const anchoHastaCm = esGeneral
      ? null
      : data.anchoHastaCm === undefined
        ? actual.anchoHastaCm === null
          ? null
          : new Prisma.Decimal(actual.anchoHastaCm)
        : data.anchoHastaCm === null
          ? null
          : decimal(data.anchoHastaCm);
    const altoHastaCm = esGeneral
      ? null
      : data.altoHastaCm === undefined
        ? actual.altoHastaCm === null
          ? null
          : new Prisma.Decimal(actual.altoHastaCm)
        : data.altoHastaCm === null
          ? null
          : decimal(data.altoHastaCm);

    if (!esGeneral && (!anchoHastaCm || !altoHastaCm)) {
      throw new Error(
        "Una tarifa por dimensiones debe incluir ancho y alto.",
      );
    }

    const duplicada = await repository.buscarDuplicada(
      actual.idTecnica,
      anchoHastaCm,
      altoHastaCm,
      esGeneral,
      idTarifa,
    );
    if (duplicada) {
      throw new Error(
        esGeneral
          ? "Ya existe una tarifa general para esta tecnica."
          : "Ya existe una tarifa para esta tecnica y dimensiones.",
      );
    }

    return await repository.actualizar(idTarifa, {
      ...(data.nombre !== undefined
        ? { nombre: String(data.nombre).trim() }
        : {}),
      ...(data.esGeneral !== undefined || data.anchoHastaCm !== undefined
        ? { anchoHastaCm }
        : {}),
      ...(data.esGeneral !== undefined || data.altoHastaCm !== undefined
        ? { altoHastaCm }
        : {}),
      ...(data.esGeneral !== undefined ? { esGeneral } : {}),
      ...(data.precioUnitario !== undefined
        ? { precioUnitario: decimal(data.precioUnitario) }
        : {}),
      ...(data.estado !== undefined ? { estado: data.estado } : {}),
    });
  }

  async eliminar(idTarifa: number) {
    validarId(idTarifa, "La tarifa");
    const actual = await repository.buscarPorId(idTarifa);
    if (!actual) throw new Error("Tarifa no encontrada.");
    return await repository.eliminar(idTarifa);
  }

  async listarDescuentos(idTecnica: number) {
    validarId(idTecnica, "La tecnica");
    return await repository.listarDescuentos(idTecnica);
  }

  async reemplazarDescuentos(idTecnica: number, data: any) {
    validarId(idTecnica, "La tecnica");
    const error = validarDescuentosTecnica(data);
    if (error) throw new Error(error);

    const tecnica = await tecnicaRepository.buscarPorId(idTecnica);
    if (!tecnica) throw new Error("Tecnica no encontrada.");

    return await repository.reemplazarDescuentos(
      idTecnica,
      data.descuentos.map((item: any) => ({
        cantidadMinima: Number(item.cantidadMinima),
        porcentaje: decimal(item.porcentaje),
        estado: item.estado ?? true,
      })),
    );
  }
}
