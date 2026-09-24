import { ReporteRepository } from "../../infrastructure/repositories/reporte.repository";
import {
  ESTADOS_ABONO_REPORTE,
  ESTADOS_COTIZACION_REPORTE,
  ESTADOS_PEDIDO_REPORTE,
  prepararFiltrosReporte,
  ReporteValidationError,
  type FiltrosReporte,
  type TipoReporte,
} from "../validators/reporte.validator";

export { ReporteValidationError } from "../validators/reporte.validator";

export const ZONA_HORARIA_REPORTES = "America/Bogota";
export const MAXIMO_REGISTROS_PDF = 1000;

export interface UsuarioGeneradorReporte {
  idUsuario?: number;
  nombre?: string;
  correo?: string;
}

export interface ReporteData {
  reporte: TipoReporte;
  generadoEn: string;
  zonaHoraria: typeof ZONA_HORARIA_REPORTES;
  generadoPor: {
    idUsuario: number | null;
    nombre: string;
  };
  periodo: {
    fechaInicio: string | null;
    fechaFin: string | null;
  };
  filtros: Record<string, string | number>;
  resumen: Record<string, unknown>;
  registros: Record<string, unknown>[];
  totalRegistros: number;
  paginacion: {
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  } | null;
}

const aNumero = (valor: unknown) => Number(valor ?? 0);
const redondearMoneda = (valor: number) => Math.round(valor * 100) / 100;
const porcentaje = (cantidad: number, total: number) =>
  total === 0 ? 0 : Math.round((cantidad / total) * 10_000) / 100;

const identidadUsuario = (usuario: UsuarioGeneradorReporte) => {
  const idUsuario = Number(usuario.idUsuario);
  return {
    idUsuario: Number.isInteger(idUsuario) && idUsuario > 0 ? idUsuario : null,
    nombre: usuario.nombre?.trim() || usuario.correo?.trim() || "Usuario autenticado",
  };
};

const filtrosPublicos = (filtros: FiltrosReporte) => {
  const salida: Record<string, string | number> = {};
  if (filtros.idCliente) salida.idCliente = filtros.idCliente;
  if (filtros.idPedido) salida.idPedido = filtros.idPedido;
  if (filtros.estadoPago) salida.estadoPago = filtros.estadoPago;
  if (filtros.estadoPedido) salida.estado = filtros.estadoPedido;
  if (filtros.estadoCotizacion) salida.estado = filtros.estadoCotizacion;
  if (filtros.estadoAbono) salida.estado = filtros.estadoAbono;
  return salida;
};

const crearBase = (
  tipo: TipoReporte,
  filtros: FiltrosReporte,
  usuario: UsuarioGeneradorReporte,
  resumen: Record<string, unknown>,
  registros: Record<string, unknown>[],
  totalRegistros: number,
  esPdf: boolean,
): ReporteData => ({
  reporte: tipo,
  generadoEn: new Date().toISOString(),
  zonaHoraria: ZONA_HORARIA_REPORTES,
  generadoPor: identidadUsuario(usuario),
  periodo: {
    fechaInicio: filtros.fechaInicio ?? null,
    fechaFin: filtros.fechaFin ?? null,
  },
  filtros: filtrosPublicos(filtros),
  resumen,
  registros,
  totalRegistros,
  paginacion: esPdf
    ? null
    : {
        page: filtros.page,
        limit: filtros.limit,
        totalPages: totalRegistros === 0 ? 0 : Math.ceil(totalRegistros / filtros.limit),
        hasNextPage: filtros.page * filtros.limit < totalRegistros,
        hasPrevPage: filtros.page > 1 && totalRegistros > 0,
      },
});

const verificarLimitePdf = (total: number) => {
  if (total > MAXIMO_REGISTROS_PDF) {
    throw new ReporteValidationError(
      `El PDF supera el limite seguro de ${MAXIMO_REGISTROS_PDF} registros. Reduce el rango o aplica filtros.`,
    );
  }
};

export class ReporteService {
  constructor(private readonly repository = new ReporteRepository()) {}

  async construirReporte(
    tipo: TipoReporte,
    query: Record<string, unknown>,
    usuario: UsuarioGeneradorReporte,
    esPdf = false,
  ): Promise<ReporteData> {
    const filtros = prepararFiltrosReporte(tipo, query, esPdf);
    if (tipo === "VENTAS") return await this.construirVentas(filtros, usuario, esPdf);
    if (tipo === "PEDIDOS") return await this.construirPedidos(filtros, usuario, esPdf);
    if (tipo === "COTIZACIONES") return await this.construirCotizaciones(filtros, usuario, esPdf);
    return await this.construirAbonos(filtros, usuario, esPdf);
  }

  private limitesListado(filtros: FiltrosReporte, esPdf: boolean) {
    return esPdf
      ? { take: MAXIMO_REGISTROS_PDF + 1, skip: 0 }
      : { take: filtros.limit, skip: filtros.skip };
  }

  private async construirVentas(
    filtros: FiltrosReporte,
    usuario: UsuarioGeneradorReporte,
    esPdf: boolean,
  ) {
    const limites = this.limitesListado(filtros, esPdf);
    const [resumenRaw, ventas] = await Promise.all([
      this.repository.resumenVentas(filtros),
      this.repository.listarVentas(filtros, limites.take, limites.skip),
    ]);
    const cantidadVentas = aNumero(resumenRaw.cantidadVentas);
    const totalVendido = redondearMoneda(aNumero(resumenRaw.totalVendido));
    if (esPdf) verificarLimitePdf(cantidadVentas);
    const registros = ventas.map((venta) => ({
      idVenta: venta.idVenta,
      idPedido: venta.idPedido,
      fecha: venta.fechaPrimerPago,
      cliente: venta.cliente,
      estadoPago: venta.pedido.estadoPago,
      estadoVenta: venta.estado,
      total: redondearMoneda(aNumero(venta.totalPedido)),
    }));
    return crearBase(
      "VENTAS",
      filtros,
      usuario,
      {
        cantidadVentas,
        totalVendido,
        ticketPromedio: cantidadVentas === 0
          ? 0
          : redondearMoneda(totalVendido / cantidadVentas),
        cantidadClientes: aNumero(resumenRaw.cantidadClientes),
      },
      registros,
      cantidadVentas,
      esPdf,
    );
  }

  private async construirPedidos(
    filtros: FiltrosReporte,
    usuario: UsuarioGeneradorReporte,
    esPdf: boolean,
  ) {
    const limites = this.limitesListado(filtros, esPdf);
    const [grupos, pedidos] = await Promise.all([
      this.repository.resumenPedidos(filtros),
      this.repository.listarPedidos(filtros, limites.take, limites.skip),
    ]);
    const cantidadPorEstado = Object.fromEntries(
      ESTADOS_PEDIDO_REPORTE.map((estado) => [estado, 0]),
    ) as Record<(typeof ESTADOS_PEDIDO_REPORTE)[number], number>;
    for (const grupo of grupos) cantidadPorEstado[grupo.estadoPedido] = aNumero(grupo._count._all);
    const totalPedidos = Object.values(cantidadPorEstado).reduce((total, valor) => total + valor, 0);
    if (esPdf) verificarLimitePdf(totalPedidos);
    const porcentajePorEstado = Object.fromEntries(
      ESTADOS_PEDIDO_REPORTE.map((estado) => [estado, porcentaje(cantidadPorEstado[estado], totalPedidos)]),
    );
    const registros = pedidos.map((pedido) => ({
      idPedido: pedido.idPedido,
      fechaCreacion: pedido.fechaCreacion,
      cliente: pedido.cliente,
      estadoPedido: pedido.estadoPedido,
      fechaEntregaEstimada: pedido.fechaEntregaEstimada,
      totalPedido: redondearMoneda(aNumero(pedido.total)),
    }));
    return crearBase(
      "PEDIDOS",
      filtros,
      usuario,
      {
        totalPedidos,
        pendientes: cantidadPorEstado.PENDIENTE,
        enProceso: cantidadPorEstado.EN_PROCESO,
        pendientesSaldoFinal: cantidadPorEstado.PENDIENTE_SALDO_FINAL,
        finalizados: cantidadPorEstado.FINALIZADO,
        entregados: cantidadPorEstado.ENTREGADO,
        anulados: cantidadPorEstado.ANULADO,
        cantidadPorEstado,
        porcentajePorEstado,
      },
      registros,
      totalPedidos,
      esPdf,
    );
  }

  private async construirCotizaciones(
    filtros: FiltrosReporte,
    usuario: UsuarioGeneradorReporte,
    esPdf: boolean,
  ) {
    const limites = this.limitesListado(filtros, esPdf);
    const [grupos, cotizaciones] = await Promise.all([
      this.repository.resumenCotizaciones(filtros),
      this.repository.listarCotizaciones(filtros, limites.take, limites.skip),
    ]);
    const cantidadPorEstado = Object.fromEntries(
      ESTADOS_COTIZACION_REPORTE.map((estado) => [estado, 0]),
    ) as Record<(typeof ESTADOS_COTIZACION_REPORTE)[number], number>;
    for (const grupo of grupos) cantidadPorEstado[grupo.estado] = aNumero(grupo._count._all);
    const totalCotizaciones = Object.values(cantidadPorEstado).reduce((total, valor) => total + valor, 0);
    const cantidadConvertidasPedido = cantidadPorEstado.CONVERTIDA_EN_PEDIDO;
    if (esPdf) verificarLimitePdf(totalCotizaciones);
    const registros = cotizaciones.map((cotizacion) => ({
      idCotizacion: cotizacion.idCotizacion,
      fechaCreacion: cotizacion.fechaCreacion,
      cliente: cotizacion.cliente,
      estado: cotizacion.estado,
      valorPropuestaVigente: cotizacion.versiones[0]
        ? redondearMoneda(aNumero(cotizacion.versiones[0].precioFinal))
        : null,
      idPedido: cotizacion.pedidos[0]?.idPedido ?? null,
    }));
    return crearBase(
      "COTIZACIONES",
      filtros,
      usuario,
      {
        totalCotizaciones,
        cantidadPorEstado,
        cantidadConvertidasPedido,
        tasaConversion: porcentaje(cantidadConvertidasPedido, totalCotizaciones),
      },
      registros,
      totalCotizaciones,
      esPdf,
    );
  }

  private async construirAbonos(
    filtros: FiltrosReporte,
    usuario: UsuarioGeneradorReporte,
    esPdf: boolean,
  ) {
    const limites = this.limitesListado(filtros, esPdf);
    const [grupos, abonos] = await Promise.all([
      this.repository.resumenAbonos(filtros),
      this.repository.listarAbonos(filtros, limites.take, limites.skip),
    ]);
    const cantidadPorEstado = Object.fromEntries(
      ESTADOS_ABONO_REPORTE.map((estado) => [estado, 0]),
    ) as Record<(typeof ESTADOS_ABONO_REPORTE)[number], number>;
    const totalPorEstado = Object.fromEntries(
      ESTADOS_ABONO_REPORTE.map((estado) => [estado, 0]),
    ) as Record<(typeof ESTADOS_ABONO_REPORTE)[number], number>;
    for (const grupo of grupos) {
      cantidadPorEstado[grupo.estado] = aNumero(grupo._count._all);
      totalPorEstado[grupo.estado] = redondearMoneda(aNumero(grupo._sum.monto));
    }
    const cantidadAbonos = Object.values(cantidadPorEstado).reduce((total, valor) => total + valor, 0);
    if (esPdf) verificarLimitePdf(cantidadAbonos);
    const registros = abonos.map((abono) => ({
      idAbono: abono.idAbono,
      idPedido: abono.idPedido,
      cliente: abono.pedido.cliente,
      fecha: abono.estado === "CONFIRMADO"
        ? abono.fechaConfirmacion ?? abono.fechaCreacion
        : abono.fechaCreacion,
      monto: abono.monto === null ? null : redondearMoneda(aNumero(abono.monto)),
      estado: abono.estado,
      referencia: abono.referencia,
    }));
    return crearBase(
      "ABONOS",
      filtros,
      usuario,
      {
        cantidadAbonos,
        cantidadConfirmados: cantidadPorEstado.CONFIRMADO,
        cantidadPendientes: cantidadPorEstado.PENDIENTE,
        cantidadRechazados: cantidadPorEstado.RECHAZADO,
        totalConfirmado: totalPorEstado.CONFIRMADO,
        totalPendiente: totalPorEstado.PENDIENTE,
      },
      registros,
      cantidadAbonos,
      esPdf,
    );
  }
}
