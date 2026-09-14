import {
  ProveedorRepository,
  type ProveedorFiltros,
} from "../../infrastructure/repositories/proveedor.repository";
import {
  validarActualizarProveedor,
  validarCrearProveedor,
  validarFiltrosProveedor,
} from "../validators/proveedor.validator";
import {
  paginatedResponse,
  parsePaginationQuery,
  type PaginationQuery,
} from "../../utils/pagination.util";

type DatosEntrada = Record<string, unknown>;

const proveedorRepository = new ProveedorRepository();

const validarId = (idProveedor: number) => {
  if (!Number.isInteger(idProveedor) || idProveedor <= 0) {
    throw new Error("El ID del proveedor no es valido.");
  }
};

const limpiarTextoOpcional = (valor: unknown) => {
  if (valor === undefined || valor === null) {
    return null;
  }

  if (typeof valor !== "string") {
    return null;
  }

  const texto = valor.trim();
  return texto === "" ? null : texto;
};

const limpiarNombre = (valor: unknown) => String(valor).trim();

const prepararFiltros = (data: DatosEntrada): ProveedorFiltros => {
  const filtros: ProveedorFiltros = {};

  if (data.estado !== undefined) {
    filtros.estado =
      data.estado === true || String(data.estado).toLowerCase() === "true";
  }

  return filtros;
};

export class ProveedorService {
  async crearProveedor(data: DatosEntrada) {
    const error = validarCrearProveedor(data);

    if (error) {
      throw new Error(error);
    }

    const nombre = limpiarNombre(data.nombre);
    const proveedorExistente =
      await proveedorRepository.buscarPorNombreExacto(nombre);

    if (proveedorExistente) {
      throw new Error("El nombre del proveedor no puede repetirse.");
    }

    return await proveedorRepository.crearProveedor({
      nombre,
      telefono: limpiarTextoOpcional(data.telefono),
      correo: limpiarTextoOpcional(data.correo),
      direccion: limpiarTextoOpcional(data.direccion),
      estado: true,
    });
  }

  async listarProveedores(filtrosEntrada: DatosEntrada & PaginationQuery) {
    const error = validarFiltrosProveedor(filtrosEntrada);

    if (error) {
      throw new Error(error);
    }

    const pagination = parsePaginationQuery(filtrosEntrada, {
      defaultSortBy: "nombre",
      allowedSortBy: ["idProveedor", "nombre", "correo", "fechaCreacion"],
      maxLimit: 10,
    });
    const filtros = prepararFiltros(filtrosEntrada);

    if (pagination.isPaginated) {
      const resultado = await proveedorRepository.listarProveedoresPaginado(
        filtros,
        pagination,
      );

      if (resultado.data.length === 0) {
        throw new Error("No se encontraron resultados.");
      }

      return paginatedResponse(resultado.data, pagination, resultado.total);
    }

    const proveedores = await proveedorRepository.listarProveedores(filtros);

    if (proveedores.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    return { data: proveedores };
  }

  async buscarPorId(idProveedor: number) {
    validarId(idProveedor);

    const proveedor = await proveedorRepository.buscarPorId(idProveedor);

    if (!proveedor) {
      throw new Error("Proveedor no encontrado.");
    }

    return proveedor;
  }

  async buscarParcial(termino: string) {
    if (!termino || termino.trim() === "") {
      throw new Error("Debe ingresar un termino de busqueda.");
    }

    const proveedores = await proveedorRepository.buscarParcial(termino.trim());

    if (proveedores.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    return proveedores;
  }

  async actualizarProveedor(idProveedor: number, data: DatosEntrada) {
    validarId(idProveedor);

    const error = validarActualizarProveedor(data);

    if (error) {
      throw new Error(error);
    }

    const proveedor = await proveedorRepository.buscarPorId(idProveedor);

    if (!proveedor) {
      throw new Error("Proveedor no encontrado.");
    }

    const dataActualizar: Partial<{
      nombre: string;
      telefono: string | null;
      correo: string | null;
      direccion: string | null;
      estado: boolean;
    }> = {};

    if (data.nombre !== undefined) {
      const nombre = limpiarNombre(data.nombre);
      const proveedorExistente =
        await proveedorRepository.buscarPorNombreExacto(nombre);

      if (
        proveedorExistente &&
        proveedorExistente.idProveedor !== idProveedor
      ) {
        throw new Error("El nombre del proveedor no puede repetirse.");
      }

      dataActualizar.nombre = nombre;
    }

    if (data.telefono !== undefined) {
      dataActualizar.telefono = limpiarTextoOpcional(data.telefono);
    }

    if (data.correo !== undefined) {
      dataActualizar.correo = limpiarTextoOpcional(data.correo);
    }

    if (data.direccion !== undefined) {
      dataActualizar.direccion = limpiarTextoOpcional(data.direccion);
    }

    if (data.estado !== undefined) {
      dataActualizar.estado = Boolean(data.estado);
    }

    return await proveedorRepository.actualizarProveedor(
      idProveedor,
      dataActualizar,
    );
  }

  async desactivarProveedor(idProveedor: number) {
    validarId(idProveedor);

    const proveedor = await proveedorRepository.buscarPorId(idProveedor);

    if (!proveedor) {
      throw new Error("Proveedor no encontrado.");
    }

    return await proveedorRepository.desactivarProveedor(idProveedor);
  }

  async eliminarProveedor(idProveedor: number) {
    validarId(idProveedor);

    const proveedor = await proveedorRepository.buscarPorId(idProveedor);

    if (!proveedor) {
      throw new Error("Proveedor no encontrado.");
    }

    const comprasAsociadas = await proveedorRepository.contarCompras(
      idProveedor,
    );

    if (comprasAsociadas > 0) {
      throw new Error(
        "No se puede eliminar el proveedor porque tiene compras asociadas.",
      );
    }

    return await proveedorRepository.eliminarProveedor(idProveedor);
  }
}
