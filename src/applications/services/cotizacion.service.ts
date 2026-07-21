import { CotizacionRepository } from "../../infrastructure/repositories/cotizacion.repository";
import { TecnicaRepository } from "../../infrastructure/repositories/tecnica.repository";
import { ClienteRepository } from "../../infrastructure/repositories/cliente.repository";
import { ProductoService } from "./producto.service";
import { ClienteAccessService } from "./cliente-access.service";
import { PedidoService } from "./pedido.service";
import { NotificationService } from "./notification.service";
import {
  validarActualizarCotizacion,
  validarCotizar,
  validarCrearCotizacionPresencial,
  validarSolicitudCliente,
} from "../validators/cotizacion.validator";
import {
  paginatedResponse,
  parsePaginationQuery,
  type PaginationQuery,
} from "../../utils/pagination.util";

const cotizacionRepository = new CotizacionRepository();
const clienteRepository = new ClienteRepository();
const tecnicaRepository = new TecnicaRepository();
const pedidoService = new PedidoService();
const notificationService = new NotificationService();
const productoService = new ProductoService();
const clienteAccessService = new ClienteAccessService();

const ESTADO_PENDIENTE = "PENDIENTE";
const ESTADO_APROBADA = "APROBADA";
const ESTADO_ANULADA = "ANULADA";

const TIPO_NORMAL = "NORMAL";

const esCliente = (usuarioAuth: any) => usuarioAuth?.rol === "Cliente";
const idClienteAutenticado = (usuarioAuth: any) =>
  Number(usuarioAuth?.idCliente ?? usuarioAuth?.idUsuario);

const validarId = (idCotizacion: number) => {
  if (!Number.isInteger(idCotizacion) || idCotizacion <= 0) {
    throw new Error("El ID de la cotizacion no es valido.");
  }
};

const aNumero = (valor: any) => Number(valor ?? 0);

const limpiarTextoOpcional = (valor: any) => {
  if (typeof valor !== "string") {
    return null;
  }

  const texto = valor.trim();
  return texto === "" ? null : texto;
};

const limpiarCorreo = (valor: any) => {
  const texto = limpiarTextoOpcional(valor);
  return texto ? texto.toLowerCase() : null;
};

const motivoCambioCotizacion = (valor: any) =>
  limpiarTextoOpcional(valor) ?? "Se realizaron ajustes en la cotizacion.";

const detalleTienePrecios = (detalle: any) => {
  return (
    detalle.precioUnitario !== null &&
    detalle.precioUnitario !== undefined &&
    detalle.costoDiseno !== null &&
    detalle.costoDiseno !== undefined &&
    detalle.subtotal !== null &&
    detalle.subtotal !== undefined
  );
};

const cotizacionTienePrecios = (cotizacion: any) => {
  return cotizacion.detalles.length > 0 && cotizacion.detalles.every(detalleTienePrecios);
};

export class CotizacionService {
  private formatearDetalleCotizacion(detalle: any) {
    if (!detalle) {
      return detalle;
    }

    const subtotal = detalle.subtotal ?? null;
    const descuentoTotal = detalle.descuentoTotal ?? 0;

    return {
      ...detalle,
      descuentoValorUnitario: detalle.descuentoValorUnitario ?? 0,
      subtotalBruto: detalle.subtotalBruto ?? subtotal,
      descuentoTotal,
      subtotalConDescuento:
        detalle.subtotalConDescuento ??
        (subtotal !== null ? aNumero(subtotal) - aNumero(descuentoTotal) : null),
    };
  }

  private formatearCotizacion(cotizacion: any) {
    if (!cotizacion) {
      return cotizacion;
    }

    return {
      ...cotizacion,
      descuentoTotal: cotizacion.descuentoTotal ?? 0,
      detalles: Array.isArray(cotizacion.detalles)
        ? cotizacion.detalles.map((detalle: any) =>
            this.formatearDetalleCotizacion(detalle),
          )
        : cotizacion.detalles,
    };
  }

  private formatearCotizaciones(cotizaciones: any[]) {
    return cotizaciones.map((cotizacion) => this.formatearCotizacion(cotizacion));
  }

  private async asegurarClienteExiste(idCliente: number) {
    const cliente = await clienteRepository.buscarPorId(idCliente);

    if (!cliente) {
      throw new Error("El cliente no existe.");
    }

    return cliente;
  }

  private async asegurarTecnicasExisten(detalles: any[]) {
    const idsTecnicas = [
      ...new Set(detalles.map((detalle) => Number(detalle.idTecnica))),
    ];

    for (const idTecnica of idsTecnicas) {
      const tecnica = await tecnicaRepository.buscarPorId(idTecnica);

      if (!tecnica) {
        throw new Error(`La tecnica con ID ${idTecnica} no existe.`);
      }
    }
  }

  private async resolverClientePresencial(data: any) {
    if (data.idCliente) {
      return await this.asegurarClienteExiste(Number(data.idCliente));
    }

    const clienteEntrada = data.cliente;

    if (
      !clienteEntrada ||
      typeof clienteEntrada !== "object" ||
      Array.isArray(clienteEntrada)
    ) {
      throw new Error("Debes seleccionar o registrar los datos del cliente.");
    }

    if (
      typeof clienteEntrada.nombre !== "string" ||
      clienteEntrada.nombre.trim() === ""
    ) {
      throw new Error("El nombre del cliente es obligatorio.");
    }

    const correo = limpiarCorreo(clienteEntrada.correo);
    const telefono = limpiarTextoOpcional(clienteEntrada.telefono);

    if (!correo && !telefono) {
      throw new Error("Debes enviar correo o telefono del cliente.");
    }

    const clienteExistente =
      await clienteRepository.buscarPorCorreoOTelefono(correo, telefono);

    const cliente = clienteExistente
      ? await clienteRepository.actualizarCliente(clienteExistente.idCliente, {
          nombre: clienteEntrada.nombre.trim(),
          documento: limpiarTextoOpcional(clienteEntrada.documento),
          correo: correo ?? clienteExistente.correo,
          telefono: telefono ?? clienteExistente.telefono,
          direccion: limpiarTextoOpcional(clienteEntrada.direccion),
        })
      : await clienteRepository.crearCliente({
          nombre: clienteEntrada.nombre.trim(),
          documento: limpiarTextoOpcional(clienteEntrada.documento),
          correo,
          telefono,
          direccion: limpiarTextoOpcional(clienteEntrada.direccion),
        });

    return cliente;
  }

  private validarDatosClientePresencial(data: any) {
    if (data.idCliente) {
      return;
    }

    const clienteEntrada = data.cliente;

    if (
      !clienteEntrada ||
      typeof clienteEntrada !== "object" ||
      Array.isArray(clienteEntrada)
    ) {
      throw new Error("Debes seleccionar o registrar los datos del cliente.");
    }

    if (
      typeof clienteEntrada.nombre !== "string" ||
      clienteEntrada.nombre.trim() === ""
    ) {
      throw new Error("El nombre del cliente es obligatorio.");
    }

    const correo = limpiarCorreo(clienteEntrada.correo);
    const telefono = limpiarTextoOpcional(clienteEntrada.telefono);

    if (!telefono) {
      throw new Error("El telefono del cliente es obligatorio para cotizaciones presenciales.");
    }

    if (!correo && !telefono) {
      throw new Error("Debes enviar correo o telefono del cliente.");
    }
  }

  private validarTelefonoClientePresencial(cliente: any) {
    if (typeof cliente?.telefono !== "string" || cliente.telefono.trim() === "") {
      throw new Error("El telefono del cliente es obligatorio para cotizaciones presenciales.");
    }
  }

  private prepararDetallesSolicitud(detalles: any[], incluirIdDetalle = false) {
    return detalles.map((detalle) => {
      const detallePreparado: any = {
        idTecnica: Number(detalle.idTecnica),
        descripcion: detalle.descripcion.trim(),
        cantidad: Number(detalle.cantidad),
        precioUnitario: null,
        costoDiseno: null,
        subtotal: null,
        subtotalBruto: null,
        descuentoValorUnitario: null,
        descuentoTotal: null,
        subtotalConDescuento: null,
        imagenReferencia: limpiarTextoOpcional(detalle.imagenReferencia),
        observaciones: limpiarTextoOpcional(detalle.observaciones),
      };

      if (incluirIdDetalle && detalle.idDetalleCotizacion) {
        detallePreparado.idDetalleCotizacion = Number(
          detalle.idDetalleCotizacion,
        );
      }

      return detallePreparado;
    });
  }

  // Cliente: crea una solicitud sin precios. El idCliente y creadoPorId salen
  // del token, por lo que el body no puede suplantar a otro cliente.
  async crearSolicitudCliente(data: any, usuarioAuth: any) {
    const error = validarSolicitudCliente(data);

    if (error) {
      throw new Error(error);
    }

    const idCliente = idClienteAutenticado(usuarioAuth);
    await this.asegurarClienteExiste(idCliente);
    await this.asegurarTecnicasExisten(data.detalles);

    const detalles = this.prepararDetallesSolicitud(data.detalles);

    const cotizacion = await cotizacionRepository.crearCotizacionConDetalles({
      idCliente,
      creadoPorId: Number(usuarioAuth.idUsuario),
      tipoCotizacion: TIPO_NORMAL,
      estado: ESTADO_PENDIENTE,
      subtotal: 0,
      descuentoTotal: 0,
      costosAdicionales: 0,
      total: 0,
      observaciones: limpiarTextoOpcional(data.observaciones),
      detalles,
    });

    return this.formatearCotizacion(cotizacion);
  }

  // Empleado: crea una cotizacion presencial. Si llega idProducto, se valora
  // con el catalogo; las solicitudes antiguas sin producto conservan el flujo
  // pendiente de cotizar.
  async crearCotizacionNormal(data: any, usuarioAuth: any) {
    const error = validarCrearCotizacionPresencial(data);

    if (error) {
      throw new Error(error);
    }

    this.validarDatosClientePresencial(data);

    await this.asegurarTecnicasExisten(data.detalles);
    const cliente = await this.resolverClientePresencial(data);
    this.validarTelefonoClientePresencial(cliente);
    const detalleEntrada = data.detalles[0];
    const idProducto = detalleEntrada.idProducto === undefined
      ? null
      : Number(detalleEntrada.idProducto);
    const costoDiseno = Math.round(aNumero(detalleEntrada.costoDiseno));
    const costosAdicionales = Math.round(aNumero(data.costosAdicionales));

    const calculo = idProducto
      ? await productoService.calcularItems([
          {
            idProducto,
            cantidad: Number(detalleEntrada.cantidad),
            observaciones: limpiarTextoOpcional(detalleEntrada.observaciones),
          },
        ])
      : null;

    const detalles = calculo
      ? calculo.items.map((item: any) => ({
          idProducto: item.snapshot.idProducto,
          idTecnica: Number(detalleEntrada.idTecnica),
          descripcion: detalleEntrada.descripcion.trim(),
          cantidad: item.snapshot.cantidad,
          precioBase: item.snapshot.precioBase,
          descuentoPorcentaje: item.snapshot.descuentoPorcentaje,
          descuentoValorUnitario: item.snapshot.descuentoValorUnitario,
          precioUnitario: item.snapshot.precioUnitario,
          costoDiseno,
          subtotal: item.snapshot.subtotal,
          subtotalBruto: item.snapshot.subtotalBruto,
          descuentoTotal: item.snapshot.descuentoTotal,
          subtotalConDescuento: item.snapshot.subtotalConDescuento,
          imagenReferencia: limpiarTextoOpcional(detalleEntrada.imagenReferencia),
          observaciones: limpiarTextoOpcional(detalleEntrada.observaciones),
        }))
      : this.prepararDetallesSolicitud(data.detalles);

    const subtotal = calculo ? calculo.subtotal : 0;
    const descuentoTotal = calculo ? calculo.descuentoTotal : 0;
    const total = calculo
      ? Math.round(calculo.total + costoDiseno + costosAdicionales)
      : 0;
    const accesoCliente = calculo
      ? await clienteAccessService.asegurarAccesoCliente(cliente)
      : null;

    const cotizacion = await cotizacionRepository.crearCotizacionConDetalles({
      idCliente: cliente.idCliente,
      creadoPorId: Number(usuarioAuth.idUsuario),
      tipoCotizacion: TIPO_NORMAL,
      estado: ESTADO_PENDIENTE,
      subtotal,
      descuentoTotal,
      costosAdicionales: calculo ? costosAdicionales : 0,
      total,
      observaciones: limpiarTextoOpcional(data.observaciones),
      detalles,
    });

    const cotizacionFormateada = this.formatearCotizacion(cotizacion);

    if (calculo) {
      await notificationService.cotizacionPresencialCreada({
        ...cotizacionFormateada,
        cliente,
        detalles: cotizacionFormateada.detalles ?? detalles,
        accesoCliente,
      });
    }

    return cotizacionFormateada;
  }

  async listarCotizaciones(usuarioAuth: any, query: PaginationQuery = {}) {
    const pagination = parsePaginationQuery(query, {
      defaultSortBy: "idCotizacion",
      allowedSortBy: ["idCotizacion", "fechaCreacion", "total", "estado"],
      maxLimit: 10,
    });
    const filtros = esCliente(usuarioAuth)
      ? { idCliente: idClienteAutenticado(usuarioAuth) }
      : {};

    if (pagination.isPaginated) {
      const resultado = await cotizacionRepository.listarCotizacionesPaginado(
        filtros,
        pagination,
      );

      return paginatedResponse(
        this.formatearCotizaciones(resultado.data),
        pagination,
        resultado.total,
      );
    }

    const cotizaciones = esCliente(usuarioAuth)
      ? await cotizacionRepository.listarPorCliente(idClienteAutenticado(usuarioAuth))
      : await cotizacionRepository.listarCotizaciones();

    if (cotizaciones.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    return { data: this.formatearCotizaciones(cotizaciones) };
  }

  async buscarPorId(idCotizacion: number, usuarioAuth: any) {
    validarId(idCotizacion);

    const cotizacion = await cotizacionRepository.buscarPorId(idCotizacion);

    if (!cotizacion) {
      throw new Error("No se encontraron resultados.");
    }

    if (esCliente(usuarioAuth) && cotizacion.idCliente !== idClienteAutenticado(usuarioAuth)) {
      throw new Error("No tienes permisos para ver esta cotizacion.");
    }

    return this.formatearCotizacion(cotizacion);
  }

  async buscarParcial(termino: string, usuarioAuth: any) {
    if (!termino || termino.trim() === "") {
      throw new Error("Debe ingresar un termino de busqueda.");
    }

    const resultados = await cotizacionRepository.buscarParcial(termino.trim());

    const cotizaciones = esCliente(usuarioAuth)
      ? resultados.filter(
          (item: any) => item.idCliente === idClienteAutenticado(usuarioAuth),
        )
      : resultados;

    if (cotizaciones.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    return this.formatearCotizaciones(cotizaciones);
  }

  // Cliente: puede editar su solicitud mientras siga pendiente y aun no tenga
  // precios asignados. Otra prenda requiere otra cotizacion.
  async editarSolicitudCliente(
    idCotizacion: number,
    data: any,
    usuarioAuth: any,
  ) {
    validarId(idCotizacion);

    const error = validarSolicitudCliente(data, {
      requiereDetalleExistente: true,
    });

    if (error) {
      throw new Error(error);
    }

    const cotizacion = await this.buscarPorId(idCotizacion, usuarioAuth);

    if (cotizacion.estado !== ESTADO_PENDIENTE) {
      throw new Error("Solo se pueden editar cotizaciones en estado PENDIENTE.");
    }

    if (cotizacionTienePrecios(cotizacion)) {
      throw new Error(
        "No se puede editar una cotizacion que ya tiene precios asignados.",
      );
    }

    if (cotizacion.detalles.length !== 1) {
      throw new Error(
        "Esta solicitud no cumple la regla de un unico detalle por cotizacion.",
      );
    }

    const detalleActual = cotizacion.detalles[0];

    if (!detalleActual) {
      throw new Error("La cotizacion no tiene detalle para actualizar.");
    }

    const idDetalleActual = Number(detalleActual.idDetalleCotizacion);
    const idDetalleRecibido = Number(data.detalles[0].idDetalleCotizacion);

    if (idDetalleActual !== idDetalleRecibido) {
      throw new Error(
        "Solo puedes modificar el detalle existente de esta cotizacion.",
      );
    }

    await this.asegurarTecnicasExisten(data.detalles);

    const detalles = this.prepararDetallesSolicitud(data.detalles, true);

    const cotizacionActualizada =
      await cotizacionRepository.actualizarSolicitudCliente(
      idCotizacion,
      {
        observaciones: limpiarTextoOpcional(data.observaciones),
        subtotal: 0,
        costosAdicionales: 0,
        total: 0,
      },
      detalles,
    );

    return this.formatearCotizacion(cotizacionActualizada);
  }

  // Empleado: asigna precios al detalle existente. La cotizacion permanece
  // PENDIENTE hasta que el cliente o la empresa la apruebe o la anule.
  async cotizarCotizacion(idCotizacion: number, data: any) {
    validarId(idCotizacion);

    const error = validarCotizar(data);

    if (error) {
      throw new Error(error);
    }

    const cotizacion = await cotizacionRepository.buscarPorId(idCotizacion);

    if (!cotizacion) {
      throw new Error("No se encontraron resultados.");
    }

    if (cotizacion.estado !== ESTADO_PENDIENTE) {
      throw new Error("Solo se pueden cotizar solicitudes en estado PENDIENTE.");
    }

    const teniaPrecios = cotizacionTienePrecios(cotizacion);
    const totalAnterior = cotizacion.total;

    if (cotizacion.detalles.length !== 1) {
      throw new Error(
        "Esta solicitud no cumple la regla de un unico detalle por cotizacion.",
      );
    }

    const idsActuales = new Set(
      cotizacion.detalles.map((detalle: any) => detalle.idDetalleCotizacion),
    );
    const idsRecibidos = new Set(
      data.detalles.map((detalle: any) =>
        Number(detalle.idDetalleCotizacion),
      ),
    );

    for (const idDetalle of idsActuales) {
      if (!idsRecibidos.has(idDetalle)) {
        throw new Error("Debe cotizar el detalle existente de la solicitud.");
      }
    }

    const detallesCotizados = data.detalles.map((detalle: any) => {
      const detalleActual = cotizacion.detalles.find(
        (item: any) =>
          item.idDetalleCotizacion === Number(detalle.idDetalleCotizacion),
      );

      if (!detalleActual) {
        throw new Error(
          `El detalle ${detalle.idDetalleCotizacion} no pertenece a esta cotizacion.`,
        );
      }

      const cantidad = Number(detalleActual.cantidad);
      const precioUnitario = Number(detalle.precioUnitario);
      const costoDiseno = Number(detalle.costoDiseno);
      const subtotalBruto = aNumero(
        detalleActual.subtotalBruto ??
          detalleActual.subtotal ??
          cantidad * precioUnitario,
      );
      const descuentoTotal = aNumero(detalleActual.descuentoTotal);
      const subtotalConDescuento = aNumero(
        detalleActual.subtotalConDescuento ??
          Math.max(subtotalBruto - descuentoTotal, 0),
      );

      return {
        idDetalleCotizacion: Number(detalle.idDetalleCotizacion),
        precioUnitario,
        costoDiseno,
        subtotal: subtotalBruto,
        subtotalBruto,
        descuentoValorUnitario: aNumero(detalleActual.descuentoValorUnitario),
        descuentoTotal,
        subtotalConDescuento,
        observaciones:
          detalle.observaciones !== undefined
            ? limpiarTextoOpcional(detalle.observaciones)
            : detalleActual.observaciones,
      };
    });

    const subtotal = detallesCotizados.reduce(
      (acc: number, item: any) => acc + item.subtotal,
      0,
    );
    const descuentoTotal = detallesCotizados.reduce(
      (acc: number, item: any) => acc + item.descuentoTotal,
      0,
    );
    const subtotalConDescuento = detallesCotizados.reduce(
      (acc: number, item: any) =>
        acc + item.subtotalConDescuento + item.costoDiseno,
      0,
    );
    const costosAdicionales = aNumero(data.costosAdicionales);
    const total = subtotalConDescuento + costosAdicionales;

    const cotizacionCotizada = await cotizacionRepository.cotizarCotizacion(
      idCotizacion,
      {
        estado: ESTADO_PENDIENTE,
        subtotal,
        descuentoTotal,
        costosAdicionales,
        total,
        observaciones: limpiarTextoOpcional(data.observaciones),
      },
      detallesCotizados,
    );

    const cotizacionFormateada = this.formatearCotizacion(cotizacionCotizada);

    if (teniaPrecios) {
      await notificationService.cotizacionModificada(cotizacionFormateada, {
        motivoCambio: motivoCambioCotizacion(data.motivoCambio),
        totalAnterior,
      });
    }

    return cotizacionFormateada;
  }

  // Admin/Secretaria: actualizacion limitada. No cambia detalles ni estado.
  async actualizarCotizacion(idCotizacion: number, data: any) {
    validarId(idCotizacion);

    const error = validarActualizarCotizacion(data);

    if (error) {
      throw new Error(error);
    }

    const cotizacion = await cotizacionRepository.buscarPorId(idCotizacion);

    if (!cotizacion) {
      throw new Error("No se encontraron resultados.");
    }

    if (cotizacion.estado !== ESTADO_PENDIENTE) {
      throw new Error("Solo se pueden actualizar cotizaciones en estado PENDIENTE.");
    }

    const dataActualizar: any = {};

    if (data.observaciones !== undefined) {
      dataActualizar.observaciones = limpiarTextoOpcional(data.observaciones);
    }

    if (data.costosAdicionales !== undefined) {
      const costosAdicionales = Number(data.costosAdicionales);

      dataActualizar.costosAdicionales = costosAdicionales;
      dataActualizar.total =
        aNumero(cotizacion.subtotal) -
        aNumero(cotizacion.descuentoTotal) +
        costosAdicionales;
    }

    if (Object.keys(dataActualizar).length === 0) {
      throw new Error("Debe enviar al menos un campo visible para actualizar.");
    }

    const cotizacionActualizada = await cotizacionRepository.actualizarCotizacion(
      idCotizacion,
      dataActualizar,
    );

    const cotizacionFormateada = this.formatearCotizacion(cotizacionActualizada);

    await notificationService.cotizacionModificada(cotizacionFormateada, {
      motivoCambio: motivoCambioCotizacion(data.motivoCambio),
      totalAnterior: cotizacion.total,
    });

    return cotizacionFormateada;
  }

  async anularCotizacion(idCotizacion: number, usuarioAuth: any) {
    const cotizacion = await this.buscarPorId(idCotizacion, usuarioAuth);

    if (cotizacion.estado !== ESTADO_PENDIENTE) {
      throw new Error("Solo se pueden anular cotizaciones en estado PENDIENTE.");
    }

    const cotizacionAnulada = await cotizacionRepository.cambiarEstado(
      idCotizacion,
      ESTADO_ANULADA,
    );

    return this.formatearCotizacion(cotizacionAnulada);
  }

  async aprobarCotizacion(idCotizacion: number, usuarioAuth: any) {
    const cotizacion = await this.buscarPorId(idCotizacion, usuarioAuth);

    if (cotizacion.estado !== ESTADO_PENDIENTE) {
      throw new Error("Solo se pueden aprobar cotizaciones en estado PENDIENTE.");
    }

    if (!cotizacionTienePrecios(cotizacion)) {
      throw new Error(
        "Solo se pueden aprobar cotizaciones con precios asignados.",
      );
    }

    const pedidoData = pedidoService.prepararPedidoDesdeCotizacion(
      cotizacion,
      {
        observaciones: `Pedido creado automaticamente al aprobar la cotizacion #${idCotizacion}.`,
      },
      usuarioAuth,
      "Creacion automatica de pedido",
    );

    const resultado = await cotizacionRepository.aprobarYCrearPedido(
      idCotizacion,
      ESTADO_APROBADA,
      pedidoData,
    );

    await notificationService.pedidoCreadoDesdeCotizacion(resultado.pedido);

    return {
      ...resultado,
      cotizacion: this.formatearCotizacion(resultado.cotizacion),
      pedido: pedidoService.formatearPedido(resultado.pedido),
    };
  }

  async eliminarCotizacion(idCotizacion: number) {
    validarId(idCotizacion);

    const cotizacion = await cotizacionRepository.buscarPorId(idCotizacion);

    if (!cotizacion) {
      throw new Error("No se encontraron resultados.");
    }

    await cotizacionRepository.eliminarCotizacion(idCotizacion);

    return this.formatearCotizacion(cotizacion);
  }

}
