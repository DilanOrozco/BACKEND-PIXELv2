import {
  CompraRepository,
  type ActualizarCompraData,
  type CompraFiltros,
  type DetalleCompraData,
} from "../../infrastructure/repositories/compra.repository";
import {
  type EstadoCompraPermitido,
  validarActualizarCompra,
  validarAnularCompra,
  validarCrearCompra,
  validarFiltrosCompra,
  validarFiltrosResumenCompra,
} from "../validators/compra.validator";

type DatosEntrada = Record<string, unknown>;

interface AuthUser {
  idUsuario: number;
  rol: string;
}

interface CompraConsulta {
  idCompra: number;
  idPedido: number;
  estado: string;
  fechaCompra: Date;
  observaciones: string | null;
  pedido?: {
    idPedido: number;
    estadoPedido: string;
    estadoPago: string;
    cliente?: {
      idCliente: number;
      nombre: string;
      correo: string | null;
      telefono: string | null;
    };
  };
  detalles?: {
    idDetalleCompra: number;
    descripcionInsumo: string;
    cantidad: number;
  }[];
}

const compraRepository = new CompraRepository();

const ESTADO_COMPRA_PENDIENTE = "PENDIENTE" as const;
const ESTADO_COMPRA_COMPRADA = "COMPRADA" as const;
const ESTADO_PEDIDO_FINALIZADO = "FINALIZADO" as const;

const puedeGestionarCompras = (usuarioAuth: AuthUser) =>
  ["Admin", "Secretaria"].includes(usuarioAuth.rol);

const esDisenador = (usuarioAuth: AuthUser) =>
  usuarioAuth.rol === "Dise\u00f1ador" ||
  usuarioAuth.rol === "Dise\u00c3\u00b1ador";

const esCliente = (usuarioAuth: AuthUser) => usuarioAuth.rol === "Cliente";

const validarId = (id: number, mensaje: string) => {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(mensaje);
  }
};

const redondearMoneda = (valor: number) => Math.round(valor * 100) / 100;

const limpiarTextoOpcional = (valor: unknown) => {
  if (valor === undefined || valor === null) {
    return null;
  }

  if (typeof valor !== "string") {
    return null;
  }

  const texto = valor.trim();
  return texto === "" ? null : texto;
};

const fechaDesde = (valor: unknown) => {
  if (typeof valor !== "string" || valor.trim() === "") {
    return undefined;
  }

  return new Date(valor);
};

const fechaHasta = (valor: unknown) => {
  if (typeof valor !== "string" || valor.trim() === "") {
    return undefined;
  }

  const fecha = new Date(valor);

  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    fecha.setUTCHours(23, 59, 59, 999);
  }

  return fecha;
};

const agregarObservacionAuditoria = (
  observacionesActuales: string | null | undefined,
  observacionNueva: unknown,
  usuarioAuth: AuthUser,
  accion: string,
) => {
  const texto = limpiarTextoOpcional(observacionNueva);

  if (!texto) {
    return observacionesActuales ?? null;
  }

  const actor = `${usuarioAuth.rol} #${usuarioAuth.idUsuario}`;
  const entrada = `[${new Date().toISOString()}] ${accion} (${actor}): ${texto}`;

  return observacionesActuales ? `${observacionesActuales}\n${entrada}` : entrada;
};

const prepararDetalles = (detallesEntrada: unknown) => {
  const detalles = (detallesEntrada as Record<string, unknown>[]).map(
    (detalle): DetalleCompraData => {
      const cantidad = Number(detalle.cantidad);
      const costoUnitario = redondearMoneda(Number(detalle.costoUnitario));

      return {
        descripcionInsumo: String(detalle.descripcionInsumo).trim(),
        cantidad,
        costoUnitario,
        subtotal: redondearMoneda(cantidad * costoUnitario),
      };
    },
  );

  const total = redondearMoneda(
    detalles.reduce((acumulado, detalle) => acumulado + detalle.subtotal, 0),
  );

  return { detalles, total };
};

const prepararFiltros = (filtrosEntrada: DatosEntrada): CompraFiltros => {
  const filtros: CompraFiltros = {};

  if (filtrosEntrada.idPedido !== undefined) {
    filtros.idPedido = Number(filtrosEntrada.idPedido);
  }

  if (filtrosEntrada.idProveedor !== undefined) {
    filtros.idProveedor = Number(filtrosEntrada.idProveedor);
  }

  if (filtrosEntrada.estado !== undefined) {
    filtros.estado = filtrosEntrada.estado as EstadoCompraPermitido;
  }

  if (filtrosEntrada.compradoPorId !== undefined) {
    filtros.compradoPorId = Number(filtrosEntrada.compradoPorId);
  }

  const desde = fechaDesde(filtrosEntrada.desde);
  const hasta = fechaHasta(filtrosEntrada.hasta);

  if (desde) {
    filtros.desde = desde;
  }

  if (hasta) {
    filtros.hasta = hasta;
  }

  return filtros;
};

export class CompraService {
  private obtenerUsuario(usuarioAuth: AuthUser | undefined) {
    if (!usuarioAuth) {
      throw new Error("Usuario no autenticado.");
    }

    return usuarioAuth;
  }

  private validarAccesoConsulta(user: AuthUser) {
    if (esCliente(user)) {
      throw new Error("No tienes permiso para consultar esta compra.");
    }
  }

  private validarAccesoGestion(user: AuthUser) {
    if (!puedeGestionarCompras(user)) {
      throw new Error("No tienes permisos para gestionar compras.");
    }
  }

  private sanitizarCompraParaDisenador(compra: CompraConsulta) {
    return {
      idCompra: compra.idCompra,
      idPedido: compra.idPedido,
      estado: compra.estado,
      fechaCompra: compra.fechaCompra,
      observaciones: compra.observaciones,
      pedido: compra.pedido
        ? {
            idPedido: compra.pedido.idPedido,
            estadoPedido: compra.pedido.estadoPedido,
            estadoPago: compra.pedido.estadoPago,
            cliente: compra.pedido.cliente,
          }
        : undefined,
      detalles: compra.detalles?.map((detalle) => ({
        idDetalleCompra: detalle.idDetalleCompra,
        descripcionInsumo: detalle.descripcionInsumo,
        cantidad: detalle.cantidad,
      })),
    };
  }

  private prepararRespuestaConsulta<T extends CompraConsulta>(
    compra: T,
    user: AuthUser,
  ) {
    return esDisenador(user) ? this.sanitizarCompraParaDisenador(compra) : compra;
  }

  private prepararRespuestaListado<T extends CompraConsulta>(
    compras: T[],
    user: AuthUser,
  ) {
    return esDisenador(user)
      ? compras.map((compra) => this.sanitizarCompraParaDisenador(compra))
      : compras;
  }

  private async validarPedidoDisponible(idPedido: number) {
    const pedido = await compraRepository.buscarPedidoPorId(idPedido);

    if (!pedido) {
      throw new Error("Pedido no encontrado.");
    }

    if (pedido.estadoPedido === ESTADO_PEDIDO_FINALIZADO) {
      throw new Error("No se pueden registrar compras para pedidos finalizados.");
    }

    return pedido;
  }

  private async validarProveedorActivo(idProveedor: number) {
    const proveedor = await compraRepository.buscarProveedorPorId(idProveedor);

    if (!proveedor) {
      throw new Error("Proveedor no encontrado.");
    }

    if (!proveedor.estado) {
      throw new Error(
        "El proveedor esta inactivo y no puede usarse en nuevas compras.",
      );
    }

    return proveedor;
  }

  async crearCompra(data: DatosEntrada, usuarioAuth: AuthUser | undefined) {
    const user = this.obtenerUsuario(usuarioAuth);
    this.validarAccesoGestion(user);

    const error = validarCrearCompra(data);

    if (error) {
      throw new Error(error);
    }

    const idPedido = Number(data.idPedido);
    const idProveedor = Number(data.idProveedor);
    await this.validarPedidoDisponible(idPedido);
    await this.validarProveedorActivo(idProveedor);

    const { detalles, total } = prepararDetalles(data.detalles);
    const estado = data.confirmar === true
      ? ESTADO_COMPRA_COMPRADA
      : ESTADO_COMPRA_PENDIENTE;

    return await compraRepository.crearCompra({
      idPedido,
      idProveedor,
      compradoPorId: Number(user.idUsuario),
      estado,
      total,
      observaciones: limpiarTextoOpcional(data.observaciones),
      detalles,
    });
  }

  async listarCompras(
    filtrosEntrada: DatosEntrada,
    usuarioAuth: AuthUser | undefined,
  ) {
    const user = this.obtenerUsuario(usuarioAuth);
    this.validarAccesoConsulta(user);

    const error = validarFiltrosCompra(filtrosEntrada);

    if (error) {
      throw new Error(error);
    }

    if (esDisenador(user) && filtrosEntrada.idPedido === undefined) {
      throw new Error("El disenador solo puede consultar compras por pedido.");
    }

    const compras = await compraRepository.listarCompras(
      prepararFiltros(filtrosEntrada),
    );

    if (compras.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    return this.prepararRespuestaListado(compras, user);
  }

  async listarPorPedido(
    idPedido: number,
    usuarioAuth: AuthUser | undefined,
  ) {
    const user = this.obtenerUsuario(usuarioAuth);
    this.validarAccesoConsulta(user);
    validarId(idPedido, "El ID del pedido no es valido.");

    const pedido = await compraRepository.buscarPedidoPorId(idPedido);

    if (!pedido) {
      throw new Error("Pedido no encontrado.");
    }

    const compras = await compraRepository.listarPorPedido(idPedido);

    return this.prepararRespuestaListado(compras, user);
  }

  async buscarPorId(idCompra: number, usuarioAuth: AuthUser | undefined) {
    const user = this.obtenerUsuario(usuarioAuth);
    this.validarAccesoConsulta(user);
    validarId(idCompra, "El ID de la compra no es valido.");

    const compra = await compraRepository.buscarPorId(idCompra);

    if (!compra) {
      throw new Error("Compra no encontrada.");
    }

    return this.prepararRespuestaConsulta(compra, user);
  }

  async actualizarCompra(
    idCompra: number,
    data: DatosEntrada,
    usuarioAuth: AuthUser | undefined,
  ) {
    const user = this.obtenerUsuario(usuarioAuth);
    this.validarAccesoGestion(user);
    validarId(idCompra, "El ID de la compra no es valido.");

    const error = validarActualizarCompra(data);

    if (error) {
      throw new Error(error);
    }

    const compra = await compraRepository.buscarPorId(idCompra);

    if (!compra) {
      throw new Error("Compra no encontrada.");
    }

    if (compra.estado !== ESTADO_COMPRA_PENDIENTE) {
      throw new Error("Solo se pueden actualizar compras pendientes.");
    }

    const dataActualizar: ActualizarCompraData = {};

    if (data.idProveedor !== undefined) {
      const idProveedor = Number(data.idProveedor);
      await this.validarProveedorActivo(idProveedor);
      dataActualizar.idProveedor = idProveedor;
    }

    if (data.observaciones !== undefined) {
      dataActualizar.observaciones = limpiarTextoOpcional(data.observaciones);
    }

    if (data.detalles !== undefined) {
      const { detalles, total } = prepararDetalles(data.detalles);
      dataActualizar.detalles = detalles;
      dataActualizar.total = total;
    }

    return await compraRepository.actualizarCompra(idCompra, dataActualizar);
  }

  async confirmarCompra(
    idCompra: number,
    usuarioAuth: AuthUser | undefined,
  ) {
    const user = this.obtenerUsuario(usuarioAuth);
    this.validarAccesoGestion(user);
    validarId(idCompra, "El ID de la compra no es valido.");

    const compra = await compraRepository.buscarPorId(idCompra);

    if (!compra) {
      throw new Error("Compra no encontrada.");
    }

    if (compra.estado !== ESTADO_COMPRA_PENDIENTE) {
      throw new Error("Solo se pueden confirmar compras pendientes.");
    }

    return await compraRepository.confirmarCompra(idCompra);
  }

  async anularCompra(
    idCompra: number,
    data: DatosEntrada,
    usuarioAuth: AuthUser | undefined,
  ) {
    const user = this.obtenerUsuario(usuarioAuth);
    this.validarAccesoGestion(user);
    validarId(idCompra, "El ID de la compra no es valido.");

    const error = validarAnularCompra(data);

    if (error) {
      throw new Error(error);
    }

    const compra = await compraRepository.buscarPorId(idCompra);

    if (!compra) {
      throw new Error("Compra no encontrada.");
    }

    if (compra.estado !== ESTADO_COMPRA_PENDIENTE) {
      throw new Error("Solo se pueden anular compras pendientes.");
    }

    return await compraRepository.anularCompra(
      idCompra,
      agregarObservacionAuditoria(
        compra.observaciones,
        data.observaciones ?? "Compra anulada.",
        user,
        "Anulacion de compra",
      ),
    );
  }

  async eliminarCompra(idCompra: number, usuarioAuth: AuthUser | undefined) {
    const user = this.obtenerUsuario(usuarioAuth);
    this.validarAccesoGestion(user);
    validarId(idCompra, "El ID de la compra no es valido.");

    const compra = await compraRepository.buscarPorId(idCompra);

    if (!compra) {
      throw new Error("Compra no encontrada.");
    }

    if (compra.estado !== ESTADO_COMPRA_PENDIENTE) {
      throw new Error("Solo se pueden eliminar compras pendientes.");
    }

    return await compraRepository.eliminarCompra(idCompra);
  }

  async obtenerResumen(
    filtrosEntrada: DatosEntrada,
    usuarioAuth: AuthUser | undefined,
  ) {
    const user = this.obtenerUsuario(usuarioAuth);
    this.validarAccesoGestion(user);

    const error = validarFiltrosResumenCompra(filtrosEntrada);

    if (error) {
      throw new Error(error);
    }

    return await compraRepository.obtenerResumen(
      prepararFiltros(filtrosEntrada),
    );
  }
}
