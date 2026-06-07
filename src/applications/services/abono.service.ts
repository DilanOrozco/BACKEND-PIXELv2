import { prisma } from "../../config/prisma";
import type { Prisma } from "../../../generated/prisma/client";
import {
  AbonoRepository,
  type AbonoFiltros,
  type ActualizarAbonoData,
  type CrearAbonoData,
} from "../../infrastructure/repositories/abono.repository";
import {
  type EstadoAbonoPermitido,
  type MetodoPagoPermitido,
  validarActualizarAbono,
  validarConfirmarAbono,
  validarCrearAbono,
  validarFiltrosAbono,
  validarRechazarAbono,
} from "../validators/abono.validator";

const abonoRepository = new AbonoRepository();

const ESTADO_ABONO_PENDIENTE = "PENDIENTE" as const;
const ESTADO_ABONO_CONFIRMADO = "CONFIRMADO" as const;
const ESTADO_ABONO_RECHAZADO = "RECHAZADO" as const;

const ESTADO_PEDIDO_PENDIENTE = "PENDIENTE" as const;
const ESTADO_PEDIDO_EN_PROCESO = "EN_PROCESO" as const;

const ESTADO_PAGO_PENDIENTE = "PENDIENTE" as const;
const ESTADO_PAGO_PARCIAL = "PARCIAL" as const;
const ESTADO_PAGO_COMPLETO = "COMPLETO" as const;

interface AuthUser {
  idUsuario: number;
  rol: string;
}

type DatosEntrada = Record<string, unknown>;

const esCliente = (usuarioAuth: AuthUser) => usuarioAuth.rol === "Cliente";
const puedeGestionarAbonos = (usuarioAuth: AuthUser) =>
  ["Admin", "Secretaria"].includes(usuarioAuth.rol);

const redondearMoneda = (valor: number) => Math.round(valor * 100) / 100;

const aNumero = (valor: unknown) => Number(valor ?? 0);

const limpiarTextoOpcional = (valor: unknown) => {
  if (typeof valor !== "string") {
    return null;
  }

  const texto = valor.trim();
  return texto === "" ? null : texto;
};

const validarId = (id: number, mensaje: string) => {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(mensaje);
  }
};

export class AbonoService {
  private obtenerUsuario(usuarioAuth: AuthUser | undefined) {
    if (!usuarioAuth) {
      throw new Error("Usuario no autenticado.");
    }

    return usuarioAuth;
  }

  validarAccesoClienteAlPedido(
    pedido: { idCliente: number },
    user: AuthUser,
    mensaje = "No tienes permiso para registrar abonos en este pedido.",
  ) {
    if (esCliente(user) && Number(pedido.idCliente) !== Number(user.idUsuario)) {
      throw new Error(mensaje);
    }
  }

  private validarAccesoConsultaAbono(
    abono: { pedido: { cliente: { idUsuario: number } } },
    user: AuthUser,
  ) {
    if (
      esCliente(user) &&
      Number(abono.pedido.cliente.idUsuario) !== Number(user.idUsuario)
    ) {
      throw new Error("No tienes permiso para consultar este abono.");
    }
  }

  private prepararDatosBase(data: DatosEntrada): CrearAbonoData {
    return {
      idPedido: Number(data.idPedido),
      monto: redondearMoneda(Number(data.monto)),
      metodoPago: data.metodoPago as MetodoPagoPermitido,
      referencia: limpiarTextoOpcional(data.referencia),
      comprobanteUrl: limpiarTextoOpcional(data.comprobanteUrl),
    };
  }

  calcularEstadoPago(total: number, totalPagado: number) {
    const totalRedondeado = redondearMoneda(total);
    const totalPagadoRedondeado = redondearMoneda(totalPagado);

    if (totalPagadoRedondeado <= 0) {
      return ESTADO_PAGO_PENDIENTE;
    }

    if (totalPagadoRedondeado >= totalRedondeado) {
      return ESTADO_PAGO_COMPLETO;
    }

    return ESTADO_PAGO_PARCIAL;
  }

  private async validarConfirmacionDeMonto(
    idPedido: number,
    monto: number,
    tx: Prisma.TransactionClient,
  ) {
    const pedido = await abonoRepository.buscarPedidoPorId(idPedido, tx);

    if (!pedido) {
      throw new Error("Pedido no encontrado.");
    }

    const total = redondearMoneda(aNumero(pedido.total));
    const totalPagadoActual = redondearMoneda(
      await abonoRepository.sumarAbonosConfirmados(idPedido, tx),
    );
    const nuevoTotalPagado = redondearMoneda(totalPagadoActual + monto);

    if (nuevoTotalPagado > total) {
      throw new Error("El abono supera el saldo pendiente del pedido.");
    }

    const minimoPrimerAbono = redondearMoneda(total * 0.5);

    if (totalPagadoActual === 0 && monto < minimoPrimerAbono) {
      throw new Error("El primer abono confirmado debe ser mínimo del 50% del total del pedido o el pago completo.");
    }

    return pedido;
  }

  async recalcularPagoPedido(idPedido: number, tx?: Prisma.TransactionClient) {
    const pedido = await abonoRepository.buscarPedidoPorId(idPedido, tx);

    if (!pedido) {
      throw new Error("Pedido no encontrado.");
    }

    const total = redondearMoneda(aNumero(pedido.total));
    const totalPagado = redondearMoneda(
      await abonoRepository.sumarAbonosConfirmados(idPedido, tx),
    );
    const saldoPendiente = redondearMoneda(Math.max(total - totalPagado, 0));
    const estadoPago = this.calcularEstadoPago(total, totalPagado);

    return await abonoRepository.actualizarResumenPagoPedido(
      idPedido,
      {
        totalPagado,
        saldoPendiente,
        estadoPago,
      },
      tx,
    );
  }

  async pedidoTienePagoInicialValido(
    idPedido: number,
    tx?: Prisma.TransactionClient,
  ) {
    const pedido = await abonoRepository.buscarPedidoPorId(idPedido, tx);

    if (!pedido) {
      throw new Error("Pedido no encontrado.");
    }

    const total = redondearMoneda(aNumero(pedido.total));
    const totalPagado = redondearMoneda(
      await abonoRepository.sumarAbonosConfirmados(idPedido, tx),
    );
    const minimo = redondearMoneda(total * 0.5);

    return totalPagado >= minimo || totalPagado >= total;
  }

  async pedidoTieneDisenoAprobado(
    idPedido: number,
    tx?: Prisma.TransactionClient,
  ) {
    return await abonoRepository.existeDisenoAprobado(idPedido, tx);
  }

  async intentarPasarPedidoAEnProceso(
    idPedido: number,
    tx?: Prisma.TransactionClient,
  ) {
    const pedido = await abonoRepository.buscarPedidoPorId(idPedido, tx);

    if (!pedido || pedido.estadoPedido !== ESTADO_PEDIDO_PENDIENTE) {
      return false;
    }

    const tienePagoInicial = await this.pedidoTienePagoInicialValido(
      idPedido,
      tx,
    );

    if (!tienePagoInicial) {
      return false;
    }

    const tieneDisenoAprobado = await this.pedidoTieneDisenoAprobado(
      idPedido,
      tx,
    );

    if (!tieneDisenoAprobado) {
      return false;
    }

    await abonoRepository.actualizarEstadoPedido(
      idPedido,
      ESTADO_PEDIDO_EN_PROCESO,
      tx,
    );

    return true;
  }

  async crearAbonoConfirmadoEnTransaccion(
    data: CrearAbonoData,
    user: AuthUser,
    tx: Prisma.TransactionClient,
  ) {
    await this.validarConfirmacionDeMonto(data.idPedido, data.monto, tx);

    const abonoCreado = await abonoRepository.crearAbono(
      {
        ...data,
        estado: ESTADO_ABONO_CONFIRMADO,
        confirmadoPorId: Number(user.idUsuario),
        fechaConfirmacion: new Date(),
      },
      tx,
    );

    await this.recalcularPagoPedido(data.idPedido, tx);
    await this.intentarPasarPedidoAEnProceso(data.idPedido, tx);

    return await abonoRepository.buscarPorId(abonoCreado.idAbono, tx);
  }

  async crearAbono(data: DatosEntrada, usuarioAuth: AuthUser | undefined) {
    const user = this.obtenerUsuario(usuarioAuth);
    const error = validarCrearAbono(data, user.rol);

    if (error) {
      throw new Error(error);
    }

    const datosBase = this.prepararDatosBase(data);
    const pedido = await abonoRepository.buscarPedidoPorId(datosBase.idPedido);

    if (!pedido) {
      throw new Error("Pedido no encontrado.");
    }

    if (esCliente(user)) {
      this.validarAccesoClienteAlPedido(pedido, user);

      return await abonoRepository.crearAbono({
        ...datosBase,
        estado: ESTADO_ABONO_PENDIENTE,
      });
    }

    if (!puedeGestionarAbonos(user)) {
      throw new Error("No tienes permiso para registrar abonos en este pedido.");
    }

    if (data.confirmar === true) {
      return await prisma.$transaction(async (tx) => {
        return await this.crearAbonoConfirmadoEnTransaccion(
          datosBase,
          user,
          tx,
        );
      });
    }

    return await abonoRepository.crearAbono({
      ...datosBase,
      estado: ESTADO_ABONO_PENDIENTE,
    });
  }

  async confirmarAbono(
    idAbono: number,
    usuarioAuth: AuthUser | undefined,
    data: DatosEntrada = {},
  ) {
    const user = this.obtenerUsuario(usuarioAuth);
    validarId(idAbono, "El ID del abono no es valido.");

    const error = validarConfirmarAbono(data);

    if (error) {
      throw new Error(error);
    }

    return await prisma.$transaction(async (tx) => {
      const abono = await abonoRepository.buscarPorId(idAbono, tx);

      if (!abono) {
        throw new Error("Abono no encontrado.");
      }

      if (abono.estado === ESTADO_ABONO_CONFIRMADO) {
        throw new Error("El abono ya fue confirmado.");
      }

      if (abono.estado === ESTADO_ABONO_RECHAZADO) {
        throw new Error("El abono ya fue rechazado.");
      }

      if (abono.estado !== ESTADO_ABONO_PENDIENTE) {
        throw new Error("Solo se pueden confirmar abonos pendientes.");
      }

      await this.validarConfirmacionDeMonto(
        abono.idPedido,
        redondearMoneda(aNumero(abono.monto)),
        tx,
      );

      const dataActualizar: ActualizarAbonoData = {
        estado: ESTADO_ABONO_CONFIRMADO,
        confirmadoPorId: Number(user.idUsuario),
        fechaConfirmacion: new Date(),
      };

      if (data.referencia !== undefined) {
        dataActualizar.referencia = limpiarTextoOpcional(data.referencia);
      }

      const abonoConfirmado = await abonoRepository.actualizarAbono(
        idAbono,
        dataActualizar,
        tx,
      );

      await this.recalcularPagoPedido(abonoConfirmado.idPedido, tx);
      await this.intentarPasarPedidoAEnProceso(abonoConfirmado.idPedido, tx);

      return await abonoRepository.buscarPorId(idAbono, tx);
    });
  }

  async rechazarAbono(
    idAbono: number,
    usuarioAuth: AuthUser | undefined,
    data: DatosEntrada,
  ) {
    const user = this.obtenerUsuario(usuarioAuth);
    validarId(idAbono, "El ID del abono no es valido.");

    const error = validarRechazarAbono(data);

    if (error) {
      throw new Error(error);
    }

    return await prisma.$transaction(async (tx) => {
      const abono = await abonoRepository.buscarPorId(idAbono, tx);

      if (!abono) {
        throw new Error("Abono no encontrado.");
      }

      if (abono.estado === ESTADO_ABONO_CONFIRMADO) {
        throw new Error("El abono ya fue confirmado.");
      }

      if (abono.estado === ESTADO_ABONO_RECHAZADO) {
        throw new Error("El abono ya fue rechazado.");
      }

      if (abono.estado !== ESTADO_ABONO_PENDIENTE) {
        throw new Error("Solo se pueden rechazar abonos pendientes.");
      }

      return await abonoRepository.actualizarAbono(
        idAbono,
        {
          estado: ESTADO_ABONO_RECHAZADO,
          rechazadoPorId: Number(user.idUsuario),
          fechaRechazo: new Date(),
          motivoRechazo: limpiarTextoOpcional(data.motivoRechazo),
        },
        tx,
      );
    });
  }

  async listarAbonos(filtrosEntrada: DatosEntrada) {
    const error = validarFiltrosAbono(filtrosEntrada);

    if (error) {
      throw new Error(error);
    }

    const filtros: AbonoFiltros = {};

    if (filtrosEntrada.idPedido !== undefined) {
      filtros.idPedido = Number(filtrosEntrada.idPedido);
    }

    if (filtrosEntrada.estado !== undefined) {
      filtros.estado = filtrosEntrada.estado as EstadoAbonoPermitido;
    }

    if (filtrosEntrada.metodoPago !== undefined) {
      filtros.metodoPago = filtrosEntrada.metodoPago as MetodoPagoPermitido;
    }

    if (typeof filtrosEntrada.desde === "string") {
      filtros.desde = filtrosEntrada.desde;
    }

    if (typeof filtrosEntrada.hasta === "string") {
      filtros.hasta = filtrosEntrada.hasta;
    }

    const abonos = await abonoRepository.listarAbonos(filtros);

    if (abonos.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    return abonos;
  }

  async listarPorPedido(idPedido: number, usuarioAuth: AuthUser | undefined) {
    const user = this.obtenerUsuario(usuarioAuth);
    validarId(idPedido, "El ID del pedido no es valido.");

    const pedido = await abonoRepository.buscarPedidoPorId(idPedido);

    if (!pedido) {
      throw new Error("Pedido no encontrado.");
    }

    this.validarAccesoClienteAlPedido(
      pedido,
      user,
      "No tienes permiso para consultar este abono.",
    );

    return await abonoRepository.listarPorPedido(idPedido);
  }

  async buscarPorId(idAbono: number, usuarioAuth: AuthUser | undefined) {
    const user = this.obtenerUsuario(usuarioAuth);
    validarId(idAbono, "El ID del abono no es valido.");

    const abono = await abonoRepository.buscarPorId(idAbono);

    if (!abono) {
      throw new Error("Abono no encontrado.");
    }

    this.validarAccesoConsultaAbono(abono, user);

    return abono;
  }

  async actualizarAbonoPendiente(idAbono: number, data: DatosEntrada) {
    validarId(idAbono, "El ID del abono no es valido.");

    const error = validarActualizarAbono(data);

    if (error) {
      throw new Error(error);
    }

    const abono = await abonoRepository.buscarPorId(idAbono);

    if (!abono) {
      throw new Error("Abono no encontrado.");
    }

    if (abono.estado !== ESTADO_ABONO_PENDIENTE) {
      throw new Error("Solo se pueden actualizar abonos pendientes.");
    }

    const dataActualizar: ActualizarAbonoData = {};

    if (data.monto !== undefined) {
      dataActualizar.monto = redondearMoneda(Number(data.monto));
    }

    if (data.metodoPago !== undefined) {
      dataActualizar.metodoPago = data.metodoPago as MetodoPagoPermitido;
    }

    if (data.referencia !== undefined) {
      dataActualizar.referencia = limpiarTextoOpcional(data.referencia);
    }

    if (data.comprobanteUrl !== undefined) {
      dataActualizar.comprobanteUrl = limpiarTextoOpcional(data.comprobanteUrl);
    }

    return await abonoRepository.actualizarAbono(idAbono, dataActualizar);
  }

  async eliminarAbonoPendiente(idAbono: number) {
    validarId(idAbono, "El ID del abono no es valido.");

    const abono = await abonoRepository.buscarPorId(idAbono);

    if (!abono) {
      throw new Error("Abono no encontrado.");
    }

    if (abono.estado !== ESTADO_ABONO_PENDIENTE) {
      throw new Error("Solo se pueden eliminar abonos pendientes.");
    }

    await abonoRepository.eliminarAbono(idAbono);

    return abono;
  }

}
