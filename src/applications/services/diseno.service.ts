import { runPrismaTransaction } from "../../config/prisma";
import type { Prisma } from "../../../generated/prisma/client";
import {
  DisenoRepository,
  type ActualizarDisenoData,
  type CrearDisenoData,
  type DisenoFiltros,
} from "../../infrastructure/repositories/diseno.repository";
import {
  type EstadoDisenoPermitido,
  validarActualizarDiseno,
  validarAprobarDiseno,
  validarCrearDiseno,
  validarFiltrosDiseno,
  validarRechazarDiseno,
} from "../validators/diseno.validator";
import { AbonoService } from "./abono.service";
import { NotificationService } from "./notification.service";

const disenoRepository = new DisenoRepository();
const abonoService = new AbonoService();
const notificationService = new NotificationService();

const ESTADO_PEDIDO_PENDIENTE = "PENDIENTE" as const;
const ESTADO_PEDIDO_EN_PROCESO = "EN_PROCESO" as const;

const ESTADO_DISENO_PENDIENTE = "PENDIENTE" as const;
const ESTADO_DISENO_ENVIADO = "ENVIADO" as const;
const ESTADO_APROBADO_DISENO = "APROBADO" as const;
const ESTADO_RECHAZADO_DISENO = "RECHAZADO" as const;
const ORIGEN_DISENO_DISENADOR = "DISENADOR" as const;
const ORIGEN_DISENO_CLIENTE = "CLIENTE" as const;
const ORIGEN_DISENO_ADMIN = "ADMIN" as const;
const ESTADOS_RESPONDIBLES_CLIENTE = [
  ESTADO_DISENO_PENDIENTE,
  ESTADO_DISENO_ENVIADO,
] as const;

interface AuthUser {
  idUsuario: number;
  idCliente?: number | null;
  rol: string;
}

type DatosEntrada = Record<string, unknown>;

const esCliente = (usuarioAuth: AuthUser) => usuarioAuth.rol === "Cliente";
const esDisenador = (usuarioAuth: AuthUser) =>
  ["Disenador", "Diseñador", "DiseÃ±ador"].includes(usuarioAuth.rol);
const puedeGestionarDisenos = (usuarioAuth: AuthUser) =>
  ["Admin", "Secretaria"].includes(usuarioAuth.rol);

const idClienteAutenticado = (usuarioAuth: AuthUser) => {
  const idCliente = Number(usuarioAuth.idCliente);

  if (!Number.isInteger(idCliente) || idCliente <= 0) {
    throw new Error("El usuario cliente no tiene un cliente vinculado.");
  }

  return idCliente;
};

const limpiarTextoOpcional = (valor: unknown) => {
  if (typeof valor !== "string") {
    return null;
  }

  const texto = valor.trim();
  return texto === "" ? null : texto;
};

const limpiarMedioRespuesta = (data: DatosEntrada) => {
  const medio = data.medioAprobacion ?? data.medioRespuesta;

  if (typeof medio !== "string") {
    return "SISTEMA";
  }

  const texto = medio.trim().toUpperCase();
  return texto === "" ? "SISTEMA" : texto;
};

const normalizarMayusculaOpcional = (valor: unknown) => {
  if (typeof valor !== "string") {
    return null;
  }

  const texto = valor.trim().toUpperCase();
  return texto === "" ? null : texto;
};

const limpiarOrigenDiseno = (valor: unknown, user: AuthUser) => {
  const origen = normalizarMayusculaOpcional(valor);

  if (origen) {
    return origen as "DISENADOR" | "CLIENTE" | "ADMIN" | "OTRO";
  }

  if (esDisenador(user)) {
    return ORIGEN_DISENO_DISENADOR;
  }

  return ORIGEN_DISENO_ADMIN;
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
  constructor(
    private readonly ejecutarTransaccion = runPrismaTransaction,
  ) {}

  private obtenerUsuario(usuarioAuth: AuthUser | undefined) {
    if (!usuarioAuth) {
      throw new Error("Usuario no autenticado.");
    }

    return usuarioAuth;
  }

  validarAccesoClienteAlPedido(
    pedido: { idCliente: number },
    user: AuthUser,
    mensaje = "No tienes permiso para consultar este diseno.",
  ) {
    if (esCliente(user) && Number(pedido.idCliente) !== idClienteAutenticado(user)) {
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
      Number(diseno.pedido.cliente.idCliente) !== idClienteAutenticado(user)
    ) {
      throw new Error("No tienes permiso para consultar este diseno.");
    }

    if (
      esDisenador(user) &&
      diseno.idDisenador !== null &&
      Number(diseno.idDisenador) !== Number(user.idUsuario)
    ) {
      throw new Error("No tienes permiso para consultar este diseno.");
    }
  }

  private validarAccesoEdicionDiseno(
    diseno: { idDisenador: number | null },
    user: AuthUser,
  ) {
    if (puedeGestionarDisenos(user)) {
      return;
    }

    if (
      esDisenador(user) &&
      (diseno.idDisenador === null ||
        Number(diseno.idDisenador) === Number(user.idUsuario))
    ) {
      return;
    }

    throw new Error("No tienes permiso para gestionar este diseno.");
  }

  async validarDisenador(idUsuario: number) {
    const disenador = await disenoRepository.buscarUsuarioDisenador(idUsuario);

    if (!disenador) {
      throw new Error("El disenador indicado no existe o no tiene rol Disenador.");
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
      throw new Error("Solo se pueden crear disenos para pedidos PENDIENTE.");
    }

    const idDetalleSolicitado =
      data.idDetallePedido === undefined || data.idDetallePedido === null
        ? null
        : Number(data.idDetallePedido);
    const detalleSolicitado = idDetalleSolicitado
      ? pedido.detalles.find(
          (detalle) => detalle.idDetallePedido === idDetalleSolicitado,
        )
      : null;

    if (idDetalleSolicitado && !detalleSolicitado) {
      throw new Error("El detalle indicado no pertenece al pedido.");
    }

    let idDetallePedido = idDetalleSolicitado;

    if (!idDetallePedido && data.esDisenoGeneral !== true) {
      if (pedido.detalles.length === 1) {
        idDetallePedido = pedido.detalles[0]?.idDetallePedido ?? null;
      } else {
        throw new Error(
          "Debes indicar idDetallePedido para pedidos con varios productos o marcar esDisenoGeneral=true.",
        );
      }
    }

    const esDisenoGeneral = data.esDisenoGeneral === true;
    const detalleFinal = idDetallePedido
      ? pedido.detalles.find(
          (detalle) => detalle.idDetallePedido === idDetallePedido,
        )
      : null;

    if (detalleFinal?.requiereDiseno === false) {
      throw new Error(
        "Este producto fue configurado como que no requiere diseno.",
      );
    }

    if (
      esDisenoGeneral &&
      !pedido.detalles.some((detalle) => detalle.requiereDiseno)
    ) {
      throw new Error(
        "El pedido no tiene productos que requieran un diseno general.",
      );
    }

    const disenoVigente = (pedido.disenos ?? []).find((diseno) =>
      esDisenoGeneral
        ? diseno.esDisenoGeneral
        : diseno.esDisenoGeneral ||
          Number(diseno.idDetallePedido) === Number(idDetallePedido),
    );

    if (disenoVigente) {
      throw new Error(
        disenoVigente.esDisenoGeneral
          ? "El pedido ya tiene un diseno general pendiente o aprobado."
          : "Este producto ya tiene un diseno pendiente o aprobado.",
      );
    }

    const tienePagoInicial =
      await abonoService.pedidoTienePagoInicialValido(idPedido);

    if (!tienePagoInicial) {
      throw new Error(
        "El pedido requiere un abono confirmado minimo del 50% o pago completo antes de crear el diseno.",
      );
    }

    const origenDiseno = limpiarOrigenDiseno(data.origenDiseno, user);
    let idDisenador: number | null = null;

    if (origenDiseno === ORIGEN_DISENO_CLIENTE) {
      idDisenador = null;
    } else if (esDisenador(user)) {
      idDisenador = Number(user.idUsuario);
    }

    if (
      origenDiseno !== ORIGEN_DISENO_CLIENTE &&
      puedeGestionarDisenos(user) &&
      data.idDisenador !== undefined
    ) {
      idDisenador = Number(data.idDisenador);
      await this.validarDisenador(idDisenador);
    }

    const archivoUrl = limpiarTextoOpcional(data.archivoUrl);
    const estadoSolicitado = normalizarMayusculaOpcional(data.estado);
    const estado =
      estadoSolicitado === ESTADO_APROBADO_DISENO && puedeGestionarDisenos(user)
        ? ESTADO_APROBADO_DISENO
        : archivoUrl
          ? ESTADO_DISENO_ENVIADO
          : ESTADO_DISENO_PENDIENTE;
    const medioRecepcion = normalizarMayusculaOpcional(data.medioRecepcion);
    const fechaRecepcion =
      origenDiseno === ORIGEN_DISENO_CLIENTE || medioRecepcion ? new Date() : null;
    const fechaRespuesta =
      estado === ESTADO_APROBADO_DISENO ? new Date() : null;

    const dataCrear: CrearDisenoData = {
      idPedido,
      idDetallePedido,
      esDisenoGeneral,
      idDisenador,
      archivoUrl,
      descripcion: limpiarTextoOpcional(data.descripcion),
      observaciones: limpiarTextoOpcional(data.observaciones),
      origenDiseno,
      medioRecepcion,
      recibidoPorId: origenDiseno === ORIGEN_DISENO_CLIENTE ? Number(user.idUsuario) : null,
      fechaRecepcion,
      observacionesCliente: limpiarTextoOpcional(data.observacionesCliente),
      estado,
      fechaEnvio: archivoUrl ? new Date() : null,
      fechaAprobacion: fechaRespuesta,
      fechaRespuestaCliente: fechaRespuesta,
      medioRespuestaCliente:
        estado === ESTADO_APROBADO_DISENO
          ? (medioRecepcion ?? "PRESENCIAL")
          : null,
      respuestaRegistradaPorId:
        estado === ESTADO_APROBADO_DISENO ? Number(user.idUsuario) : null,
    };

    const resultadoCreacion = await this.ejecutarTransaccion(
      async (tx: Prisma.TransactionClient) => {
        const diseno = await disenoRepository.crearDiseno(dataCrear, tx);
        let pasoAProduccion = false;

        if (estado === ESTADO_APROBADO_DISENO) {
          const todosAprobados =
            await disenoRepository.todosDisenosRequeridosAprobados(idPedido, tx);

          if (todosAprobados) {
            await disenoRepository.actualizarEstadoPedido(
              idPedido,
              ESTADO_PEDIDO_EN_PROCESO,
              tx,
            );
            pasoAProduccion = true;
          }
        }

        return { diseno, pasoAProduccion };
      },
    );

    const disenoCreado = resultadoCreacion.diseno;

    if (resultadoCreacion.pasoAProduccion) {
      const pedidoEnProduccion = await disenoRepository.buscarPedidoCompleto(idPedido);

      if (pedidoEnProduccion) {
        try {
          await notificationService.pedidoEnProduccion(pedidoEnProduccion);
        } catch (error) {
          console.error("Error enviando correo de pedido en produccion:", error);
        }
      }
    }

    if (estado === ESTADO_DISENO_ENVIADO) {
      try {
        await notificationService.disenoEnviadoParaRevision(disenoCreado);
      } catch (error) {
        console.error("Error enviando correo de diseno para revision:", error);
      }
    }

    return disenoCreado;
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

  async listarDisenosCliente(usuarioAuth: AuthUser | undefined) {
    const user = this.obtenerUsuario(usuarioAuth);

    if (!esCliente(user)) {
      throw new Error("Solo clientes pueden consultar sus disenos en este endpoint.");
    }

    return await disenoRepository.listarPorCliente(idClienteAutenticado(user));
  }

  async buscarPorId(idDiseno: number, usuarioAuth: AuthUser | undefined) {
    const user = this.obtenerUsuario(usuarioAuth);
    validarId(idDiseno, "El ID del diseno no es valido.");

    const diseno = await disenoRepository.buscarPorId(idDiseno);

    if (!diseno) {
      throw new Error("Diseno no encontrado.");
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
    validarId(idDiseno, "El ID del diseno no es valido.");

    const error = validarActualizarDiseno(data);

    if (error) {
      throw new Error(error);
    }

    const diseno = await disenoRepository.buscarPorId(idDiseno);

    if (!diseno) {
      throw new Error("Diseno no encontrado.");
    }

    this.validarAccesoEdicionDiseno(diseno, user);

    if (diseno.estado === ESTADO_APROBADO_DISENO) {
      throw new Error("Solo se pueden editar disenos no aprobados.");
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

    if (data.origenDiseno !== undefined) {
      dataActualizar.origenDiseno = limpiarOrigenDiseno(data.origenDiseno, user);
    }

    if (data.medioRecepcion !== undefined) {
      dataActualizar.medioRecepcion = normalizarMayusculaOpcional(
        data.medioRecepcion,
      );
      dataActualizar.fechaRecepcion = dataActualizar.medioRecepcion
        ? (diseno.fechaRecepcion ?? new Date())
        : null;
      dataActualizar.recibidoPorId = dataActualizar.medioRecepcion
        ? Number(user.idUsuario)
        : null;
    }

    if (data.observacionesCliente !== undefined) {
      dataActualizar.observacionesCliente = limpiarTextoOpcional(
        data.observacionesCliente,
      );
    }

    const disenoActualizado = await disenoRepository.actualizarDiseno(
      idDiseno,
      dataActualizar,
    );

    if (
      dataActualizar.estado === ESTADO_DISENO_ENVIADO &&
      diseno.estado !== ESTADO_DISENO_ENVIADO
    ) {
      try {
        await notificationService.disenoEnviadoParaRevision(disenoActualizado);
      } catch (error) {
        console.error("Error enviando correo de diseno para revision:", error);
      }
    }

    return disenoActualizado;
  }

  async aprobarDiseno(
    idDiseno: number,
    usuarioAuth: AuthUser | undefined,
    data: DatosEntrada = {},
  ) {
    return await this.responderDisenoCliente(
      idDiseno,
      usuarioAuth,
      data,
      "APROBAR",
    );
  }

  async rechazarDiseno(
    idDiseno: number,
    usuarioAuth: AuthUser | undefined,
    data: DatosEntrada = {},
  ) {
    return await this.responderDisenoCliente(
      idDiseno,
      usuarioAuth,
      data,
      "RECHAZAR",
    );
  }

  private async responderDisenoCliente(
    idDiseno: number,
    usuarioAuth: AuthUser | undefined,
    data: DatosEntrada,
    decision: "APROBAR" | "RECHAZAR",
  ) {
    const user = this.obtenerUsuario(usuarioAuth);
    validarId(idDiseno, "El ID del diseno no es valido.");

    const error =
      decision === "APROBAR"
        ? validarAprobarDiseno(data)
        : validarRechazarDiseno(data);

    if (error) {
      throw new Error(error);
    }

    const resultado = await this.ejecutarTransaccion(async (tx: Prisma.TransactionClient) => {
      const diseno = await disenoRepository.buscarPorIdOperacion(idDiseno, tx);

      if (!diseno) {
        throw new Error("Diseno no encontrado.");
      }

      if (
        esCliente(user) &&
        Number(diseno.pedido.cliente.idCliente) !== idClienteAutenticado(user)
      ) {
        throw new Error("No tienes permiso para responder este diseno.");
      }

      if (!esCliente(user)) {
        this.validarAccesoEdicionDiseno(diseno, user);
      }

      if (
        !ESTADOS_RESPONDIBLES_CLIENTE.includes(
          diseno.estado as (typeof ESTADOS_RESPONDIBLES_CLIENTE)[number],
        )
      ) {
        throw new Error("Solo se pueden responder disenos pendientes o enviados.");
      }

      if (
        decision === "APROBAR" &&
        diseno.pedido.estadoPedido !== ESTADO_PEDIDO_PENDIENTE
      ) {
        throw new Error("El pedido debe estar PENDIENTE para aprobar diseno.");
      }

      if (decision === "APROBAR") {
        const disenoAprobadoExistente =
          await disenoRepository.buscarDisenoAprobadoPorDetalle(
            diseno.idPedido,
            diseno.idDetallePedido,
            tx,
          );

        if (
          disenoAprobadoExistente &&
          disenoAprobadoExistente.idDiseno !== idDiseno
        ) {
          throw new Error("El pedido ya tiene un diseno aprobado.");
        }
      }

      const fechaRespuestaCliente = new Date();
      const dataActualizar: ActualizarDisenoData = {
        estado:
          decision === "APROBAR"
            ? ESTADO_APROBADO_DISENO
            : ESTADO_RECHAZADO_DISENO,
        fechaAprobacion:
          decision === "APROBAR" ? fechaRespuestaCliente : null,
        fechaRespuestaCliente,
        medioRespuestaCliente: limpiarMedioRespuesta(data),
        observacionesCliente:
          limpiarTextoOpcional(data.observacionesCliente) ??
          limpiarTextoOpcional(data.observaciones),
        respuestaRegistradaPorId: esCliente(user) ? null : Number(user.idUsuario),
      };

      if (data.observaciones !== undefined) {
        dataActualizar.observaciones = limpiarTextoOpcional(data.observaciones);
      }

      const disenoActualizado = await disenoRepository.actualizarDisenoOperacion(
        idDiseno,
        dataActualizar,
        tx,
      );

      const tienePagoInicial =
        decision === "APROBAR" && pedidoTienePagoInicial(diseno.pedido);
      const todosDisenosRequeridosAprobados =
        decision === "APROBAR"
          ? await disenoRepository.todosDisenosRequeridosAprobados(
              diseno.idPedido,
              tx,
            )
          : false;

      let estadoPedido = diseno.pedido.estadoPedido;

      if (
        tienePagoInicial &&
        todosDisenosRequeridosAprobados &&
        estadoPedido === ESTADO_PEDIDO_PENDIENTE
      ) {
        const pedidoActualizado = await disenoRepository.actualizarEstadoPedido(
          diseno.idPedido,
          ESTADO_PEDIDO_EN_PROCESO,
          tx,
        );
        estadoPedido = pedidoActualizado.estadoPedido;
      }

      return {
        idDiseno: disenoActualizado.idDiseno,
        idPedido: diseno.idPedido,
        pasoAProduccion: Boolean(
          tienePagoInicial &&
          todosDisenosRequeridosAprobados &&
          estadoPedido === ESTADO_PEDIDO_EN_PROCESO,
        ),
        todosDisenosRequeridosAprobados,
      };
    });

    const [diseno, pedido] = await Promise.all([
      disenoRepository.buscarPorId(resultado.idDiseno),
      disenoRepository.buscarPedidoCompleto(resultado.idPedido),
    ]);

    if (resultado.pasoAProduccion && pedido) {
      try {
        await notificationService.pedidoEnProduccion(pedido);
      } catch (error) {
        console.error("Error enviando correo de pedido en produccion:", error);
      }
    }

    return {
      diseno,
      pedido,
      pasoAProduccion: resultado.pasoAProduccion,
      todosDisenosRequeridosAprobados:
        resultado.todosDisenosRequeridosAprobados,
    };
  }

  async eliminarDiseno(idDiseno: number, usuarioAuth: AuthUser | undefined) {
    this.obtenerUsuario(usuarioAuth);
    validarId(idDiseno, "El ID del diseno no es valido.");

    const diseno = await disenoRepository.buscarPorId(idDiseno);

    if (!diseno) {
      throw new Error("Diseno no encontrado.");
    }

    if (diseno.estado === ESTADO_APROBADO_DISENO) {
      throw new Error("Solo se pueden eliminar disenos no aprobados.");
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
