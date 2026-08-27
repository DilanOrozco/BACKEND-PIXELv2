import test from "node:test";
import assert from "node:assert/strict";
import { serializarCotizacionCliente } from "./cotizacion-serializer.util";

const solicitud = {
  idCotizacion: 10,
  estado: "EN_REVISION",
  subtotal: 50000,
  descuentoTotal: 5000,
  costosAdicionales: 1000,
  total: 46000,
  precioSugeridoInterno: 45000,
  subtotalServiciosBrutoSugerido: 50000,
  montoDescuentoProductoSugerido: 5000,
  subtotalServiciosConDescuentoSugerido: 45000,
  costoDisenoSugerido: 0,
  calculoCompleto: false,
  requiereRevisionPrecio: true,
  advertenciasInternas: ["Falta revisar una tarifa."],
  observacionesInternas: "Margen reservado.",
  creadoPor: { idUsuario: 1, nombre: "Admin" },
  cliente: { idCliente: 2, nombre: "Cliente" },
  detalles: [
    {
      idDetalleCotizacion: 20,
      idProducto: 3,
      cantidad: 2,
      precioBase: 25000,
      precioUnitario: 22500,
      subtotal: 45000,
      subtotalSugeridoInterno: 45000,
      idRangoDescuentoAplicado: 8,
      cantidadMinimaDescuentoSnapshot: 2,
      rangoDescuentoAplicado: {
        idRango: 8,
        cantidadMin: 2,
        descuentoPorcentaje: 10,
      },
      porcentajeDescuentoProducto: 10,
      montoDescuentoProducto: 5000,
      subtotalServiciosBruto: 50000,
      subtotalServiciosConDescuento: 45000,
      calculoCompleto: false,
      requiereRevisionPrecio: true,
      producto: {
        idProducto: 3,
        idCategoriaProducto: 4,
        nombre: "Camiseta",
        precioBase: 25000,
        categoriaProducto: { idCategoriaProducto: 4, nombre: "Textil" },
      },
      estampados: [
        {
          idDetalleEstampadoCotizacion: 30,
          idTecnica: 5,
          ubicacion: "FRENTE",
          anchoCm: 10,
          altoCm: 10,
          precioUnitarioSugerido: 25000,
          subtotalSugerido: 45000,
          tecnica: { idTecnica: 5, nombre: "DTF" },
        },
      ],
    },
  ],
  versiones: [],
};

test("solicitud cliente oculta precios, tarifas y notas internas", () => {
  const respuesta: any = serializarCotizacionCliente(solicitud);
  const serializada = JSON.stringify(respuesta);

  assert.equal(respuesta.estadoPrecio, "PENDIENTE_CONFIRMACION");
  assert.equal(respuesta.propuesta, null);
  assert.equal("total" in respuesta, false);
  assert.equal("precioSugeridoInterno" in respuesta, false);
  assert.equal("subtotalServiciosBrutoSugerido" in respuesta, false);
  assert.equal("montoDescuentoProductoSugerido" in respuesta, false);
  assert.equal("advertenciasInternas" in respuesta, false);
  assert.equal("observacionesInternas" in respuesta, false);
  assert.equal("creadoPor" in respuesta, false);
  assert.equal("precioBase" in respuesta.detalles[0], false);
  assert.equal("rangoDescuentoProducto" in respuesta.detalles[0], false);
  assert.equal("montoDescuentoProducto" in respuesta.detalles[0], false);
  assert.equal("precioBase" in respuesta.detalles[0].producto, false);
  assert.doesNotMatch(serializada, /45000|50000|Margen reservado/);
  assert.equal(respuesta.detalles[0].estampados[0].tecnica.nombre, "DTF");
});

test("cliente recibe solamente la propuesta oficial vigente", () => {
  const respuesta: any = serializarCotizacionCliente({
    ...solicitud,
    estado: "PENDIENTE_APROBACION_CLIENTE",
    propuestaAdministrativa: {
      ajusteManual: 11000,
      motivoAjusteManual: "Margen interno reservado",
    },
    versiones: [
      {
        idVersion: 8,
        numeroVersion: 2,
        precioFinal: 52000,
        precioSugeridoInterno: 41000,
        descuentoManual: 0,
        costosAdicionales: 2000,
        subtotalDesglose: 41000,
        ajusteManual: 11000,
        motivoAjusteManual: "Incluye margen interno.",
        desgloseVisible: {
          items: [{ nombre: "Camiseta", cantidad: 2, subtotal: 50000 }],
          total: 52000,
        },
        snapshotCompleto: { costosInternos: 41000 },
        observacionesInternas: "No exponer",
        observacionesCliente: "Incluye empaque.",
        mensajeCliente: "Propuesta lista.",
        validaHasta: new Date(Date.now() + 86400000),
        enviadaAt: new Date(),
        estado: "ENVIADA",
        esVigente: true,
        respuesta: null,
      },
    ],
  });
  const serializada = JSON.stringify(respuesta);

  assert.equal(respuesta.estadoPrecio, "PROPUESTA_OFICIAL_DISPONIBLE");
  assert.equal(respuesta.propuesta.idVersion, 8);
  assert.equal(Number(respuesta.propuesta.precioFinal), 52000);
  assert.equal("snapshotCompleto" in respuesta.propuesta, false);
  assert.equal("precioSugeridoInterno" in respuesta.propuesta, false);
  assert.equal("propuestaAdministrativa" in respuesta, false);
  assert.doesNotMatch(
    serializada,
    /costosInternos|No exponer|41000|Margen interno|margen interno/i,
  );
});

test("cotizacion historica valorizada conserva propuesta compatible", () => {
  const respuesta: any = serializarCotizacionCliente({
    ...solicitud,
    estado: "PENDIENTE",
    subtotal: 50000,
    descuentoTotal: 5000,
    costosAdicionales: 1000,
    total: 46000,
    precioSugeridoInterno: null,
    requiereRevisionPrecio: false,
    detalles: [
      {
        ...solicitud.detalles[0],
        precioUnitario: 23000,
        subtotal: 46000,
        subtotalConDescuento: 46000,
      },
    ],
    versiones: [],
  });

  assert.equal(respuesta.estadoPrecio, "PROPUESTA_OFICIAL_DISPONIBLE");
  assert.equal(respuesta.propuesta.numeroVersion, 0);
  assert.equal(Number(respuesta.propuesta.precioFinal), 46000);
  assert.match(
    respuesta.propuesta.mensajeCliente,
    /historica anterior al versionado/i,
  );
});
