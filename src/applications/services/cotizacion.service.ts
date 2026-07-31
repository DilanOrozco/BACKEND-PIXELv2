import { CotizacionRepository } from "../../infrastructure/repositories/cotizacion.repository";
import { TecnicaRepository } from "../../infrastructure/repositories/tecnica.repository";
import { ClienteRepository } from "../../infrastructure/repositories/cliente.repository";
import { ProductoService } from "./producto.service";
import { ClienteAccessService } from "./cliente-access.service";
import { CotizacionCalculoInternoService } from "./cotizacion-calculo-interno.service";
import { CotizacionWorkflowService } from "./cotizacion-workflow.service";
import {
  detallesPersistenciaSolicitud,
} from "./public-cotizacion.service";
import { serializarCotizacionCliente } from "../../utils/cotizacion-serializer.util";
import { validarCalcularCotizacionPublica } from "../validators/public-cotizacion.validator";
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
const calculoInternoService = new CotizacionCalculoInternoService();
const workflowService = new CotizacionWorkflowService();

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

    const subtotalConDescuento =
      detalle.subtotalConDescuento ??
      (subtotal !== null ? aNumero(subtotal) - aNumero(descuentoTotal) : null);

    return {
      ...detalle,
      idCategoriaProducto:
        detalle.idCategoriaProducto ??
        detalle.producto?.idCategoriaProducto ??
        detalle.producto?.categoriaProducto?.idCategoriaProducto ??
        null,
      categoriaProducto:
        detalle.categoriaProducto ??
        detalle.producto?.categoriaProducto ??
        null,
      descuentoValorUnitario: detalle.descuentoValorUnitario ?? 0,
      subtotalBruto: detalle.subtotalBruto ?? subtotal,
      descuentoTotal,
      subtotalConDescuento,
      subtotalFinal: subtotalConDescuento,
      rangoDescuentoProducto: detalle.rangoDescuentoAplicado
        ? {
            idRango: detalle.rangoDescuentoAplicado.idRango,
            cantidadMinima:
              detalle.cantidadMinimaDescuentoSnapshot ??
              detalle.rangoDescuentoAplicado.cantidadMin,
            porcentaje: detalle.descuentoPorcentaje ?? 0,
          }
        : detalle.cantidadMinimaDescuentoSnapshot
          ? {
              idRango: detalle.idRangoDescuentoAplicado,
              cantidadMinima: detalle.cantidadMinimaDescuentoSnapshot,
              porcentaje: detalle.descuentoPorcentaje ?? 0,
            }
          : null,
      porcentajeDescuentoProducto: detalle.descuentoPorcentaje ?? 0,
      montoDescuentoProducto: descuentoTotal,
      subtotalServiciosBruto: detalle.subtotalBruto ?? subtotal,
      subtotalServiciosConDescuento: subtotalConDescuento,
      calculoCompleto: !detalle.requiereRevisionPrecio,
    };
  }

  private formatearCotizacion(cotizacion: any) {
    if (!cotizacion) {
      return cotizacion;
    }

    const detalles = Array.isArray(cotizacion.detalles)
      ? cotizacion.detalles.map((detalle: any) =>
          this.formatearDetalleCotizacion(detalle),
        )
      : cotizacion.detalles;
    const costoDiseno = Array.isArray(detalles)
      ? detalles.reduce(
          (total: number, detalle: any) => total + aNumero(detalle.costoDiseno),
          0,
        )
      : 0;
    const subtotalServiciosBrutoSugerido = Array.isArray(detalles)
      ? detalles.reduce(
          (total: number, detalle: any) =>
            total + aNumero(detalle.subtotalServiciosBruto),
          0,
        )
      : 0;
    const montoDescuentoProductoSugerido = Array.isArray(detalles)
      ? detalles.reduce(
          (total: number, detalle: any) =>
            total + aNumero(detalle.montoDescuentoProducto),
          0,
        )
      : 0;
    const subtotalServiciosConDescuentoSugerido = Array.isArray(detalles)
      ? detalles.reduce(
          (total: number, detalle: any) =>
            total + aNumero(detalle.subtotalServiciosConDescuento),
          0,
        )
      : 0;
    const subtotalBruto = cotizacion.subtotal ?? 0;
    const descuentoTotal = cotizacion.descuentoTotal ?? 0;
    const subtotalConDescuento = Math.max(
      aNumero(subtotalBruto) - aNumero(descuentoTotal),
      0,
    );
    const nombresProductos = Array.isArray(detalles)
      ? detalles.map(
          (detalle: any) =>
            detalle.producto?.nombre ?? detalle.descripcion ?? "Producto",
        )
      : [];
    const versionVigente = Array.isArray(cotizacion.versiones)
      ? cotizacion.versiones.find((version: any) => version.esVigente)
      : null;
    const snapshotAdministrativo =
      versionVigente?.snapshotCompleto?.administrativo ?? null;
    const itemsOficiales = new Map<number, any>(
      (snapshotAdministrativo?.items ?? []).map((item: any) => [
        Number(item.idDetalleCotizacion),
        item,
      ]),
    );
    const mensajesRevision: Record<string, string> = {
      PRODUCTO_ESPECIAL: "El producto especial requiere revision.",
      SERVICIOS_PENDIENTES: "Debes definir los servicios del producto.",
      COSTO_DISENO_PENDIENTE: "Define el costo oficial del diseno.",
      MEDIDAS_PENDIENTES: "Debes completar las medidas del estampado.",
      TECNICA_PENDIENTE: "Debes seleccionar una tecnica.",
      TECNICA_INVALIDA: "La tecnica seleccionada no esta disponible.",
      TARIFA_NO_CONFIGURADA: "No existe una tarifa para estas medidas.",
      TARIFA_GENERAL_NO_CONFIGURADA:
        "No existe una tarifa general para esta tecnica.",
      RANGO_DESCUENTO_PRODUCTO_PENDIENTE:
        "El descuento por cantidad requiere revision.",
    };
    const codigosRevision: Record<string, string> = {
      COSTO_DISENO_PENDIENTE: "DESIGN_COST_REQUIRED",
      MEDIDAS_PENDIENTES: "MEASUREMENTS_PENDING",
      TECNICA_PENDIENTE: "TECHNIQUE_PENDING",
      TECNICA_INVALIDA: "TECHNIQUE_PENDING",
      TARIFA_NO_CONFIGURADA: "TARIFF_NOT_FOUND",
      TARIFA_GENERAL_NO_CONFIGURADA: "TARIFF_NOT_FOUND",
    };
    const motivosRevision = Array.isArray(detalles)
      ? detalles.flatMap((detalle: any) => {
          const advertencias = (detalle.estampados ?? []).flatMap(
            (estampado: any) =>
              (Array.isArray(estampado.motivosRevision)
                ? estampado.motivosRevision
                : []
              ).map((motivo: string) => ({
                code: codigosRevision[motivo] ?? motivo,
                idDetalleCotizacion: detalle.idDetalleCotizacion,
                idDetalleEstampadoCotizacion:
                  estampado.idDetalleEstampadoCotizacion,
                grupoDisenoCompartido:
                  estampado.grupoDisenoCompartido ?? null,
                message:
                  mensajesRevision[motivo] ??
                  "Este dato requiere revision administrativa.",
              })),
          );
          const costoProductoDefinido = itemsOficiales.get(
            Number(detalle.idDetalleCotizacion),
          )?.costoProducto;
          if (
            (detalle.suministradoPor ?? "PIXEL") === "PIXEL" &&
            costoProductoDefinido === undefined
          ) {
            advertencias.push({
              code: "PRODUCT_COST_UNDEFINED",
              idDetalleCotizacion: detalle.idDetalleCotizacion,
              idDetalleEstampadoCotizacion: null,
              grupoDisenoCompartido: null,
              message:
                "El costo del producto fisico no ha sido definido; puede quedar incluido en el precio final manual.",
            });
          }
          return advertencias;
        })
      : [];

    return {
      ...cotizacion,
      subtotalBruto,
      descuentoTotal,
      subtotalConDescuento,
      subtotalFinal: subtotalConDescuento,
      costoDiseno,
      subtotalServiciosBrutoSugerido,
      montoDescuentoProductoSugerido,
      subtotalServiciosConDescuentoSugerido,
      costoDisenoSugerido: costoDiseno,
      calculoCompleto: !cotizacion.requiereRevisionPrecio,
      cantidadItems: Array.isArray(detalles) ? detalles.length : 0,
      productosResumen:
        nombresProductos.length <= 2
          ? nombresProductos.join(", ")
          : `${nombresProductos.slice(0, 2).join(", ")} y ${nombresProductos.length - 2} mas`,
      detalles,
      propuestaAdministrativa: {
        precioSugeridoSistema:
          cotizacion.precioSugeridoInterno ?? 0,
        calculoCompleto: !cotizacion.requiereRevisionPrecio,
        requiereRevisionPrecio: Boolean(
          cotizacion.requiereRevisionPrecio,
        ),
        motivosRevision,
        items: Array.isArray(detalles)
          ? detalles.map((detalle: any) => {
              const oficial = itemsOficiales.get(
                Number(detalle.idDetalleCotizacion),
              );
              return {
                idDetalleCotizacion: detalle.idDetalleCotizacion,
                nombre:
                  detalle.producto?.nombre ??
                  detalle.nombrePersonalizado ??
                  detalle.descripcion,
                cantidad: detalle.cantidad,
                suministradoPor: detalle.suministradoPor ?? "PIXEL",
                subtotalServiciosBruto:
                  detalle.subtotalServiciosBruto ?? 0,
                rangoDescuentoAplicado:
                  detalle.rangoDescuentoProducto ?? null,
                porcentajeDescuentoProducto:
                  detalle.porcentajeDescuentoProducto ?? 0,
                montoDescuentoProducto:
                  detalle.montoDescuentoProducto ?? 0,
                subtotalServiciosNeto:
                  oficial?.subtotalServiciosNeto ??
                  detalle.subtotalServiciosConDescuento ??
                  0,
                costoProducto: oficial?.costoProducto ?? null,
                otrosCostosItem: oficial?.otrosCostosItem ?? 0,
                subtotalOficial:
                  oficial?.subtotalOficialItem ??
                  detalle.subtotalServiciosConDescuento ??
                  0,
              };
            })
          : [],
        disenos: snapshotAdministrativo?.disenos ?? [],
        gruposDisenoCompartido: [
          ...new Set(
            (detalles ?? []).flatMap((detalle: any) =>
              (detalle.estampados ?? [])
                .map((estampado: any) =>
                  limpiarTextoOpcional(
                    estampado.grupoDisenoCompartido,
                  ),
                )
                .filter(Boolean),
            ),
          ),
        ],
        conceptosAdicionales:
          snapshotAdministrativo?.conceptosAdicionales ?? [],
        subtotalDesglose:
          snapshotAdministrativo?.subtotalDesglose ?? null,
        ajusteManual: snapshotAdministrativo?.ajusteManual ?? null,
      },
    };
  }

  private formatearCotizaciones(cotizaciones: any[]) {
    return cotizaciones.map((cotizacion) => this.formatearCotizacion(cotizacion));
  }

  private presentarCotizacion(cotizacion: any, usuarioAuth: any) {
    const formateada = this.formatearCotizacion(cotizacion);
    return esCliente(usuarioAuth)
      ? serializarCotizacionCliente(formateada)
      : formateada;
  }

  private presentarCotizaciones(cotizaciones: any[], usuarioAuth: any) {
    return cotizaciones.map((cotizacion) =>
      this.presentarCotizacion(cotizacion, usuarioAuth),
    );
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

    const tecnicas = await tecnicaRepository.buscarActivasPorIds(idsTecnicas);
    const idsEncontrados = new Set(
      tecnicas.map((tecnica) => tecnica.idTecnica),
    );

    for (const idTecnica of idsTecnicas) {
      if (!idsEncontrados.has(idTecnica)) {
        throw new Error(
          `La tecnica con ID ${idTecnica} no existe o esta inactiva.`,
        );
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
        idProducto: detalle.idProducto
          ? Number(detalle.idProducto)
          : undefined,
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
    const items = data.items ?? data.detalles;
    const error = validarCalcularCotizacionPublica({ items });
    if (error) throw new Error(error);

    const cliente = await clienteAccessService.obtenerClienteDeUsuario(
      Number(usuarioAuth.idUsuario),
    );
    const calculo = await calculoInternoService.calcular(
      { items },
    );
    const detalles = detallesPersistenciaSolicitud(calculo);

    const cotizacion = await cotizacionRepository.crearCotizacionConDetalles({
      idCliente: cliente.idCliente,
      creadoPorId: Number(usuarioAuth.idUsuario),
      tipoCotizacion: TIPO_NORMAL,
      estado: "EN_REVISION",
      subtotal: 0,
      descuentoTotal: 0,
      costosAdicionales: 0,
      total: 0,
      precioSugeridoInterno: calculo.precioSugeridoInterno,
      requiereRevisionPrecio: calculo.requiereRevisionPrecio,
      advertenciasInternas: calculo.advertencias,
      observaciones: limpiarTextoOpcional(data.observaciones),
      detalles,
    });

    await notificationService.solicitudCotizacionRecibida({
      ...serializarCotizacionCliente(cotizacion),
      cliente,
    });

    return serializarCotizacionCliente(cotizacion);
  }

  // Empleado: crea una cotizacion presencial. Si todos los detalles incluyen
  // producto, se valoran con el catalogo; solicitudes antiguas sin producto
  // conservan el flujo pendiente de cotizar.
  async crearCotizacionNormal(data: any, usuarioAuth: any) {
    const items = (data.items ?? data.detalles ?? []).map((item: any) =>
      item.idProducto ||
      item.nombrePersonalizado ||
      item.nombreProducto ||
      item.nombre
        ? item
        : {
            ...item,
            tipoProducto: "OTRO",
            nombrePersonalizado: item.descripcion,
          },
    );
    const error = validarCrearCotizacionPresencial({
      ...data,
      detalles: items,
    });
    if (error) throw new Error(error);
    this.validarDatosClientePresencial(data);
    const cliente = await this.resolverClientePresencial(data);
    this.validarTelefonoClientePresencial(cliente);
    const validacionItems = validarCalcularCotizacionPublica({ items });
    if (validacionItems) throw new Error(validacionItems);
    const calculo = await calculoInternoService.calcular(
      { items },
    );
    const detalles = detallesPersistenciaSolicitud(calculo);

    const cotizacion = await cotizacionRepository.crearCotizacionConDetalles({
      idCliente: cliente.idCliente,
      creadoPorId: Number(usuarioAuth.idUsuario),
      tipoCotizacion: TIPO_NORMAL,
      estado: "EN_REVISION",
      subtotal: 0,
      descuentoTotal: 0,
      costosAdicionales: 0,
      total: 0,
      precioSugeridoInterno: calculo.precioSugeridoInterno,
      requiereRevisionPrecio: calculo.requiereRevisionPrecio,
      advertenciasInternas: calculo.advertencias,
      observaciones: limpiarTextoOpcional(data.observaciones),
      detalles,
    });

    const cotizacionFormateada = this.formatearCotizacion(cotizacion);
    await notificationService.solicitudCotizacionRecibida({
      ...serializarCotizacionCliente(cotizacion),
      cliente,
    });

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
        this.presentarCotizaciones(resultado.data, usuarioAuth),
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

    return { data: this.presentarCotizaciones(cotizaciones, usuarioAuth) };
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

    return this.presentarCotizacion(cotizacion, usuarioAuth);
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

    return this.presentarCotizaciones(cotizaciones, usuarioAuth);
  }

  // Cliente: puede editar los detalles existentes mientras la solicitud siga
  // pendiente y aun no tenga precios asignados.
  async editarSolicitudCliente(
    idCotizacion: number,
    data: any,
    usuarioAuth: any,
  ) {
    validarId(idCotizacion);

    const items = data.items ?? data.detalles;
    const error = validarCalcularCotizacionPublica({ items });
    if (error) throw new Error(error);
    const cotizacion = await cotizacionRepository.buscarPorId(idCotizacion);
    if (!cotizacion) throw new Error("No se encontraron resultados.");
    const cliente = await clienteAccessService.obtenerClienteDeUsuario(
      Number(usuarioAuth.idUsuario),
    );
    if (cotizacion.idCliente !== cliente.idCliente) {
      throw new Error("No tienes permisos para editar esta cotizacion.");
    }
    if (
      !["PENDIENTE", "EN_REVISION", "AJUSTE_SOLICITADO", "VENCIDA"].includes(
        cotizacion.estado,
      )
    ) {
      throw new Error(
        "La cotizacion no se puede editar en su estado actual.",
      );
    }

    const calculo = await calculoInternoService.calcular(
      { items },
    );
    const detalles = detallesPersistenciaSolicitud(calculo);

    const cotizacionActualizada =
      await cotizacionRepository.reemplazarSolicitud(
      idCotizacion,
      {
        estado: "EN_REVISION",
        observaciones: limpiarTextoOpcional(data.observaciones),
        subtotal: 0,
        descuentoTotal: 0,
        costosAdicionales: 0,
        total: 0,
        precioSugeridoInterno: calculo.precioSugeridoInterno,
        requiereRevisionPrecio: calculo.requiereRevisionPrecio,
        advertenciasInternas: calculo.advertencias,
      },
      detalles,
    );

    return serializarCotizacionCliente(cotizacionActualizada);
  }

  // Empleado: asigna precios al detalle existente. La cotizacion permanece
  // PENDIENTE hasta que el cliente o la empresa la apruebe o la anule.
  async cotizarCotizacion(
    idCotizacion: number,
    data: any,
    usuarioAuth?: any,
  ) {
    validarId(idCotizacion);

    if (data?.precioFinal !== undefined) {
      return await workflowService.enviarPropuesta(
        idCotizacion,
        data,
        usuarioAuth,
      );
    }

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

    const idsActuales = new Set(
      cotizacion.detalles.map((detalle: any) =>
        Number(detalle.idDetalleCotizacion),
      ),
    );

    for (const detalle of data.detalles) {
      if (
        detalle.idDetalleCotizacion !== undefined &&
        !idsActuales.has(Number(detalle.idDetalleCotizacion))
      ) {
        throw new Error(
          `El detalle ${detalle.idDetalleCotizacion} no pertenece a esta cotizacion.`,
        );
      }
    }

    const detallesResueltos = data.detalles.map((detalle: any) => {
      const detalleActual = detalle.idDetalleCotizacion
        ? cotizacion.detalles.find(
            (item: any) =>
              item.idDetalleCotizacion ===
              Number(detalle.idDetalleCotizacion),
          )
        : null;

      return {
        entrada: detalle,
        actual: detalleActual,
        idProducto: Number(detalle.idProducto ?? detalleActual?.idProducto) || null,
        idTecnica:
          detalle.idTecnica ?? detalleActual?.idTecnica
            ? Number(detalle.idTecnica ?? detalleActual?.idTecnica)
            : null,
        descripcion:
          limpiarTextoOpcional(detalle.descripcion) ??
          detalleActual?.descripcion ??
          null,
        cantidad: Number(detalle.cantidad ?? detalleActual?.cantidad),
        costoDiseno: Math.round(
          aNumero(detalle.costoDiseno ?? detalleActual?.costoDiseno),
        ),
        validarTecnica:
          !detalleActual ||
          (detalle.idTecnica !== undefined &&
            Number(detalle.idTecnica) !== Number(detalleActual.idTecnica)),
      };
    });

    const tecnicasPorValidar = detallesResueltos.filter(
      (detalle: any) => detalle.validarTecnica,
    );

    if (tecnicasPorValidar.length > 0) {
      await this.asegurarTecnicasExisten(tecnicasPorValidar);
    }

    const itemsCatalogo = detallesResueltos.filter(
      (detalle: any) => detalle.idProducto,
    );
    const calculoCatalogo =
      itemsCatalogo.length > 0
        ? await productoService.calcularItems(
            itemsCatalogo.map((detalle: any) => ({
              idProducto: detalle.idProducto,
              idTecnica: detalle.idTecnica,
              cantidad: detalle.cantidad,
              observaciones:
                detalle.entrada.observaciones ??
                detalle.actual?.observaciones,
            })),
          )
        : null;
    let indiceCatalogo = 0;

    const detallesCotizados = detallesResueltos.map((detalle: any) => {
      const observaciones =
        detalle.entrada.observaciones !== undefined
          ? limpiarTextoOpcional(detalle.entrada.observaciones)
          : detalle.actual?.observaciones ?? null;
      const datosComunes = {
        idDetalleCotizacion:
          detalle.actual?.idDetalleCotizacion ?? undefined,
        idProducto: detalle.idProducto,
        idTecnica: detalle.idTecnica,
        descripcion: detalle.descripcion,
        cantidad: detalle.cantidad,
        costoDiseno: detalle.costoDiseno,
        requiereDiseno:
          detalle.entrada.requiereDiseno ??
          detalle.actual?.requiereDiseno ??
          true,
        origenDiseno: String(
          detalle.entrada.origenDiseno ??
            detalle.actual?.origenDiseno ??
            "PIXEL",
        ).toUpperCase(),
        archivoDisenoInicialUrl:
          detalle.entrada.archivoDisenoInicialUrl !== undefined
            ? limpiarTextoOpcional(detalle.entrada.archivoDisenoInicialUrl)
            : detalle.actual?.archivoDisenoInicialUrl ?? null,
        esDisenoGeneral:
          detalle.entrada.esDisenoGeneral ??
          detalle.actual?.esDisenoGeneral ??
          false,
        medioRecepcionDiseno:
          detalle.entrada.medioRecepcionDiseno !== undefined
            ? limpiarTextoOpcional(detalle.entrada.medioRecepcionDiseno)
            : detalle.actual?.medioRecepcionDiseno ?? null,
        imagenReferencia:
          detalle.entrada.imagenReferencia !== undefined
            ? limpiarTextoOpcional(detalle.entrada.imagenReferencia)
            : detalle.actual?.imagenReferencia ?? null,
        observaciones,
      };

      if (detalle.idProducto) {
        const calculado = calculoCatalogo?.items[indiceCatalogo++];

        if (!calculado) {
          throw new Error("No fue posible calcular uno de los productos.");
        }

        return {
          ...datosComunes,
          precioBase: calculado.snapshot.precioBase,
          descuentoPorcentaje: calculado.snapshot.descuentoPorcentaje,
          descuentoValorUnitario: calculado.snapshot.descuentoValorUnitario,
          precioUnitario: calculado.snapshot.precioUnitario,
          subtotal: calculado.snapshot.subtotal,
          subtotalBruto: calculado.snapshot.subtotalBruto,
          descuentoTotal: calculado.snapshot.descuentoTotal,
          subtotalConDescuento: calculado.snapshot.subtotalConDescuento,
        };
      }

      const precioUnitario = Number(detalle.entrada.precioUnitario);

      if (!Number.isFinite(precioUnitario) || precioUnitario < 0) {
        throw new Error(
          `El precio unitario del detalle ${detalle.actual?.idDetalleCotizacion} es obligatorio y no puede ser negativo.`,
        );
      }

      const subtotalBruto = detalle.cantidad * precioUnitario;

      return {
        ...datosComunes,
        precioBase: null,
        descuentoPorcentaje: null,
        descuentoValorUnitario: 0,
        precioUnitario,
        subtotal: subtotalBruto,
        subtotalBruto,
        descuentoTotal: 0,
        subtotalConDescuento: subtotalBruto,
      };
    });

    const subtotal = detallesCotizados.reduce(
      (acc: number, item: any) => acc + aNumero(item.subtotal),
      0,
    );
    const descuentoTotal = detallesCotizados.reduce(
      (acc: number, item: any) => acc + aNumero(item.descuentoTotal),
      0,
    );
    const subtotalConDescuento = detallesCotizados.reduce(
      (acc: number, item: any) =>
        acc +
        aNumero(item.subtotalConDescuento) +
        aNumero(item.costoDiseno),
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

    await notificationService.cotizacionModificada(cotizacionFormateada, {
      motivoCambio: motivoCambioCotizacion(data.motivoCambio),
      totalAnterior: teniaPrecios ? totalAnterior : undefined,
    });

    return cotizacionFormateada;
  }

  // Admin/Secretaria: actualizacion limitada. No cambia detalles ni estado.
  async actualizarCotizacion(idCotizacion: number, data: any) {
    validarId(idCotizacion);

    const cotizacion = await cotizacionRepository.buscarPorId(idCotizacion);

    if (!cotizacion) {
      throw new Error("No se encontraron resultados.");
    }

    const items = data.items ?? data.detalles;
    if (items !== undefined) {
      if (
        ![
          "PENDIENTE",
          "BORRADOR",
          "SOLICITUD_RECIBIDA",
          "EN_REVISION",
          "AJUSTE_SOLICITADO",
          "VENCIDA",
        ].includes(cotizacion.estado)
      ) {
        throw new Error(
          "La solicitud no se puede editar en su estado actual.",
        );
      }

      const errorItems = validarCalcularCotizacionPublica({ items });
      if (errorItems) {
        throw new Error(errorItems);
      }
      if (
        data.precioFinal !== undefined ||
        data.descuentoManual !== undefined ||
        data.costosAdicionales !== undefined
      ) {
        throw new Error(
          "Los valores oficiales deben definirse al enviar una propuesta.",
        );
      }

      const calculo = await calculoInternoService.calcular({ items });
      const detalles = detallesPersistenciaSolicitud(calculo);

      return await cotizacionRepository.reemplazarSolicitud(
        idCotizacion,
        {
          estado: "EN_REVISION",
          observaciones: limpiarTextoOpcional(data.observaciones),
          subtotal: 0,
          descuentoTotal: 0,
          costosAdicionales: 0,
          total: 0,
          precioSugeridoInterno: calculo.precioSugeridoInterno,
          requiereRevisionPrecio: calculo.requiereRevisionPrecio,
          advertenciasInternas: calculo.advertencias,
        },
        detalles,
      );
    }

    const error = validarActualizarCotizacion(data);

    if (error) {
      throw new Error(error);
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

    if (
      ![
        "PENDIENTE",
        "BORRADOR",
        "SOLICITUD_RECIBIDA",
        "EN_REVISION",
        "PENDIENTE_APROBACION_CLIENTE",
        "AJUSTE_SOLICITADO",
        "VENCIDA",
      ].includes(cotizacion.estado)
    ) {
      throw new Error("La cotizacion no se puede anular en su estado actual.");
    }

    const cotizacionAnulada = await cotizacionRepository.cambiarEstado(
      idCotizacion,
      ESTADO_ANULADA,
    );

    return this.presentarCotizacion(cotizacionAnulada, usuarioAuth);
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
