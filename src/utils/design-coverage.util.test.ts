import test from "node:test";
import assert from "node:assert/strict";
import {
  agregarCoberturaDisenoADetalles,
  resolverRequerimientosDiseno,
  resumirCoberturaDisenos,
} from "./design-coverage.util";

const detalle = {
  idDetallePedido: 1,
  requiereDiseno: true,
  estampados: [
    {
      idDetalleEstampadoPedido: 10,
      origenDiseno: "PIXEL",
      grupoDisenoCompartido: null,
    },
    {
      idDetalleEstampadoPedido: 11,
      origenDiseno: "PIXEL",
      grupoDisenoCompartido: null,
    },
  ],
};

test("un pedido con dos estampados no queda cubierto al aprobar solo uno", () => {
  const cobertura = agregarCoberturaDisenoADetalles([detalle], [
    {
      idDiseno: 1,
      idDetallePedido: 1,
      idDetalleEstampadoPedido: 10,
      esDisenoGeneral: false,
      estado: "APROBADO",
    },
  ]);
  const resumen = resumirCoberturaDisenos(cobertura);

  assert.equal(cobertura[0].cubiertoPorDiseno, false);
  assert.equal(resumen.totalDisenosPendientes, 1);
});

test("todos los estampados aprobados permiten cubrir el producto", () => {
  const cobertura = agregarCoberturaDisenoADetalles([detalle], [
    {
      idDiseno: 1,
      idDetallePedido: 1,
      idDetalleEstampadoPedido: 10,
      esDisenoGeneral: false,
      estado: "APROBADO",
    },
    {
      idDiseno: 2,
      idDetallePedido: 1,
      idDetalleEstampadoPedido: 11,
      esDisenoGeneral: false,
      estado: "APROBADO",
    },
  ]);

  assert.equal(cobertura[0].cubiertoPorDiseno, true);
  assert.equal(
    cobertura[0].estadoCoberturaDiseno,
    "ESTAMPADOS_CUBIERTOS",
  );
});

test("un diseno compartido aprobado cubre los estampados del mismo grupo", () => {
  const compartido = {
    ...detalle,
    estampados: detalle.estampados.map((estampado) => ({
      ...estampado,
      grupoDisenoCompartido: "LOGO-COMPARTIDO",
    })),
  };
  const cobertura = agregarCoberturaDisenoADetalles([compartido], [
    {
      idDiseno: 3,
      idDetallePedido: 1,
      idDetalleEstampadoPedido: 10,
      grupoDisenoCompartido: "LOGO-COMPARTIDO",
      esDisenoGeneral: false,
      estado: "APROBADO",
    },
  ]);

  assert.equal(cobertura[0].cubiertoPorDiseno, true);
  assert.equal(
    cobertura[0].estampados[1].estadoCoberturaDiseno,
    "CUBIERTO_POR_DISENO_COMPARTIDO",
  );
});

test("resolver genera requerimientos estables por estampado y respeta origen", () => {
  const resultado = resolverRequerimientosDiseno(54, [
    {
      idDetallePedido: 20,
      requiereDiseno: true,
      producto: { nombre: "Camiseta" },
      estampados: [
        {
          idDetalleEstampadoPedido: 34,
          origenDiseno: "PIXEL",
          grupoDisenoCompartido: null,
        },
        {
          idDetalleEstampadoPedido: 35,
          origenDiseno: "CLIENTE",
          grupoDisenoCompartido: null,
        },
        {
          idDetalleEstampadoPedido: 36,
          origenDiseno: "NO_REQUIERE",
          grupoDisenoCompartido: null,
        },
      ],
    },
  ]);

  assert.deepEqual(
    resultado.requerimientos.map((item) => item.idRequerimientoDiseno),
    ["STAMP-34", "STAMP-35"],
  );
  assert.equal(resultado.requerimientos[0]?.puedeCrearDiseno, true);
  assert.equal(
    resultado.requerimientos[1]?.estadoCoberturaDiseno,
    "PENDIENTE_RECEPCION_CLIENTE",
  );
  assert.equal(resultado.resumen.totalDisenosRequeridos, 2);
});

test("grupo compartido entre productos genera un solo requerimiento", () => {
  const resultado = resolverRequerimientosDiseno(
    54,
    [
      {
        idDetallePedido: 20,
        requiereDiseno: true,
        producto: { nombre: "Camiseta" },
        estampados: [
          {
            idDetalleEstampadoPedido: 34,
            origenDiseno: "PIXEL",
            grupoDisenoCompartido: "LOGO-1",
          },
        ],
      },
      {
        idDetallePedido: 21,
        requiereDiseno: true,
        producto: { nombre: "Mug" },
        estampados: [
          {
            idDetalleEstampadoPedido: 35,
            origenDiseno: "PIXEL",
            grupoDisenoCompartido: "LOGO-1",
          },
        ],
      },
    ],
    [],
  );

  assert.equal(resultado.requerimientos.length, 1);
  assert.equal(
    resultado.requerimientos[0]?.idRequerimientoDiseno,
    "GROUP-LOGO-1",
  );
  assert.equal(
    resultado.requerimientos[0]?.estampadosCubiertos.length,
    2,
  );
});

test("diseno general de producto cubre solo sus estampados", () => {
  const resultado = resolverRequerimientosDiseno(
    54,
    [
      {
        idDetallePedido: 20,
        requiereDiseno: true,
        esDisenoGeneral: true,
        estampados: [
          {
            idDetalleEstampadoPedido: 34,
            origenDiseno: "PIXEL",
          },
          {
            idDetalleEstampadoPedido: 35,
            origenDiseno: "PIXEL",
          },
        ],
      },
      {
        idDetallePedido: 21,
        requiereDiseno: true,
        estampados: [
          {
            idDetalleEstampadoPedido: 36,
            origenDiseno: "PIXEL",
          },
        ],
      },
    ],
    [
      {
        idDiseno: 9,
        idDetallePedido: 20,
        idDetalleEstampadoPedido: null,
        esDisenoGeneral: true,
        estado: "APROBADO",
      },
    ],
  );

  assert.equal(resultado.resumen.totalDisenosRequeridos, 2);
  assert.equal(resultado.resumen.totalDisenosAprobados, 1);
  assert.equal(
    resultado.requerimientos[0]?.estadoCoberturaDiseno,
    "CUBIERTO_POR_DISENO_GENERAL_PRODUCTO",
  );
});

test("diseno general del pedido cubre todos los requerimientos aplicables", () => {
  const resultado = resolverRequerimientosDiseno(
    54,
    [
      {
        idDetallePedido: 20,
        requiereDiseno: true,
        estampados: [
          {
            idDetalleEstampadoPedido: 34,
            origenDiseno: "PIXEL",
          },
        ],
      },
      {
        idDetallePedido: 21,
        requiereDiseno: true,
        estampados: [
          {
            idDetalleEstampadoPedido: 35,
            origenDiseno: "CLIENTE",
          },
        ],
      },
    ],
    [
      {
        idDiseno: 10,
        idDetallePedido: null,
        idDetalleEstampadoPedido: null,
        esDisenoGeneral: true,
        estado: "APROBADO",
      },
    ],
  );

  assert.equal(resultado.resumen.totalDisenosPendientes, 0);
  assert.ok(
    resultado.requerimientos.every(
      (item) =>
        item.estadoCoberturaDiseno ===
        "CUBIERTO_POR_DISENO_GENERAL_PEDIDO",
    ),
  );
});

test("rechazo posterior invalida aprobacion y habilita correccion", () => {
  const resultado = resolverRequerimientosDiseno(
    54,
    [
      {
        idDetallePedido: 20,
        requiereDiseno: true,
        estampados: [
          {
            idDetalleEstampadoPedido: 34,
            origenDiseno: "PIXEL",
          },
        ],
      },
    ],
    [
      {
        idDiseno: 10,
        idDetallePedido: 20,
        idDetalleEstampadoPedido: 34,
        esDisenoGeneral: false,
        estado: "APROBADO",
      },
      {
        idDiseno: 11,
        idDetallePedido: 20,
        idDetalleEstampadoPedido: 34,
        esDisenoGeneral: false,
        estado: "RECHAZADO",
      },
    ],
  );

  assert.equal(resultado.resumen.totalDisenosPendientes, 1);
  assert.equal(resultado.requerimientos[0]?.puedeCargarCorreccion, true);
  assert.equal(resultado.requerimientos[0]?.versiones.length, 2);
});
