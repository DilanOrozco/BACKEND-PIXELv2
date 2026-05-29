import { PedidoRepository } from "../../infrastructure/repositories/pedido.repository";
import {
  validarActualizarObservacionesPedido,
  validarAnularPedido,
  validarCrearPedido,
  validarFinalizarPedido,
  validarPasarPedidoEnProceso,
} from "../validators/pedido.validator";

const pedidoRepository = new PedidoRepository();

const ESTADO_COTIZACION_APROBADA = "APROBADA";

const ESTADO_PEDIDO_PENDIENTE = "PENDIENTE";
const ESTADO_PEDIDO_EN_PROCESO = "EN_PROCESO";
const ESTADO_PEDIDO_FINALIZADO = "FINALIZADO";
const ESTADO_PEDIDO_ANULADO = "ANULADO";

const ESTADO_PAGO_PENDIENTE = "PENDIENTE";
const ESTADO_PAGO_PARCIAL = "PARCIAL";
const ESTADO_PAGO_COMPLETO = "COMPLETO";

const esCliente = (usuarioAuth: any) => usuarioAuth?.rol === "Cliente";

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

    return await pedidoRepository.crearDesdeCotizacion(pedidoData);
  }

  async listarPedidos(usuarioAuth: any) {
    const pedidos = esCliente(usuarioAuth)
      ? await pedidoRepository.listarPorCliente(Number(usuarioAuth.idUsuario))
      : await pedidoRepository.listarPedidos();

    if (pedidos.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    return pedidos;
  }

  async buscarPorId(idPedido: number, usuarioAuth: any) {
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

    return pedidos;
  }

  async actualizarObservacionesCliente(
    idPedido: number,
    data: any,
    usuarioAuth: any,
  ) {
    validarId(idPedido);

    const error = validarActualizarObservacionesPedido(data);

    if (error) {
      throw new Error(error);
    }

    const pedido = await this.buscarPorId(idPedido, usuarioAuth);

    if (pedido.estadoPedido !== ESTADO_PEDIDO_PENDIENTE) {
      throw new Error("Solo se pueden actualizar observaciones de pedidos PENDIENTE.");
    }

    const observaciones = agregarObservacionAuditoria(
      pedido.observaciones,
      data.observaciones,
      usuarioAuth,
      "Actualizacion de observaciones",
    );

    return await pedidoRepository.actualizarPedido(idPedido, { observaciones });
  }

  // Hook temporal para la futura API de abonos: no crea registros en Abonos,
  // pero exige confirmacion y monto minimo antes de activar produccion.
  async marcarEnProceso(idPedido: number, data: any, usuarioAuth: any) {
    validarId(idPedido);

    const error = validarPasarPedidoEnProceso(data);

    if (error) {
      throw new Error(error);
    }

    const pedido = await this.buscarPorId(idPedido, usuarioAuth);

    if (pedido.estadoPedido !== ESTADO_PEDIDO_PENDIENTE) {
      throw new Error("Solo un pedido PENDIENTE puede pasar a EN_PROCESO.");
    }

    const total = aNumero(pedido.total);
    const montoPrimerAbono = redondearMoneda(Number(data.montoPrimerAbono));
    const minimoPrimerAbono = redondearMoneda(total * 0.5);

    if (montoPrimerAbono < minimoPrimerAbono) {
      throw new Error("El primer abono confirmado debe ser minimo el 50% del total.");
    }

    if (montoPrimerAbono > total) {
      throw new Error("El primer abono no puede superar el total del pedido.");
    }

    const saldoPendiente = redondearMoneda(total - montoPrimerAbono);
    const estadoPago =
      saldoPendiente === 0 ? ESTADO_PAGO_COMPLETO : ESTADO_PAGO_PARCIAL;
    const observacion = limpiarTextoOpcional(data.observaciones)
      ?? `Primer abono confirmado por ${montoPrimerAbono}.`;

    return await pedidoRepository.actualizarPedido(idPedido, {
      estadoPedido: ESTADO_PEDIDO_EN_PROCESO,
      estadoPago,
      totalPagado: montoPrimerAbono,
      saldoPendiente,
      observaciones: agregarObservacionAuditoria(
        pedido.observaciones,
        observacion,
        usuarioAuth,
        "Confirmacion de primer abono",
      ),
    });
  }

  async finalizarPedido(idPedido: number, data: any, usuarioAuth: any) {
    validarId(idPedido);

    const error = validarFinalizarPedido(data);

    if (error) {
      throw new Error(error);
    }

    const pedido = await this.buscarPorId(idPedido, usuarioAuth);

    if (pedido.estadoPedido !== ESTADO_PEDIDO_EN_PROCESO) {
      throw new Error("Solo un pedido EN_PROCESO puede finalizarse.");
    }

    const observacion = limpiarTextoOpcional(data?.observaciones)
      ?? "Produccion y entrega completadas.";

    return await pedidoRepository.actualizarPedido(idPedido, {
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
  }

  async anularPedido(idPedido: number, data: any, usuarioAuth: any) {
    validarId(idPedido);

    const error = validarAnularPedido(data);

    if (error) {
      throw new Error(error);
    }

    const pedido = await this.buscarPorId(idPedido, usuarioAuth);

    if (pedido.estadoPedido === ESTADO_PEDIDO_ANULADO) {
      throw new Error("El pedido ya esta ANULADO.");
    }

    if (pedido.estadoPedido !== ESTADO_PEDIDO_PENDIENTE) {
      throw new Error("No se puede anular un pedido que ya inicio produccion.");
    }

    const observacion = limpiarTextoOpcional(data?.observaciones)
      ?? "Pedido anulado antes de iniciar produccion.";

    return await pedidoRepository.actualizarPedido(idPedido, {
      estadoPedido: ESTADO_PEDIDO_ANULADO,
      observaciones: agregarObservacionAuditoria(
        pedido.observaciones,
        observacion,
        usuarioAuth,
        "Anulacion de pedido",
      ),
    });
  }
}
