import { runPrismaTransaction } from "../../config/prisma";
import type { Prisma } from "../../../generated/prisma/client";
import {
  DisenoRepository,
  type ActualizarDisenoData,
  type DisenoFiltros,
} from "../../infrastructure/repositories/diseno.repository";
import {
  type EstadoDisenoPermitido,
  validarActualizarDiseno,
  validarAprobarDiseno,
  validarCrearDiseno,
  validarFiltrosDiseno,
} from "../validators/diseno.validator";
import { AbonoService } from "./abono.service";

const disenoRepository = new DisenoRepository();
const abonoService = new AbonoService();

const ESTADO_PEDIDO_PENDIENTE = "PENDIENTE" as const;
const ESTADO_PEDIDO_EN_PROCESO = "EN_PROCESO" as const;

const ESTADO_DISENO_PENDIENTE = "PENDIENTE" as const;
const ESTADO_DISENO_ENVIADO = "ENVIADO" as const;
const ESTADO_APROBADO_DISENO = "APROBADO" as const;

interface AuthUser {
  idUsuario: number;
  rol: string;
}

type DatosEntrada = Record<string, unknown>;

const esCliente = (usuarioAuth: AuthUser) => usuarioAuth.rol === "Cliente";
const esDisenador = (usuarioAuth: AuthUser) => usuarioAuth.rol === "Diseñador";
const puedeGestionarDisenos = (usuarioAuth: AuthUser) =>
  ["Admin", "Secretaria"].includes(usuarioAuth.rol);

const limpiarTextoOpcional = (valor: unknown) => {
  if (typeof valor !== "string") {
    return null;
  }

  const texto = valor.trim();
  return texto === "" ? null : texto;
};

const aNumero = (valor: unknown) => Number(valor ?? 0);

const redondearMoneda = (valor: number) => Math.round(valor * 100) / 100;

const pedidoTienePagoInicial = (pedido: {
  total: unknown;
  totalPagado: unknown;
}) => {
  const total = redondearMoneda(aNumero(pedido.total));
  const totalPagado = redondearMoneda(aNumero(pedido.totalPagado));
  const minimo = redondearMoneda(total * 0.5);

  return totalPagado >= minimo || totalPagado >= total;
};

const validarId = (id: number, mensaje: string) => {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(mensaje);
  }
};

export class DisenoService {
  private obtenerUsuario(usuarioAuth: AuthUser | undefined) {
    if (!usuarioAuth) {
      throw new Error("Usuario no autenticado.");
    }

    return usuarioAuth;
  }

  validarAccesoClienteAlPedido(
    pedido: { idCliente: number },
    user: AuthUser,
    mensaje = "No tienes permiso para consultar este diseño.",
  ) {
    if (esCliente(user) && Number(pedido.idCliente) !== Number(user.idUsuario)) {
      throw new Error(mensaje);
    }
  }

  private validarAccesoConsultaDiseno(
    diseno: {
      idDisenador: number | null;
      pedido: { cliente: { idCliente: number } };
    },
    user: AuthUser,
  ) {
    if (
      esCliente(user) &&
      Number(diseno.pedido.cliente.idCliente) !== Number(user.idUsuario)
    ) {
      throw new Error("No tienes permiso para consultar este diseño.");
    }

    if (
      esDisenador(user) &&
      diseno.idDisenador !== null &&
      Number(diseno.idDisenador) !== Number(user.idUsuario)
    ) {
      throw new Error("No tienes permiso para consultar este diseño.");
    }
  }

  private validarAccesoEdicionDiseno(
    diseno: { idDisenador: number | null },
    user: AuthUser,
  ) {
    if (
      esDisenador(user) &&
      diseno.idDisenador !== null &&
      Number(diseno.idDisenador) !== Number(user.idUsuario)
    ) {
      throw new Error("No tienes permiso para consultar este diseño.");
    }
  }

  async validarDisenador(idUsuario: number) {
    const disenador = await disenoRepository.buscarUsuarioDisenador(idUsuario);

    if (!disenador) {
      throw new Error("El diseñador indicado no existe o no tiene rol Diseñador.");
    }

    return disenador;
  }

  async crearDiseno(data: DatosEntrada, usuarioAuth: AuthUser | undefined) {
    const user = this.obtenerUsuario(usuarioAuth);
    const error = validarCrearDiseno(data, user.rol);

    if (error) {
      throw new Error(error);
    }

    const idPedido = Number(data.idPedido);
    const pedido = await disenoRepository.buscarPedidoPorId(idPedido);

    if (!pedido) {
      throw new Error("Pedido no encontrado.");
    }

    if (pedido.estadoPedido !== ESTADO_PEDIDO_PENDIENTE) {
      throw new Error("Solo se pueden crear diseños para pedidos PENDIENTE.");
    }

    const tienePagoInicial = await abonoService.pedidoTienePagoInicialValido(
      idPedido,
    );

    if (!tienePagoInicial) {
      throw new Error("El pedido requiere un abono confirmado mínimo del 50% o pago completo antes de crear el diseño.");
    }

    let idDisenador: number | null = null;

    if (esDisenador(user)) {
      idDisenador = Number(user.idUsuario);
    }

    if (puedeGestionarDisenos(user) && data.idDisenador !== undefined) {
      idDisenador = Number(data.idDisenador);
      await this.validarDisenador(idDisenador);
    }

    const archivoUrl = limpiarTextoOpcional(data.archivoUrl);
    const estado = archivoUrl ? ESTADO_DISENO_ENVIADO : ESTADO_DISENO_PENDIENTE;

    return await disenoRepository.crearDiseno({
      idPedido,
      idDisenador,
      archivoUrl,
      descripcion: limpiarTextoOpcional(data.descripcion),
      observaciones: limpiarTextoOpcional(data.observaciones),
      estado,
      fechaEnvio: archivoUrl ? new Date() : null,
    });
  }

  async listarDisenos(
    filtrosEntrada: DatosEntrada,
    usuarioAuth: AuthUser | undefined,
  ) {
    const user = this.obtenerUsuario(usuarioAuth);
    const error = validarFiltrosDiseno(filtrosEntrada);

    if (error) {
      throw new Error(error);
    }

    const filtros: DisenoFiltros = {};

    if (filtrosEntrada.idPedido !== undefined) {
      filtros.idPedido = Number(filtrosEntrada.idPedido);
    }

    if (filtrosEntrada.estado !== undefined) {
      filtros.estado = filtrosEntrada.estado as EstadoDisenoPermitido;
    }

    if (filtrosEntrada.idDisenador !== undefined) {
      filtros.idDisenador = Number(filtrosEntrada.idDisenador);
    }

    const disenos = await disenoRepository.listarDisenos(
      filtros,
      esDisenador(user) ? Number(user.idUsuario) : undefined,
    );

    if (disenos.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    return disenos;
  }

  async listarPorPedido(idPedido: number, usuarioAuth: AuthUser | undefined) {
    const user = this.obtenerUsuario(usuarioAuth);
    validarId(idPedido, "El ID del pedido no es valido.");

    const pedido = await disenoRepository.buscarPedidoPorId(idPedido);

    if (!pedido) {
      throw new Error("Pedido no encontrado.");
    }

    this.validarAccesoClienteAlPedido(pedido, user);

    return await disenoRepository.listarPorPedido(
      idPedido,
      esDisenador(user) ? Number(user.idUsuario) : undefined,
    );
  }

  async buscarPorId(idDiseno: number, usuarioAuth: AuthUser | undefined) {
    const user = this.obtenerUsuario(usuarioAuth);
    validarId(idDiseno, "El ID del diseño no es valido.");

    const diseno = await disenoRepository.buscarPorId(idDiseno);

    if (!diseno) {
      throw new Error("Diseño no encontrado.");
    }

    this.validarAccesoConsultaDiseno(diseno, user);

    return diseno;
  }

  async actualizarDiseno(
    idDiseno: number,
    data: DatosEntrada,
    usuarioAuth: AuthUser | undefined,
  ) {
    const user = this.obtenerUsuario(usuarioAuth);
    validarId(idDiseno, "El ID del diseño no es valido.");

    const error = validarActualizarDiseno(data);

    if (error) {
      throw new Error(error);
    }

    const diseno = await disenoRepository.buscarPorId(idDiseno);

    if (!diseno) {
      throw new Error("Diseño no encontrado.");
    }

    this.validarAccesoEdicionDiseno(diseno, user);

    if (diseno.estado === ESTADO_APROBADO_DISENO) {
      throw new Error("Solo se pueden editar diseños no aprobados.");
    }

    const dataActualizar: ActualizarDisenoData = {};
    const archivoUrl = limpiarTextoOpcional(data.archivoUrl);

    if (data.archivoUrl !== undefined) {
      dataActualizar.archivoUrl = archivoUrl;

      if (archivoUrl) {
        dataActualizar.estado = ESTADO_DISENO_ENVIADO;
        dataActualizar.fechaEnvio = diseno.fechaEnvio ?? new Date();
      }
    }

    if (data.descripcion !== undefined) {
      dataActualizar.descripcion = limpiarTextoOpcional(data.descripcion);
    }

    if (data.observaciones !== undefined) {
      dataActualizar.observaciones = limpiarTextoOpcional(data.observaciones);
    }

    return await disenoRepository.actualizarDiseno(idDiseno, dataActualizar);
  }

  async aprobarDiseno(
    idDiseno: number,
    usuarioAuth: AuthUser | undefined,
    data: DatosEntrada = {},
  ) {
    const user = this.obtenerUsuario(usuarioAuth);
    validarId(idDiseno, "El ID del diseño no es valido.");

    const error = validarAprobarDiseno(data);

    if (error) {
      throw new Error(error);
    }

    return await runPrismaTransaction(async (tx: Prisma.TransactionClient) => {
      const diseno = await disenoRepository.buscarPorId(idDiseno, tx);

      if (!diseno) {
        throw new Error("Diseño no encontrado.");
      }

      if (
        esCliente(user) &&
        Number(diseno.pedido.cliente.idCliente) !== Number(user.idUsuario)
      ) {
        throw new Error("No tienes permiso para aprobar este diseño.");
      }

      if (diseno.estado !== ESTADO_DISENO_ENVIADO) {
        throw new Error("Solo se pueden aprobar diseños enviados.");
      }

      if (diseno.pedido.estadoPedido !== ESTADO_PEDIDO_PENDIENTE) {
        throw new Error("El pedido debe estar PENDIENTE para aprobar diseño.");
      }

      const disenoAprobadoExistente =
        await disenoRepository.buscarDisenoAprobadoPorPedido(
          diseno.idPedido,
          tx,
        );

      if (
        disenoAprobadoExistente &&
        disenoAprobadoExistente.idDiseno !== idDiseno
      ) {
        throw new Error("El pedido ya tiene un diseño aprobado.");
      }

      const dataActualizar: ActualizarDisenoData = {
        estado: ESTADO_APROBADO_DISENO,
        fechaAprobacion: new Date(),
      };

      if (data.observaciones !== undefined) {
        dataActualizar.observaciones = limpiarTextoOpcional(data.observaciones);
      }

      const disenoActualizado = await disenoRepository.actualizarDiseno(
        idDiseno,
        dataActualizar,
        tx,
      );

      const tienePagoInicial = pedidoTienePagoInicial(diseno.pedido);

      let pedido = await disenoRepository.buscarPedidoCompleto(
        diseno.idPedido,
        tx,
      );

      if (tienePagoInicial && pedido?.estadoPedido === ESTADO_PEDIDO_PENDIENTE) {
        pedido = await disenoRepository.actualizarEstadoPedido(
          diseno.idPedido,
          ESTADO_PEDIDO_EN_PROCESO,
          tx,
        );
      }

      return {
        diseno: disenoActualizado,
        pedido,
        pasoAProduccion: Boolean(
          tienePagoInicial && pedido?.estadoPedido === ESTADO_PEDIDO_EN_PROCESO,
        ),
      };
    });
  }

  async eliminarDiseno(idDiseno: number, usuarioAuth: AuthUser | undefined) {
    this.obtenerUsuario(usuarioAuth);
    validarId(idDiseno, "El ID del diseño no es valido.");

    const diseno = await disenoRepository.buscarPorId(idDiseno);

    if (!diseno) {
      throw new Error("Diseño no encontrado.");
    }

    if (diseno.estado === ESTADO_APROBADO_DISENO) {
      throw new Error("Solo se pueden eliminar diseños no aprobados.");
    }

    await disenoRepository.eliminarDiseno(idDiseno);

    return diseno;
  }

  async listarProduccionPendiente(usuarioAuth: AuthUser | undefined) {
    const user = this.obtenerUsuario(usuarioAuth);

    return await disenoRepository.listarProduccionPendiente(
      esDisenador(user) ? Number(user.idUsuario) : undefined,
    );
  }
}
