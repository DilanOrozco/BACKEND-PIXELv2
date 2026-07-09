import { ClienteRepository } from "../../infrastructure/repositories/cliente.repository";
import {
  paginatedResponse,
  parsePaginationQuery,
  type PaginationQuery,
} from "../../utils/pagination.util";

const clienteRepository = new ClienteRepository();

const validarId = (idCliente: number) => {
  if (!Number.isInteger(idCliente) || idCliente <= 0) {
    throw new Error("El ID del cliente no es valido.");
  }
};

export class ClienteService {
  async listarClientes(query: PaginationQuery = {}) {
    const pagination = parsePaginationQuery(query, {
      defaultSortBy: "idCliente",
      allowedSortBy: [
        "idCliente",
        "nombre",
        "correo",
        "telefono",
        "fechaCreacion",
      ],
      maxLimit: 10,
    });

    const resultado = await clienteRepository.listarClientesPaginado(
      pagination,
    );

    return paginatedResponse(resultado.data, pagination, resultado.total);
  }

  async buscarPorId(idCliente: number) {
    validarId(idCliente);

    const cliente = await clienteRepository.buscarDetallePorId(idCliente);

    if (!cliente) {
      throw new Error("Cliente no encontrado.");
    }

    return cliente;
  }

  async desactivarCliente(idCliente: number) {
    validarId(idCliente);

    const cliente = await clienteRepository.buscarPorId(idCliente);

    if (!cliente) {
      throw new Error("Cliente no encontrado.");
    }

    return await clienteRepository.desactivarCliente(idCliente);
  }

  async eliminarCliente(idCliente: number) {
    validarId(idCliente);

    const cliente = await clienteRepository.buscarPorId(idCliente);

    if (!cliente) {
      throw new Error("Cliente no encontrado.");
    }

    const relaciones = await clienteRepository.contarRelaciones(idCliente);

    if (relaciones.total > 0) {
      throw new Error(
        "No se puede eliminar el cliente porque tiene cotizaciones o pedidos relacionados. Desactivalo en su lugar.",
      );
    }

    return await clienteRepository.eliminarCliente(idCliente);
  }
}
