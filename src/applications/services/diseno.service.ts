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
  validarUrlDisenoCliente,
} from "../validators/diseno.validator";
import { AbonoService } from "./abono.service";
import { NotificationService } from "./notification.service";
import {
  resolverRequerimientosDiseno,
  type TipoObjetivoDiseno,
} from "../../utils/design-coverage.util";

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
    return origen as
      | "DISENADOR"
      | "PIXEL"
      | "CLIENTE"
      | "ADMIN"
      | "OTRO";
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

  private resolverObjetivoDiseno(pedido: any, data: DatosEntrada) {
    const detalles = pedido.detalles ?? [];
    const estampados = detalles.flatMap((detalle: any) =>
      (detalle.estampados ?? []).map((estampado: any) => ({
        ...estampado,
        detalle,
      })),
    );
    const idDetalleEntrada =
      data.idDetallePedido == null ? null : Number(data.idDetallePedido);
    const idEstampadoEntrada =
      (data.idDetalleEstampadoPedido ?? data.idEstampadoPedido) == null
        ? null
        : Number(
            data.idDetalleEstampadoPedido ??
              data.idEstampadoPedido,
          );
    const grupoEntrada = limpiarTextoOpcional(data.grupoDisenoCompartido);
    let tipo = normalizarMayusculaOpcional(
      data.tipoObjetivo,
    ) as TipoObjetivoDiseno | null;
    let detalle = idDetalleEntrada
      ? detalles.find(
          (item: any) =>
            Number(item.idDetallePedido) === idDetalleEntrada,
        )
      : null;
    let estampado = idEstampadoEntrada
      ? estampados.find(
          (item: any) =>
            Number(item.idDetalleEstampadoPedido) ===
            idEstampadoEntrada,
        )
      : null;

    if (idDetalleEntrada && !detalle) {
      throw new Error("El detalle indicado no pertenece al pedido.");
    }
    if (idEstampadoEntrada && !estampado) {
      throw new Error("El estampado indicado no pertenece al pedido.");
    }
    if (
      estampado &&
      detalle &&
      Number(estampado.detalle.idDetallePedido) !==
        Number(detalle.idDetallePedido)
    ) {
      throw new Error(
        "El estampado no pertenece al producto indicado.",
      );
    }

    if (!tipo) {
      if (idEstampadoEntrada) tipo = "ESTAMPADO";
      else if (grupoEntrada) tipo = "GRUPO_COMPARTIDO";
      else if (data.esDisenoGeneral === true && idDetalleEntrada) {
        tipo = "PRODUCTO_GENERAL";
      } else if (data.esDisenoGeneral === true) {
        tipo = "PEDIDO_GENERAL";
      } else if (idDetalleEntrada) {
        tipo = (detalle?.estampados ?? []).length > 0
          ? "PRODUCTO_GENERAL"
          : "LEGACY_PRODUCTO";
      } else if (detalles.length === 1) {
        detalle = detalles[0];
        tipo = (detalle.estampados ?? []).length > 0
          ? "PRODUCTO_GENERAL"
          : "LEGACY_PRODUCTO";
      } else {
        throw new Error(
          "Debes indicar el objetivo real del diseno.",
        );
      }
    }

    let grupo = grupoEntrada;
    let estampadosCubiertos: any[] = [];
    if (tipo === "ESTAMPADO") {
      if (!estampado) {
        throw new Error(
          "Para un diseno de estampado debes indicar idDetalleEstampadoPedido.",
        );
      }
      if (estampado.grupoDisenoCompartido) {
        throw new Error(
          `El estampado pertenece al grupo ${estampado.grupoDisenoCompartido}; crea un diseno de tipo GRUPO_COMPARTIDO.`,
        );
      }
      detalle = estampado.detalle;
      estampadosCubiertos = [estampado];
    } else if (tipo === "GRUPO_COMPARTIDO") {
      if (!grupo) {
        throw new Error(
          "Para un diseno compartido debes indicar grupoDisenoCompartido.",
        );
      }
      estampadosCubiertos = estampados.filter(
        (item: any) => item.grupoDisenoCompartido === grupo,
      );
      if (estampadosCubiertos.length === 0) {
        throw new Error(
          "El grupo de diseno no pertenece al pedido.",
        );
      }
      const idsDetalle = new Set(
        estampadosCubiertos.map((item: any) =>
          Number(item.detalle.idDetallePedido),
        ),
      );
      detalle =
        idsDetalle.size === 1 ? estampadosCubiertos[0].detalle : null;
    } else if (tipo === "PRODUCTO_GENERAL") {
      if (!detalle) {
        throw new Error(
          "Para un diseno general de producto debes indicar idDetallePedido.",
        );
      }
      estampadosCubiertos = detalle.estampados ?? [];
    } else if (tipo === "PEDIDO_GENERAL") {
      detalle = null;
      estampadosCubiertos = estampados;
    } else {
      if (!detalle) {
        throw new Error(
          "Para un diseno legacy debes indicar idDetallePedido.",
        );
      }
      if ((detalle.estampados ?? []).length > 0) {
        throw new Error(
          "El producto tiene estampados; selecciona un objetivo de diseno actual.",
        );
      }
    }

    const detallesCubiertos = new Set(
      [
        ...(detalle ? [detalle] : []),
        ...(tipo === "PEDIDO_GENERAL"
          ? detalles.filter(
              (item: any) => item.requiereDiseno !== false,
            )
          : []),
        ...estampadosCubiertos.map((item: any) => item.detalle),
      ].map((item: any) => Number(item.idDetallePedido)),
    );
    const requiereDiseno = [...detallesCubiertos].every((idDetalle) =>
      detalles.some(
        (item: any) =>
          Number(item.idDetallePedido) === idDetalle &&
          item.requiereDiseno !== false,
      ),
    );
    if (!requiereDiseno || detallesCubiertos.size === 0) {
      throw new Error(
        "El objetivo seleccionado no requiere diseno.",
      );
    }
    if (
      estampadosCubiertos.some(
        (item: any) =>
          String(item.origenDiseno).toUpperCase() === "NO_REQUIERE",
      )
    ) {
      throw new Error(
        "No puedes crear un diseno sobre un estampado NO_REQUIERE.",
      );
    }

    const disenoGeneralPedidoActivo = (pedido.disenos ?? []).find(
      (diseno: any) =>
        diseno.esDisenoGeneral &&
        diseno.idDetallePedido == null &&
        diseno.estado !== "RECHAZADO",
    );
    const disenoGeneralProductoActivo =
      detalle &&
      tipo !== "PRODUCTO_GENERAL" &&
      (pedido.disenos ?? []).find(
        (diseno: any) =>
          diseno.esDisenoGeneral &&
          Number(diseno.idDetallePedido) ===
            Number(detalle.idDetallePedido) &&
          diseno.estado !== "RECHAZADO",
      );

    if (
      tipo !== "PEDIDO_GENERAL" &&
      (disenoGeneralPedidoActivo || disenoGeneralProductoActivo)
    ) {
      throw new Error(
        "El pedido ya tiene un diseno general pendiente o aprobado que cubre este objetivo.",
      );
    }

    const disenosActivos = (pedido.disenos ?? []).filter(
      (diseno: any) => diseno.estado !== "RECHAZADO",
    );
    if (tipo === "PEDIDO_GENERAL" && disenosActivos.length > 0) {
      throw new Error(
        "No puedes crear un diseno general del pedido mientras existan disenos activos para objetivos especificos.",
      );
    }
    if (tipo === "PRODUCTO_GENERAL" && detalle) {
      const idsEstampados = new Set(
        (detalle.estampados ?? []).map((item: any) =>
          Number(item.idDetalleEstampadoPedido),
        ),
      );
      const gruposDetalle = new Set(
        (detalle.estampados ?? [])
          .map((item: any) => item.grupoDisenoCompartido)
          .filter(Boolean),
      );
      const tieneCoberturaActiva = disenosActivos.some(
        (diseno: any) =>
          Number(diseno.idDetallePedido) ===
            Number(detalle.idDetallePedido) ||
          idsEstampados.has(
            Number(diseno.idDetalleEstampadoPedido),
          ) ||
          gruposDetalle.has(diseno.grupoDisenoCompartido),
      );
      if (tieneCoberturaActiva) {
        throw new Error(
          "No puedes crear un diseno general del producto mientras existan disenos activos para sus estampados.",
        );
      }
    }

    const origenes = new Set(
      (estampadosCubiertos.length > 0
        ? estampadosCubiertos.map((item: any) => item.origenDiseno)
        : [detalle?.origenDiseno]
      ).map((origen) => {
        const valor = String(origen ?? "PENDIENTE_DEFINIR").toUpperCase();
        if (valor === "CLIENTE") return "CLIENTE";
        if (["PIXEL", "DISENADOR", "ADMIN"].includes(valor)) return "PIXEL";
        return "PENDIENTE_DEFINIR";
      }),
    );
    const origenConfigurado =
      origenes.size === 1 ? [...origenes][0] : "PENDIENTE_DEFINIR";
    if (
      origenConfigurado === "PENDIENTE_DEFINIR" &&
      data.origenDiseno === undefined
    ) {
      throw new Error(
        "Debes definir si el diseno sera suministrado por CLIENTE o creado por PIXEL.",
      );
    }

    const coincideObjetivo = (diseno: any) => {
      const estampadoDiseno = estampados.find(
        (item: any) =>
          Number(item.idDetalleEstampadoPedido) ===
          Number(diseno.idDetalleEstampadoPedido),
      );
      const grupoDiseno =
        diseno.grupoDisenoCompartido ??
        estampadoDiseno?.grupoDisenoCompartido ??
        null;
      if (tipo === "PEDIDO_GENERAL") {
        return diseno.esDisenoGeneral && diseno.idDetallePedido == null;
      }
      if (tipo === "PRODUCTO_GENERAL") {
        return (
          Number(diseno.idDetallePedido) ===
            Number(detalle.idDetallePedido) &&
          (diseno.esDisenoGeneral ||
            (!diseno.idDetalleEstampadoPedido && !grupoDiseno))
        );
      }
      if (tipo === "GRUPO_COMPARTIDO") {
        return grupoDiseno === grupo;
      }
      if (tipo === "ESTAMPADO") {
        return (
          Number(diseno.idDetalleEstampadoPedido) ===
          Number(estampado.idDetalleEstampadoPedido)
        );
      }
      return (
        Number(diseno.idDetallePedido) ===
          Number(detalle.idDetallePedido) &&
        !diseno.esDisenoGeneral &&
        !diseno.idDetalleEstampadoPedido &&
        !grupoDiseno
      );
    };
    const versionVigente = [...(pedido.disenos ?? [])]
      .filter(coincideObjetivo)
      .sort(
        (a: any, b: any) =>
          Number(b.idDiseno) - Number(a.idDiseno),
      )[0];
    if (versionVigente && versionVigente.estado !== "RECHAZADO") {
      throw new Error(
        "Este requerimiento ya tiene un diseno activo.",
      );
    }

    return {
      tipoObjetivo: tipo,
      idDetallePedido:
        tipo === "PEDIDO_GENERAL"
          ? null
          : tipo === "GRUPO_COMPARTIDO"
            ? detalle?.idDetallePedido ?? null
            : detalle?.idDetallePedido ?? null,
      idDetalleEstampadoPedido:
        tipo === "ESTAMPADO"
          ? estampado.idDetalleEstampadoPedido
          : null,
      grupoDisenoCompartido:
        tipo === "GRUPO_COMPARTIDO" ? grupo : null,
      esDisenoGeneral:
        tipo === "PRODUCTO_GENERAL" || tipo === "PEDIDO_GENERAL",
      detalle,
      estampadosCubiertos,
      origenConfigurado,
    };
  }

  private async enriquecerDisenosConObjetivo(disenos: any[]) {
    const idsPedido = [
      ...new Set(
        disenos
          .map((diseno) => Number(diseno.idPedido))
          .filter((idPedido) => Number.isInteger(idPedido) && idPedido > 0),
      ),
    ];
    const pedidos =
      await disenoRepository.buscarPedidosParaRequerimientos(idsPedido);
    const pedidoPorId = new Map(
      pedidos.map((pedido) => [Number(pedido.idPedido), pedido]),
    );

    return disenos.map((diseno) => {
      const pedido = pedidoPorId.get(Number(diseno.idPedido));
      if (!pedido) {
        return diseno;
      }

      const resolucion = resolverRequerimientosDiseno(
        pedido.idPedido,
        pedido.detalles,
        pedido.disenos,
      );
      const requerimiento = resolucion.requerimientos.find(
        (item) =>
          item.versiones.some(
            (version: any) =>
              Number(version.idDiseno) === Number(diseno.idDiseno),
          ) ||
          Number(item.disenoCobertura?.idDiseno) ===
            Number(diseno.idDiseno),
      );
      const tipoObjetivo: TipoObjetivoDiseno =
        diseno.esDisenoGeneral && diseno.idDetallePedido == null
          ? "PEDIDO_GENERAL"
          : diseno.esDisenoGeneral
            ? "PRODUCTO_GENERAL"
            : diseno.grupoDisenoCompartido
              ? "GRUPO_COMPARTIDO"
              : diseno.idDetalleEstampadoPedido
                ? "ESTAMPADO"
                : "LEGACY_PRODUCTO";
      const versiones = requerimiento?.versiones ?? [diseno];
      const ordenCronologico = [...versiones].reverse();

      return {
        ...diseno,
        tipoObjetivo,
        idRequerimientoDiseno:
          requerimiento?.idRequerimientoDiseno ??
          (tipoObjetivo === "PEDIDO_GENERAL"
            ? `ORDER-${diseno.idPedido}`
            : null),
        version:
          ordenCronologico.findIndex(
            (item: any) =>
              Number(item.idDiseno) === Number(diseno.idDiseno),
          ) + 1,
        estampadosCubiertos:
          requerimiento?.estampadosCubiertos ??
          resolucion.requerimientos.flatMap((item) =>
            Number(item.disenoCobertura?.idDiseno) ===
            Number(diseno.idDiseno)
              ? item.estampadosCubiertos
              : [],
          ),
        acciones: requerimiento
          ? {
              puedeCrearDiseno: requerimiento.puedeCrearDiseno,
              puedeCargarCorreccion:
                requerimiento.puedeCargarCorreccion,
              puedeRegistrarDisenoCliente:
                requerimiento.puedeRegistrarDisenoCliente,
              puedeDefinirOrigen:
                requerimiento.puedeDefinirOrigen,
              puedeAprobar: requerimiento.puedeAprobar,
            }
          : null,
      };
    });
  }

  async obtenerRequerimientosPedido(
    idPedido: number,
    usuarioAuth: AuthUser | undefined,
  ) {
    const user = this.obtenerUsuario(usuarioAuth);
    validarId(idPedido, "El ID del pedido no es valido.");
    const pedido = await disenoRepository.buscarPedidoPorId(idPedido);

    if (!pedido) {
      throw new Error("Pedido no encontrado.");
    }

    this.validarAccesoClienteAlPedido(pedido, user);

    return resolverRequerimientosDiseno(
      pedido.idPedido,
      pedido.detalles,
      pedido.disenos,
    );
  }

  async definirOrigenRequerimiento(
    idPedido: number,
    idRequerimientoDiseno: string,
    data: DatosEntrada,
    usuarioAuth: AuthUser | undefined,
  ) {
    this.obtenerUsuario(usuarioAuth);
    validarId(idPedido, "El ID del pedido no es valido.");
    const campos = Object.keys(data ?? {});
    if (
      campos.length !== 1 ||
      campos[0] !== "origenDiseno"
    ) {
      throw new Error("Debes enviar solamente origenDiseno.");
    }
    const origenDiseno = normalizarMayusculaOpcional(
      data.origenDiseno,
    );
    if (origenDiseno !== "CLIENTE" && origenDiseno !== "PIXEL") {
      throw new Error("origenDiseno debe ser CLIENTE o PIXEL.");
    }
    const idRequerimiento = String(
      idRequerimientoDiseno ?? "",
    ).trim();
    if (
      !/^(STAMP|GROUP|PRODUCT|LEGACY)-.+$/.test(idRequerimiento)
    ) {
      throw new Error("El requerimiento de diseno no es valido.");
    }

    const pedido = await disenoRepository.buscarPedidoPorId(idPedido);
    if (!pedido) {
      throw new Error("Pedido no encontrado.");
    }
    const resolucion = resolverRequerimientosDiseno(
      pedido.idPedido,
      pedido.detalles,
      pedido.disenos,
    );
    const requerimiento = resolucion.requerimientos.find(
      (item) =>
        item.idRequerimientoDiseno === idRequerimiento,
    );
    if (!requerimiento) {
      throw new Error(
        "El requerimiento no pertenece al pedido.",
      );
    }
    if (requerimiento.origenDiseno !== "PENDIENTE_DEFINIR") {
      throw new Error(
        "El origen de este requerimiento ya fue definido.",
      );
    }
    if (requerimiento.disenoVigente) {
      throw new Error(
        "No puedes cambiar el origen de un requerimiento con un diseno activo.",
      );
    }

    const idsEstampados = requerimiento.estampadosCubiertos.map(
      (item: any) => Number(item.idEstampadoPedido),
    );
    await this.ejecutarTransaccion(
      async (tx: Prisma.TransactionClient) => {
        if (idsEstampados.length > 0) {
          await disenoRepository.actualizarOrigenEstampadosPedido(
            idsEstampados,
            origenDiseno,
            tx,
          );
        }
        if (
          requerimiento.tipo === "PRODUCTO_GENERAL" ||
          requerimiento.tipo === "LEGACY_PRODUCTO"
        ) {
          await disenoRepository.actualizarOrigenDetallePedido(
            Number(requerimiento.idDetallePedido),
            origenDiseno,
            tx,
          );
        }
      },
    );

    const pedidoActualizado =
      await disenoRepository.buscarPedidoPorId(idPedido);
    if (!pedidoActualizado) {
      throw new Error("Pedido no encontrado.");
    }
    const requerimientoActualizado = resolverRequerimientosDiseno(
      pedidoActualizado.idPedido,
      pedidoActualizado.detalles,
      pedidoActualizado.disenos,
    ).requerimientos.find(
      (item) =>
        item.idRequerimientoDiseno === idRequerimiento,
    );

    if (!requerimientoActualizado) {
      throw new Error(
        "No fue posible recargar el requerimiento actualizado.",
      );
    }

    return requerimientoActualizado;
  }

  async registrarDisenoClientePorRequerimiento(
    idPedido: number,
    idRequerimientoDiseno: string,
    data: DatosEntrada,
    usuarioAuth: AuthUser | undefined,
  ) {
    const user = this.obtenerUsuario(usuarioAuth);
    validarId(idPedido, "El ID del pedido no es valido.");
    if (!puedeGestionarDisenos(user) && !esDisenador(user)) {
      throw new Error(
        "No tienes permiso para registrar disenos recibidos del cliente.",
      );
    }
    const error = validarUrlDisenoCliente(data);
    if (error) {
      throw new Error(error);
    }
    const idRequerimiento = String(
      idRequerimientoDiseno ?? "",
    ).trim();
    if (
      !/^(STAMP|GROUP|PRODUCT|LEGACY)-.+$/.test(idRequerimiento)
    ) {
      throw new Error("El requerimiento de diseno no es valido.");
    }

    const pedido = await disenoRepository.buscarPedidoPorId(idPedido);
    if (!pedido) {
      throw new Error("Pedido no encontrado.");
    }
    const resolucion = resolverRequerimientosDiseno(
      pedido.idPedido,
      pedido.detalles,
      pedido.disenos,
    );
    const requerimiento = resolucion.requerimientos.find(
      (item) =>
        item.idRequerimientoDiseno === idRequerimiento,
    );
    if (!requerimiento) {
      throw new Error(
        "El requerimiento no pertenece al pedido.",
      );
    }
    if (requerimiento.origenDiseno !== "CLIENTE") {
      throw new Error(
        "Este requerimiento no esta configurado con diseno del cliente.",
      );
    }
    if (
      requerimiento.disenoVigente &&
      requerimiento.disenoVigente.estado !== ESTADO_RECHAZADO_DISENO
    ) {
      throw new Error(
        "Este requerimiento ya tiene un diseno activo.",
      );
    }

    const ahora = new Date();
    const medioRecepcion =
      normalizarMayusculaOpcional(data.medioRecepcion) ?? "OTRO";
    const dataCrear: CrearDisenoData = {
      idPedido,
      idDetallePedido: requerimiento.idDetallePedido ?? null,
      idDetalleEstampadoPedido:
        requerimiento.tipo === "ESTAMPADO"
          ? requerimiento.idEstampadoPedido
          : null,
      grupoDisenoCompartido:
        requerimiento.tipo === "GRUPO_COMPARTIDO"
          ? requerimiento.grupoDisenoCompartido
          : null,
      esDisenoGeneral:
        requerimiento.tipo === "PRODUCTO_GENERAL",
      idDisenador: null,
      archivoUrl: String(data.archivoDisenoInicialUrl).trim(),
      descripcion:
        "Diseno del cliente registrado por un usuario interno.",
      observaciones: limpiarTextoOpcional(data.observaciones),
      origenDiseno: ORIGEN_DISENO_CLIENTE,
      medioRecepcion,
      recibidoPorId: Number(user.idUsuario),
      fechaRecepcion: ahora,
      observacionesCliente: null,
      estado: ESTADO_DISENO_ENVIADO,
      fechaEnvio: ahora,
    };

    await this.ejecutarTransaccion(
      async (tx: Prisma.TransactionClient) => {
        await disenoRepository.crearDisenoOperacion(dataCrear, tx);
      },
    );

    const pedidoActualizado =
      await disenoRepository.buscarPedidoPorId(idPedido);
    if (!pedidoActualizado) {
      throw new Error("Pedido no encontrado.");
    }
    const requerimientoActualizado = resolverRequerimientosDiseno(
      pedidoActualizado.idPedido,
      pedidoActualizado.detalles,
      pedidoActualizado.disenos,
    ).requerimientos.find(
      (item) =>
        item.idRequerimientoDiseno === idRequerimiento,
    );
    if (!requerimientoActualizado) {
      throw new Error(
        "No fue posible recargar el requerimiento actualizado.",
      );
    }

    return requerimientoActualizado;
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

    const objetivo = this.resolverObjetivoDiseno(pedido, data);

    const tienePagoInicial =
      await abonoService.pedidoTienePagoInicialValido(idPedido);

    if (!tienePagoInicial) {
      throw new Error(
        "El pedido requiere un abono confirmado minimo del 50% o pago completo antes de crear el diseno.",
      );
    }

    const origenDiseno =
      data.origenDiseno === undefined &&
      objetivo.origenConfigurado === "PIXEL"
        ? "PIXEL"
        : data.origenDiseno === undefined &&
            objetivo.origenConfigurado === "CLIENTE"
          ? ORIGEN_DISENO_CLIENTE
          : limpiarOrigenDiseno(data.origenDiseno, user);
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
      idDetallePedido: objetivo.idDetallePedido,
      idDetalleEstampadoPedido:
        objetivo.idDetalleEstampadoPedido,
      grupoDisenoCompartido:
        objetivo.grupoDisenoCompartido,
      esDisenoGeneral: objetivo.esDisenoGeneral,
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

  async registrarUrlDisenoCliente(
    idPedido: number,
    idDetallePedido: number,
    data: DatosEntrada,
    usuarioAuth: AuthUser | undefined,
    registroInterno = false,
  ) {
    const user = this.obtenerUsuario(usuarioAuth);
    validarId(idPedido, "El pedido debe ser valido.");
    validarId(idDetallePedido, "El detalle del pedido debe ser valido.");

    if (
      registroInterno
        ? !puedeGestionarDisenos(user) && !esDisenador(user)
        : !esCliente(user)
    ) {
      throw new Error(
        registroInterno
          ? "No tienes permiso para registrar disenos recibidos del cliente."
          : "Solo un cliente puede registrar su diseno desde este endpoint.",
      );
    }

    const error = validarUrlDisenoCliente(data);

    if (error) {
      throw new Error(error);
    }

    const pedido = await disenoRepository.buscarPedidoPorId(idPedido);

    if (!pedido) {
      throw new Error("Pedido no encontrado.");
    }

    if (!registroInterno) {
      this.validarAccesoClienteAlPedido(
        pedido,
        user,
        "No tienes permiso para modificar este pedido.",
      );
    }

    if (pedido.estadoPedido !== ESTADO_PEDIDO_PENDIENTE) {
      throw new Error(
        "Solo puedes adjuntar o reemplazar el diseno mientras el pedido esta PENDIENTE.",
      );
    }

    const detalle = pedido.detalles.find(
      (item) => Number(item.idDetallePedido) === idDetallePedido,
    );

    if (!detalle) {
      throw new Error("El detalle indicado no pertenece al pedido.");
    }

    if (!detalle.requiereDiseno) {
      throw new Error("Este producto no requiere diseno.");
    }

    if (String(detalle.origenDiseno).toUpperCase() !== ORIGEN_DISENO_CLIENTE) {
      throw new Error("Este producto no esta configurado con diseno del cliente.");
    }

    const esDisenoGeneral = detalle.esDisenoGeneral === true;
    const disenoVigente = (pedido.disenos ?? []).find((diseno) =>
      esDisenoGeneral
        ? diseno.esDisenoGeneral
        : !diseno.esDisenoGeneral &&
          Number(diseno.idDetallePedido) === idDetallePedido,
    );

    if (disenoVigente?.estado === ESTADO_APROBADO_DISENO) {
      throw new Error("El diseno ya fue aprobado y no puede reemplazarse.");
    }

    const archivoUrl = String(data.archivoDisenoInicialUrl).trim();
    const medioRecepcion = registroInterno
      ? normalizarMayusculaOpcional(data.medioRecepcion) ?? "OTRO"
      : "SISTEMA";
    const observaciones = limpiarTextoOpcional(data.observaciones);
    const ahora = new Date();
    const resultado = await this.ejecutarTransaccion(
      async (tx: Prisma.TransactionClient) => {
        await disenoRepository.actualizarArchivoDetallePedido(
          idDetallePedido,
          archivoUrl,
          tx,
        );
        const existente = await disenoRepository.buscarDisenoParaCargaCliente(
          idPedido,
          idDetallePedido,
          esDisenoGeneral,
          tx,
        );

        if (existente && existente.estado !== ESTADO_RECHAZADO_DISENO) {
          return await disenoRepository.actualizarDisenoOperacion(
            existente.idDiseno,
            {
              idDisenador: null,
              archivoUrl,
              observaciones,
              estado: ESTADO_DISENO_ENVIADO,
              origenDiseno: ORIGEN_DISENO_CLIENTE,
              medioRecepcion,
              recibidoPorId: Number(user.idUsuario),
              fechaRecepcion: ahora,
              fechaEnvio: ahora,
              fechaAprobacion: null,
              medioRespuestaCliente: null,
              observacionesCliente: null,
              fechaRespuestaCliente: null,
              respuestaRegistradaPorId: null,
            },
            tx,
          );
        }

        return await disenoRepository.crearDisenoOperacion(
          {
            idPedido,
            idDetallePedido: esDisenoGeneral ? null : idDetallePedido,
            esDisenoGeneral,
            idDisenador: null,
            archivoUrl,
            descripcion: registroInterno
              ? "Diseno del cliente registrado por un usuario interno."
              : "Diseno entregado por el cliente desde su panel.",
            observaciones,
            origenDiseno: ORIGEN_DISENO_CLIENTE,
            medioRecepcion,
            recibidoPorId: Number(user.idUsuario),
            fechaRecepcion: ahora,
            observacionesCliente: null,
            estado: ESTADO_DISENO_ENVIADO,
            fechaEnvio: ahora,
          },
          tx,
        );
      },
    );

    const diseno = await disenoRepository.buscarPorId(resultado.idDiseno);

    if (!diseno) {
      throw new Error("No fue posible cargar el diseno actualizado.");
    }

    return diseno;
  }

  async registrarUrlDisenoRecibidoAdmin(
    idPedido: number,
    idDetallePedido: number,
    data: DatosEntrada,
    usuarioAuth: AuthUser | undefined,
  ) {
    return await this.registrarUrlDisenoCliente(
      idPedido,
      idDetallePedido,
      data,
      usuarioAuth,
      true,
    );
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

    return await this.enriquecerDisenosConObjetivo(disenos);
  }

  async listarPorPedido(idPedido: number, usuarioAuth: AuthUser | undefined) {
    const user = this.obtenerUsuario(usuarioAuth);
    validarId(idPedido, "El ID del pedido no es valido.");

    const pedido = await disenoRepository.buscarPedidoPorId(idPedido);

    if (!pedido) {
      throw new Error("Pedido no encontrado.");
    }

    this.validarAccesoClienteAlPedido(pedido, user);

    const disenos = await disenoRepository.listarPorPedido(
      idPedido,
      esDisenador(user) ? Number(user.idUsuario) : undefined,
    );
    return await this.enriquecerDisenosConObjetivo(disenos);
  }

  async listarDisenosCliente(usuarioAuth: AuthUser | undefined) {
    const user = this.obtenerUsuario(usuarioAuth);

    if (!esCliente(user)) {
      throw new Error("Solo clientes pueden consultar sus disenos en este endpoint.");
    }

    const disenos = await disenoRepository.listarPorCliente(
      idClienteAutenticado(user),
    );
    return await this.enriquecerDisenosConObjetivo(disenos);
  }

  async buscarPorId(idDiseno: number, usuarioAuth: AuthUser | undefined) {
    const user = this.obtenerUsuario(usuarioAuth);
    validarId(idDiseno, "El ID del diseno no es valido.");

    const diseno = await disenoRepository.buscarPorId(idDiseno);

    if (!diseno) {
      throw new Error("Diseno no encontrado.");
    }

    this.validarAccesoConsultaDiseno(diseno, user);

    return (await this.enriquecerDisenosConObjetivo([diseno]))[0];
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

    if (
      diseno.estado === ESTADO_APROBADO_DISENO ||
      diseno.estado === ESTADO_RECHAZADO_DISENO
    ) {
      throw new Error(
        "Los disenos aprobados o rechazados se conservan como historial.",
      );
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
