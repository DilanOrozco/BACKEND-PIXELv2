import { Prisma } from "../../../generated/prisma/client";
import { CategoriaProductoRepository } from "../../infrastructure/repositories/categoria-producto.repository";
import { ProductoRepository } from "../../infrastructure/repositories/producto.repository";
import {
  validarActualizarProducto,
  validarCrearProducto,
  validarRangosProducto,
} from "../validators/producto.validator";
import {
  paginatedResponse,
  parsePaginationQuery,
  type PaginationQuery,
} from "../../utils/pagination.util";
import { limpiarTextoOpcional } from "../../utils/text.util";

const productoRepository = new ProductoRepository();
const categoriaProductoRepository = new CategoriaProductoRepository();

type ItemCalculoEntrada = {
  idProducto: number;
  idTecnica?: number | null;
  cantidad: number;
  observaciones?: string | null;
};

const validarId = (id: number, mensaje: string) => {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(mensaje);
  }
};

const normalizarDecimal = (valor: unknown) => new Prisma.Decimal(String(valor));

const redondearPesos = (valor: Prisma.Decimal) => valor.toDecimalPlaces(0);

const parseFiltroCategoria = (query: PaginationQuery = {}) => {
  if (query.idCategoriaProducto === undefined || query.idCategoriaProducto === "") {
    return undefined;
  }

  const idCategoriaProducto = Number(query.idCategoriaProducto);

  if (!Number.isInteger(idCategoriaProducto) || idCategoriaProducto <= 0) {
    throw new Error("El filtro de categoria debe ser valido.");
  }

  return { idCategoriaProducto };
};

export class ProductoService {
  async listarProductos(query: PaginationQuery = {}) {
    const pagination = parsePaginationQuery(query, {
      defaultSortBy: "idProducto",
      allowedSortBy: ["idProducto", "nombre", "precioBase", "fechaCreacion"],
      maxLimit: 10,
    });

    const resultado = await productoRepository.listarProductosPaginado(
      pagination,
      parseFiltroCategoria(query),
    );

    return paginatedResponse(resultado.data, pagination, resultado.total);
  }

  async listarProductosPublicos(query: PaginationQuery = {}) {
    return await productoRepository.listarProductosPublicos(
      parseFiltroCategoria(query),
    );
  }

  async buscarPorId(idProducto: number) {
    validarId(idProducto, "El ID del producto no es valido.");

    const producto = await productoRepository.buscarPorId(idProducto);

    if (!producto) {
      throw new Error("Producto no encontrado.");
    }

    return producto;
  }

  async crearProducto(data: Record<string, unknown>) {
    const error = validarCrearProducto(data);

    if (error) {
      throw new Error(error);
    }

    const nombre = String(data.nombre).trim();
    const idCategoriaProducto = Number(data.idCategoriaProducto);
    const existente = await productoRepository.buscarPorNombreExacto(nombre);

    if (existente) {
      throw new Error("El nombre del producto no puede repetirse.");
    }

    const categoria = await categoriaProductoRepository.buscarActivaPorId(
      idCategoriaProducto,
    );

    if (!categoria) {
      throw new Error("La categoria del producto no existe o esta inactiva.");
    }

    return await productoRepository.crearProducto({
      nombre,
      idCategoriaProducto,
      descripcion: limpiarTextoOpcional(data.descripcion),
      precioBase: normalizarDecimal(data.precioBase),
      estado: data.estado === undefined ? true : Boolean(data.estado),
    });
  }

  async actualizarProducto(idProducto: number, data: Record<string, unknown>) {
    validarId(idProducto, "El ID del producto no es valido.");

    const error = validarActualizarProducto(data);

    if (error) {
      throw new Error(error);
    }

    const producto = await productoRepository.buscarPorId(idProducto);

    if (!producto) {
      throw new Error("Producto no encontrado.");
    }

    const dataActualizar: any = {};

    if (data.nombre !== undefined) {
      const nombre = String(data.nombre).trim();
      const existente = await productoRepository.buscarPorNombreExacto(nombre);

      if (existente && existente.idProducto !== idProducto) {
        throw new Error("El nombre del producto no puede repetirse.");
      }

      dataActualizar.nombre = nombre;
    }

    if (data.descripcion !== undefined) {
      dataActualizar.descripcion = limpiarTextoOpcional(data.descripcion);
    }

    if (data.precioBase !== undefined) {
      dataActualizar.precioBase = normalizarDecimal(data.precioBase);
    }

    if (data.idCategoriaProducto !== undefined) {
      const idCategoriaProducto = Number(data.idCategoriaProducto);
      const categoria = await categoriaProductoRepository.buscarActivaPorId(
        idCategoriaProducto,
      );

      if (!categoria) {
        throw new Error("La categoria del producto no existe o esta inactiva.");
      }

      dataActualizar.idCategoriaProducto = idCategoriaProducto;
    }

    if (data.estado !== undefined) {
      dataActualizar.estado = Boolean(data.estado);
    }

    return await productoRepository.actualizarProducto(
      idProducto,
      dataActualizar,
    );
  }

  async desactivarProducto(idProducto: number) {
    validarId(idProducto, "El ID del producto no es valido.");
    await this.buscarPorId(idProducto);

    return await productoRepository.desactivarProducto(idProducto);
  }

  async eliminarProducto(idProducto: number) {
    validarId(idProducto, "El ID del producto no es valido.");
    await this.buscarPorId(idProducto);

    return await productoRepository.eliminarProducto(idProducto);
  }

  async listarRangos(idProducto: number) {
    validarId(idProducto, "El ID del producto no es valido.");
    await this.buscarPorId(idProducto);

    return await productoRepository.listarRangos(idProducto);
  }

  async reemplazarRangos(idProducto: number, data: Record<string, unknown>) {
    validarId(idProducto, "El ID del producto no es valido.");

    const error = validarRangosProducto(data);

    if (error) {
      throw new Error(error);
    }

    await this.buscarPorId(idProducto);

    const rangos = (data.rangos as any[]).map((rango) => ({
      cantidadMin: Number(rango.cantidadMin),
      descuentoPorcentaje: normalizarDecimal(rango.descuentoPorcentaje),
      estado: rango.estado === undefined ? true : Boolean(rango.estado),
    }));

    return await productoRepository.reemplazarRangos(idProducto, rangos);
  }

  async calcularItems(items: ItemCalculoEntrada[]) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("Debe enviar al menos un producto para cotizar.");
    }

    const itemsNormalizados = items.map((item) => {
      const idProducto = Number(item.idProducto);
      const cantidad = Number(item.cantidad);

      validarId(idProducto, "El producto es obligatorio y debe ser valido.");

      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        throw new Error("La cantidad debe ser mayor a 0.");
      }

      return { item, idProducto, cantidad };
    });
    const idsProductos = [
      ...new Set(itemsNormalizados.map(({ idProducto }) => idProducto)),
    ];
    const productos = await Promise.all(
      idsProductos.map(async (idProducto) => ({
        idProducto,
        producto: await productoRepository.buscarActivoPorId(idProducto),
      })),
    );
    const productosPorId = new Map(
      productos.map(({ idProducto, producto }) => [idProducto, producto]),
    );
    const resultados = [];
    let subtotalBrutoGeneral = new Prisma.Decimal(0);
    let descuentoTotalGeneral = new Prisma.Decimal(0);
    let total = new Prisma.Decimal(0);

    for (const { item, idProducto, cantidad } of itemsNormalizados) {
      const producto = productosPorId.get(idProducto);

      if (!producto) {
        throw new Error(`El producto ${idProducto} no existe o esta inactivo.`);
      }

      const rangosActivos = producto.rangos.filter((rango: any) => rango.estado);
      const rango = rangosActivos
        .filter((itemRango: any) => Number(itemRango.cantidadMin) <= cantidad)
        .sort((a: any, b: any) => Number(b.cantidadMin) - Number(a.cantidadMin))[0];

      if (!rango) {
        throw new Error(`El producto ${producto.nombre} no tiene rangos activos para cotizar.`);
      }

      const precioBase = new Prisma.Decimal(producto.precioBase);
      const descuentoPorcentaje = new Prisma.Decimal(rango.descuentoPorcentaje);
      const descuentoValor = precioBase.mul(descuentoPorcentaje).div(100);
      const precioUnitario = redondearPesos(precioBase.minus(descuentoValor));
      const descuentoValorUnitario = redondearPesos(descuentoValor);
      const subtotalBruto = precioBase.mul(cantidad);
      const descuentoTotal = redondearPesos(
        subtotalBruto.mul(descuentoPorcentaje).div(100),
      );
      const subtotalConDescuento = subtotalBruto.minus(descuentoTotal);
      const subtotalFinal = subtotalConDescuento;

      subtotalBrutoGeneral = subtotalBrutoGeneral.plus(subtotalBruto);
      descuentoTotalGeneral = descuentoTotalGeneral.plus(descuentoTotal);
      total = total.plus(subtotalFinal);

      resultados.push({
        idProducto: producto.idProducto,
        idTecnica: item.idTecnica ? Number(item.idTecnica) : undefined,
        producto: {
          idProducto: producto.idProducto,
          nombre: producto.nombre,
          descripcion: producto.descripcion,
          categoriaProducto: producto.categoriaProducto,
        },
        cantidad,
        precioBase: precioBase.toNumber(),
        descuentoPorcentaje: descuentoPorcentaje.toNumber(),
        descuentoValorUnitario: descuentoValorUnitario.toNumber(),
        descuentoAplicado: descuentoTotal.toNumber(),
        descuentoTotal: descuentoTotal.toNumber(),
        precioUnitario: precioUnitario.toNumber(),
        subtotalBruto: subtotalBruto.toNumber(),
        subtotal: subtotalBruto.toNumber(),
        subtotalConDescuento: subtotalConDescuento.toNumber(),
        subtotalFinal: subtotalFinal.toNumber(),
        observaciones: limpiarTextoOpcional(item.observaciones),
        snapshot: {
          idProducto: producto.idProducto,
          idTecnica: item.idTecnica ? Number(item.idTecnica) : undefined,
          descripcion: producto.nombre,
          cantidad,
          precioBase,
          descuentoPorcentaje,
          descuentoValorUnitario,
          precioUnitario,
          subtotal: subtotalBruto,
          subtotalBruto,
          descuentoTotal,
          subtotalConDescuento,
          observaciones: limpiarTextoOpcional(item.observaciones),
        },
      });
    }

    return {
      items: resultados,
      subtotal: subtotalBrutoGeneral.toNumber(),
      subtotalBruto: subtotalBrutoGeneral.toNumber(),
      descuentoTotal: descuentoTotalGeneral.toNumber(),
      subtotalConDescuento: total.toNumber(),
      costosAdicionales: 0,
      costoDiseno: 0,
      total: total.toNumber(),
    };
  }
}
