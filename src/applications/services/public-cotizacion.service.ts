import { ClienteRepository } from "../../infrastructure/repositories/cliente.repository";
import { CotizacionRepository } from "../../infrastructure/repositories/cotizacion.repository";
import { limpiarTextoOpcional } from "../../utils/text.util";
import { ProductoService } from "./producto.service";
import { CategoriaProductoService } from "./categoria-producto.service";
import { TecnicaRepository } from "../../infrastructure/repositories/tecnica.repository";
import { NotificationService } from "./notification.service";
import { ClienteAccessService } from "./cliente-access.service";
import {
  validarCalcularCotizacionPublica,
  validarCrearCotizacionPublica,
} from "../validators/public-cotizacion.validator";

const clienteRepository = new ClienteRepository();
const cotizacionRepository = new CotizacionRepository();
const productoService = new ProductoService();
const categoriaProductoService = new CategoriaProductoService();
const tecnicaRepository = new TecnicaRepository();
const notificationService = new NotificationService();
const clienteAccessService = new ClienteAccessService();

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

const enviarCorreosCotizacion = async (
  cliente: any,
  cotizacion: any,
  calculo: any,
  observaciones: string | null,
  accesoCliente?: any,
) => {
  const payload = {
    idCotizacion: cotizacion.idCotizacion,
    cliente,
    items: respuestaCalculoPublica(calculo).items,
    total: calculo.total,
    observaciones,
    accesoCliente,
  };
  return await notificationService.cotizacionCreada(payload);
};

export class PublicCotizacionService {
  async listarProductos(query: Record<string, unknown> = {}) {
    return await productoService.listarProductosPublicos(query);
  }

  async listarCategoriasProducto() {
    return await categoriaProductoService.listarCategoriasPublicas();
  }

  async listarTecnicas() {
    return await tecnicaRepository.listarTecnicasActivas();
  }

  private async asegurarTecnicasActivas(items: any[]) {
    const idsTecnicas = [...new Set(items.map((item) => Number(item.idTecnica)))];

    for (const idTecnica of idsTecnicas) {
      const tecnica = await tecnicaRepository.buscarPorId(idTecnica);

      if (!tecnica || !tecnica.estado) {
        throw new Error(`La tecnica con ID ${idTecnica} no existe o esta inactiva.`);
      }
    }
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

    const itemsEntrada = data.items as any[];
    await this.asegurarTecnicasActivas(itemsEntrada);

    const calculo = await productoService.calcularItems(itemsEntrada);
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

    const accesoCliente = await clienteAccessService.asegurarAccesoCliente(cliente);

    const detalles = calculo.items.map((item: any, index: number) => ({
      idProducto: item.snapshot.idProducto,
      idTecnica: Number(itemsEntrada[index]?.idTecnica),
      descripcion: item.snapshot.descripcion,
      cantidad: item.snapshot.cantidad,
      precioBase: item.snapshot.precioBase,
      descuentoPorcentaje: item.snapshot.descuentoPorcentaje,
      descuentoValorUnitario: item.snapshot.descuentoValorUnitario,
      precioUnitario: item.snapshot.precioUnitario,
      costoDiseno: 0,
      subtotal: item.snapshot.subtotal,
      subtotalBruto: item.snapshot.subtotalBruto,
      descuentoTotal: item.snapshot.descuentoTotal,
      subtotalConDescuento: item.snapshot.subtotalConDescuento,
      observaciones: item.snapshot.observaciones,
    }));

    const cotizacion = await cotizacionRepository.crearCotizacionConDetalles({
      idCliente: cliente.idCliente,
      creadoPorId: null,
      tipoCotizacion: "PUBLICA",
      estado: "PENDIENTE",
      subtotal: calculo.subtotal,
      descuentoTotal: calculo.descuentoTotal,
      costosAdicionales: 0,
      total: calculo.total,
      observaciones: limpiarTextoOpcional(data.observaciones),
      detalles,
    });
    const observaciones = limpiarTextoOpcional(data.observaciones);
    const email = await enviarCorreosCotizacion(
      cliente,
      cotizacion,
      calculo,
      observaciones,
      accesoCliente,
    );

    return {
      cotizacion,
      calculo: respuestaCalculoPublica(calculo),
      email,
    };
  }
}
