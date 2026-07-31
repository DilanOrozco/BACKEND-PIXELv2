import { ClienteRepository } from "../../infrastructure/repositories/cliente.repository";
import { CotizacionRepository } from "../../infrastructure/repositories/cotizacion.repository";
import { limpiarTextoOpcional } from "../../utils/text.util";
import { ProductoService } from "./producto.service";
import { CategoriaProductoService } from "./categoria-producto.service";
import { TecnicaRepository } from "../../infrastructure/repositories/tecnica.repository";
import { NotificationService } from "./notification.service";
import { ClienteAccessService } from "./cliente-access.service";
import { UsuarioRepository } from "../../infrastructure/repositories/usuario.repository";
import {
  validarCalcularCotizacionPublica,
  validarCrearCotizacionPublica,
} from "../validators/public-cotizacion.validator";
import { CotizacionCalculoInternoService } from "./cotizacion-calculo-interno.service";
import { serializarCotizacionCliente } from "../../utils/cotizacion-serializer.util";

const clienteRepository = new ClienteRepository();
const cotizacionRepository = new CotizacionRepository();
const productoService = new ProductoService();
const categoriaProductoService = new CategoriaProductoService();
const tecnicaRepository = new TecnicaRepository();
const notificationService = new NotificationService();
const clienteAccessService = new ClienteAccessService();
const usuarioRepository = new UsuarioRepository();
const calculoInternoService = new CotizacionCalculoInternoService();

const EMAIL_REQUIRES_LOGIN_MESSAGE =
  "Este correo ya est\u00e1 registrado. Inicia sesi\u00f3n para realizar una cotizaci\u00f3n con esta cuenta.";

export class PublicCotizacionConflictError extends Error {
  readonly code = "EMAIL_REQUIRES_LOGIN";

  constructor() {
    super(EMAIL_REQUIRES_LOGIN_MESSAGE);
    this.name = "PublicCotizacionConflictError";
  }
}

const limpiarCorreo = (valor: unknown) => {
  const texto = limpiarTextoOpcional(valor);
  return texto ? texto.toLowerCase() : null;
};

const construirResumenProductos = (items: any[]) => {
  const nombres = items.map(
    (item) => item.producto?.nombre ?? item.descripcion ?? "Producto",
  );

  return nombres.length <= 2
    ? nombres.join(", ")
    : `${nombres.slice(0, 2).join(", ")} y ${nombres.length - 2} mas`;
};

const respuestaCalculoPublica = (
  calculo: any,
  itemsEntrada: any[] = [],
  tecnicasPorId: Map<number, any> = new Map(),
) => {
  const items = calculo.items.map((item: any, index: number) => {
    const { snapshot, ...publico } = item;
    void snapshot;
    const idTecnica = itemsEntrada[index]?.idTecnica
      ? Number(itemsEntrada[index].idTecnica)
      : undefined;

    return {
      ...publico,
      idTecnica,
      tecnica: idTecnica ? tecnicasPorId.get(idTecnica) ?? null : null,
    };
  });
  const subtotalConDescuento =
    calculo.subtotalConDescuento ?? calculo.total;

  return {
    items,
    detalles: items,
    cantidadItems: items.length,
    productosResumen: construirResumenProductos(items),
    subtotal: calculo.subtotal,
    subtotalBruto: calculo.subtotalBruto ?? calculo.subtotal,
    descuentoTotal: calculo.descuentoTotal ?? 0,
    subtotalConDescuento,
    subtotalFinal: subtotalConDescuento,
    costosAdicionales: calculo.costosAdicionales ?? 0,
    costoDiseno: calculo.costoDiseno ?? 0,
    total: calculo.total,
  };
};

const formatearCotizacionPublica = (cotizacion: any) => {
  const detalles = Array.isArray(cotizacion?.detalles)
    ? cotizacion.detalles.map((detalle: any) => {
        const subtotalBruto = detalle.subtotalBruto ?? detalle.subtotal;
        const descuentoTotal = detalle.descuentoTotal ?? 0;
        const subtotalConDescuento =
          detalle.subtotalConDescuento ??
          (subtotalBruto === null || subtotalBruto === undefined
            ? null
            : Number(subtotalBruto) - Number(descuentoTotal));

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
          subtotalBruto,
          descuentoValorUnitario: detalle.descuentoValorUnitario ?? 0,
          descuentoTotal,
          subtotalConDescuento,
          subtotalFinal: subtotalConDescuento,
        };
      })
    : [];
  const subtotalBruto = cotizacion?.subtotal ?? 0;
  const descuentoTotal = cotizacion?.descuentoTotal ?? 0;
  const subtotalConDescuento = Math.max(
    Number(subtotalBruto) - Number(descuentoTotal),
    0,
  );
  const costoDiseno = detalles.reduce(
    (total: number, detalle: any) =>
      total + Number(detalle.costoDiseno ?? 0),
    0,
  );

  return {
    ...cotizacion,
    detalles,
    cantidadItems: detalles.length,
    productosResumen: construirResumenProductos(detalles),
    subtotalBruto,
    descuentoTotal,
    subtotalConDescuento,
    subtotalFinal: subtotalConDescuento,
    costoDiseno,
  };
};

export const respuestaSolicitudPublica = (calculo: any) => ({
  estado: "EN_REVISION",
  estadoPrecio: "PENDIENTE_CONFIRMACION",
  requiereRevisionManual: Boolean(calculo.requiereRevisionPrecio),
  mensaje: "El equipo de PIXEL revisara la solicitud y confirmara el precio.",
  items: calculo.items.map((item: any) => ({
    tipoProducto: item.tipoProducto,
    idProducto: item.idProducto,
    nombre: item.nombre,
    descripcion: item.descripcionPersonalizada,
    materialReferencia: item.materialReferencia,
    suministradoPor: item.suministradoPor,
    cantidad: item.cantidad,
    requiereRevisionManual: Boolean(item.requiereRevisionPrecio),
    observaciones: item.observaciones,
    estampados: item.estampados.map((estampado: any) => ({
      idTecnica: estampado.idTecnica,
      tecnica: estampado.tecnica,
      ubicacion: estampado.ubicacion,
      anchoCm: estampado.anchoCm,
      altoCm: estampado.altoCm,
      descripcion: estampado.descripcion,
      observaciones: estampado.observaciones,
      origenDiseno: estampado.origenDiseno,
      grupoDisenoCompartido: estampado.grupoDisenoCompartido,
      requiereRevisionManual: Boolean(
        estampado.requiereRevisionPrecio,
      ),
    })),
  })),
});

export const detallesPersistenciaSolicitud = (calculo: any) =>
  calculo.items.map((item: any) => {
    const primerEstampado = item.estampados[0] ?? null;
    const requiereDiseno =
      item.requiereDiseno ??
      item.producto?.requiereDiseno ??
      item.estampados.some(
        (estampado: any) => estampado.origenDiseno !== "NO_REQUIERE",
      );

    return {
      idProducto: item.idProducto,
      idTecnica: primerEstampado?.idTecnica ?? null,
      tipoProducto: item.tipoProducto,
      nombrePersonalizado: item.nombrePersonalizado,
      descripcionPersonalizada: item.descripcionPersonalizada,
      materialReferencia: item.materialReferencia,
      suministradoPor: item.suministradoPor,
      descripcion: String(
        item.descripcionPersonalizada ?? item.nombre,
      ).slice(0, 255),
      cantidad: item.cantidad,
      precioBase: null,
      idRangoDescuentoAplicado:
        item.rangoDescuentoProducto?.idRango ?? null,
      cantidadMinimaDescuentoSnapshot:
        item.rangoDescuentoProducto?.cantidadMinima ?? null,
      descuentoPorcentaje: item.porcentajeDescuentoProducto,
      descuentoValorUnitario:
        item.cantidad > 0
          ? Math.round(item.montoDescuentoProducto / item.cantidad)
          : 0,
      precioUnitario:
        item.cantidad > 0
          ? Math.round(
              item.subtotalServiciosConDescuento / item.cantidad,
            )
          : null,
      costoDiseno: item.costoDisenoSugerido,
      subtotal: item.subtotalServiciosBruto,
      subtotalBruto: item.subtotalServiciosBruto,
      descuentoTotal: item.montoDescuentoProducto,
      subtotalConDescuento: item.subtotalServiciosConDescuento,
      precioSugeridoInterno: item.subtotalSugeridoInterno,
      subtotalSugeridoInterno: item.subtotalSugeridoInterno,
      requiereRevisionPrecio: item.requiereRevisionPrecio,
      imagenReferencia: item.imagenReferencia,
      requiereDiseno,
      origenDiseno: item.origenDiseno,
      archivoDisenoInicialUrl: item.archivoDisenoInicialUrl,
      esDisenoGeneral: item.esDisenoGeneral,
      medioRecepcionDiseno:
        item.origenDiseno === "CLIENTE" && item.archivoDisenoInicialUrl
          ? "SISTEMA"
          : null,
      observaciones: item.observaciones,
      estampados: item.estampados.map((estampado: any) => ({
        idTecnica: estampado.idTecnica,
        idTarifaAplicada: estampado.tarifa?.idTarifa ?? null,
        ubicacion: estampado.ubicacion,
        anchoCm: estampado.anchoCm,
        altoCm: estampado.altoCm,
        descripcion: estampado.descripcion,
        observaciones: estampado.observaciones,
        origenDiseno: estampado.origenDiseno,
        grupoDisenoCompartido: estampado.grupoDisenoCompartido,
        tarifaAnchoSnapshot: estampado.tarifa?.anchoHastaCm ?? null,
        tarifaAltoSnapshot: estampado.tarifa?.altoHastaCm ?? null,
        tarifaGeneralSnapshot: estampado.tarifa?.esGeneral ?? null,
        precioUnitarioSugerido: estampado.precioUnitarioSugerido,
        descuentoPorcentajeSnapshot: 0,
        subtotalBrutoSugerido: estampado.subtotalBrutoSugerido,
        descuentoTotalSugerido: 0,
        subtotalSugerido: estampado.subtotalSugerido,
        costoDisenoSugerido: estampado.costoDisenoSugerido,
        requiereRevisionPrecio: estampado.requiereRevisionPrecio,
        estadoMedidas: estampado.estadoMedidas,
        motivosRevision: estampado.motivosRevision,
      })),
    };
  });

const enviarCorreosCotizacion = async (
  cliente: any,
  cotizacion: any,
  calculo: any,
  observaciones: string | null,
  accesoCliente?: any,
  tecnicasPorId: Map<number, any> = new Map(),
) => {
  const detallesBase =
    Array.isArray(cotizacion.detalles) && cotizacion.detalles.length > 0
      ? cotizacion.detalles
      : respuestaCalculoPublica(calculo).items;
  const detallesCorreo = detallesBase.map((detalle: any) => ({
    ...detalle,
    tecnica:
      detalle.tecnica ??
      tecnicasPorId.get(Number(detalle.idTecnica)) ??
      null,
  }));
  const payload = {
    idCotizacion: cotizacion.idCotizacion,
    cliente,
    ...respuestaCalculoPublica(calculo),
    detalles: detallesCorreo,
    items: detallesCorreo,
    observaciones,
    accesoCliente,
  };
  return await notificationService.cotizacionCreada(payload);
};

export class PublicCotizacionService {
  async listarProductos(query: Record<string, unknown> = {}) {
    return await productoService.listarProductosPublicos(query);
  }

  async listarCategoriasProducto() {
    return await categoriaProductoService.listarCategoriasPublicas();
  }

  async listarTecnicas() {
    return await tecnicaRepository.listarTecnicasActivas();
  }

  private async asegurarTecnicasActivas(items: any[]) {
    const idsTecnicas = [
      ...new Set(
        items
          .filter((item) => item.idTecnica !== undefined)
          .map((item) => Number(item.idTecnica)),
      ),
    ];

    const tecnicas = await tecnicaRepository.buscarActivasPorIds(idsTecnicas);
    const tecnicasPorId = new Map(
      tecnicas.map((tecnica) => [tecnica.idTecnica, tecnica]),
    );

    for (const idTecnica of idsTecnicas) {
      if (!tecnicasPorId.has(idTecnica)) {
        throw new Error(`La tecnica con ID ${idTecnica} no existe o esta inactiva.`);
      }
    }

    return tecnicasPorId;
  }

  async calcular(data: Record<string, unknown>) {
    const error = validarCalcularCotizacionPublica(data);

    if (error) {
      throw new Error(error);
    }

    const calculo = await calculoInternoService.calcular(data);
    return respuestaSolicitudPublica(calculo);
  }

  async crearCotizacion(
    data: Record<string, unknown>,
    usuarioAuth?: any,
  ) {
    const esClienteAutenticado =
      String(usuarioAuth?.rol ?? "").toLowerCase() === "cliente";
    const clienteAutenticado = esClienteAutenticado
      ? await clienteAccessService.obtenerClienteDeUsuario(
          Number(usuarioAuth.idUsuario),
        )
      : null;
    const datosValidados = clienteAutenticado
      ? { ...data, cliente: clienteAutenticado }
      : data;
    const error = validarCrearCotizacionPublica(datosValidados);

    if (error) {
      throw new Error(error);
    }

    const calculo = await calculoInternoService.calcular(data);
    let cliente: any = clienteAutenticado;
    let accesoCliente: any = clienteAutenticado
      ? {
          usuarioCreado: false,
          usuarioExistente: true,
          idUsuario: Number(usuarioAuth.idUsuario),
        }
      : null;

    if (!cliente) {
      const clienteEntrada = data.cliente as Record<string, unknown>;
      const correo = limpiarCorreo(clienteEntrada.correo);
      const telefono = limpiarTextoOpcional(clienteEntrada.telefono);

      if (correo) {
        const [clienteConCorreo, usuarioConCorreo] = await Promise.all([
          clienteRepository.buscarPorCorreo(correo),
          usuarioRepository.buscarPorCorreo(correo),
        ]);

        if (clienteConCorreo || usuarioConCorreo) {
          throw new PublicCotizacionConflictError();
        }
      }

      const clienteExistente =
        await clienteRepository.buscarPorCorreoOTelefono(correo, telefono);
      const puedeReutilizarCliente =
        clienteExistente &&
        (!correo || !clienteExistente.idUsuario);

      cliente = puedeReutilizarCliente
        ? await clienteRepository.actualizarCliente(clienteExistente.idCliente, {
            nombre: String(clienteEntrada.nombre).trim(),
            documento: limpiarTextoOpcional(clienteEntrada.documento),
            correo: correo ?? clienteExistente.correo,
            telefono: telefono ?? clienteExistente.telefono,
            direccion: limpiarTextoOpcional(clienteEntrada.direccion),
          })
        : await clienteRepository.crearCliente({
            nombre: String(clienteEntrada.nombre).trim(),
            documento: limpiarTextoOpcional(clienteEntrada.documento),
            correo,
            telefono,
            direccion: limpiarTextoOpcional(clienteEntrada.direccion),
          });

      accesoCliente = await clienteAccessService.asegurarAccesoCliente(cliente);
    }

    const detalles = detallesPersistenciaSolicitud(calculo);

    const cotizacion = await cotizacionRepository.crearCotizacionConDetalles({
      idCliente: cliente.idCliente,
      creadoPorId: null,
      tipoCotizacion: "PUBLICA",
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
    const observaciones = limpiarTextoOpcional(data.observaciones);
    const email = await notificationService.solicitudCotizacionRecibida({
      ...serializarCotizacionCliente(cotizacion),
      cliente,
      observaciones,
      accesoCliente,
    });

    return {
      cotizacion: serializarCotizacionCliente(cotizacion),
      email,
    };
  }
}
