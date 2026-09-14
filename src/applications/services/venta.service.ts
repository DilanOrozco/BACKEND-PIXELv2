import {
  VentaRepository,
  type VentaFiltros,
} from "../../infrastructure/repositories/venta.repository";
import {
  type EstadoPagoVenta,
  validarBusquedaVentas,
  validarFiltrosVentas,
  validarResumenPeriodoVentas,
  validarResumenVentas,
} from "../validators/venta.validator";

type DatosEntrada = Record<string, unknown>;

const ventaRepository = new VentaRepository();

export class VentaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VentaValidationError";
    Object.setPrototypeOf(this, VentaValidationError.prototype);
  }
}

const obtenerValorQuery = (valorEntrada: unknown) => {
  if (Array.isArray(valorEntrada)) {
    return valorEntrada[0];
  }

  return valorEntrada;
};

const aNumero = (valor: unknown) => {
  const numero = typeof valor === "bigint"
    ? Number(valor)
    : Number(valor ?? 0);

  return Number.isFinite(numero) ? numero : 0;
};

const fechaInicio = (valorEntrada: unknown) => {
  const valor = obtenerValorQuery(valorEntrada);

  if (typeof valor !== "string" || valor.trim() === "") {
    return undefined;
  }

  const fecha = new Date(valor);

  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    fecha.setUTCHours(0, 0, 0, 0);
  }

  return fecha;
};

const fechaFin = (valorEntrada: unknown) => {
  const valor = obtenerValorQuery(valorEntrada);

  if (typeof valor !== "string" || valor.trim() === "") {
    return undefined;
  }

  const fecha = new Date(valor);

  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    fecha.setUTCHours(23, 59, 59, 999);
  }

  return fecha;
};

const obtenerTerminoBusqueda = (filtrosEntrada: DatosEntrada) => {
  const termino =
    obtenerValorQuery(filtrosEntrada.termino) ??
    obtenerValorQuery(filtrosEntrada.q) ??
    obtenerValorQuery(filtrosEntrada.busqueda);

  return String(termino ?? "").trim();
};

const prepararFiltros = (filtrosEntrada: DatosEntrada): VentaFiltros => {
  const filtros: VentaFiltros = {};
  const idCliente = obtenerValorQuery(filtrosEntrada.idCliente);
  const estadoPago = obtenerValorQuery(filtrosEntrada.estadoPago);
  const inicio = fechaInicio(filtrosEntrada.fechaInicio);
  const fin = fechaFin(filtrosEntrada.fechaFin);

  if (idCliente !== undefined) {
    filtros.idCliente = Number(idCliente);
  }

  if (estadoPago !== undefined) {
    filtros.estadoPago = estadoPago as EstadoPagoVenta;
  }

  if (inicio) {
    filtros.fechaInicio = inicio;
  }

  if (fin) {
    filtros.fechaFin = fin;
  }

  return filtros;
};

const lanzarErrorValidacion = (error: string | null) => {
  if (error) {
    throw new VentaValidationError(error);
  }
};

export class VentaService {
  private formatearVenta(pedido: any) {
    const tecnicasPorId = new Map<number, { idTecnica: number; nombre: string }>();
    let cantidadTotalProductos = 0;

    for (const detalle of pedido.detalles ?? []) {
      cantidadTotalProductos += aNumero(detalle.cantidad);

      if (!detalle.tecnica) {
        continue;
      }

      tecnicasPorId.set(Number(detalle.tecnica.idTecnica), {
        idTecnica: Number(detalle.tecnica.idTecnica),
        nombre: detalle.tecnica.nombre,
      });
    }

    return {
      idPedido: pedido.idPedido,
      idVenta: pedido.venta?.idVenta ?? null,
      idCliente: pedido.idCliente,
      nombreCliente: pedido.cliente?.nombre ?? null,
      correoCliente: pedido.cliente?.correo ?? null,
      telefonoCliente: pedido.cliente?.telefono ?? null,
      total: aNumero(pedido.total),
      totalPagado: aNumero(pedido.totalPagado),
      saldoPendiente: aNumero(pedido.saldoPendiente),
      fechaCreacion: pedido.fechaCreacion,
      fechaFinalizado: pedido.fechaFinalizado,
      fechaEntregado: pedido.fechaEntregado,
      estadoPago: pedido.estadoPago,
      estado: pedido.venta?.estado ?? null,
      fechaPrimerPago: pedido.venta?.fechaPrimerPago ?? null,
      tecnicas: Array.from(tecnicasPorId.values()),
      cantidadTotalProductos,
    };
  }

  private formatearVentas(pedidos: any[]) {
    return pedidos.map((pedido) => this.formatearVenta(pedido));
  }

  async listarVentas(filtrosEntrada: DatosEntrada) {
    lanzarErrorValidacion(validarFiltrosVentas(filtrosEntrada));

    const ventas = await ventaRepository.listarVentas(
      prepararFiltros(filtrosEntrada),
    );

    if (ventas.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    return this.formatearVentas(ventas);
  }

  async buscarVentas(filtrosEntrada: DatosEntrada) {
    lanzarErrorValidacion(validarBusquedaVentas(filtrosEntrada));

    const ventas = await ventaRepository.buscarVentas(
      obtenerTerminoBusqueda(filtrosEntrada),
    );

    if (ventas.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    return this.formatearVentas(ventas);
  }

  async obtenerResumen(filtrosEntrada: DatosEntrada) {
    lanzarErrorValidacion(validarResumenVentas(filtrosEntrada));

    return await ventaRepository.obtenerResumen();
  }

  async obtenerResumenPeriodo(filtrosEntrada: DatosEntrada) {
    lanzarErrorValidacion(validarResumenPeriodoVentas(filtrosEntrada));

    const resumen = await ventaRepository.obtenerResumen(
      prepararFiltros(filtrosEntrada),
    );

    return {
      totalVentas: resumen.totalVentas,
      ingresosRecibidos: resumen.ingresosRecibidos,
      cantidadVentas: resumen.cantidadVentas,
      ticketPromedio: resumen.ticketPromedio,
    };
  }
}
