import { prisma } from "../../config/prisma";
import type { Prisma } from "../../../generated/prisma/client";
import { clienteDetalleSelect, clienteSelect } from "../../utils/selects/cliente.select";
import {
  looksLikeEmail,
  looksNumeric,
  type ParsedPagination,
} from "../../utils/pagination.util";

export interface ClienteData {
  nombre: string;
  documento?: string | null;
  correo?: string | null;
  telefono?: string | null;
  direccion?: string | null;
}

const buildClienteWhere = (search?: string | null): Prisma.ClienteWhereInput => {
  if (!search) {
    return {};
  }

  if (looksLikeEmail(search)) {
    return {
      correo: {
        startsWith: search.toLowerCase(),
        mode: "insensitive",
      },
    };
  }

  if (looksNumeric(search)) {
    return {
      OR: [
        { telefono: { startsWith: search } },
        { documento: { startsWith: search } },
      ],
    };
  }

  return {
    OR: [
      { nombre: { contains: search, mode: "insensitive" } },
      { correo: { startsWith: search.toLowerCase(), mode: "insensitive" } },
      { telefono: { startsWith: search } },
      { documento: { startsWith: search } },
    ],
  };
};

const buildClienteOrderBy = (pagination: ParsedPagination) => ({
  [pagination.sortBy]: pagination.order,
});

export class ClienteRepository {
  async buscarPorId(idCliente: number) {
    return await prisma.cliente.findUnique({
      where: { idCliente },
      select: clienteSelect,
    });
  }

  async buscarDetallePorId(idCliente: number) {
    return await prisma.cliente.findUnique({
      where: { idCliente },
      select: clienteDetalleSelect,
    });
  }

  async listarClientesPaginado(pagination: ParsedPagination) {
    const where = buildClienteWhere(pagination.search);
    const [total, data] = await Promise.all([
      prisma.cliente.count({ where }),
      prisma.cliente.findMany({
        where,
        select: clienteSelect,
        orderBy: buildClienteOrderBy(pagination),
        skip: pagination.skip,
        take: pagination.limit,
      }),
    ]);

    return { data, total };
  }

  async buscarPorCorreoOTelefono(correo?: string | null, telefono?: string | null) {
    if (!correo && !telefono) {
      return null;
    }

    return await prisma.cliente.findFirst({
      where: {
        OR: [
          ...(correo ? [{ correo }] : []),
          ...(telefono ? [{ telefono }] : []),
        ],
      },
      select: clienteSelect,
      orderBy: {
        idCliente: "asc",
      },
    });
  }

  async crearCliente(data: ClienteData) {
    return await prisma.cliente.create({
      data: {
        ...data,
        estado: true,
      },
      select: clienteSelect,
    });
  }

  async actualizarCliente(idCliente: number, data: Partial<ClienteData>) {
    return await prisma.cliente.update({
      where: { idCliente },
      data,
      select: clienteSelect,
    });
  }

  async contarRelaciones(idCliente: number) {
    const [cotizaciones, pedidos] = await Promise.all([
      prisma.cotizacion.count({ where: { idCliente } }),
      prisma.pedido.count({ where: { idCliente } }),
    ]);

    return { cotizaciones, pedidos, total: cotizaciones + pedidos };
  }

  async desactivarCliente(idCliente: number) {
    return await prisma.cliente.update({
      where: { idCliente },
      data: { estado: false },
      select: clienteSelect,
    });
  }

  async eliminarCliente(idCliente: number) {
    return await prisma.cliente.delete({
      where: { idCliente },
      select: clienteSelect,
    });
  }
}
