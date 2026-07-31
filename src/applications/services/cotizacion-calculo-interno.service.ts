import { Prisma } from "../../../generated/prisma/client";
import { ProductoRepository } from "../../infrastructure/repositories/producto.repository";
import { TarifaTecnicaRepository } from "../../infrastructure/repositories/tarifa-tecnica.repository";
import { limpiarTextoOpcional } from "../../utils/text.util";

const productoRepository = new ProductoRepository();
const tarifaRepository = new TarifaTecnicaRepository();
const cero = () => new Prisma.Decimal(0);
const decimal = (valor: unknown) => new Prisma.Decimal(String(valor ?? 0));
const redondearPesos = (valor: Prisma.Decimal) => valor.toDecimalPlaces(0);
const costoDisenoConfigurado = () => {
  const valor = Number(process.env.QUOTE_DESIGN_SUGGESTED_COST ?? 0);
  return Number.isFinite(valor) && valor >= 0 ? valor : 0;
};

const normalizarOrigenDiseno = (valor: unknown) => {
  const origen = String(valor ?? "PENDIENTE_DEFINIR").toUpperCase();
  return [
    "CLIENTE",
    "PIXEL",
    "PENDIENTE_DEFINIR",
    "NO_REQUIERE",
  ].includes(origen)
    ? origen
    : "PENDIENTE_DEFINIR";
};

export const normalizarItemsSolicitudCotizacion = (data: any) => {
  const itemsEntrada = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.detalles)
      ? data.detalles
      : [];

  return itemsEntrada.map((item: any) => {
    const tipoProducto = String(
      item.tipoProducto ?? item.tipo ?? (item.idProducto ? "CATALOGO" : "OTRO"),
    ).toUpperCase();
    const estampadosEntrada = Array.isArray(item.estampados)
      ? item.estampados
      : item.idTecnica
        ? [
            {
              idTecnica: item.idTecnica,
              ubicacion: item.ubicacion ?? "NO_ESPECIFICADA",
              anchoCm: item.anchoCm,
              altoCm: item.altoCm,
              descripcion: item.descripcionEstampado,
              observaciones: item.observaciones,
              origenDiseno: item.origenDiseno,
              grupoDisenoCompartido: item.grupoDisenoCompartido,
            },
          ]
        : [];

    return {
      tipoProducto,
      idProducto:
        tipoProducto === "CATALOGO" ? Number(item.idProducto) : null,
      nombrePersonalizado:
        tipoProducto === "OTRO"
          ? limpiarTextoOpcional(
              item.nombrePersonalizado ?? item.nombreProducto ?? item.nombre,
            )
          : null,
      descripcionPersonalizada: limpiarTextoOpcional(
        item.descripcionPersonalizada ?? item.descripcion,
      ),
      materialReferencia: limpiarTextoOpcional(item.materialReferencia),
      suministradoPor: String(item.suministradoPor ?? "PIXEL").toUpperCase(),
      cantidad: Number(item.cantidad),
      imagenReferencia: limpiarTextoOpcional(item.imagenReferencia),
      observaciones: limpiarTextoOpcional(item.observaciones),
      requiereDiseno:
        item.requiereDiseno === undefined
          ? undefined
          : Boolean(item.requiereDiseno),
      origenDiseno: normalizarOrigenDiseno(item.origenDiseno),
      archivoDisenoInicialUrl: limpiarTextoOpcional(
        item.archivoDisenoInicialUrl,
      ),
      esDisenoGeneral: item.esDisenoGeneral === true,
      estampados: estampadosEntrada.map((estampado: any) => ({
        idTecnica:
          estampado.idTecnica === undefined ||
          estampado.idTecnica === null ||
          estampado.idTecnica === ""
            ? null
            : Number(estampado.idTecnica),
        ubicacion:
          limpiarTextoOpcional(estampado.ubicacion) ?? "NO_ESPECIFICADA",
        anchoCm:
          estampado.anchoCm === undefined ||
          estampado.anchoCm === null ||
          estampado.anchoCm === ""
            ? null
            : Number(estampado.anchoCm),
        altoCm:
          estampado.altoCm === undefined ||
          estampado.altoCm === null ||
          estampado.altoCm === ""
            ? null
            : Number(estampado.altoCm),
        descripcion: limpiarTextoOpcional(estampado.descripcion),
        observaciones: limpiarTextoOpcional(estampado.observaciones),
        origenDiseno: normalizarOrigenDiseno(estampado.origenDiseno),
        grupoDisenoCompartido: limpiarTextoOpcional(
          estampado.grupoDisenoCompartido,
        ),
        costoDisenoSugerido:
          estampado.costoDisenoSugerido === undefined
            ? 0
            : Number(estampado.costoDisenoSugerido),
      })),
    };
  });
};

const seleccionarTarifa = (
  tarifas: any[],
  anchoCm: number,
  altoCm: number,
) =>
  tarifas
    .filter(
      (tarifa) =>
        tarifa.esGeneral !== true &&
        tarifa.anchoHastaCm !== null &&
        tarifa.altoHastaCm !== null &&
        Number(tarifa.anchoHastaCm) >= anchoCm &&
        Number(tarifa.altoHastaCm) >= altoCm,
    )
    .sort(
      (a, b) =>
        Number(a.anchoHastaCm) * Number(a.altoHastaCm) -
          Number(b.anchoHastaCm) * Number(b.altoHastaCm) ||
        Number(a.precioUnitario) - Number(b.precioUnitario),
    )[0] ?? null;

const seleccionarTarifaGeneral = (tarifas: any[]) =>
  tarifas.find((tarifa) => tarifa.esGeneral === true) ?? null;

const seleccionarRangoProducto = (rangos: any[], cantidad: number) =>
  rangos
    .filter(
      (rango) =>
        rango.estado !== false && Number(rango.cantidadMin) <= cantidad,
    )
    .sort((a, b) => Number(b.cantidadMin) - Number(a.cantidadMin))[0] ??
  null;

export class CotizacionCalculoInternoService {
  async calcular(
    data: any,
    opciones: {
      permitirCostosDiseno?: boolean;
      costosAdicionales?: number;
    } = {},
  ) {
    const items: any[] = normalizarItemsSolicitudCotizacion(data);
    const idsProductos: number[] = [
      ...new Set(
        items
          .filter((item) => item.tipoProducto === "CATALOGO")
          .map((item) => Number(item.idProducto)),
      ),
    ];
    const idsTecnicas: number[] = [
      ...new Set(
        items.flatMap((item) =>
          item.estampados.map((estampado: any) =>
            Number(estampado.idTecnica),
          ),
        ).filter((idTecnica) => Number.isInteger(idTecnica) && idTecnica > 0),
      ),
    ];
    const [productos, configuracionesTecnica] = await Promise.all([
      productoRepository.buscarActivosPorIds(idsProductos),
      tarifaRepository.cargarConfiguracionActiva(idsTecnicas),
    ]);
    const productosPorId = new Map(
      productos.map((producto) => [producto.idProducto, producto]),
    );
    const tecnicasPorId = new Map(
      configuracionesTecnica.map((tecnica) => [
        tecnica.idTecnica,
        tecnica,
      ]),
    );
    const advertencias: string[] = [];
    const gruposDisenoCobrados = new Set<string>();
    let subtotalServiciosBrutoGeneral = cero();
    let descuentoProductoGeneral = cero();
    let subtotalServiciosNetoGeneral = cero();
    let costoDisenoSugerido = cero();
    let requiereRevisionPrecio = false;

    const itemsCalculados = items.map((item, indiceItem) => {
      const producto = item.idProducto
        ? productosPorId.get(item.idProducto)
        : null;

      if (item.tipoProducto === "CATALOGO" && !producto) {
        throw new Error(
          `El producto ${item.idProducto} no existe o esta inactivo.`,
        );
      }

      const motivosRevisionItem: string[] = [];
      let subtotalServiciosBruto = cero();
      let costoDisenoItem = cero();

      if (item.tipoProducto === "OTRO") {
        motivosRevisionItem.push("PRODUCTO_ESPECIAL");
        advertencias.push(
          `Item ${indiceItem + 1}: producto especial pendiente de revision por PIXEL.`,
        );
      }

      if (item.estampados.length === 0) {
        motivosRevisionItem.push("SERVICIOS_PENDIENTES");
        advertencias.push(
          `Item ${indiceItem + 1}: no tiene servicios o estampados definidos.`,
        );
      }

      const estampados = item.estampados.map(
        (estampado: any, indiceEstampado: number) => {
          const tecnica = tecnicasPorId.get(estampado.idTecnica);
          const motivosRevision: string[] = [];
          let costoDiseno = cero();
          const grupo =
            estampado.grupoDisenoCompartido ??
            `ITEM_${indiceItem}_ESTAMPADO_${indiceEstampado}`;

          if (
            estampado.origenDiseno === "PIXEL" &&
            !gruposDisenoCobrados.has(grupo)
          ) {
            const costoBase = opciones.permitirCostosDiseno
              ? estampado.costoDisenoSugerido
              : costoDisenoConfigurado();
            costoDiseno = redondearPesos(decimal(costoBase));
            gruposDisenoCobrados.add(grupo);
            costoDisenoSugerido =
              costoDisenoSugerido.plus(costoDiseno);
            costoDisenoItem = costoDisenoItem.plus(costoDiseno);

            if (costoDiseno.equals(0)) {
              motivosRevision.push("COSTO_DISENO_PENDIENTE");
              advertencias.push(
                `Item ${indiceItem + 1}, detalle ${indiceEstampado + 1}: el costo de diseno PIXEL requiere revision.`,
              );
            }
          }

          if (!tecnica) {
            motivosRevision.push(
              estampado.idTecnica === null
                ? "TECNICA_PENDIENTE"
                : "TECNICA_INVALIDA",
            );
            motivosRevisionItem.push(...motivosRevision);
            advertencias.push(
              `Item ${indiceItem + 1}, detalle ${indiceEstampado + 1}: tecnica pendiente, inexistente o inactiva.`,
            );
            return {
              ...estampado,
              tecnica: null,
              tarifa: null,
              estadoMedidas:
                estampado.anchoCm === null ? "PENDIENTES" : "DEFINIDAS",
              motivosRevision,
              descuentoPorcentaje: 0,
              precioUnitarioSugerido: null,
              subtotalBrutoSugerido: null,
              descuentoTotalSugerido: 0,
              subtotalSugerido: null,
              costoDisenoSugerido: costoDiseno.toNumber(),
              requiereRevisionPrecio: true,
            };
          }

          const medidasDefinidas =
            estampado.anchoCm !== null && estampado.altoCm !== null;
          const estadoMedidas = medidasDefinidas
            ? "DEFINIDAS"
            : tecnica.requiereMedidas === false
              ? "NO_APLICA"
              : "PENDIENTES";

          if (!medidasDefinidas && tecnica.requiereMedidas !== false) {
            motivosRevision.push("MEDIDAS_PENDIENTES");
            motivosRevisionItem.push(...motivosRevision);
            advertencias.push(
              `Item ${indiceItem + 1}, detalle ${indiceEstampado + 1}: faltan dimensiones para elegir tarifa.`,
            );
            return {
              ...estampado,
              tecnica: {
                idTecnica: tecnica.idTecnica,
                nombre: tecnica.nombre,
                requiereMedidas: true,
              },
              tarifa: null,
              estadoMedidas,
              motivosRevision,
              descuentoPorcentaje: 0,
              precioUnitarioSugerido: null,
              subtotalBrutoSugerido: null,
              descuentoTotalSugerido: 0,
              subtotalSugerido: null,
              costoDisenoSugerido: costoDiseno.toNumber(),
              requiereRevisionPrecio: true,
            };
          }

          const tarifa = medidasDefinidas
            ? seleccionarTarifa(
                tecnica.tarifas,
                estampado.anchoCm,
                estampado.altoCm,
              )
            : seleccionarTarifaGeneral(tecnica.tarifas);

          if (!tarifa) {
            const motivo =
              tecnica.requiereMedidas === false && !medidasDefinidas
                ? "TARIFA_GENERAL_NO_CONFIGURADA"
                : "TARIFA_NO_CONFIGURADA";
            motivosRevision.push(motivo);
            motivosRevisionItem.push(...motivosRevision);
            const referenciaMedidas = medidasDefinidas
              ? `${estampado.anchoCm}x${estampado.altoCm} cm`
              : "el servicio sin medidas";
            advertencias.push(
              `Item ${indiceItem + 1}, detalle ${indiceEstampado + 1}: no existe tarifa que cubra ${referenciaMedidas}.`,
            );
            return {
              ...estampado,
              tecnica: {
                idTecnica: tecnica.idTecnica,
                nombre: tecnica.nombre,
                requiereMedidas: tecnica.requiereMedidas !== false,
              },
              tarifa: null,
              estadoMedidas,
              motivosRevision,
              descuentoPorcentaje: 0,
              precioUnitarioSugerido: null,
              subtotalBrutoSugerido: null,
              descuentoTotalSugerido: 0,
              subtotalSugerido: null,
              costoDisenoSugerido: costoDiseno.toNumber(),
              requiereRevisionPrecio: true,
            };
          }

          const precioUnitario = redondearPesos(
            decimal(tarifa.precioUnitario),
          );
          const subtotalBruto = precioUnitario.mul(item.cantidad);
          subtotalServiciosBruto =
            subtotalServiciosBruto.plus(subtotalBruto);
          motivosRevisionItem.push(...motivosRevision);

          return {
            ...estampado,
            tecnica: {
              idTecnica: tecnica.idTecnica,
              nombre: tecnica.nombre,
              requiereMedidas: tecnica.requiereMedidas !== false,
            },
            tarifa: {
              idTarifa: tarifa.idTarifa,
              anchoHastaCm:
                tarifa.anchoHastaCm === null
                  ? null
                  : Number(tarifa.anchoHastaCm),
              altoHastaCm:
                tarifa.altoHastaCm === null
                  ? null
                  : Number(tarifa.altoHastaCm),
              esGeneral: tarifa.esGeneral === true,
              precioUnitario: precioUnitario.toNumber(),
            },
            estadoMedidas,
            motivosRevision,
            descuentoPorcentaje: 0,
            precioUnitarioSugerido: precioUnitario.toNumber(),
            subtotalBrutoSugerido: subtotalBruto.toNumber(),
            descuentoTotalSugerido: 0,
            subtotalSugerido: subtotalBruto.toNumber(),
            costoDisenoSugerido: costoDiseno.toNumber(),
            requiereRevisionPrecio: motivosRevision.length > 0,
          };
        },
      );

      const rangoDescuento =
        item.tipoProducto === "CATALOGO"
          ? seleccionarRangoProducto((producto as any)?.rangos ?? [], item.cantidad)
          : null;

      if (item.tipoProducto === "CATALOGO" && !rangoDescuento) {
        motivosRevisionItem.push("RANGO_DESCUENTO_PRODUCTO_PENDIENTE");
        advertencias.push(
          `Item ${indiceItem + 1}: el producto no tiene un rango de descuento activo para la cantidad solicitada.`,
        );
      }

      const porcentajeDescuentoProducto = rangoDescuento
        ? decimal(rangoDescuento.descuentoPorcentaje)
        : cero();
      const montoDescuentoProducto = redondearPesos(
        subtotalServiciosBruto
          .mul(porcentajeDescuentoProducto)
          .div(100),
      );
      const subtotalServiciosConDescuento =
        subtotalServiciosBruto.minus(montoDescuentoProducto);
      const subtotalItem =
        subtotalServiciosConDescuento.plus(costoDisenoItem);
      const itemRequiereRevision =
        item.tipoProducto === "OTRO" ||
        motivosRevisionItem.length > 0 ||
        estampados.some(
          (estampado: any) => estampado.requiereRevisionPrecio,
        );

      subtotalServiciosBrutoGeneral =
        subtotalServiciosBrutoGeneral.plus(subtotalServiciosBruto);
      descuentoProductoGeneral =
        descuentoProductoGeneral.plus(montoDescuentoProducto);
      subtotalServiciosNetoGeneral =
        subtotalServiciosNetoGeneral.plus(subtotalServiciosConDescuento);
      requiereRevisionPrecio ||= itemRequiereRevision;

      return {
        ...item,
        producto: producto
          ? {
              idProducto: producto.idProducto,
              nombre: producto.nombre,
              descripcion: producto.descripcion,
              requiereDiseno: producto.requiereDiseno,
              categoriaProducto: producto.categoriaProducto,
            }
          : null,
        nombre:
          producto?.nombre ??
          item.nombrePersonalizado ??
          "Producto especial",
        estampados,
        rangoDescuentoProducto: rangoDescuento
          ? {
              idRango: rangoDescuento.idRango,
              cantidadMinima: Number(rangoDescuento.cantidadMin),
              porcentaje: Number(rangoDescuento.descuentoPorcentaje),
            }
          : null,
        porcentajeDescuentoProducto:
          porcentajeDescuentoProducto.toNumber(),
        montoDescuentoProducto: montoDescuentoProducto.toNumber(),
        subtotalServiciosBruto: subtotalServiciosBruto.toNumber(),
        subtotalServiciosConDescuento:
          subtotalServiciosConDescuento.toNumber(),
        costoDisenoSugerido: costoDisenoItem.toNumber(),
        subtotalSugeridoInterno: subtotalItem.toNumber(),
        calculoCompleto: !itemRequiereRevision,
        motivosRevision: [...new Set(motivosRevisionItem)],
        requiereRevisionPrecio: itemRequiereRevision,
      };
    });

    const costosAdicionales = redondearPesos(
      decimal(opciones.costosAdicionales ?? 0),
    );
    const totalSugerido = subtotalServiciosNetoGeneral
      .plus(costoDisenoSugerido)
      .plus(costosAdicionales);

    return {
      items: itemsCalculados,
      subtotalServiciosBruto: subtotalServiciosBrutoGeneral.toNumber(),
      porcentajeDescuentoProducto: null,
      montoDescuentoProducto: descuentoProductoGeneral.toNumber(),
      subtotalServiciosConDescuento:
        subtotalServiciosNetoGeneral.toNumber(),
      precioSugeridoInterno: totalSugerido.toNumber(),
      costoDisenoSugerido: costoDisenoSugerido.toNumber(),
      costosAdicionales: costosAdicionales.toNumber(),
      calculoCompleto: !requiereRevisionPrecio,
      requiereRevisionPrecio,
      advertencias,
    };
  }
}
