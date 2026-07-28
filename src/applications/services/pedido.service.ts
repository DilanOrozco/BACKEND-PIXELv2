import { runPrismaTransaction } from "../../config/prisma";
import type { Prisma } from "../../../generated/prisma/client";
import { PedidoRepository } from "../../infrastructure/repositories/pedido.repository";
import { AbonoRepository } from "../../infrastructure/repositories/abono.repository";
import { AbonoService } from "./abono.service";
import { NotificationService } from "./notification.service";
import type { MetodoPagoPermitido } from "../validators/abono.validator";
import {
  validarActualizarPedido,
  validarCrearPedido,
  validarFinalizarPedido,
  validarConfirmarEntregaPedido,
  validarAnularPedido,
  validarMarcarPendienteSaldoFinal,
  validarPasarPedidoEnProceso,
  validarRequiereDisenoDetalle,
} from "../validators/pedido.validator";
import {
  paginatedResponse,
  parsePaginationQuery,
  type PaginationQuery,
} from "../../utils/pagination.util";
import {
  agregarCoberturaDisenoADetalles,
  resumirCoberturaDisenos,
} from "../../utils/design-coverage.util";
import {
  formatearFechaCalendario,
  prepararFechaCalendario,
} from "../../utils/date.util";
import { describirOrigenAnalisis } from "../../utils/receipt-analysis.util";

export { agregarCoberturaDisenoADetalles } from "../../utils/design-coverage.util";

const pedidoRepository = new PedidoRepository();
const abonoRepository = new AbonoRepository();
const abonoService = new AbonoService();
const notificationService = new NotificationService();

const ESTADO_COTIZACION_APROBADA = "APROBADA";

const ESTADO_PEDIDO_PENDIENTE = "PENDIENTE";
const ESTADO_PEDIDO_EN_PROCESO = "EN_PROCESO";
const ESTADO_PEDIDO_PENDIENTE_SALDO_FINAL = "PENDIENTE_SALDO_FINAL";
const ESTADO_PEDIDO_FINALIZADO = "FINALIZADO";
const ESTADO_PEDIDO_ENTREGADO = "ENTREGADO";
const ESTADO_PEDIDO_ANULADO = "ANULADO";

const ESTADO_PAGO_PENDIENTE = "PENDIENTE";
const ESTADO_PAGO_COMPLETO = "COMPLETO";

const esCliente = (usuarioAuth: any) => usuarioAuth?.rol === "Cliente";
const idClienteAutenticado = (usuarioAuth: any) => {
  const idCliente = Number(usuarioAuth?.idCliente);

  if (!Number.isInteger(idCliente) || idCliente <= 0) {
    throw new Error("El usuario cliente no tiene un cliente vinculado.");
  }

  return idCliente;
};
const puedeGestionarPedido = (usuarioAuth: any) =>
  ["Admin", "Secretaria"].includes(usuarioAuth?.rol);

const validarId = (idPedido: number) => {
  if (!Number.isInteger(idPedido) || idPedido <= 0) {
    throw new Error("El ID del pedido no es valido.");
  }
};

const aNumero = (valor: any) => Number(valor ?? 0);

const redondearMoneda = (valor: number) => Math.round(valor * 100) / 100;

const limpiarTextoOpcional = (valor: any) => {
  if (typeof valor !== "string") {
    return null;
  }

  const texto = valor.trim();
  return texto === "" ? null : texto;
};

const prepararFechaOpcional = (valor: any) => {
  if (valor === undefined || valor === null || valor === "") {
    return null;
  }

  return new Date(valor);
};

const formatearFechaLegible = (valor: any) => {
  if (!valor) {
    return null;
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(fecha);
};

const agregarObservacionAuditoria = (
  observacionesActuales: string | null | undefined,
  observacionNueva: any,
  usuarioAuth: any,
  accion: string,
) => {
  const texto = limpiarTextoOpcional(observacionNueva);

  if (!texto) {
    return observacionesActuales ?? null;
  }

  const actor = `${usuarioAuth?.rol ?? "Usuario"} #${usuarioAuth?.idUsuario ?? "N/A"}`;
  const entrada = `[${new Date().toISOString()}] ${accion} (${actor}): ${texto}`;

  return observacionesActuales ? `${observacionesActuales}\n${entrada}` : entrada;
};

const prepararDetallePedido = (detalle: any) => {
  if (detalle.precioUnitario === null || detalle.precioUnitario === undefined) {
    throw new Error("La cotizacion aprobada tiene detalles sin precio unitario.");
  }

  if (detalle.subtotal === null || detalle.subtotal === undefined) {
    throw new Error("La cotizacion aprobada tiene detalles sin subtotal.");
  }

  return {
    idProducto: detalle.idProducto ? Number(detalle.idProducto) : null,
    idTecnica: detalle.idTecnica ? Number(detalle.idTecnica) : null,
    descripcion: detalle.descripcion,
    cantidad: Number(detalle.cantidad),
    precioUnitario: aNumero(detalle.precioUnitario),
    subtotal: aNumero(detalle.subtotalConDescuento ?? detalle.subtotal),
    costoDiseno: aNumero(detalle.costoDiseno),
    requiereDiseno: detalle.requiereDiseno !== false,
    origenDiseno: String(detalle.origenDiseno ?? "PIXEL").toUpperCase(),
    archivoDisenoInicialUrl: limpiarTextoOpcional(
      detalle.archivoDisenoInicialUrl,
    ),
    esDisenoGeneral: detalle.esDisenoGeneral === true,
    medioRecepcionDiseno: limpiarTextoOpcional(
      detalle.medioRecepcionDiseno,
    ),
    observaciones: limpiarTextoOpcional(detalle.observaciones),
  };
};

const valorDefinido = (...valores: any[]) =>
  valores.find((valor) => valor !== undefined && valor !== null);

const normalizarTexto = (valor: any) =>
  typeof valor === "string" ? valor.trim().toLowerCase() : "";

const buscarSnapshotDetalle = (
  detalle: any,
  snapshots: any[],
  usados: Set<number>,
  indiceDetalle: number,
) => {
  const disponibles = snapshots
    .map((snapshot, indice) => ({ snapshot, indice }))
    .filter(({ indice }) => !usados.has(indice));
  const idProducto = Number(detalle?.idProducto);
  const idTecnica = Number(detalle?.idTecnica);
  const mismoProducto = ({ snapshot }: any) =>
    Number.isInteger(idProducto) &&
    idProducto > 0 &&
    Number(snapshot?.idProducto) === idProducto;
  const mismaTecnica = ({ snapshot }: any) =>
    Number.isInteger(idTecnica) &&
    idTecnica > 0 &&
    Number(snapshot?.idTecnica) === idTecnica;
  const mismaCantidad = ({ snapshot }: any) =>
    Number(snapshot?.cantidad) === Number(detalle?.cantidad);
  const descripcion = normalizarTexto(detalle?.descripcion);
  const mismaDescripcion = ({ snapshot }: any) =>
    descripcion !== "" &&
    normalizarTexto(snapshot?.descripcion) === descripcion;

  const coincidencia =
    disponibles.find(
      (candidato) =>
        mismoProducto(candidato) &&
        mismaTecnica(candidato) &&
        mismaCantidad(candidato) &&
        mismaDescripcion(candidato),
    ) ??
    disponibles.find(
      (candidato) =>
        mismoProducto(candidato) &&
        mismaTecnica(candidato) &&
        mismaCantidad(candidato),
    ) ??
    disponibles.find(
      (candidato) => mismoProducto(candidato) && mismaCantidad(candidato),
    ) ??
    disponibles.find(
      (candidato) => mismaDescripcion(candidato) && mismaCantidad(candidato),
    ) ??
    disponibles.find(({ indice }) => indice === indiceDetalle);

  if (coincidencia) {
    usados.add(coincidencia.indice);
  }

  return coincidencia?.snapshot ?? null;
};

const formatearDetallePedido = (detalle: any, snapshot: any) => {
  const producto = detalle?.producto ?? snapshot?.producto ?? null;
  const subtotalConDescuento = valorDefinido(
    snapshot?.subtotalConDescuento,
    detalle?.subtotal,
  );
  const subtotalBruto = valorDefinido(
    snapshot?.subtotalBruto,
    snapshot?.subtotal,
    detalle?.subtotal,
  );

  return {
    ...detalle,
    producto,
    idCategoriaProducto:
      detalle?.idCategoriaProducto ??
      producto?.idCategoriaProducto ??
      producto?.categoriaProducto?.idCategoriaProducto ??
      snapshot?.idCategoriaProducto ??
      null,
    categoriaProducto:
      detalle?.categoriaProducto ??
      producto?.categoriaProducto ??
      snapshot?.categoriaProducto ??
      null,
    tecnica: detalle?.tecnica ?? snapshot?.tecnica ?? null,
    precioBase: valorDefinido(snapshot?.precioBase, detalle?.precioBase) ?? null,
    descuentoPorcentaje:
      valorDefinido(
        snapshot?.descuentoPorcentaje,
        detalle?.descuentoPorcentaje,
      ) ?? null,
    descuentoValorUnitario:
      valorDefinido(
        snapshot?.descuentoValorUnitario,
        detalle?.descuentoValorUnitario,
      ) ?? null,
    precioUnitario: valorDefinido(
      snapshot?.precioUnitario,
      detalle?.precioUnitario,
    ),
    costoDiseno: valorDefinido(snapshot?.costoDiseno, detalle?.costoDiseno) ?? 0,
    subtotalBruto,
    descuentoTotal:
      valorDefinido(snapshot?.descuentoTotal, detalle?.descuentoTotal) ?? null,
    subtotalConDescuento,
    subtotalFinal: subtotalConDescuento,
  };
};

const pedidoPagadoCompleto = (pedido: any) =>
  redondearMoneda(aNumero(pedido?.saldoPendiente)) <= 0 &&
  redondearMoneda(aNumero(pedido?.totalPagado)) >=
    redondearMoneda(aNumero(pedido?.total)) &&
  pedido?.estadoPago === ESTADO_PAGO_COMPLETO;

const notificarSaldoFinalPendiente = async (pedido: any) => {
  try {
    await notificationService.pedidoPendienteSaldoFinal(pedido);
  } catch (error) {
    console.error("Error enviando correo de saldo final pendiente:", error);
  }
};

const notificarPedidoFinalizado = async (pedido: any) => {
  try {
    await notificationService.pedidoFinalizado(pedido);
  } catch (error) {
    console.error("Error enviando correo de pedido finalizado:", error);
  }
};

const notificarPedidoEntregado = async (pedido: any) => {
  try {
    await notificationService.pedidoEntregado(pedido);
  } catch (error) {
    console.error("Error enviando correo de pedido entregado:", error);
  }
};

const notificarPedidoAnulado = async (pedido: any, motivo?: string | null) => {
  try {
    await notificationService.pedidoAnulado(pedido, motivo);
  } catch (error) {
    console.error("Error enviando correo de pedido anulado:", error);
  }
};

export class PedidoService {
  constructor(
    private readonly ejecutarTransaccion = runPrismaTransaction,
  ) {}

  formatearPedido(pedido: any) {
    if (!pedido) {
      return pedido;
    }

    const snapshots = Array.isArray(pedido?.cotizacion?.detalles)
      ? pedido.cotizacion.detalles
      : [];
    const usados = new Set<number>();
    const detallesBase = Array.isArray(pedido.detalles)
      ? pedido.detalles.map((detalle: any, indice: number) =>
          formatearDetallePedido(
            detalle,
            buscarSnapshotDetalle(detalle, snapshots, usados, indice),
          ),
        )
      : [];
    const detalles = agregarCoberturaDisenoADetalles(
      detallesBase,
      Array.isArray(pedido.disenos) ? pedido.disenos : [],
    );
    const resumenDisenos = resumirCoberturaDisenos(detalles);
    const subtotalBruto =
      valorDefinido(pedido?.subtotalBruto, pedido?.cotizacion?.subtotal) ?? null;
    const descuentoTotal =
      valorDefinido(
        pedido?.descuentoTotal,
        pedido?.cotizacion?.descuentoTotal,
      ) ?? null;
    const subtotalConDescuento =
      subtotalBruto !== null && descuentoTotal !== null
        ? redondearMoneda(aNumero(subtotalBruto) - aNumero(descuentoTotal))
        : null;
    const costoDiseno = detalles.reduce(
      (total: number, detalle: any) => total + aNumero(detalle?.costoDiseno),
      0,
    );
    const abonos = Array.isArray(pedido.abonos)
      ? pedido.abonos.map((abono: any) => {
          const {
            comprobantePath: _comprobantePath,
            nombreSeguroComprobante: _nombreSeguroComprobante,
            textoOcr: _textoOcr,
            ...respuesta
          } = abono;
          const origen = describirOrigenAnalisis(abono.origenRegistro);

          return {
            ...respuesta,
            origenRegistroCodigo: origen.codigo,
            origenRegistroLabel: origen.etiqueta,
            comprobanteDisponible: Boolean(
              abono.comprobantePath ??
                abono.nombreOriginalComprobante ??
                abono.comprobanteUrl,
            ),
          };
        })
      : pedido.abonos;

    return {
      ...pedido,
      detalles,
      abonos,
      subtotalBruto,
      descuentoTotal,
      subtotalConDescuento,
      subtotalFinal: subtotalConDescuento,
      costosAdicionales:
        valorDefinido(
          pedido?.costosAdicionales,
          pedido?.cotizacion?.costosAdicionales,
        ) ?? 0,
      costoDiseno,
      ...resumenDisenos,
      fechaCreacion: formatearFechaLegible(pedido.fechaCreacion),
      fechaEntregaEstimada: formatearFechaCalendario(
        pedido.fechaEntregaEstimada,
      ),
      fechaFinalizado: formatearFechaLegible(pedido.fechaFinalizado),
      fechaEntregado: formatearFechaLegible(pedido.fechaEntregado),
    };
  }

  formatearPedidos(pedidos: any[]) {
    return pedidos.map((pedido) => this.formatearPedido(pedido));
  }

  private async buscarPorIdInterno(idPedido: number, usuarioAuth: any) {
    validarId(idPedido);

    const pedido = await pedidoRepository.buscarPorId(idPedido);

    if (!pedido) {
      throw new Error("No se encontraron resultados.");
    }

    if (esCliente(usuarioAuth) && pedido.idCliente !== idClienteAutenticado(usuarioAuth)) {
      throw new Error("No tienes permisos para ver este pedido.");
    }

    return pedido;
  }

  prepararPedidoDesdeCotizacion(
    cotizacion: any,
    data: any = {},
    usuarioAuth: any,
    accion = "Creacion de pedido",
  ) {
    const idCotizacion = Number(cotizacion.idCotizacion);

    if (!cotizacion.detalles || cotizacion.detalles.length === 0) {
      throw new Error("La cotizacion aprobada no tiene detalles para copiar al pedido.");
    }

    const total = aNumero(cotizacion.total);

    if (!Number.isFinite(total) || total <= 0) {
      throw new Error("La cotizacion aprobada debe tener un total mayor a 0.");
    }

    const detalles = cotizacion.detalles.map(prepararDetallePedido);
    const observacionesIniciales = limpiarTextoOpcional(data?.observaciones)
      ?? `Pedido creado desde cotizacion #${idCotizacion}.`;

    return {
      idCotizacion,
      idCliente: Number(cotizacion.idCliente),
      estadoPedido: ESTADO_PEDIDO_PENDIENTE,
      estadoPago: ESTADO_PAGO_PENDIENTE,
      total,
      totalPagado: 0,
      saldoPendiente: total,
      fechaEntregaEstimada: prepararFechaCalendario(
        data?.fechaEntregaEstimada,
      ),
      observaciones: agregarObservacionAuditoria(
        null,
        observacionesIniciales,
        usuarioAuth,
        accion,
      ),
      detalles,
    };
  }

  async crearPedido(data: any, usuarioAuth: any) {
    const error = validarCrearPedido(data);

    if (error) {
      throw new Error(error);
    }

    const idCotizacion = Number(data.idCotizacion);
    const cotizacion =
      await pedidoRepository.buscarCotizacionParaPedido(idCotizacion);

    if (!cotizacion) {
      throw new Error("La cotizacion no existe.");
    }

    if (cotizacion.estado !== ESTADO_COTIZACION_APROBADA) {
      throw new Error("Solo se pueden crear pedidos desde cotizaciones APROBADA.");
    }

    const pedidoExistente =
      await pedidoRepository.buscarPorCotizacion(idCotizacion);

    if (pedidoExistente) {
      throw new Error("Ya existe un pedido creado para esta cotizacion.");
    }

    const pedidoData = this.prepararPedidoDesdeCotizacion(
      cotizacion,
      data,
      usuarioAuth,
    );

    const pedido = await pedidoRepository.crearDesdeCotizacion(pedidoData);

    await notificationService.pedidoCreadoDesdeCotizacion(pedido);

    return this.formatearPedido(pedido);
  }

  async listarPedidos(usuarioAuth: any, query: PaginationQuery = {}) {
    const pagination = parsePaginationQuery(query, {
      defaultSortBy: "idPedido",
      allowedSortBy: ["idPedido", "fechaCreacion", "total", "estadoPedido"],
      maxLimit: 10,
    });
    const filtros = esCliente(usuarioAuth)
      ? { idCliente: idClienteAutenticado(usuarioAuth) }
      : {};

    if (pagination.isPaginated) {
      const resultado = await pedidoRepository.listarPedidosPaginado(
        filtros,
        pagination,
      );

      return paginatedResponse(
        this.formatearPedidos(resultado.data),
        pagination,
        resultado.total,
      );
    }

    const pedidos = esCliente(usuarioAuth)
      ? await pedidoRepository.listarPorCliente(idClienteAutenticado(usuarioAuth))
      : await pedidoRepository.listarPedidos();

    if (pedidos.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    return { data: this.formatearPedidos(pedidos) };
  }

  async buscarPorId(idPedido: number, usuarioAuth: any) {
    const pedido = await this.buscarPorIdInterno(idPedido, usuarioAuth);

    return this.formatearPedido(pedido);
  }

  async obtenerExpediente(idPedido: number, usuarioAuth: any) {
    const pedido = await this.buscarPorIdInterno(idPedido, usuarioAuth);
    const formateado = this.formatearPedido(pedido);
    const todosDisenosAprobados = (formateado.detalles ?? []).every(
      (detalle: any) => detalle.cubiertoPorDiseno,
    );
    const requiereCreacionDisenoPixel = (formateado.detalles ?? []).some(
      (detalle: any) =>
        detalle.estadoCoberturaDiseno === "PENDIENTE_CREACION_PIXEL",
    );
    const comprobantesPendientes = (pedido.abonos ?? []).some(
      (abono: any) =>
        abono.estado === "PENDIENTE" &&
        Boolean(
          abono.comprobantePath ??
            abono.nombreOriginalComprobante ??
            abono.comprobanteUrl,
        ),
    );
    const proximasAcciones: string[] = [];

    if (pedido.estadoPedido === ESTADO_PEDIDO_ANULADO) {
      proximasAcciones.push("ANULADO");
    } else if (pedido.estadoPedido === ESTADO_PEDIDO_ENTREGADO) {
      proximasAcciones.push("ENTREGADO");
    } else {
      if (comprobantesPendientes) {
        proximasAcciones.push("COMPROBANTE_PENDIENTE_REVISION");
      }
      if (aNumero(pedido.totalPagado) <= 0) {
        proximasAcciones.push("REQUIERE_PRIMER_ABONO");
      }
      if (!todosDisenosAprobados) {
        proximasAcciones.push(
          requiereCreacionDisenoPixel
            ? "REQUIERE_DISENO"
            : "DISENO_PENDIENTE_APROBACION",
        );
      }
      if (
        pedido.estadoPedido === ESTADO_PEDIDO_PENDIENTE &&
        aNumero(pedido.totalPagado) >= aNumero(pedido.total) * 0.5 &&
        todosDisenosAprobados
      ) {
        proximasAcciones.push("LISTO_PARA_PRODUCCION");
      }
      if (pedido.estadoPedido === ESTADO_PEDIDO_EN_PROCESO) {
        proximasAcciones.push("EN_PRODUCCION");
      }
      if (
        pedido.estadoPedido === ESTADO_PEDIDO_PENDIENTE_SALDO_FINAL ||
        (pedido.estadoPedido === ESTADO_PEDIDO_EN_PROCESO &&
          aNumero(pedido.saldoPendiente) > 0)
      ) {
        proximasAcciones.push("PENDIENTE_SALDO_FINAL");
      }
      if (pedido.estadoPedido === ESTADO_PEDIDO_FINALIZADO) {
        proximasAcciones.push("LISTO_PARA_ENTREGAR");
      }
    }

    const historial = [
      {
        tipo: "PEDIDO_CREADO",
        fecha: pedido.fechaCreacion,
      },
      ...(pedido.abonos ?? []).map((abono: any) => ({
        tipo: `ABONO_${abono.estado}`,
        fecha:
          abono.fechaConfirmacion ??
          abono.fechaRechazo ??
          abono.fechaCreacion,
        idAbono: abono.idAbono,
      })),
      ...(pedido.disenos ?? []).map((diseno: any) => ({
        tipo: `DISENO_${diseno.estado}`,
        fecha:
          diseno.fechaAprobacion ??
          diseno.fechaEnvio ??
          diseno.fechaCreacion,
        idDiseno: diseno.idDiseno,
      })),
      ...(pedido.fechaFinalizado
        ? [{ tipo: "PEDIDO_FINALIZADO", fecha: pedido.fechaFinalizado }]
        : []),
      ...(pedido.fechaEntregado
        ? [{ tipo: "PEDIDO_ENTREGADO", fecha: pedido.fechaEntregado }]
        : []),
    ].sort(
      (a, b) =>
        new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
    );

    return {
      pedido: {
        idPedido: formateado.idPedido,
        idCotizacion: formateado.idCotizacion,
        estadoPedido: formateado.estadoPedido,
        estadoPago: formateado.estadoPago,
        fechaCreacion: formateado.fechaCreacion,
        fechaEntregaEstimada: formateado.fechaEntregaEstimada,
        observaciones: formateado.observaciones,
      },
      cliente: pedido.cliente,
      detalles: formateado.detalles,
      resumenEconomico: {
        total: aNumero(pedido.total),
        totalConfirmado: aNumero(pedido.totalPagado),
        saldoPendiente: aNumero(pedido.saldoPendiente),
        estadoPago: pedido.estadoPago,
        montoMinimoPrimerAbono: redondearMoneda(aNumero(pedido.total) * 0.5),
      },
      totalDisenosRequeridos: formateado.totalDisenosRequeridos,
      totalDisenosAprobados: formateado.totalDisenosAprobados,
      totalDisenosPendientes: formateado.totalDisenosPendientes,
      venta: pedido.venta ?? null,
      abonos: formateado.abonos ?? [],
      disenos: pedido.disenos ?? [],
      historial,
      proximasAcciones,
    };
  }

  async buscarParcial(termino: string, usuarioAuth: any) {
    if (!termino || termino.trim() === "") {
      throw new Error("Debe ingresar un termino de busqueda.");
    }

    const resultados = await pedidoRepository.buscarParcial(termino.trim());
    const pedidos = esCliente(usuarioAuth)
      ? resultados.filter(
          (item: any) => item.idCliente === idClienteAutenticado(usuarioAuth),
        )
      : resultados;

    if (pedidos.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    return this.formatearPedidos(pedidos);
  }

  async actualizarPedido(
    idPedido: number,
    data: any,
    usuarioAuth: any,
  ) {
    validarId(idPedido);

    const esGestor = puedeGestionarPedido(usuarioAuth);
    const error = validarActualizarPedido(data, {
      permiteFechaEntregaEstimada: esGestor,
    });

    if (error) {
      throw new Error(error);
    }

    const pedido = await this.buscarPorIdInterno(idPedido, usuarioAuth);

    if (
      data.fechaEntregaEstimada !== undefined &&
      ![ESTADO_PEDIDO_PENDIENTE, ESTADO_PEDIDO_EN_PROCESO].includes(
        pedido.estadoPedido,
      )
    ) {
      throw new Error(
        "La fecha de entrega estimada solo se puede asignar mientras el pedido este PENDIENTE o EN_PROCESO.",
      );
    }

    if (
      !esGestor &&
      pedido.estadoPedido !== ESTADO_PEDIDO_PENDIENTE
    ) {
      throw new Error("El cliente solo puede actualizar observaciones de pedidos PENDIENTE.");
    }

    const dataActualizar: any = {};

    if (data.observaciones !== undefined) {
      dataActualizar.observaciones = agregarObservacionAuditoria(
        pedido.observaciones,
        data.observaciones,
        usuarioAuth,
        "Actualizacion de observaciones",
      );
    }

    if (data.fechaEntregaEstimada !== undefined) {
      dataActualizar.fechaEntregaEstimada = prepararFechaCalendario(
        data.fechaEntregaEstimada,
      );

      if (data.observaciones === undefined) {
        dataActualizar.observaciones = agregarObservacionAuditoria(
          pedido.observaciones,
          `Fecha estimada de entrega asignada a ${formatearFechaLegible(dataActualizar.fechaEntregaEstimada)}.`,
          usuarioAuth,
          "Actualizacion de fecha estimada",
        );
      }
    }

    const pedidoActualizado = await pedidoRepository.actualizarPedido(
      idPedido,
      dataActualizar,
    );

    return this.formatearPedido(pedidoActualizado);
  }

  async marcarEnProceso(idPedido: number, data: any, usuarioAuth: any) {
    validarId(idPedido);

    const error = validarPasarPedidoEnProceso(data);

    if (error) {
      throw new Error(error);
    }

    const pedido = await this.buscarPorIdInterno(idPedido, usuarioAuth);

    if (pedido.estadoPedido === ESTADO_PEDIDO_EN_PROCESO) {
      throw new Error("El pedido ya está en proceso.");
    }

    if (pedido.estadoPedido !== ESTADO_PEDIDO_PENDIENTE) {
      throw new Error("Solo un pedido PENDIENTE puede pasar a EN_PROCESO.");
    }

    const traeMontoLegacy =
      data?.montoPrimerAbono !== undefined &&
      data?.montoPrimerAbono !== null &&
      data?.montoPrimerAbono !== "";

    const resultado = await runPrismaTransaction(
      async (tx: Prisma.TransactionClient) => {
        let pagoInicialValidadoPorAbono = false;

        if (traeMontoLegacy) {
          const resultadoAbono =
            await abonoService.crearAbonoConfirmadoConResumenEnTransaccion(
              {
                idPedido,
                monto: redondearMoneda(Number(data.montoPrimerAbono)),
                metodoPago: (data.metodoPago ?? "EFECTIVO") as MetodoPagoPermitido,
                referencia:
                  limpiarTextoOpcional(data.referencia) ??
                  limpiarTextoOpcional(data.observaciones) ??
                  "Primer abono registrado desde endpoint legado.",
                comprobanteUrl: limpiarTextoOpcional(data.comprobanteUrl),
              },
              usuarioAuth,
              tx,
            );

          pagoInicialValidadoPorAbono = resultadoAbono.pagoInicialValido;
        }

        const tienePagoInicial =
          pagoInicialValidadoPorAbono ||
          (await abonoService.pedidoTienePagoInicialValido(idPedido, tx));

        if (!tienePagoInicial) {
          throw new Error("El pedido requiere un abono confirmado mínimo del 50% o pago completo antes de pasar a producción.");
        }

        const tieneDisenoAprobado =
          await abonoService.pedidoTieneDisenoAprobado(idPedido, tx);

        if (!tieneDisenoAprobado) {
          throw new Error("El pedido requiere un diseño aprobado por el cliente antes de pasar a producción.");
        }

        const pedidoActual = await pedidoRepository.buscarOperacionPorId(
          idPedido,
          tx,
        );

        if (pedidoActual?.estadoPedido === ESTADO_PEDIDO_EN_PROCESO) {
          return pedidoActual;
        }

        return await pedidoRepository.actualizarPedidoOperacion(
          idPedido,
          {
            estadoPedido: ESTADO_PEDIDO_EN_PROCESO,
            observaciones: agregarObservacionAuditoria(
              pedido.observaciones,
              limpiarTextoOpcional(data.observaciones)
                ?? "Pedido habilitado para produccion con pago inicial y diseño aprobado.",
              usuarioAuth,
              "Paso a produccion",
            ),
          },
          tx,
        );
      },
    );

    const pedidoActualizado = await pedidoRepository.buscarPorId(
      resultado.idPedido,
    );

    if (!pedidoActualizado) {
      throw new Error("No fue posible cargar el pedido actualizado.");
    }

    return this.formatearPedido(pedidoActualizado);
  }

  async actualizarFechaEntregaEstimada(
    idPedido: number,
    data: any,
    usuarioAuth: any,
  ) {
    return await this.actualizarPedido(idPedido, data, usuarioAuth);
  }

  async actualizarRequiereDisenoDetalle(
    idPedido: number,
    idDetallePedido: number,
    data: any,
    usuarioAuth: any,
  ) {
    validarId(idPedido);
    validarId(idDetallePedido);

    if (!puedeGestionarPedido(usuarioAuth)) {
      throw new Error("No tienes permiso para configurar los disenos del pedido.");
    }

    const error = validarRequiereDisenoDetalle(data);

    if (error) {
      throw new Error(error);
    }

    const resultado = await runPrismaTransaction(async (tx) => {
      const detalle = await pedidoRepository.buscarDetallePedido(
        idDetallePedido,
        tx,
      );

      if (!detalle || detalle.idPedido !== idPedido) {
        throw new Error("El detalle indicado no pertenece al pedido.");
      }

      const detalleActualizado =
        await pedidoRepository.actualizarRequiereDisenoDetalle(
          idDetallePedido,
          data.requiereDiseno,
          tx,
        );
      const pedido = await pedidoRepository.buscarOperacionPorId(idPedido, tx);
      let pasoAProduccion = false;

      if (
        pedido?.estadoPedido === ESTADO_PEDIDO_PENDIENTE &&
        data.requiereDiseno === false
      ) {
        const tienePagoInicial =
          await abonoService.pedidoTienePagoInicialValido(idPedido, tx);
        const tieneDisenosAprobados =
          await abonoService.pedidoTieneDisenoAprobado(idPedido, tx);

        if (tienePagoInicial && tieneDisenosAprobados) {
          await pedidoRepository.actualizarPedidoOperacion(
            idPedido,
            { estadoPedido: ESTADO_PEDIDO_EN_PROCESO },
            tx,
          );
          pasoAProduccion = true;
        }
      }

      return { detalleActualizado, pasoAProduccion };
    });

    const pedido = await pedidoRepository.buscarPorId(idPedido);

    if (resultado.pasoAProduccion && pedido) {
      try {
        await notificationService.pedidoEnProduccion(pedido);
      } catch (error) {
        console.error("Error enviando correo de pedido en produccion:", error);
      }
    }

    return {
      detalle: resultado.detalleActualizado,
      pedido: this.formatearPedido(pedido),
      pasoAProduccion: resultado.pasoAProduccion,
    };
  }

  async marcarPendienteSaldoFinal(idPedido: number, data: any, usuarioAuth: any) {
    validarId(idPedido);

    const error = validarMarcarPendienteSaldoFinal(data);

    if (error) {
      throw new Error(error);
    }

    const pedido = await this.buscarPorIdInterno(idPedido, usuarioAuth);

    if (pedido.estadoPedido === ESTADO_PEDIDO_PENDIENTE_SALDO_FINAL) {
      return this.formatearPedido(pedido);
    }

    if (pedido.estadoPedido !== ESTADO_PEDIDO_EN_PROCESO) {
      throw new Error("Solo pedidos EN_PROCESO pueden quedar pendientes de saldo final.");
    }

    if (pedidoPagadoCompleto(pedido)) {
      throw new Error("El pedido ya esta pagado completo; puedes finalizarlo directamente.");
    }

    const observacion = limpiarTextoOpcional(data?.observaciones)
      ?? "Produccion terminada. Pedido pendiente de saldo final.";

    const pedidoActualizado = await pedidoRepository.actualizarPedido(idPedido, {
      estadoPedido: ESTADO_PEDIDO_PENDIENTE_SALDO_FINAL,
      observaciones: agregarObservacionAuditoria(
        pedido.observaciones,
        observacion,
        usuarioAuth,
        "Produccion terminada pendiente de saldo",
      ),
    });

    await notificarSaldoFinalPendiente(pedidoActualizado);

    return this.formatearPedido(pedidoActualizado);
  }

  async finalizarPedido(idPedido: number, data: any, usuarioAuth: any) {
    validarId(idPedido);

    const error = validarFinalizarPedido(data);

    if (error) {
      throw new Error(error);
    }

    const pedido = await this.buscarPorIdInterno(idPedido, usuarioAuth);

    if (
      ![
        ESTADO_PEDIDO_EN_PROCESO,
        ESTADO_PEDIDO_PENDIENTE_SALDO_FINAL,
      ].includes(pedido.estadoPedido)
    ) {
      throw new Error("Solo se pueden finalizar pedidos en proceso o pendientes de saldo final.");
    }

    if (!pedidoPagadoCompleto(pedido)) {
      throw new Error("No se puede finalizar el pedido porque aun tiene saldo pendiente.");
    }

    const observacion = limpiarTextoOpcional(data?.observaciones)
      ?? "Produccion completada.";

    const pedidoActualizado = await pedidoRepository.actualizarPedido(idPedido, {
      estadoPedido: ESTADO_PEDIDO_FINALIZADO,
      fechaFinalizado: new Date(),
      observaciones: agregarObservacionAuditoria(
        pedido.observaciones,
        observacion,
        usuarioAuth,
        "Finalizacion de pedido",
      ),
    });

    await notificarPedidoFinalizado(pedidoActualizado);

    return this.formatearPedido(pedidoActualizado);
  }

  async confirmarEntrega(idPedido: number, data: any, usuarioAuth: any) {
    validarId(idPedido);

    const error = validarConfirmarEntregaPedido(data);

    if (error) {
      throw new Error(error);
    }

    const pedido = await this.buscarPorIdInterno(idPedido, usuarioAuth);

    if (pedido.estadoPedido === ESTADO_PEDIDO_ENTREGADO) {
      throw new Error("El pedido ya fue entregado o reclamado.");
    }

    if (pedido.estadoPedido !== ESTADO_PEDIDO_FINALIZADO) {
      throw new Error("Solo se pueden entregar pedidos FINALIZADO.");
    }

    if (!pedidoPagadoCompleto(pedido)) {
      throw new Error("No se puede entregar el pedido porque aun tiene saldo pendiente.");
    }

    const pedidoActualizado = await pedidoRepository.actualizarPedido(idPedido, {
      estadoPedido: ESTADO_PEDIDO_ENTREGADO,
      fechaEntregado: prepararFechaOpcional(data?.fechaEntregado) ?? new Date(),
      observaciones: agregarObservacionAuditoria(
        pedido.observaciones,
        limpiarTextoOpcional(data?.observaciones) ?? "Pedido entregado o reclamado por el cliente.",
        usuarioAuth,
        "Confirmacion de entrega",
      ),
    });

    await notificarPedidoEntregado(pedidoActualizado);

    return this.formatearPedido(pedidoActualizado);
  }

  async anularPedido(idPedido: number, data: any, usuarioAuth: any) {
    validarId(idPedido);
    const error = validarAnularPedido(data);

    if (error) {
      throw new Error(error);
    }

    if (esCliente(usuarioAuth)) {
      throw new Error("Los clientes no pueden anular pedidos.");
    }

    const pedido = await this.buscarPorIdInterno(idPedido, usuarioAuth);

    if (pedido.estadoPedido === ESTADO_PEDIDO_ANULADO) {
      throw new Error("El pedido ya fue anulado.");
    }

    const motivo = limpiarTextoOpcional(
      data?.motivoAnulacion ?? data?.observaciones,
    );
    await this.ejecutarTransaccion(async (tx) => {
      await pedidoRepository.actualizarPedidoOperacion(
        idPedido,
        {
          estadoPedido: ESTADO_PEDIDO_ANULADO,
          observaciones: agregarObservacionAuditoria(
            pedido.observaciones,
            motivo ?? "Pedido anulado por un usuario autorizado.",
            usuarioAuth,
            "Anulacion de pedido",
          ),
        },
        tx,
      );
      await abonoRepository.actualizarVentaAnulada(idPedido, tx);
    });
    const pedidoAnulado = await pedidoRepository.buscarPorId(idPedido);

    if (!pedidoAnulado) {
      throw new Error("No fue posible cargar el pedido anulado.");
    }

    await notificarPedidoAnulado(pedidoAnulado, motivo);

    return this.formatearPedido(pedidoAnulado);
  }
}
