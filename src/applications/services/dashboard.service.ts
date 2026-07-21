import {
  DashboardRepository,
  type VentaPorMesRaw,
} from "../../infrastructure/repositories/dashboard.repository";
import { ClienteAccessService } from "./cliente-access.service";

const dashboardRepository = new DashboardRepository();
const clienteAccessService = new ClienteAccessService();

const ESTADOS_PEDIDO = [
  "PENDIENTE",
  "EN_PROCESO",
  "PENDIENTE_SALDO_FINAL",
  "FINALIZADO",
  "ENTREGADO",
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

export class DashboardService {
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
      pedidoActivo: pedidosActivos[0] ?? null,
      pedidosActivos,
      historialPedidos,
      cotizacionesPendientes,
    };
  }
}
