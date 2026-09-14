import test from "node:test";
import assert from "node:assert/strict";
import { CotizacionCalculoInternoService } from "./cotizacion-calculo-interno.service";
import { ProductoRepository } from "../../infrastructure/repositories/producto.repository";
import { TarifaTecnicaRepository } from "../../infrastructure/repositories/tarifa-tecnica.repository";

const producto = {
  idProducto: 1,
  nombre: "Camiseta",
  descripcion: null,
  precioBase: null,
  requiereDiseno: true,
  categoriaProducto: null,
  rangos: [
    { idRango: 1, cantidadMin: 1, descuentoPorcentaje: 0, estado: true },
    { idRango: 2, cantidadMin: 10, descuentoPorcentaje: 8, estado: true },
    { idRango: 3, cantidadMin: 50, descuentoPorcentaje: 10, estado: true },
  ],
};

const configurar = (t: any) => {
  t.mock.method(
    ProductoRepository.prototype,
    "buscarActivosPorIds",
    async () => [producto],
  );
  t.mock.method(
    TarifaTecnicaRepository.prototype,
    "cargarConfiguracionActiva",
    async () => [
      {
        idTecnica: 1,
        nombre: "DTF",
        tarifas: [
          {
            idTarifa: 1,
            anchoHastaCm: 20,
            altoHastaCm: 20,
            precioUnitario: 10000,
          },
          {
            idTarifa: 2,
            anchoHastaCm: 30,
            altoHastaCm: 30,
            precioUnitario: 16000,
          },
        ],
        descuentos: [
          { idDescuento: 1, cantidadMinima: 1, porcentaje: 0 },
          { idDescuento: 2, cantidadMinima: 12, porcentaje: 10 },
          { idDescuento: 3, cantidadMinima: 50, porcentaje: 20 },
        ],
      },
      {
        idTecnica: 2,
        nombre: "Bordado",
        tarifas: [
          {
            idTarifa: 3,
            anchoHastaCm: 10,
            altoHastaCm: 10,
            precioUnitario: 5000,
          },
        ],
        descuentos: [],
      },
    ],
  );
};

test("elige la tarifa activa mas pequena que cubre las dimensiones", async (t) => {
  configurar(t);
  const resultado = await new CotizacionCalculoInternoService().calcular({
    items: [
      {
        idProducto: 1,
        cantidad: 1,
        estampados: [
          { idTecnica: 1, ubicacion: "FRENTE", anchoCm: 11, altoCm: 12 },
        ],
      },
    ],
  });

  assert.equal(resultado.items[0].estampados[0].tarifa.idTarifa, 1);
  assert.equal(resultado.precioSugeridoInterno, 10000);
  assert.equal(resultado.requiereRevisionPrecio, false);
});

test("usa la tarifa elegida por id aun cuando las dimensiones quedan pendientes", async (t) => {
  configurar(t);
  const resultado = await new CotizacionCalculoInternoService().calcular({
    items: [
      {
        idProducto: 1,
        cantidad: 1,
        estampados: [
          { idTecnica: 1, idTarifaTecnica: 2, ubicacion: "FRENTE" },
        ],
      },
    ],
  });

  assert.equal(resultado.items[0].estampados[0].tarifa.idTarifa, 2);
  assert.equal(resultado.items[0].estampados[0].estadoMedidas, "SEGUN_TARIFA");
  assert.equal(resultado.precioSugeridoInterno, 16000);
  assert.equal(resultado.requiereRevisionPrecio, false);
});

test("rechaza una tarifa elegida que no pertenece a la tecnica", async (t) => {
  configurar(t);

  await assert.rejects(
    () =>
      new CotizacionCalculoInternoService().calcular({
        items: [
          {
            idProducto: 1,
            cantidad: 1,
            estampados: [
              { idTecnica: 1, idTarifaTecnica: 3, ubicacion: "FRENTE" },
            ],
          },
        ],
      }),
    /no pertenece a la tecnica seleccionada o esta inactiva/i,
  );
});

test("aplica el mayor descuento del producto e ignora DescuentoTecnica", async (t) => {
  configurar(t);
  const service = new CotizacionCalculoInternoService();
  const doce = await service.calcular({
    items: [
      {
        idProducto: 1,
        cantidad: 12,
        estampados: [
          { idTecnica: 1, ubicacion: "FRENTE", anchoCm: 10, altoCm: 10 },
        ],
      },
    ],
  });
  const cincuenta = await service.calcular({
    items: [
      {
        idProducto: 1,
        cantidad: 50,
        estampados: [
          { idTecnica: 1, ubicacion: "FRENTE", anchoCm: 10, altoCm: 10 },
        ],
      },
    ],
  });

  assert.equal(doce.items[0].estampados[0].descuentoPorcentaje, 0);
  assert.equal(doce.items[0].porcentajeDescuentoProducto, 8);
  assert.equal(doce.items[0].rangoDescuentoProducto.cantidadMinima, 10);
  assert.equal(doce.items[0].montoDescuentoProducto, 9600);
  assert.equal(doce.precioSugeridoInterno, 110400);
  assert.equal(cincuenta.items[0].estampados[0].descuentoPorcentaje, 0);
  assert.equal(cincuenta.items[0].porcentajeDescuentoProducto, 10);
  assert.equal(cincuenta.precioSugeridoInterno, 450000);
});

test("suma varios servicios y no duplica costo de diseno compartido", async (t) => {
  configurar(t);
  const resultado = await new CotizacionCalculoInternoService().calcular(
    {
      items: [
        {
          idProducto: 1,
          cantidad: 2,
          estampados: [
            {
              idTecnica: 1,
              ubicacion: "FRENTE",
              anchoCm: 10,
              altoCm: 10,
              origenDiseno: "PIXEL",
              grupoDisenoCompartido: "LOGO-1",
              costoDisenoSugerido: 20000,
            },
            {
              idTecnica: 2,
              ubicacion: "MANGA",
              anchoCm: 5,
              altoCm: 5,
              origenDiseno: "PIXEL",
              grupoDisenoCompartido: "LOGO-1",
              costoDisenoSugerido: 20000,
            },
          ],
        },
      ],
    },
    { permitirCostosDiseno: true },
  );

  assert.equal(resultado.costoDisenoSugerido, 20000);
  assert.equal(resultado.precioSugeridoInterno, 50000);
});

test("usa costo de diseno configurado una sola vez por grupo compartido", async (t) => {
  configurar(t);
  const anterior = process.env.QUOTE_DESIGN_SUGGESTED_COST;
  process.env.QUOTE_DESIGN_SUGGESTED_COST = "15000";
  t.after(() => {
    if (anterior === undefined) {
      delete process.env.QUOTE_DESIGN_SUGGESTED_COST;
    } else {
      process.env.QUOTE_DESIGN_SUGGESTED_COST = anterior;
    }
  });

  const resultado = await new CotizacionCalculoInternoService().calcular({
    items: [
      {
        idProducto: 1,
        cantidad: 1,
        estampados: [
          {
            idTecnica: 1,
            ubicacion: "FRENTE",
            anchoCm: 10,
            altoCm: 10,
            origenDiseno: "PIXEL",
            grupoDisenoCompartido: "MARCA",
          },
          {
            idTecnica: 2,
            ubicacion: "MANGA",
            anchoCm: 5,
            altoCm: 5,
            origenDiseno: "PIXEL",
            grupoDisenoCompartido: "MARCA",
          },
        ],
      },
    ],
  });

  assert.equal(resultado.costoDisenoSugerido, 15000);
  assert.equal(resultado.precioSugeridoInterno, 30000);
  assert.equal(resultado.requiereRevisionPrecio, false);
});

test("descuento del producto no afecta diseno ni costos adicionales", async (t) => {
  configurar(t);
  const resultado = await new CotizacionCalculoInternoService().calcular(
    {
      items: [
        {
          idProducto: 1,
          cantidad: 12,
          estampados: [
            {
              idTecnica: 1,
              ubicacion: "FRENTE",
              anchoCm: 10,
              altoCm: 10,
              origenDiseno: "PIXEL",
              costoDisenoSugerido: 20000,
            },
          ],
        },
      ],
    },
    {
      permitirCostosDiseno: true,
      costosAdicionales: 30000,
    },
  );

  assert.equal(resultado.subtotalServiciosBruto, 120000);
  assert.equal(resultado.montoDescuentoProducto, 9600);
  assert.equal(resultado.subtotalServiciosConDescuento, 110400);
  assert.equal(resultado.costoDisenoSugerido, 20000);
  assert.equal(resultado.costosAdicionales, 30000);
  assert.equal(resultado.precioSugeridoInterno, 160400);
});

test("grupo de diseno compartido entre productos se cobra una sola vez", async (t) => {
  configurar(t);
  const anterior = process.env.QUOTE_DESIGN_SUGGESTED_COST;
  process.env.QUOTE_DESIGN_SUGGESTED_COST = "15000";
  t.after(() => {
    if (anterior === undefined) {
      delete process.env.QUOTE_DESIGN_SUGGESTED_COST;
    } else {
      process.env.QUOTE_DESIGN_SUGGESTED_COST = anterior;
    }
  });

  const resultado = await new CotizacionCalculoInternoService().calcular({
    items: [
      {
        idProducto: 1,
        cantidad: 1,
        estampados: [
          {
            idTecnica: 1,
            ubicacion: "FRENTE",
            anchoCm: 10,
            altoCm: 10,
            origenDiseno: "PIXEL",
            grupoDisenoCompartido: "LOGO-COMPARTIDO",
          },
        ],
      },
      {
        idProducto: 1,
        cantidad: 1,
        estampados: [
          {
            idTecnica: 2,
            ubicacion: "LATERAL",
            anchoCm: 5,
            altoCm: 5,
            origenDiseno: "PIXEL",
            grupoDisenoCompartido: "LOGO-COMPARTIDO",
          },
        ],
      },
    ],
  });

  assert.equal(resultado.items.length, 2);
  assert.equal(resultado.costoDisenoSugerido, 15000);
  assert.equal(resultado.precioSugeridoInterno, 30000);
});

test("tecnica sin medidas usa su tarifa activa sin exigir ancho y alto", async (t) => {
  t.mock.method(
    ProductoRepository.prototype,
    "buscarActivosPorIds",
    async () => [producto],
  );
  t.mock.method(
    TarifaTecnicaRepository.prototype,
    "cargarConfiguracionActiva",
    async () => [
      {
        idTecnica: 3,
        nombre: "Servicio fijo",
        requiereMedidas: false,
        tarifas: [
          {
            idTarifa: 4,
            anchoHastaCm: null,
            altoHastaCm: null,
            esGeneral: true,
            precioUnitario: 7000,
          },
        ],
        descuentos: [],
      },
    ],
  );

  const resultado = await new CotizacionCalculoInternoService().calcular({
    items: [
      {
        idProducto: 1,
        cantidad: 2,
        estampados: [
          {
            idTecnica: 3,
            ubicacion: "SERVICIO",
            origenDiseno: "NO_REQUIERE",
          },
        ],
      },
    ],
  });

  assert.equal(resultado.requiereRevisionPrecio, false);
  assert.equal(resultado.precioSugeridoInterno, 14000);
  assert.equal(
    resultado.items[0].estampados[0].tecnica.requiereMedidas,
    false,
  );
  assert.equal(resultado.items[0].estampados[0].estadoMedidas, "NO_APLICA");
});

test("producto OTRO no aplica descuento automatico y queda en revision", async (t) => {
  configurar(t);
  const resultado = await new CotizacionCalculoInternoService().calcular({
    items: [
      {
        tipoProducto: "OTRO",
        nombrePersonalizado: "Producto especial",
        cantidad: 12,
        estampados: [
          {
            idTecnica: 1,
            ubicacion: "FRENTE",
            anchoCm: 10,
            altoCm: 10,
          },
        ],
      },
    ],
  });

  assert.equal(resultado.items[0].porcentajeDescuentoProducto, 0);
  assert.equal(resultado.items[0].montoDescuentoProducto, 0);
  assert.equal(resultado.items[0].subtotalServiciosBruto, 120000);
  assert.equal(resultado.items[0].subtotalServiciosConDescuento, 120000);
  assert.equal(resultado.items[0].requiereRevisionPrecio, true);
});

test("calculo multiproducto carga productos y tecnicas una sola vez", async (t) => {
  const productosMock = t.mock.method(
    ProductoRepository.prototype,
    "buscarActivosPorIds",
    async () => [producto],
  );
  const tecnicasMock = t.mock.method(
    TarifaTecnicaRepository.prototype,
    "cargarConfiguracionActiva",
    async () => [
      {
        idTecnica: 1,
        nombre: "DTF",
        requiereMedidas: true,
        tarifas: [
          {
            idTarifa: 1,
            anchoHastaCm: 20,
            altoHastaCm: 20,
            esGeneral: false,
            precioUnitario: 10000,
          },
        ],
        descuentos: [{ cantidadMinima: 1, porcentaje: 99 }],
      },
    ],
  );

  await new CotizacionCalculoInternoService().calcular({
    items: [
      {
        idProducto: 1,
        cantidad: 2,
        estampados: [
          { idTecnica: 1, ubicacion: "FRENTE", anchoCm: 10, altoCm: 10 },
          { idTecnica: 1, ubicacion: "ESPALDA", anchoCm: 15, altoCm: 15 },
        ],
      },
      {
        idProducto: 1,
        cantidad: 3,
        estampados: [
          { idTecnica: 1, ubicacion: "MANGA", anchoCm: 5, altoCm: 5 },
        ],
      },
    ],
  });

  assert.equal(productosMock.mock.calls.length, 1);
  assert.equal(tecnicasMock.mock.calls.length, 1);
});

test("detalle sin tarifa no rechaza la solicitud y deja advertencia interna", async (t) => {
  configurar(t);
  const resultado = await new CotizacionCalculoInternoService().calcular({
    items: [
      {
        idProducto: 1,
        cantidad: 1,
        estampados: [
          { idTecnica: 1, ubicacion: "ESPALDA", anchoCm: 100, altoCm: 100 },
        ],
      },
    ],
  });

  assert.equal(resultado.requiereRevisionPrecio, true);
  assert.equal(
    resultado.items[0].estampados[0].requiereRevisionPrecio,
    true,
  );
  assert.match(resultado.advertencias[0]!, /no existe tarifa/i);
});
