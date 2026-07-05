import { ClienteRepository } from "../../infrastructure/repositories/cliente.repository";
import { CotizacionRepository } from "../../infrastructure/repositories/cotizacion.repository";
import { limpiarTextoOpcional } from "../../utils/text.util";
import { ProductoService } from "./producto.service";
import {
  validarCalcularCotizacionPublica,
  validarCrearCotizacionPublica,
} from "../validators/public-cotizacion.validator";

const clienteRepository = new ClienteRepository();
const cotizacionRepository = new CotizacionRepository();
const productoService = new ProductoService();

const limpiarCorreo = (valor: unknown) => {
  const texto = limpiarTextoOpcional(valor);
  return texto ? texto.toLowerCase() : null;
};

const respuestaCalculoPublica = (calculo: any) => ({
  items: calculo.items.map((item: any) => {
    const { snapshot, ...publico } = item;
    void snapshot;
    return publico;
  }),
  subtotal: calculo.subtotal,
  total: calculo.total,
});

export class PublicCotizacionService {
  async listarProductos() {
    return await productoService.listarProductosPublicos();
  }

  async calcular(data: Record<string, unknown>) {
    const error = validarCalcularCotizacionPublica(data);

    if (error) {
      throw new Error(error);
    }

    const calculo = await productoService.calcularItems(data.items as any[]);
    return respuestaCalculoPublica(calculo);
  }

  async crearCotizacion(data: Record<string, unknown>) {
    const error = validarCrearCotizacionPublica(data);

    if (error) {
      throw new Error(error);
    }

    const clienteEntrada = data.cliente as Record<string, unknown>;
    const correo = limpiarCorreo(clienteEntrada.correo);
    const telefono = limpiarTextoOpcional(clienteEntrada.telefono);
    const clienteExistente =
      await clienteRepository.buscarPorCorreoOTelefono(correo, telefono);

    const cliente = clienteExistente
      ? await clienteRepository.actualizarCliente(clienteExistente.idCliente, {
          nombre: String(clienteEntrada.nombre).trim(),
          documento: limpiarTextoOpcional(clienteEntrada.documento),
          correo: correo ?? clienteExistente.correo,
          telefono: telefono ?? clienteExistente.telefono,
          direccion: limpiarTextoOpcional(clienteEntrada.direccion),
        })
      : await clienteRepository.crearCliente({
          nombre: String(clienteEntrada.nombre).trim(),
          documento: limpiarTextoOpcional(clienteEntrada.documento),
          correo,
          telefono,
          direccion: limpiarTextoOpcional(clienteEntrada.direccion),
        });

    const calculo = await productoService.calcularItems(data.items as any[]);
    const detalles = calculo.items.map((item: any) => ({
      idProducto: item.snapshot.idProducto,
      idTecnica: null,
      descripcion: item.snapshot.descripcion,
      cantidad: item.snapshot.cantidad,
      precioBase: item.snapshot.precioBase,
      descuentoPorcentaje: item.snapshot.descuentoPorcentaje,
      precioUnitario: item.snapshot.precioUnitario,
      costoDiseno: 0,
      subtotal: item.snapshot.subtotal,
      observaciones: item.snapshot.observaciones,
    }));

    const cotizacion = await cotizacionRepository.crearCotizacionConDetalles({
      idCliente: cliente.idCliente,
      creadoPorId: null,
      tipoCotizacion: "PUBLICA",
      estado: "PENDIENTE",
      subtotal: calculo.subtotal,
      costosAdicionales: 0,
      total: calculo.total,
      observaciones: limpiarTextoOpcional(data.observaciones),
      detalles,
    });

    return {
      cotizacion,
      calculo: respuestaCalculoPublica(calculo),
    };
  }
}
