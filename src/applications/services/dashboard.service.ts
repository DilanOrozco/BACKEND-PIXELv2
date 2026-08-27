import {
  DashboardRepository,
  type GranularidadTendencia,
  type TendenciaAdminRaw,
  type VentaPorMesRaw,
} from "../../infrastructure/repositories/dashboard.repository";
import { ClienteAccessService } from "./cliente-access.service";
import {
  agregarCoberturaDisenoADetalles,
  resumirCoberturaDisenos,
} from "../../utils/design-coverage.util";
import { formatearFechaCalendario } from "../../utils/date.util";
import { obtenerAccionesFinancierasPedido } from "../../utils/pedido-actions.util";

const dashboardRepository = new DashboardRepository();
const clienteAccessService = new ClienteAccessService();

const ESTADOS_PEDIDO = [
  "PENDIENTE",
  "EN_PROCESO",
  "PENDIENTE_SALDO_FINAL",
  "FINALIZADO",
  "ENTREGADO",
  "ANULADO",
] as const;
const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

const ERROR_ANIO = "El a\u00f1o debe ser un n\u00famero v\u00e1lido.";
const ERROR_LIMITE = "El l\u00edmite debe ser un n\u00famero entre 1 y 20.";
const ERROR_FECHA = "Las fechas deben usar el formato YYYY-MM-DD.";
const ERROR_RANGO = "El rango de fechas no es v\u00e1lido.";
const ERROR_GRANULARIDAD =
  "La granularidad debe ser DIA, SEMANA, MES o ANIO.";
const MAXIMO_PUNTOS_TENDENCIA = 366;
const GRANULARIDADES: GranularidadTendencia[] = [
  "DIA",
  "SEMANA",
  "MES",
  "ANIO",
];

type EstadoPedidoDashboard = (typeof ESTADOS_PEDIDO)[number];
type ConteosPorEstado = Record<EstadoPedidoDashboard, number>;

interface AuthUser {
  idUsuario: number;
  rol: string;
}

interface RangoFechas {
  fechaInicio: Date;
  fechaFin: Date;
}

export class DashboardValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DashboardValidationError";
    Object.setPrototypeOf(this, DashboardValidationError.prototype);
  }
}

interface PeriodoTendencias {
  fechaInicio: string;
  fechaFin: string;
  fechaFinExclusiva: string;
  granularidad: GranularidadTendencia;
}

interface PuntoTendencia {
  fecha: string;
  ingresos: number;
  ventas: number;
  pedidos: number;
  cotizaciones: number;
}

export class DashboardForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DashboardForbiddenError";
    Object.setPrototypeOf(this, DashboardForbiddenError.prototype);
  }
}

export class DashboardNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DashboardNotFoundError";
    Object.setPrototypeOf(this, DashboardNotFoundError.prototype);
  }
}

const aNumero = (valor: unknown) => {
  const numero = typeof valor === "bigint"
    ? Number(valor)
    : Number(valor ?? 0);

  return Number.isFinite(numero) ? numero : 0;
};

const redondearMoneda = (valor: number) => Math.round(valor * 100) / 100;

const formatearFechaUTC = (fecha: Date) => {
  const anio = fecha.getUTCFullYear();
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getUTCDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
};

const fechaUTCDesdeCalendario = (fecha: string) => {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return new Date(Date.UTC(anio!, mes! - 1, dia!));
};

const sumarDiasCalendario = (fecha: string, dias: number) => {
  const resultado = fechaUTCDesdeCalendario(fecha);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return formatearFechaUTC(resultado);
};

const obtenerFechaActualColombia = () => {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const obtener = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? "";

  return `${obtener("year")}-${obtener("month")}-${obtener("day")}`;
};

const validarFechaCalendario = (valor: unknown) => {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new DashboardValidationError(ERROR_FECHA);
  }

  const fecha = fechaUTCDesdeCalendario(valor);

  if (formatearFechaUTC(fecha) !== valor) {
    throw new DashboardValidationError(ERROR_FECHA);
  }

  return valor;
};

const validarGranularidad = (valorEntrada: unknown): GranularidadTendencia => {
  const valor = obtenerValorQuery(valorEntrada);

  if (valor === undefined || valor === null || String(valor).trim() === "") {
    return "DIA";
  }

  const granularidad = String(valor).trim().toUpperCase();

  if (!GRANULARIDADES.includes(granularidad as GranularidadTendencia)) {
    throw new DashboardValidationError(ERROR_GRANULARIDAD);
  }

  return granularidad as GranularidadTendencia;
};

const inicioPeriodo = (
  fechaEntrada: string,
  granularidad: GranularidadTendencia,
) => {
  const fecha = fechaUTCDesdeCalendario(fechaEntrada);

  if (granularidad === "SEMANA") {
    const diasDesdeLunes = (fecha.getUTCDay() + 6) % 7;
    fecha.setUTCDate(fecha.getUTCDate() - diasDesdeLunes);
  } else if (granularidad === "MES") {
    fecha.setUTCDate(1);
  } else if (granularidad === "ANIO") {
    fecha.setUTCMonth(0, 1);
  }

  return formatearFechaUTC(fecha);
};

const siguientePeriodo = (
  fechaEntrada: string,
  granularidad: GranularidadTendencia,
) => {
  const fecha = fechaUTCDesdeCalendario(fechaEntrada);

  if (granularidad === "DIA") {
    fecha.setUTCDate(fecha.getUTCDate() + 1);
  } else if (granularidad === "SEMANA") {
    fecha.setUTCDate(fecha.getUTCDate() + 7);
  } else if (granularidad === "MES") {
    fecha.setUTCMonth(fecha.getUTCMonth() + 1, 1);
  } else {
    fecha.setUTCFullYear(fecha.getUTCFullYear() + 1, 0, 1);
  }

  return formatearFechaUTC(fecha);
};

const validarCantidadPeriodos = (
  fechaInicio: string,
  fechaFin: string,
  granularidad: GranularidadTendencia,
) => {
  const ultimoPeriodo = inicioPeriodo(fechaFin, granularidad);
  let fecha = inicioPeriodo(fechaInicio, granularidad);
  let cantidad = 0;

  while (fecha <= ultimoPeriodo) {
    cantidad += 1;

    if (cantidad > MAXIMO_PUNTOS_TENDENCIA) {
      throw new DashboardValidationError(
        `El rango no puede superar ${MAXIMO_PUNTOS_TENDENCIA} periodos.`,
      );
    }

    fecha = siguientePeriodo(fecha, granularidad);
  }
};

const prepararPeriodoTendencias = (
  query: Record<string, unknown>,
): PeriodoTendencias => {
  const inicioEntrada = obtenerValorQuery(query.fechaInicio);
  const finEntrada = obtenerValorQuery(query.fechaFin);
  const granularidad = validarGranularidad(query.granularidad);
  let fechaInicio: string;
  let fechaFin: string;

  if (inicioEntrada === undefined && finEntrada === undefined) {
    fechaFin = obtenerFechaActualColombia();
    fechaInicio = sumarDiasCalendario(fechaFin, -29);
  } else {
    if (inicioEntrada === undefined || finEntrada === undefined) {
      throw new DashboardValidationError(
        "Debes enviar fechaInicio y fechaFin juntas.",
      );
    }

    fechaInicio = validarFechaCalendario(inicioEntrada);
    fechaFin = validarFechaCalendario(finEntrada);
  }

  if (fechaInicio > fechaFin) {
    throw new DashboardValidationError(ERROR_RANGO);
  }

  validarCantidadPeriodos(fechaInicio, fechaFin, granularidad);

  return {
    fechaInicio,
    fechaFin,
    fechaFinExclusiva: sumarDiasCalendario(fechaFin, 1),
    granularidad,
  };
};

const normalizarPuntoTendencia = (punto: TendenciaAdminRaw): PuntoTendencia => ({
  fecha: String(punto.fecha),
  ingresos: redondearMoneda(aNumero(punto.ingresos)),
  ventas: aNumero(punto.ventas),
  pedidos: aNumero(punto.pedidos),
  cotizaciones: aNumero(punto.cotizaciones),
});

const completarSerieTendencias = (
  periodo: PeriodoTendencias,
  resultados: TendenciaAdminRaw[],
) => {
  const resultadosPorFecha = new Map(
    resultados.map((resultado) => {
      const normalizado = normalizarPuntoTendencia(resultado);
      return [normalizado.fecha, normalizado] as const;
    }),
  );
  const serie: PuntoTendencia[] = [];
  const ultimoPeriodo = inicioPeriodo(periodo.fechaFin, periodo.granularidad);
  let fecha = inicioPeriodo(periodo.fechaInicio, periodo.granularidad);

  while (fecha <= ultimoPeriodo) {
    if (serie.length >= MAXIMO_PUNTOS_TENDENCIA) {
      throw new DashboardValidationError(
        `El rango no puede superar ${MAXIMO_PUNTOS_TENDENCIA} periodos.`,
      );
    }

    serie.push(
      resultadosPorFecha.get(fecha) ?? {
        fecha,
        ingresos: 0,
        ventas: 0,
        pedidos: 0,
        cotizaciones: 0,
      },
    );
    fecha = siguientePeriodo(fecha, periodo.granularidad);
  }

  return serie;
};

const obtenerValorQuery = (valor: unknown) => {
  if (Array.isArray(valor)) {
    return valor[0];
  }

  return valor;
};

const validarEnteroOpcional = (
  valorEntrada: unknown,
  opciones: {
    defecto: number;
    minimo: number;
    maximo: number;
    mensaje: string;
  },
) => {
  const valor = obtenerValorQuery(valorEntrada);

  if (valor === undefined || valor === null) {
    return opciones.defecto;
  }

  if (typeof valor !== "string" && typeof valor !== "number") {
    throw new DashboardValidationError(opciones.mensaje);
  }

  const texto = String(valor).trim();

  if (texto === "" || !/^\d+$/.test(texto)) {
    throw new DashboardValidationError(opciones.mensaje);
  }

  const numero = Number(texto);

  if (
    !Number.isInteger(numero) ||
    numero < opciones.minimo ||
    numero > opciones.maximo
  ) {
    throw new DashboardValidationError(opciones.mensaje);
  }

  return numero;
};

const validarAnio = (query: Record<string, unknown>) =>
  validarEnteroOpcional(query.anio, {
    defecto: new Date().getFullYear(),
    minimo: 2000,
    maximo: 2100,
    mensaje: ERROR_ANIO,
  });

const validarLimite = (valor: unknown) =>
  validarEnteroOpcional(valor, {
    defecto: 5,
    minimo: 1,
    maximo: 20,
    mensaje: ERROR_LIMITE,
  });

const crearRangoDia = (fecha: Date): RangoFechas => {
  const fechaInicio = new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate(),
  );
  const fechaFin = new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate() + 1,
  );

  return { fechaInicio, fechaFin };
};

const crearRangoMes = (fecha: Date): RangoFechas => {
  const fechaInicio = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
  const fechaFin = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 1);

  return { fechaInicio, fechaFin };
};

const crearRangoAnio = (anio: number): RangoFechas => ({
  fechaInicio: new Date(anio, 0, 1),
  fechaFin: new Date(anio + 1, 0, 1),
});

const crearConteosVacios = (): ConteosPorEstado => ({
  PENDIENTE: 0,
  EN_PROCESO: 0,
  PENDIENTE_SALDO_FINAL: 0,
  FINALIZADO: 0,
  ENTREGADO: 0,
  ANULADO: 0,
});

const esEstadoPedido = (estado: unknown): estado is EstadoPedidoDashboard =>
  typeof estado === "string" &&
  (ESTADOS_PEDIDO as readonly string[]).includes(estado);

const normalizarConteosPorEstado = (resultados: any[]): ConteosPorEstado => {
  const conteos = crearConteosVacios();

  for (const resultado of resultados) {
    const estado = resultado?.estadoPedido;

    if (esEstadoPedido(estado)) {
      conteos[estado] = aNumero(resultado?._count?._all);
    }
  }

  return conteos;
};

const completarVentasPorMes = (ventas: VentaPorMesRaw[]) => {
  const ventasPorMes = MESES.map((mes, index) => ({
    mes,
    numeroMes: index + 1,
    total: 0,
    cantidadPedidos: 0,
  }));

  for (const venta of ventas) {
    const numeroMes = Number(venta.numeroMes);
    const indice = numeroMes - 1;
    const ventaActual = ventasPorMes[indice];

    if (!ventaActual) {
      continue;
    }

    ventasPorMes[indice] = {
      ...ventaActual,
      total: redondearMoneda(aNumero(venta.total)),
      cantidadPedidos: aNumero(venta.cantidadPedidos),
    };
  }

  return ventasPorMes;
};

const obtenerIdUsuario = (user: AuthUser | undefined) => {
  const idCliente = Number(user?.idUsuario);

  if (!Number.isInteger(idCliente) || idCliente <= 0) {
    throw new DashboardValidationError("Usuario no autenticado.");
  }

  return idCliente;
};

const prepararPedidoCliente = (pedido: any) => {
  const detalles = agregarCoberturaDisenoADetalles(
    Array.isArray(pedido?.detalles) ? pedido.detalles : [],
    Array.isArray(pedido?.disenos) ? pedido.disenos : [],
  );

  const resumenDisenos = resumirCoberturaDisenos(detalles);

  return {
    ...pedido,
    detalles,
    ...resumenDisenos,
    ...obtenerAccionesFinancierasPedido(
      pedido,
      resumenDisenos.totalDisenosPendientes,
    ),
    totalPagadoConfirmado: aNumero(pedido?.totalPagado),
    fechaEntregaEstimada: formatearFechaCalendario(
      pedido?.fechaEntregaEstimada,
    ),
  };
};

export class DashboardService {
  async obtenerTendenciasAdmin(query: Record<string, unknown> = {}) {
    const periodo = prepararPeriodoTendencias(query);
    const resultados = await dashboardRepository.obtenerTendenciasPorRango(
      periodo.fechaInicio,
      periodo.fechaFinExclusiva,
      periodo.granularidad,
    );
    const series = completarSerieTendencias(periodo, resultados);
    const resumen = series.reduce(
      (acumulado, punto) => ({
        ingresos: redondearMoneda(acumulado.ingresos + punto.ingresos),
        ventas: acumulado.ventas + punto.ventas,
        pedidos: acumulado.pedidos + punto.pedidos,
        cotizaciones: acumulado.cotizaciones + punto.cotizaciones,
      }),
      { ingresos: 0, ventas: 0, pedidos: 0, cotizaciones: 0 },
    );

    return {
      periodo: {
        fechaInicio: periodo.fechaInicio,
        fechaFin: periodo.fechaFin,
        granularidad: periodo.granularidad,
        zonaHoraria: "America/Bogota",
      },
      resumen,
      series,
    };
  }

  async obtenerDashboardAdmin(query: Record<string, unknown> = {}) {
    const anio = validarAnio(query);
    const limite = validarLimite(query.ultimos);
    const ahora = new Date();
    const rangoDia = crearRangoDia(ahora);
    const rangoMes = crearRangoMes(ahora);
    const rangoAnio = crearRangoAnio(anio);

    const [
      totalPedidos,
      conteosPedidos,
      totalClientes,
      totalCotizacionesPendientes,
      ingresosDia,
      ingresosMes,
      ingresosAnio,
      ventas,
      ultimosPedidos,
      cotizacionesPendientes,
    ] = await Promise.all([
      dashboardRepository.contarPedidos(),
      dashboardRepository.contarPedidosPorEstado(),
      dashboardRepository.contarClientesActivos(),
      dashboardRepository.contarCotizacionesPendientes(),
      dashboardRepository.sumarIngresosPorRango(
        rangoDia.fechaInicio,
        rangoDia.fechaFin,
      ),
      dashboardRepository.sumarIngresosPorRango(
        rangoMes.fechaInicio,
        rangoMes.fechaFin,
      ),
      dashboardRepository.sumarIngresosPorRango(
        rangoAnio.fechaInicio,
        rangoAnio.fechaFin,
      ),
      dashboardRepository.ventasPorMes(anio),
      dashboardRepository.obtenerUltimosPedidos(limite),
      dashboardRepository.obtenerCotizacionesPendientes(limite),
    ]);

    const distribucionPedidos =
      normalizarConteosPorEstado(conteosPedidos as any[]);
    const ingresosDiaNormalizado = redondearMoneda(ingresosDia);
    const ingresosMesNormalizado = redondearMoneda(ingresosMes);
    const ingresosAnioNormalizado = redondearMoneda(ingresosAnio);

    return {
      kpis: {
        totalPedidos,
        pedidosPendientes: distribucionPedidos.PENDIENTE,
        pedidosEnProceso: distribucionPedidos.EN_PROCESO,
        pedidosFinalizados:
          distribucionPedidos.FINALIZADO + distribucionPedidos.ENTREGADO,
        totalClientes,
        cotizacionesPendientes: totalCotizacionesPendientes,
        ingresosDia: ingresosDiaNormalizado,
        ingresosMes: ingresosMesNormalizado,
        ingresosAnio: ingresosAnioNormalizado,
      },
      ingresos: {
        diario: ingresosDiaNormalizado,
        mensual: ingresosMesNormalizado,
        anual: ingresosAnioNormalizado,
      },
      ventasPorMes: completarVentasPorMes(ventas),
      distribucionPedidos,
      ultimosPedidos,
      cotizacionesPendientes,
    };
  }

  async obtenerDashboardCliente(
    user: AuthUser | undefined,
    query: Record<string, unknown> = {},
  ) {
    if (user?.rol !== "Cliente") {
      throw new DashboardForbiddenError(
        "Este dashboard solo esta disponible para clientes.",
      );
    }

    const idUsuario = obtenerIdUsuario(user);
    let cliente: any;

    try {
      cliente = await clienteAccessService.obtenerClienteDeUsuario(idUsuario);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "El usuario no tiene un cliente vinculado.";
      throw new DashboardNotFoundError(message);
    }

    const idCliente = cliente.idCliente;
    const limite = validarLimite(query.limite);

    const [
      totalPedidos,
      conteosPedidos,
      totalCotizacionesPendientes,
      totalGastado,
      saldoPendiente,
      pedidosActivos,
      historialPedidos,
      cotizacionesPendientes,
    ] = await Promise.all([
      dashboardRepository.contarPedidosCliente(idCliente),
      dashboardRepository.contarPedidosClientePorEstado(idCliente),
      dashboardRepository.contarCotizacionesPendientesCliente(idCliente),
      dashboardRepository.sumarTotalGastadoCliente(idCliente),
      dashboardRepository.sumarSaldoPendienteCliente(idCliente),
      dashboardRepository.obtenerPedidosActivosCliente(idCliente),
      dashboardRepository.obtenerHistorialPedidosCliente(idCliente, limite),
      dashboardRepository.obtenerCotizacionesPendientesCliente(
        idCliente,
        limite,
      ),
    ]);

    const conteos = normalizarConteosPorEstado(conteosPedidos as any[]);
    const pedidosActivosFormateados = pedidosActivos.map(prepararPedidoCliente);
    const historialFormateado = historialPedidos.map(prepararPedidoCliente);

    return {
      kpis: {
        totalPedidos,
        pedidosPendientes: conteos.PENDIENTE,
        pedidosEnProceso: conteos.EN_PROCESO,
        pedidosFinalizados: conteos.FINALIZADO + conteos.ENTREGADO,
        cotizacionesPendientes: totalCotizacionesPendientes,
        totalGastado: redondearMoneda(totalGastado),
        saldoPendiente: redondearMoneda(saldoPendiente),
      },
      cliente: {
        idCliente: cliente.idCliente,
        nombre: cliente.nombre,
        correo: cliente.correo,
        telefono: cliente.telefono,
      },
      pedidoActivo: pedidosActivosFormateados[0] ?? null,
      pedidosActivos: pedidosActivosFormateados,
      historialPedidos: historialFormateado,
      cotizacionesPendientes,
    };
  }
}
