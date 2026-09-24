import { esFechaCalendarioValida } from "../../utils/date.util";

export const ESTADOS_PAGO_REPORTE = ["PENDIENTE", "PARCIAL", "COMPLETO"] as const;
export const ESTADOS_PEDIDO_REPORTE = [
  "PENDIENTE",
  "EN_PROCESO",
  "PENDIENTE_SALDO_FINAL",
  "FINALIZADO",
  "ENTREGADO",
  "ANULADO",
] as const;
export const ESTADOS_COTIZACION_REPORTE = [
  "PENDIENTE",
  "APROBADA",
  "ANULADA",
  "BORRADOR",
  "SOLICITUD_RECIBIDA",
  "EN_REVISION",
  "PENDIENTE_APROBACION_CLIENTE",
  "AJUSTE_SOLICITADO",
  "ACEPTADA",
  "RECHAZADA_CLIENTE",
  "VENCIDA",
  "CONVERTIDA_EN_PEDIDO",
] as const;
export const ESTADOS_ABONO_REPORTE = ["PENDIENTE", "CONFIRMADO", "RECHAZADO"] as const;

export type TipoReporte = "VENTAS" | "PEDIDOS" | "COTIZACIONES" | "ABONOS";
export type EstadoPagoReporte = (typeof ESTADOS_PAGO_REPORTE)[number];
export type EstadoPedidoReporte = (typeof ESTADOS_PEDIDO_REPORTE)[number];
export type EstadoCotizacionReporte = (typeof ESTADOS_COTIZACION_REPORTE)[number];
export type EstadoAbonoReporte = (typeof ESTADOS_ABONO_REPORTE)[number];

export interface FiltrosReporte {
  fechaInicio?: string;
  fechaFin?: string;
  fechaInicioUtc?: Date;
  fechaFinExclusivaUtc?: Date;
  idCliente?: number;
  idPedido?: number;
  estadoPago?: EstadoPagoReporte;
  estadoPedido?: EstadoPedidoReporte;
  estadoCotizacion?: EstadoCotizacionReporte;
  estadoAbono?: EstadoAbonoReporte;
  page: number;
  limit: number;
  skip: number;
}

export class ReporteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReporteValidationError";
    Object.setPrototypeOf(this, ReporteValidationError.prototype);
  }
}

const LIMITE_JSON_MAXIMO = 100;
const LIMITE_JSON_POR_DEFECTO = 20;

const valorQuery = (entrada: unknown) => Array.isArray(entrada) ? entrada[0] : entrada;

const textoOpcional = (entrada: unknown) => {
  const valor = valorQuery(entrada);
  return valor === undefined || valor === null || valor === ""
    ? undefined
    : String(valor).trim();
};

const enteroPositivoOpcional = (entrada: unknown, nombre: string) => {
  const texto = textoOpcional(entrada);
  if (texto === undefined) return undefined;
  const numero = Number(texto);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new ReporteValidationError(`${nombre} debe ser un entero positivo.`);
  }
  return numero;
};

const validarEstado = <T extends string>(
  entrada: unknown,
  permitidos: readonly T[],
  nombre: string,
) => {
  const texto = textoOpcional(entrada);
  if (texto === undefined) return undefined;
  const normalizado = texto.toUpperCase();
  if (!permitidos.includes(normalizado as T)) {
    throw new ReporteValidationError(`${nombre} no es valido.`);
  }
  return normalizado as T;
};

const limitesColombia = (fechaInicio: string, fechaFin: string) => {
  const [inicioAnio, inicioMes, inicioDia] = fechaInicio.split("-").map(Number);
  const [finAnio, finMes, finDia] = fechaFin.split("-").map(Number);
  return {
    fechaInicioUtc: new Date(Date.UTC(inicioAnio!, inicioMes! - 1, inicioDia!, 5)),
    fechaFinExclusivaUtc: new Date(Date.UTC(finAnio!, finMes! - 1, finDia! + 1, 5)),
  };
};

const prepararPeriodo = (query: Record<string, unknown>) => {
  const fechaInicio = textoOpcional(query.fechaInicio);
  const fechaFin = textoOpcional(query.fechaFin);
  if ((fechaInicio === undefined) !== (fechaFin === undefined)) {
    throw new ReporteValidationError("Debes enviar fechaInicio y fechaFin juntas.");
  }
  if (fechaInicio === undefined || fechaFin === undefined) return {};
  if (!esFechaCalendarioValida(fechaInicio) || !esFechaCalendarioValida(fechaFin)) {
    throw new ReporteValidationError("Las fechas deben usar el formato YYYY-MM-DD y ser validas.");
  }
  if (fechaInicio > fechaFin) {
    throw new ReporteValidationError("La fecha de inicio no puede ser mayor a la fecha de fin.");
  }
  return { fechaInicio, fechaFin, ...limitesColombia(fechaInicio, fechaFin) };
};

const prepararPaginacion = (query: Record<string, unknown>, esPdf: boolean) => {
  if (esPdf && (query.page !== undefined || query.limit !== undefined)) {
    throw new ReporteValidationError("page y limit solo estan disponibles en el reporte JSON.");
  }
  const page = enteroPositivoOpcional(query.page, "page") ?? 1;
  const limitEntrada = enteroPositivoOpcional(query.limit, "limit") ?? LIMITE_JSON_POR_DEFECTO;
  if (limitEntrada > LIMITE_JSON_MAXIMO) {
    throw new ReporteValidationError(`limit no puede superar ${LIMITE_JSON_MAXIMO}.`);
  }
  return { page, limit: limitEntrada, skip: (page - 1) * limitEntrada };
};

const CAMPOS_COMUNES = ["fechaInicio", "fechaFin", "idCliente"];
const CAMPOS_POR_TIPO: Record<TipoReporte, string[]> = {
  VENTAS: [...CAMPOS_COMUNES, "estadoPago"],
  PEDIDOS: [...CAMPOS_COMUNES, "estado"],
  COTIZACIONES: [...CAMPOS_COMUNES, "estado"],
  ABONOS: [...CAMPOS_COMUNES, "idPedido", "estado"],
};

export const prepararFiltrosReporte = (
  tipo: TipoReporte,
  query: Record<string, unknown> = {},
  esPdf = false,
): FiltrosReporte => {
  const permitidos = new Set([
    ...CAMPOS_POR_TIPO[tipo],
    ...(esPdf ? [] : ["page", "limit"]),
  ]);
  const noPermitido = Object.keys(query).find((campo) => !permitidos.has(campo));
  if (noPermitido) {
    throw new ReporteValidationError(`El filtro ${noPermitido} no esta permitido en este reporte.`);
  }

  const periodo = prepararPeriodo(query);
  const paginacion = prepararPaginacion(query, esPdf);
  const idCliente = enteroPositivoOpcional(query.idCliente, "idCliente");
  const base: FiltrosReporte = { ...periodo, ...paginacion };
  if (idCliente !== undefined) base.idCliente = idCliente;

  if (tipo === "VENTAS") {
    const estadoPago = validarEstado(query.estadoPago, ESTADOS_PAGO_REPORTE, "estadoPago");
    if (estadoPago) base.estadoPago = estadoPago;
  } else if (tipo === "PEDIDOS") {
    const estadoPedido = validarEstado(query.estado, ESTADOS_PEDIDO_REPORTE, "estado");
    if (estadoPedido) base.estadoPedido = estadoPedido;
  } else if (tipo === "COTIZACIONES") {
    const estadoCotizacion = validarEstado(query.estado, ESTADOS_COTIZACION_REPORTE, "estado");
    if (estadoCotizacion) base.estadoCotizacion = estadoCotizacion;
  } else {
    const estadoAbono = validarEstado(query.estado, ESTADOS_ABONO_REPORTE, "estado");
    const idPedido = enteroPositivoOpcional(query.idPedido, "idPedido");
    if (estadoAbono) base.estadoAbono = estadoAbono;
    if (idPedido !== undefined) base.idPedido = idPedido;
  }

  return base;
};
