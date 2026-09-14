import { Prisma } from "../../../generated/prisma/client";
import { createHash } from "node:crypto";
import { prisma, runPrismaTransaction } from "../../config/prisma";
import { pedidoSelect } from "../../utils/selects/pedido.select";
import { cotizacionSelect } from "../../utils/selects/cotizacion.select";
import { serializarCotizacionCliente } from "../../utils/cotizacion-serializer.util";
import { ClienteAccessService } from "./cliente-access.service";
import { NotificationService } from "./notification.service";
import {
  validarEnviarPropuesta,
  validarRespuestaCotizacion,
} from "../validators/cotizacion-workflow.validator";

const clienteAccessService = new ClienteAccessService();
const notificationService = new NotificationService();

const decimal = (valor: unknown) => new Prisma.Decimal(String(valor ?? 0));
const dinero = (valor: unknown) => decimal(valor).toDecimalPlaces(2);
const limpiarTexto = (valor: unknown) => {
  if (typeof valor !== "string") return null;
  const texto = valor.trim();
  return texto === "" ? null : texto;
};
const jsonSeguro = (valor: unknown) =>
  JSON.parse(
    JSON.stringify(valor, (_clave, dato) =>
      typeof dato?.toJSON === "function" ? dato.toJSON() : dato,
    ),
  );

const diasVigencia = () => {
  const configurado = Number(process.env.QUOTE_VALIDITY_DAYS ?? 7);
  return Number.isInteger(configurado) && configurado > 0 ? configurado : 7;
};

const vigenciaPorDefecto = () => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + diasVigencia());
  return fecha;
};

const nombreDetalle = (detalle: any) =>
  detalle.producto?.nombre ??
  detalle.nombrePersonalizado ??
  detalle.descripcionPersonalizada ??
  detalle.descripcion ??
  "Producto especial";

class ManualPriceReasonRequiredError extends Error {
  readonly code = "MANUAL_PRICE_REASON_REQUIRED";

  constructor() {
    super("Explica brevemente por qué el precio final difiere del desglose.");
  }
}

const snapshotEstampados = (estampados: any[]) =>
  estampados.map((estampado) => {
    const subtotalBruto = dinero(
      estampado.subtotalBrutoSugerido ??
        estampado.subtotalSugerido ??
        0,
    );
    const descuentoTotal = dinero(
      estampado.descuentoTotalSugerido ?? 0,
    );
    const subtotal = dinero(
      estampado.subtotalSugerido ??
        subtotalBruto.minus(descuentoTotal),
    );

    return {
      idDetalleEstampadoCotizacion:
        estampado.idDetalleEstampadoCotizacion,
      idTecnica: estampado.idTecnica,
      tecnica: estampado.tecnica,
      ubicacion: estampado.ubicacion,
      anchoCm: estampado.anchoCm,
      altoCm: estampado.altoCm,
      descripcion: estampado.descripcion,
      observaciones: estampado.observaciones,
      origenDiseno: estampado.origenDiseno,
      grupoDisenoCompartido: estampado.grupoDisenoCompartido,
      precioUnitario: dinero(
        estampado.precioUnitarioSugerido ?? 0,
      ).toNumber(),
      descuentoPorcentaje: decimal(
        estampado.descuentoPorcentajeSnapshot ?? 0,
      ).toNumber(),
      subtotalBruto: subtotalBruto.toNumber(),
      descuentoTotal: descuentoTotal.toNumber(),
      subtotal: subtotal.toNumber(),
    };
  });

const normalizarItemsOficiales = (
  detalles: any[],
  itemsEntrada: any[] | undefined,
) => {
  const entradasPorId = new Map(
    (itemsEntrada ?? []).map((item: any) => [
      Number(item.idDetalleCotizacion),
      item,
    ]),
  );
  if (
    itemsEntrada &&
    entradasPorId.size !== itemsEntrada.length
  ) {
    throw new Error("No se pueden repetir items en la propuesta oficial.");
  }
  const idsDetalle = new Set(
    detalles.map((detalle) => Number(detalle.idDetalleCotizacion)),
  );

  for (const idEntrada of entradasPorId.keys()) {
    if (!idsDetalle.has(idEntrada)) {
      throw new Error(
        `El detalle ${idEntrada} no pertenece a esta cotizacion.`,
      );
    }
  }

  if (
    itemsEntrada &&
    itemsEntrada.length > 0 &&
    itemsEntrada.length !== detalles.length
  ) {
    throw new Error(
      "Si envias valores por item, debes incluir todos los detalles de la cotizacion.",
    );
  }

  return detalles.map((detalle) => {
    const entrada = entradasPorId.get(Number(detalle.idDetalleCotizacion));
    const subtotalSugeridoServicios = dinero(
      detalle.subtotalServiciosConDescuento ??
        detalle.subtotalConDescuento ??
        detalle.subtotalSugeridoInterno ??
        0,
    );
    const subtotalLegacy =
      entrada?.subtotal !== undefined
        ? dinero(entrada.subtotal)
        : null;
    const subtotalServiciosOficial =
      entrada?.subtotalServiciosOficial !== undefined
        ? dinero(entrada.subtotalServiciosOficial)
        : subtotalLegacy ?? subtotalSugeridoServicios;
    const suministradoPor = detalle.suministradoPor ?? "PIXEL";
    const costoProductoSolicitado = dinero(entrada?.costoProducto ?? 0);

    if (
      suministradoPor === "CLIENTE" &&
      costoProductoSolicitado.greaterThan(0)
    ) {
      throw new Error(
        `El costo del producto debe ser 0 para el detalle ${detalle.idDetalleCotizacion} porque lo suministra el cliente.`,
      );
    }
    const costoProducto =
      suministradoPor === "CLIENTE"
        ? dinero(0)
        : costoProductoSolicitado;
    const otrosCostosItem = dinero(entrada?.otrosCostosItem ?? 0);
    const subtotalComponentes = subtotalServiciosOficial
      .plus(costoProducto)
      .plus(otrosCostosItem);
    const subtotalOficial =
      entrada?.subtotalOficial !== undefined
        ? dinero(entrada.subtotalOficial)
        : subtotalLegacy ?? subtotalComponentes;
    const ajusteItem = subtotalOficial.minus(subtotalComponentes);

    return {
      detalle,
      entrada,
      subtotalServiciosOficial,
      costoProducto,
      otrosCostosItem,
      subtotalOficial,
      ajusteItem,
    };
  });
};

const normalizarDisenosOficiales = (
  detalles: any[],
  disenosEntrada: any[] | undefined,
) => {
  const detallesPorId = new Map(
    detalles.map((detalle) => [
      Number(detalle.idDetalleCotizacion),
      detalle,
    ]),
  );
  const estampados = detalles.flatMap((detalle) =>
    (detalle.estampados ?? []).map((estampado: any) => ({
      ...estampado,
      idDetalleCotizacion: detalle.idDetalleCotizacion,
      nombreProducto: nombreDetalle(detalle),
    })),
  );
  const estampadosPorId = new Map(
    estampados.map((estampado) => [
      Number(estampado.idDetalleEstampadoCotizacion),
      estampado,
    ]),
  );
  const estampadosPorGrupo = new Map<string, any[]>();
  for (const estampado of estampados) {
    const grupo = limpiarTexto(estampado.grupoDisenoCompartido);
    if (!grupo) continue;
    estampadosPorGrupo.set(grupo, [
      ...(estampadosPorGrupo.get(grupo) ?? []),
      estampado,
    ]);
  }

  const claves = new Set<string>();
  const entradas = (disenosEntrada ?? []).map((entrada: any) => {
    const idDetalleCotizacion = Number(
      entrada.idDetalleCotizacion ?? 0,
    );
    const idDetalleEstampadoCotizacion = Number(
      entrada.idDetalleEstampadoCotizacion ?? 0,
    );
    let grupoDisenoCompartido = limpiarTexto(
      entrada.grupoDisenoCompartido,
    );
    let clave: string;
    let cubre: any[] = [];
    if (idDetalleCotizacion > 0) {
      const detalle = detallesPorId.get(idDetalleCotizacion);
      if (!detalle) {
        throw new Error(
          `El detalle ${idDetalleCotizacion} no pertenece a esta cotizacion.`,
        );
      }
      cubre = [{ idDetalleCotizacion, nombreProducto: nombreDetalle(detalle) }];
      clave = `ITEM:${idDetalleCotizacion}`;
    } else if (idDetalleEstampadoCotizacion > 0) {
      const estampado = estampadosPorId.get(
        idDetalleEstampadoCotizacion,
      );
      if (!estampado) {
        throw new Error(
          `El estampado ${idDetalleEstampadoCotizacion} no pertenece a esta cotizacion.`,
        );
      }
      const grupoDelEstampado = limpiarTexto(
        estampado.grupoDisenoCompartido,
      );
      if (grupoDelEstampado) {
        grupoDisenoCompartido = grupoDelEstampado;
        cubre = estampadosPorGrupo.get(grupoDelEstampado) ?? [estampado];
        clave = `GRUPO:${grupoDelEstampado}`;
      } else {
        cubre = [estampado];
        clave = `ESTAMPADO:${idDetalleEstampadoCotizacion}`;
      }
    } else {
      cubre = estampadosPorGrupo.get(grupoDisenoCompartido ?? "") ?? [];
      if (cubre.length === 0) {
        throw new Error(
          `El grupo de diseno ${grupoDisenoCompartido} no pertenece a esta cotizacion.`,
        );
      }
      clave = `GRUPO:${grupoDisenoCompartido}`;
    }
    if (claves.has(clave)) {
      throw new Error(
        "No se puede cobrar dos veces el mismo diseno o grupo compartido.",
      );
    }
    claves.add(clave);

    return {
      idDetalleCotizacion:
        idDetalleCotizacion > 0 ? idDetalleCotizacion : null,
      idDetalleEstampadoCotizacion:
        idDetalleEstampadoCotizacion > 0
          ? idDetalleEstampadoCotizacion
          : null,
      grupoDisenoCompartido,
      descripcionVisible:
        limpiarTexto(entrada.descripcionVisible) ??
        (grupoDisenoCompartido
          ? `Diseno compartido ${grupoDisenoCompartido}`
          : "Creacion de diseno"),
      costoDiseno: dinero(entrada.costoDiseno),
      visibleCliente: entrada.visibleCliente !== false,
      cubre: cubre.map((item: any) => ({
        idDetalleCotizacion: item.idDetalleCotizacion,
        idDetalleEstampadoCotizacion:
          item.idDetalleEstampadoCotizacion ?? null,
        nombreProducto: item.nombreProducto,
        ubicacion: item.ubicacion ?? null,
      })),
    };
  });

  return entradas;
};

const normalizarConceptosAdicionales = (
  data: any,
): Array<{
  concepto: string;
  valor: Prisma.Decimal;
  visibleCliente: boolean;
}> => {
  const conceptosEntrada = Array.isArray(data.conceptosAdicionales)
    ? data.conceptosAdicionales
    : [];
  if (conceptosEntrada.length > 0) {
    return conceptosEntrada.map((concepto: any) => ({
      concepto: concepto.concepto.trim(),
      valor: dinero(concepto.valor),
      visibleCliente: concepto.visibleCliente !== false,
    }));
  }

  const legacy = dinero(data.costosAdicionales ?? 0);
  return legacy.greaterThan(0)
    ? [
        {
          concepto: "Costos adicionales",
          valor: legacy,
          visibleCliente: true,
        },
      ]
    : [];
};

const construirSnapshot = (
  cotizacion: any,
  data: any,
  usuarioAuth: any,
  validaHasta: Date,
) => {
  const precioFinal = dinero(data.precioFinal);
  const descuentoManual = dinero(data.descuentoManual ?? 0);
  const itemsOficiales = normalizarItemsOficiales(
    cotizacion.detalles,
    data.items,
  );
  const disenosOficiales = normalizarDisenosOficiales(
    cotizacion.detalles,
    data.disenos,
  );
  const conceptosAdicionales = normalizarConceptosAdicionales(data);
  const subtotalItems = itemsOficiales.reduce(
    (total, item) => total.plus(item.subtotalOficial),
    dinero(0),
  );
  const totalDisenos = disenosOficiales.reduce(
    (total, diseno) => total.plus(diseno.costoDiseno),
    dinero(0),
  );
  const costosAdicionales = conceptosAdicionales.reduce(
    (total, concepto) => total.plus(concepto.valor),
    dinero(0),
  );
  const subtotalDesglose = subtotalItems
    .plus(totalDisenos)
    .plus(costosAdicionales)
    .minus(descuentoManual);

  if (subtotalDesglose.isNegative()) {
    throw new Error(
      "El descuento manual no puede superar la suma de items, disenos y conceptos adicionales.",
    );
  }
  const ajusteManual = precioFinal.minus(subtotalDesglose);
  const motivoAjusteManual = limpiarTexto(data.motivoAjusteManual);
  if (!ajusteManual.isZero() && !motivoAjusteManual) {
    throw new ManualPriceReasonRequiredError();
  }

  const costoDisenoPorDetalle = new Map<number, Prisma.Decimal>();
  for (const diseno of disenosOficiales) {
    const idDetalle = Number(
      diseno.idDetalleCotizacion ??
        diseno.cubre[0]?.idDetalleCotizacion ??
        0,
    );
    if (idDetalle <= 0) continue;
    costoDisenoPorDetalle.set(
      idDetalle,
      (costoDisenoPorDetalle.get(idDetalle) ?? dinero(0)).plus(
        diseno.costoDiseno,
      ),
    );
  }

  const items = itemsOficiales.map((itemOficial) => {
    const detalle = itemOficial.detalle;
    const subtotalOficial = itemOficial.subtotalOficial;
    const cantidad = Number(detalle.cantidad);
    const precioUnitario = cantidad > 0
      ? subtotalOficial.div(cantidad).toDecimalPlaces(2)
      : decimal(0);

    return {
      idDetalleCotizacion: detalle.idDetalleCotizacion,
      tipoProducto: detalle.tipoProducto,
      idProducto: detalle.idProducto,
      nombre: nombreDetalle(detalle),
      nombrePersonalizado: detalle.nombrePersonalizado,
      materialReferencia: detalle.materialReferencia,
      suministradoPor: detalle.suministradoPor,
      descripcion: detalle.descripcion,
      cantidad,
      precioUnitario: precioUnitario.toNumber(),
      subtotal: subtotalOficial.toNumber(),
      subtotalOficial: subtotalOficial.toNumber(),
      costoDiseno: (
        costoDisenoPorDetalle.get(Number(detalle.idDetalleCotizacion)) ??
        dinero(0)
      ).toNumber(),
      requiereDiseno: detalle.requiereDiseno,
      origenDiseno: detalle.origenDiseno,
      archivoDisenoInicialUrl: detalle.archivoDisenoInicialUrl,
      esDisenoGeneral: detalle.esDisenoGeneral,
      medioRecepcionDiseno: detalle.medioRecepcionDiseno,
      observaciones: detalle.observaciones,
      producto: detalle.producto
        ? {
            idProducto: detalle.producto.idProducto,
            nombre: detalle.producto.nombre,
            idCategoriaProducto:
              detalle.producto.idCategoriaProducto ?? null,
            categoriaProducto:
              detalle.producto.categoriaProducto ?? null,
          }
        : null,
      estampados: snapshotEstampados(detalle.estampados ?? []),
    };
  });

  const conceptosVisibles = conceptosAdicionales
    .filter((concepto) => concepto.visibleCliente)
    .map((concepto) => ({
      concepto: concepto.concepto,
      valor: concepto.valor.toNumber(),
    }));
  const disenosVisibles = disenosOficiales
    .filter((diseno) => diseno.visibleCliente)
    .map((diseno) => ({
      idDetalleCotizacion: diseno.idDetalleCotizacion,
      idDetalleEstampadoCotizacion:
        diseno.idDetalleEstampadoCotizacion,
      grupoDisenoCompartido: diseno.grupoDisenoCompartido,
      descripcion: diseno.descripcionVisible,
      valor: diseno.costoDiseno.toNumber(),
    }));
  const subtotalVisible = subtotalItems
    .plus(
      disenosOficiales
        .filter((diseno) => diseno.visibleCliente)
        .reduce(
          (total, diseno) => total.plus(diseno.costoDiseno),
          dinero(0),
        ),
    )
    .plus(
      conceptosAdicionales
        .filter((concepto) => concepto.visibleCliente)
        .reduce(
          (total, concepto) => total.plus(concepto.valor),
          dinero(0),
        ),
    )
    .minus(descuentoManual);
  const ajusteComercialVisible = precioFinal.minus(subtotalVisible);

  const desgloseVisible = {
    items,
    disenos: disenosVisibles,
    conceptosAdicionales: conceptosVisibles,
    subtotalItems: subtotalItems.toNumber(),
    costoDisenos: disenosVisibles.reduce(
      (total, diseno) => total + Number(diseno.valor),
      0,
    ),
    descuentoManual: descuentoManual.toNumber(),
    costosAdicionales: conceptosVisibles.reduce(
      (total, concepto) => total + Number(concepto.valor),
      0,
    ),
    ajusteComercial: ajusteComercialVisible.toNumber(),
    total: precioFinal.toNumber(),
  };

  const {
    versiones: _versionesAnteriores,
    ...cotizacionSinVersiones
  } = cotizacion;

  const itemsAdministrativos = itemsOficiales.map((item) => ({
    idDetalleCotizacion: item.detalle.idDetalleCotizacion,
    nombre: nombreDetalle(item.detalle),
    cantidad: Number(item.detalle.cantidad),
    suministradoPor: item.detalle.suministradoPor ?? "PIXEL",
    subtotalServiciosBruto: dinero(
      item.detalle.subtotalServiciosBruto ??
        item.detalle.subtotalBruto ??
        0,
    ).toNumber(),
    porcentajeDescuentoProducto: decimal(
      item.detalle.porcentajeDescuentoProducto ??
        item.detalle.descuentoPorcentaje ??
        0,
    ).toNumber(),
    montoDescuentoProducto: dinero(
      item.detalle.montoDescuentoProducto ??
        item.detalle.descuentoTotal ??
        0,
    ).toNumber(),
    subtotalServiciosNeto: item.subtotalServiciosOficial.toNumber(),
    costoProducto: item.costoProducto.toNumber(),
    otrosCostosItem: item.otrosCostosItem.toNumber(),
    ajusteItem: item.ajusteItem.toNumber(),
    subtotalOficialItem: item.subtotalOficial.toNumber(),
  }));
  const administrativo = {
    precioSugeridoSistema: dinero(
      cotizacion.precioSugeridoInterno ?? 0,
    ).toNumber(),
    subtotalDesglose: subtotalDesglose.toNumber(),
    ajusteManual: ajusteManual.toNumber(),
    motivoAjusteManual,
    items: itemsAdministrativos,
    disenos: disenosOficiales.map((diseno) => ({
      ...diseno,
      costoDiseno: diseno.costoDiseno.toNumber(),
    })),
    conceptosAdicionales: conceptosAdicionales.map((concepto) => ({
      ...concepto,
      valor: concepto.valor.toNumber(),
    })),
    descuentoManual: descuentoManual.toNumber(),
    enviadoPor: usuarioAuth
      ? {
          idUsuario: Number(usuarioAuth.idUsuario),
          nombre: limpiarTexto(usuarioAuth.nombre),
        }
      : null,
  };
  const snapshotCompleto: any = {
    cotizacion: jsonSeguro(cotizacionSinVersiones),
    propuesta: desgloseVisible,
    administrativo: jsonSeguro(administrativo),
    metadata: {
      validaHasta: validaHasta.toISOString(),
    },
  };
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        propuesta: snapshotCompleto.propuesta,
        administrativo: snapshotCompleto.administrativo,
        validaHasta:
          data.validaHasta !== undefined
            ? snapshotCompleto.metadata.validaHasta
            : "VIGENCIA_POR_DEFECTO",
        observacionesCliente:
          limpiarTexto(
            data.observacionesCliente ?? data.observacionesVisibles,
          ),
        observacionesInternas: limpiarTexto(data.observacionesInternas),
        mensajeCliente: limpiarTexto(data.mensajeCliente),
      }),
    )
    .digest("hex");
  snapshotCompleto.metadata.fingerprint = fingerprint;

  return {
    precioFinal,
    descuentoManual,
    costosAdicionales,
    subtotalDesglose,
    ajusteManual,
    motivoAjusteManual,
    conceptosAdicionales: administrativo.conceptosAdicionales,
    disenosOficiales: administrativo.disenos,
    desgloseVisible,
    snapshotCompleto,
    fingerprint,
  };
};

const crearDisenosIniciales = async (
  tx: Prisma.TransactionClient,
  idPedido: number,
  detalle: any,
  detalleCreado: any,
  gruposCreadosPedido: Set<string>,
  gruposMultiProducto: Set<string>,
) => {
  if (!detalle.requiereDiseno) return;
  if (!detalle.archivoDisenoInicialUrl) return;

  const estampadosCliente = (detalle.estampados ?? []).filter(
    (estampado: any) =>
      estampado.origenDiseno === "CLIENTE",
  );
  if (
    detalle.origenDiseno !== "CLIENTE" &&
    estampadosCliente.length === 0
  ) {
    return;
  }
  if (detalle.esDisenoGeneral || estampadosCliente.length === 0) {
    await tx.diseno.create({
      data: {
        idPedido,
        idDetallePedido: detalleCreado.idDetallePedido,
        idDetalleEstampadoPedido: null,
        grupoDisenoCompartido: null,
        esDisenoGeneral: detalle.esDisenoGeneral === true,
        archivoUrl: detalle.archivoDisenoInicialUrl,
        descripcion: "Diseno entregado por el cliente desde la cotizacion.",
        estado: "ENVIADO",
        origenDiseno: "CLIENTE",
        medioRecepcion: detalle.medioRecepcionDiseno ?? "SISTEMA",
        fechaRecepcion: new Date(),
        fechaEnvio: new Date(),
      },
    });
    return;
  }

  for (let indice = 0; indice < estampadosCliente.length; indice += 1) {
    const estampado = estampadosCliente[indice];
    const indiceOriginal = (detalle.estampados ?? []).indexOf(estampado);
    const grupo = estampado.grupoDisenoCompartido;
    if (grupo && gruposCreadosPedido.has(grupo)) continue;
    if (grupo) gruposCreadosPedido.add(grupo);

    await tx.diseno.create({
      data: {
        idPedido,
        idDetallePedido:
          grupo && gruposMultiProducto.has(grupo)
            ? null
            : detalleCreado.idDetallePedido,
        idDetalleEstampadoPedido:
          grupo
            ? null
            : detalleCreado.estampados[indiceOriginal]
                ?.idDetalleEstampadoPedido ?? null,
        grupoDisenoCompartido: grupo,
        esDisenoGeneral: false,
        archivoUrl: detalle.archivoDisenoInicialUrl,
        descripcion: "Diseno entregado por el cliente desde la cotizacion.",
        estado: "ENVIADO",
        origenDiseno: "CLIENTE",
        medioRecepcion: detalle.medioRecepcionDiseno ?? "SISTEMA",
        fechaRecepcion: new Date(),
        fechaEnvio: new Date(),
      },
    });
  }
};

export class CotizacionWorkflowService {
  constructor(
    private readonly database: any = prisma,
    private readonly ejecutarTransaccion = runPrismaTransaction,
  ) {}

  async listarVersiones(idCotizacion: number) {
    return await this.database.cotizacionVersion.findMany({
      where: { idCotizacion },
      orderBy: { numeroVersion: "desc" },
      include: {
        respuesta: {
          include: {
            usuarioInterno: {
              select: { idUsuario: true, nombre: true },
            },
          },
        },
      },
    });
  }

  private async cargarRespuestaExistente(
    idCotizacion: number,
    idVersion: number,
    actor: "CLIENTE" | "USUARIO_INTERNO",
  ) {
    const [cotizacion, pedido, respuesta] = await Promise.all([
      this.database.cotizacion.findUnique({
        where: { idCotizacion },
        select: cotizacionSelect,
      }),
      this.database.pedido.findUnique({
        where: { idCotizacion },
        select: pedidoSelect,
      }),
      this.database.cotizacionRespuesta.findUnique({
        where: { idVersion },
        include: {
          usuarioInterno: { select: { idUsuario: true, nombre: true } },
        },
      }),
    ]);

    return {
      cotizacion:
        actor === "CLIENTE"
          ? serializarCotizacionCliente(cotizacion)
          : cotizacion,
      version: cotizacion?.versiones.find(
        (item: any) => item.idVersion === idVersion,
      ),
      respuesta,
      pedido,
      email: null,
      idempotent: true,
    };
  }

  async enviarPropuesta(
    idCotizacion: number,
    data: any,
    usuarioAuth: any,
  ) {
    const error = validarEnviarPropuesta(data);
    if (error) throw new Error(error);

    const cotizacion = await this.database.cotizacion.findUnique({
      where: { idCotizacion },
      select: cotizacionSelect,
    });
    if (!cotizacion) throw new Error("Cotizacion no encontrada.");
    if (
      ["ANULADA", "CONVERTIDA_EN_PEDIDO", "ACEPTADA"].includes(
        cotizacion.estado,
      )
    ) {
      throw new Error("La cotizacion ya no admite nuevas propuestas.");
    }

    const validaHasta = data.validaHasta
      ? new Date(data.validaHasta)
      : vigenciaPorDefecto();
    const snapshot = construirSnapshot(
      cotizacion,
      data,
      usuarioAuth,
      validaHasta,
    );

    let versionResultado: { idVersion: number; creada: boolean };
    try {
      versionResultado = await this.ejecutarTransaccion(async (tx) => {
        const ultima = await tx.cotizacionVersion.findFirst({
          where: { idCotizacion },
          orderBy: { numeroVersion: "desc" },
          select: {
            idVersion: true,
            numeroVersion: true,
            estado: true,
            esVigente: true,
            snapshotCompleto: true,
          },
        });
        const fingerprintAnterior = (ultima?.snapshotCompleto as any)
          ?.metadata?.fingerprint;
        if (
          ultima?.esVigente &&
          ultima.estado === "ENVIADA" &&
          fingerprintAnterior === snapshot.fingerprint
        ) {
          return { idVersion: ultima.idVersion, creada: false };
        }

        await tx.cotizacionVersion.updateMany({
          where: { idCotizacion, esVigente: true },
          data: { esVigente: false, estado: "INVALIDADA" },
        });
        const version = await tx.cotizacionVersion.create({
          data: {
            idCotizacion,
            numeroVersion: (ultima?.numeroVersion ?? 0) + 1,
            precioSugeridoInterno: cotizacion.precioSugeridoInterno,
            precioFinal: snapshot.precioFinal,
            descuentoManual: snapshot.descuentoManual,
            costosAdicionales: snapshot.costosAdicionales,
            subtotalDesglose: snapshot.subtotalDesglose,
            ajusteManual: snapshot.ajusteManual,
            motivoAjusteManual: snapshot.motivoAjusteManual,
            conceptosAdicionales: snapshot.conceptosAdicionales,
            disenosOficiales: snapshot.disenosOficiales,
            desgloseVisible: snapshot.desgloseVisible,
            snapshotCompleto: snapshot.snapshotCompleto,
            observacionesCliente: limpiarTexto(
              data.observacionesCliente ?? data.observacionesVisibles,
            ),
            observacionesInternas: limpiarTexto(
              data.observacionesInternas,
            ),
            mensajeCliente: limpiarTexto(data.mensajeCliente),
            validaHasta,
            enviadaAt: new Date(),
            estado: "ENVIADA",
            esVigente: true,
          },
          select: { idVersion: true },
        });
        const subtotalBase = snapshot.subtotalDesglose
          .minus(snapshot.costosAdicionales)
          .plus(snapshot.descuentoManual);
        await tx.cotizacion.update({
          where: { idCotizacion },
          data: {
            estado: "PENDIENTE_APROBACION_CLIENTE",
            subtotal: subtotalBase,
            descuentoTotal: snapshot.descuentoManual,
            costosAdicionales: snapshot.costosAdicionales,
            total: snapshot.precioFinal,
            observacionesInternas: limpiarTexto(
              data.observacionesInternas,
            ),
          },
        });
        return { idVersion: version.idVersion, creada: true };
      });
    } catch (error) {
      if ((error as any)?.code === "P2002") {
        const versionConcurrente =
          await this.database.cotizacionVersion.findFirst({
            where: {
              idCotizacion,
              estado: "ENVIADA",
              esVigente: true,
            },
            orderBy: { numeroVersion: "desc" },
            select: { idVersion: true, snapshotCompleto: true },
          });
        if (
          (versionConcurrente?.snapshotCompleto as any)?.metadata
            ?.fingerprint === snapshot.fingerprint
        ) {
          versionResultado = {
            idVersion: versionConcurrente.idVersion,
            creada: false,
          };
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    const actualizada = await this.database.cotizacion.findUnique({
      where: { idCotizacion },
      select: cotizacionSelect,
    });
    const version = actualizada?.versiones.find(
      (item: any) => item.idVersion === versionResultado.idVersion,
    );
    const email = versionResultado.creada
      ? await notificationService.propuestaCotizacionEnviada({
          cotizacion: actualizada,
          version,
          cliente: actualizada?.cliente,
          registradoPor: usuarioAuth,
        })
      : {
          event: "PROPUESTA_COTIZACION_ENVIADA",
          cliente: "omitido",
          reason: "Propuesta identica procesada previamente.",
        };
    return {
      cotizacion: actualizada,
      version,
      email,
      idempotent: !versionResultado.creada,
    };
  }

  async responderComoCliente(
    idCotizacion: number,
    data: any,
    usuarioAuth: any,
  ) {
    const cliente = await clienteAccessService.obtenerClienteDeUsuario(
      Number(usuarioAuth.idUsuario),
    );
    return await this.responder(
      idCotizacion,
      { ...data, medio: "SISTEMA" },
      {
        actor: "CLIENTE",
        idCliente: cliente.idCliente,
        idUsuarioInterno: null,
      },
    );
  }

  async responderComoInterno(
    idCotizacion: number,
    data: any,
    usuarioAuth: any,
  ) {
    const cotizacion = await this.database.cotizacion.findUnique({
      where: { idCotizacion },
      select: { idCliente: true },
    });
    if (!cotizacion) throw new Error("Cotizacion no encontrada.");

    return await this.responder(idCotizacion, data, {
      actor: "USUARIO_INTERNO",
      idCliente: cotizacion.idCliente,
      idUsuarioInterno: Number(usuarioAuth.idUsuario),
    });
  }

  private async responder(
    idCotizacion: number,
    data: any,
    actorData: {
      actor: "CLIENTE" | "USUARIO_INTERNO";
      idCliente: number;
      idUsuarioInterno: number | null;
    },
  ) {
    const error = validarRespuestaCotizacion(data, actorData.actor);
    if (error) throw new Error(error);
    const decision = String(data.decision).toUpperCase() as
      | "ACEPTAR"
      | "RECHAZAR"
      | "SOLICITAR_AJUSTE";
    const medio = String(data.medio ?? "SISTEMA").toUpperCase() as any;

    const versionPrevia = await this.database.cotizacionVersion.findFirst({
      where: {
        idCotizacion,
        idVersion: Number(data.idVersion),
      },
      select: {
        idVersion: true,
        idCotizacion: true,
        precioFinal: true,
        validaHasta: true,
        estado: true,
        esVigente: true,
        snapshotCompleto: true,
        respuesta: {
          select: {
            idRespuesta: true,
            decision: true,
          },
        },
        pedido: {
          select: {
            idPedido: true,
          },
        },
        cotizacion: { select: { idCliente: true } },
      },
    });
    if (!versionPrevia) throw new Error("No existe una propuesta vigente.");
    if (versionPrevia.cotizacion.idCliente !== actorData.idCliente) {
      throw new Error("No tienes permisos para responder esta cotizacion.");
    }
    if (versionPrevia.respuesta) {
      if (versionPrevia.respuesta.decision === decision) {
        return await this.cargarRespuestaExistente(
          idCotizacion,
          versionPrevia.idVersion,
          actorData.actor,
        );
      }
      throw new Error("Esta propuesta ya fue respondida con otra decision.");
    }
    if (!versionPrevia.esVigente || versionPrevia.estado !== "ENVIADA") {
      throw new Error("La version indicada ya no esta disponible para respuesta.");
    }
    if (versionPrevia.validaHasta <= new Date()) {
      await this.database.$transaction([
        this.database.cotizacionVersion.update({
          where: { idVersion: versionPrevia.idVersion },
          data: { estado: "VENCIDA", esVigente: false },
        }),
        this.database.cotizacion.update({
          where: { idCotizacion },
          data: { estado: "VENCIDA" },
        }),
      ]);
      throw new Error("La propuesta esta vencida. Solicita una actualizacion.");
    }

    let resultadoIds: { idRespuesta: number; idPedido: number | null };
    try {
      resultadoIds = await this.ejecutarTransaccion(async (tx) => {
        const version = await tx.cotizacionVersion.findUnique({
        where: { idVersion: versionPrevia.idVersion },
        select: {
          idVersion: true,
          estado: true,
          esVigente: true,
          validaHasta: true,
          precioFinal: true,
          snapshotCompleto: true,
        },
      });
      if (
        !version ||
        version.estado !== "ENVIADA" ||
        !version.esVigente ||
        version.validaHasta <= new Date()
      ) {
        throw new Error("La propuesta ya no esta disponible para respuesta.");
      }

      const existente = await tx.cotizacionRespuesta.findUnique({
        where: { idVersion: version.idVersion },
        select: { idRespuesta: true },
      });
      if (existente) throw new Error("Esta propuesta ya fue respondida.");

      const respuesta = await tx.cotizacionRespuesta.create({
        data: {
          idCotizacion,
          idVersion: version.idVersion,
          decision,
          actor: actorData.actor,
          idUsuarioInterno: actorData.idUsuarioInterno,
          idCliente: actorData.idCliente,
          medio,
          observaciones: limpiarTexto(data.observaciones),
          evidenciaUrl: limpiarTexto(data.evidenciaUrl),
          precioAceptado:
            decision === "ACEPTAR" ? version.precioFinal : null,
        },
        select: { idRespuesta: true },
      });

      const estadoVersion =
        decision === "ACEPTAR"
          ? "ACEPTADA"
          : decision === "RECHAZAR"
            ? "RECHAZADA"
            : "AJUSTE_SOLICITADO";
      const estadoCotizacion =
        decision === "ACEPTAR"
          ? "CONVERTIDA_EN_PEDIDO"
          : decision === "RECHAZAR"
            ? "RECHAZADA_CLIENTE"
            : "AJUSTE_SOLICITADO";
      await tx.cotizacionVersion.update({
        where: { idVersion: version.idVersion },
        data: { estado: estadoVersion, esVigente: decision !== "RECHAZAR" },
      });

      let idPedido: number | null = null;
      if (decision === "ACEPTAR") {
        const existentePedido = await tx.pedido.findUnique({
          where: { idCotizacion },
          select: { idPedido: true },
        });
        if (existentePedido) {
          idPedido = existentePedido.idPedido;
        } else {
          const snapshot = version.snapshotCompleto as any;
          const items = snapshot?.propuesta?.items ?? [];
          if (!Array.isArray(items) || items.length === 0) {
            throw new Error("La propuesta no contiene items para crear el pedido.");
          }
          const pedido = await tx.pedido.create({
            data: {
              idCotizacion,
              idCotizacionVersion: version.idVersion,
              idCliente: actorData.idCliente,
              estadoPedido: "PENDIENTE",
              estadoPago: "PENDIENTE",
              total: version.precioFinal,
              totalPagado: 0,
              saldoPendiente: version.precioFinal,
              observaciones: `Pedido creado desde la version ${version.idVersion} de la cotizacion ${idCotizacion}.`,
            },
            select: { idPedido: true },
          });
          idPedido = pedido.idPedido;
          const gruposPorDetalle = new Map<string, Set<number>>();
          items.forEach((item: any, indiceItem: number) => {
            (item.estampados ?? []).forEach((estampado: any) => {
              const grupo = estampado.grupoDisenoCompartido;
              if (!grupo) return;
              const detallesGrupo =
                gruposPorDetalle.get(grupo) ?? new Set<number>();
              detallesGrupo.add(indiceItem);
              gruposPorDetalle.set(grupo, detallesGrupo);
            });
          });
          const gruposMultiProducto = new Set(
            [...gruposPorDetalle.entries()]
              .filter(([, detallesGrupo]) => detallesGrupo.size > 1)
              .map(([grupo]) => grupo),
          );
          const gruposCreadosPedido = new Set<string>();

          for (const item of items) {
            const detalleCreado = await tx.detallePedido.create({
              data: {
                idPedido,
                idProducto: item.idProducto,
                idTecnica: item.estampados?.[0]?.idTecnica ?? null,
                tipoProducto: item.tipoProducto ?? "CATALOGO",
                nombrePersonalizado: item.nombrePersonalizado,
                materialReferencia: item.materialReferencia,
                suministradoPor: item.suministradoPor ?? "PIXEL",
                descripcion: item.descripcion ?? item.nombre,
                cantidad: Number(item.cantidad),
                precioUnitario: dinero(item.precioUnitario),
                subtotal: dinero(item.subtotal),
                costoDiseno: dinero(item.costoDiseno ?? 0),
                requiereDiseno: item.requiereDiseno !== false,
                origenDiseno: item.origenDiseno ?? "PIXEL",
                archivoDisenoInicialUrl: item.archivoDisenoInicialUrl,
                esDisenoGeneral: item.esDisenoGeneral === true,
                medioRecepcionDiseno: item.medioRecepcionDiseno,
                observaciones: item.observaciones,
                estampados: {
                  create: (item.estampados ?? []).map(
                    (estampado: any, indice: number, lista: any[]) => {
                      const subtotalFallback =
                        indice === lista.length - 1
                          ? dinero(item.subtotal).minus(
                              dinero(item.subtotal)
                                .div(lista.length)
                                .toDecimalPlaces(0)
                                .mul(lista.length - 1),
                            )
                          : dinero(item.subtotal)
                              .div(lista.length)
                              .toDecimalPlaces(0);
                      const subtotalEstampado = dinero(
                        estampado.subtotal ?? subtotalFallback,
                      );

                      return {
                        idTecnica: estampado.idTecnica,
                        ubicacion: estampado.ubicacion,
                        anchoCm: estampado.anchoCm,
                        altoCm: estampado.altoCm,
                        descripcion: estampado.descripcion,
                        observaciones: estampado.observaciones,
                        origenDiseno: estampado.origenDiseno,
                        grupoDisenoCompartido:
                          estampado.grupoDisenoCompartido,
                        precioUnitario: dinero(
                          estampado.precioUnitario ??
                            subtotalEstampado.div(Number(item.cantidad)),
                        ),
                        descuentoPorcentaje: decimal(
                          estampado.descuentoPorcentaje ?? 0,
                        ),
                        subtotalBruto: dinero(
                          estampado.subtotalBruto ?? subtotalEstampado,
                        ),
                        descuentoTotal: dinero(
                          estampado.descuentoTotal ?? 0,
                        ),
                        subtotal: subtotalEstampado,
                      };
                    },
                  ),
                },
              },
              select: {
                idDetallePedido: true,
                estampados: {
                  select: { idDetalleEstampadoPedido: true },
                  orderBy: { idDetalleEstampadoPedido: "asc" },
                },
              },
            });
            await crearDisenosIniciales(
              tx,
              idPedido,
              item,
              detalleCreado,
              gruposCreadosPedido,
              gruposMultiProducto,
            );
          }
        }
      }

      await tx.cotizacion.update({
        where: { idCotizacion },
        data: { estado: estadoCotizacion },
      });
        return { idRespuesta: respuesta.idRespuesta, idPedido };
      });
    } catch (error) {
      if ((error as any)?.code === "P2002") {
        const respuestaConcurrente =
          await this.database.cotizacionRespuesta.findUnique({
            where: { idVersion: versionPrevia.idVersion },
            select: { decision: true },
          });
        if (respuestaConcurrente?.decision === decision) {
          return await this.cargarRespuestaExistente(
            idCotizacion,
            versionPrevia.idVersion,
            actorData.actor,
          );
        }
      }
      throw error;
    }

    const [cotizacion, pedido, respuesta] = await Promise.all([
      this.database.cotizacion.findUnique({
        where: { idCotizacion },
        select: cotizacionSelect,
      }),
      resultadoIds.idPedido
        ? this.database.pedido.findUnique({
            where: { idPedido: resultadoIds.idPedido },
            select: pedidoSelect,
          })
        : Promise.resolve(null),
      this.database.cotizacionRespuesta.findUnique({
        where: { idRespuesta: resultadoIds.idRespuesta },
        include: {
          usuarioInterno: { select: { idUsuario: true, nombre: true } },
        },
      }),
    ]);

    const emailRespuesta = pedido
      ? null
      : await notificationService.respuestaCotizacionRegistrada({
          cotizacion,
          pedido,
          respuesta,
          cliente: cotizacion?.cliente,
          version: cotizacion?.versiones.find(
            (item: any) => item.idVersion === versionPrevia.idVersion,
          ),
        });
    const emailPedido = pedido
      ? await notificationService.pedidoCreadoDesdeCotizacion({
          ...pedido,
          respuestaCotizacion: respuesta,
        })
      : null;

    return {
      cotizacion:
        actorData.actor === "CLIENTE"
          ? serializarCotizacionCliente(cotizacion)
          : cotizacion,
      version: cotizacion?.versiones.find(
        (item: any) => item.idVersion === versionPrevia.idVersion,
      ),
      respuesta,
      pedido,
      email: {
        respuesta: emailRespuesta,
        pedido: emailPedido,
      },
    };
  }
}
