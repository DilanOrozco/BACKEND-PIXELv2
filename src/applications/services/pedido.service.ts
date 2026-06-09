import { runPrismaTransaction } from "../../config/prisma";
import type { Prisma } from "../../../generated/prisma/client";
import { PedidoRepository } from "../../infrastructure/repositories/pedido.repository";
import { AbonoService } from "./abono.service";
import type { MetodoPagoPermitido } from "../validators/abono.validator";
import {
  validarActualizarPedido,
  validarCrearPedido,
  validarFinalizarPedido,
  validarPasarPedidoEnProceso,
} from "../validators/pedido.validator";

const pedidoRepository = new PedidoRepository();
const abonoService = new AbonoService();

const ESTADO_COTIZACION_APROBADA = "APROBADA";

const ESTADO_PEDIDO_PENDIENTE = "PENDIENTE";
const ESTADO_PEDIDO_EN_PROCESO = "EN_PROCESO";
const ESTADO_PEDIDO_FINALIZADO = "FINALIZADO";

const ESTADO_PAGO_PENDIENTE = "PENDIENTE";

const esCliente = (usuarioAuth: any) => usuarioAuth?.rol === "Cliente";
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
    idTecnica: Number(detalle.idTecnica),
    descripcion: detalle.descripcion,
    cantidad: Number(detalle.cantidad),
    precioUnitario: aNumero(detalle.precioUnitario),
    subtotal: aNumero(detalle.subtotal),
    observaciones: limpiarTextoOpcional(detalle.observaciones),
  };
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

    if (esCliente(usuarioAuth) && pedido.idCliente !== Number(usuarioAuth.idUsuario)) {
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

    return this.formatearPedido(pedido);
  }

  async listarPedidos(usuarioAuth: any) {
    const pedidos = esCliente(usuarioAuth)
      ? await pedidoRepository.listarPorCliente(Number(usuarioAuth.idUsuario))
      : await pedidoRepository.listarPedidos();

    if (pedidos.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    return this.formatearPedidos(pedidos);
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
          (item: any) => item.idCliente === Number(usuarioAuth.idUsuario),
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

  async finalizarPedido(idPedido: number, data: any, usuarioAuth: any) {
    validarId(idPedido);

    const error = validarFinalizarPedido(data);

    if (error) {
      throw new Error(error);
    }

    const pedido = await this.buscarPorIdInterno(idPedido, usuarioAuth);

    if (pedido.estadoPedido !== ESTADO_PEDIDO_EN_PROCESO) {
      throw new Error("Solo se pueden finalizar pedidos en proceso.");
    }

    const observacion = limpiarTextoOpcional(data?.observaciones)
      ?? "Produccion completada.";

    const pedidoActualizado = await pedidoRepository.actualizarPedido(idPedido, {
      estadoPedido: ESTADO_PEDIDO_FINALIZADO,
      fechaFinalizado: new Date(),
      fechaEntregado: prepararFechaOpcional(data?.fechaEntregado) ?? new Date(),
      observaciones: agregarObservacionAuditoria(
        pedido.observaciones,
        observacion,
        usuarioAuth,
        "Finalizacion de pedido",
      ),
    });

    return this.formatearPedido(pedidoActualizado);
  }

  async anularPedido(idPedido: number, data: any, usuarioAuth: any) {
    validarId(idPedido);
    await this.buscarPorIdInterno(idPedido, usuarioAuth);
    void data;

    throw new Error("La anulación de pedidos está deshabilitada porque EstadoPedido solo permite PENDIENTE, EN_PROCESO y FINALIZADO.");
  }
}
