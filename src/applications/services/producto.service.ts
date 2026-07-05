import { Prisma } from "../../../generated/prisma/client";
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

type ItemCalculoEntrada = {
  idProducto: number;
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

export class ProductoService {
  async listarProductos(query: PaginationQuery = {}) {
    const pagination = parsePaginationQuery(query, {
      defaultSortBy: "idProducto",
      allowedSortBy: ["idProducto", "nombre", "precioBase", "fechaCreacion"],
      maxLimit: 10,
    });

    const resultado = await productoRepository.listarProductosPaginado(
      pagination,
    );

    return paginatedResponse(resultado.data, pagination, resultado.total);
  }

  async listarProductosPublicos() {
    return await productoRepository.listarProductosPublicos();
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
    const existente = await productoRepository.buscarPorNombreExacto(nombre);

    if (existente) {
      throw new Error("El nombre del producto no puede repetirse.");
    }

    return await productoRepository.crearProducto({
      nombre,
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

    const resultados = [];
    let total = new Prisma.Decimal(0);

    for (const item of items) {
      const idProducto = Number(item.idProducto);
      const cantidad = Number(item.cantidad);

      validarId(idProducto, "El producto es obligatorio y debe ser valido.");

      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        throw new Error("La cantidad debe ser mayor a 0.");
      }

      const producto = await productoRepository.buscarActivoPorId(idProducto);

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
      const subtotal = precioUnitario.mul(cantidad);

      total = total.plus(subtotal);

      resultados.push({
        idProducto: producto.idProducto,
        producto: {
          idProducto: producto.idProducto,
          nombre: producto.nombre,
          descripcion: producto.descripcion,
        },
        cantidad,
        precioBase: precioBase.toNumber(),
        descuentoPorcentaje: descuentoPorcentaje.toNumber(),
        descuentoAplicado: redondearPesos(descuentoValor).toNumber(),
        precioUnitario: precioUnitario.toNumber(),
        subtotal: subtotal.toNumber(),
        observaciones: limpiarTextoOpcional(item.observaciones),
        snapshot: {
          idProducto: producto.idProducto,
          descripcion: producto.nombre,
          cantidad,
          precioBase,
          descuentoPorcentaje,
          precioUnitario,
          subtotal,
          observaciones: limpiarTextoOpcional(item.observaciones),
        },
      });
    }

    return {
      items: resultados,
      subtotal: total.toNumber(),
      total: total.toNumber(),
    };
  }
}
