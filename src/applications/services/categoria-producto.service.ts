import { CategoriaProductoRepository } from "../../infrastructure/repositories/categoria-producto.repository";
import {
  paginatedResponse,
  parsePaginationQuery,
  type PaginationQuery,
} from "../../utils/pagination.util";
import { limpiarTextoOpcional } from "../../utils/text.util";
import {
  validarActualizarCategoriaProducto,
  validarCrearCategoriaProducto,
} from "../validators/categoria-producto.validator";

const categoriaProductoRepository = new CategoriaProductoRepository();

const validarId = (id: number, mensaje: string) => {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(mensaje);
  }
};

export class CategoriaProductoService {
  async listarCategorias(query: PaginationQuery = {}) {
    const pagination = parsePaginationQuery(query, {
      defaultSortBy: "idCategoriaProducto",
      allowedSortBy: ["idCategoriaProducto", "nombre", "fechaCreacion"],
      maxLimit: 10,
    });

    const resultado = await categoriaProductoRepository.listarCategoriasPaginado(
      pagination,
    );

    return paginatedResponse(resultado.data, pagination, resultado.total);
  }

  async listarCategoriasPublicas() {
    return await categoriaProductoRepository.listarCategoriasPublicas();
  }

  async buscarPorId(idCategoriaProducto: number) {
    validarId(idCategoriaProducto, "El ID de la categoria no es valido.");

    const categoria = await categoriaProductoRepository.buscarPorId(
      idCategoriaProducto,
    );

    if (!categoria) {
      throw new Error("Categoria no encontrada.");
    }

    return categoria;
  }

  async crearCategoria(data: Record<string, unknown>) {
    const error = validarCrearCategoriaProducto(data);

    if (error) {
      throw new Error(error);
    }

    const nombre = String(data.nombre).trim();
    const existente =
      await categoriaProductoRepository.buscarPorNombreExacto(nombre);

    if (existente) {
      throw new Error("El nombre de la categoria no puede repetirse.");
    }

    return await categoriaProductoRepository.crearCategoria({
      nombre,
      descripcion: limpiarTextoOpcional(data.descripcion),
      estado: data.estado === undefined ? true : Boolean(data.estado),
    });
  }

  async actualizarCategoria(
    idCategoriaProducto: number,
    data: Record<string, unknown>,
  ) {
    validarId(idCategoriaProducto, "El ID de la categoria no es valido.");

    const error = validarActualizarCategoriaProducto(data);

    if (error) {
      throw new Error(error);
    }

    await this.buscarPorId(idCategoriaProducto);

    const dataActualizar: any = {};

    if (data.nombre !== undefined) {
      const nombre = String(data.nombre).trim();
      const existente =
        await categoriaProductoRepository.buscarPorNombreExacto(nombre);

      if (existente && existente.idCategoriaProducto !== idCategoriaProducto) {
        throw new Error("El nombre de la categoria no puede repetirse.");
      }

      dataActualizar.nombre = nombre;
    }

    if (data.descripcion !== undefined) {
      dataActualizar.descripcion = limpiarTextoOpcional(data.descripcion);
    }

    if (data.estado !== undefined) {
      dataActualizar.estado = Boolean(data.estado);
    }

    return await categoriaProductoRepository.actualizarCategoria(
      idCategoriaProducto,
      dataActualizar,
    );
  }

  async desactivarCategoria(idCategoriaProducto: number) {
    validarId(idCategoriaProducto, "El ID de la categoria no es valido.");
    await this.buscarPorId(idCategoriaProducto);

    return await categoriaProductoRepository.desactivarCategoria(
      idCategoriaProducto,
    );
  }

  async eliminarCategoria(idCategoriaProducto: number) {
    validarId(idCategoriaProducto, "El ID de la categoria no es valido.");
    await this.buscarPorId(idCategoriaProducto);

    const productosAsociados =
      await categoriaProductoRepository.contarProductos(idCategoriaProducto);

    if (productosAsociados > 0) {
      throw new Error(
        "No se puede eliminar una categoria con productos asociados. Desactivela en su lugar.",
      );
    }

    return await categoriaProductoRepository.eliminarCategoria(
      idCategoriaProducto,
    );
  }
}
