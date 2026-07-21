import { runPrismaTransaction } from "../../config/prisma";
import type { Prisma } from "../../../generated/prisma/client";
import { PedidoRepository } from "../../infrastructure/repositories/pedido.repository";
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
} from "../validators/pedido.validator";
import {
  paginatedResponse,
  parsePaginationQuery,
  type PaginationQuery,
} from "../../utils/pagination.util";

const pedidoRepository = new PedidoRepository();
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
    observaciones: limpiarTextoOpcional(detalle.observaciones),
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
  formatearPedido(pedido: any) {
    if (!pedido) {
      return pedido;
    }

    return {
      ...pedido,
      fechaCreacion: formatearFechaLegible(pedido.fechaCreacion),
      fechaEntregaEstimada: formatearFechaLegible(
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
      fechaEntregaEstimada: prepararFechaOpcional(data?.fechaEntregaEstimada),
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
      dataActualizar.fechaEntregaEstimada = prepararFechaOpcional(
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

    const pedidoActualizado = await runPrismaTransaction(
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

        const pedidoActual = await pedidoRepository.buscarPorId(idPedido, tx);

        if (pedidoActual?.estadoPedido === ESTADO_PEDIDO_EN_PROCESO) {
          return pedidoActual;
        }

        return await pedidoRepository.actualizarPedido(
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

    return this.formatearPedido(pedidoActualizado);
  }

  async actualizarFechaEntregaEstimada(
    idPedido: number,
    data: any,
    usuarioAuth: any,
  ) {
    return await this.actualizarPedido(idPedido, data, usuarioAuth);
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
    const pedidoAnulado = await pedidoRepository.actualizarPedido(idPedido, {
      estadoPedido: ESTADO_PEDIDO_ANULADO,
      observaciones: agregarObservacionAuditoria(
        pedido.observaciones,
        motivo ?? "Pedido anulado por un usuario autorizado.",
        usuarioAuth,
        "Anulacion de pedido",
      ),
    });

    await notificarPedidoAnulado(pedidoAnulado, motivo);

    return this.formatearPedido(pedidoAnulado);
  }
}
