import test from "node:test";
import assert from "node:assert/strict";
import {
  PedidoService,
  agregarCoberturaDisenoADetalles,
} from "./pedido.service";
import {
  PedidoRepository,
  prepararDisenosInicialesDesdeDetalles,
} from "../../infrastructure/repositories/pedido.repository";
import { buildPedidoCreadoTemplate } from "./email-templates";

const clienteA = {
  idCliente: 10,
  nombre: "Cliente A",
  correo: "a@pixel.test",
  telefono: "3000000001",
};

const clienteB = {
  idCliente: 20,
  nombre: "Cliente B",
  correo: "b@pixel.test",
  telefono: "3000000002",
};

const pedidoA = {
  idPedido: 1,
  idCotizacion: 100,
  idCliente: 10,
  estadoPedido: "PENDIENTE",
  estadoPago: "PENDIENTE",
  total: 50000,
  totalPagado: 0,
  saldoPendiente: 50000,
  fechaCreacion: new Date("2026-01-01"),
  fechaEntregaEstimada: null,
  fechaFinalizado: null,
  fechaEntregado: null,
  observaciones: null,
  cliente: clienteA,
  detalles: [],
  abonos: [],
  disenos: [],
};

const pedidoB = {
  ...pedidoA,
  idPedido: 2,
  idCotizacion: 200,
  idCliente: 20,
  cliente: clienteB,
};

test("PedidoService crea pedido desde cotizacion usando idCliente de la cotizacion", () => {
  const cotizacion = {
    idCotizacion: 100,
    idCliente: 20,
    total: 116000,
    detalles: [
      {
        idProducto: 1,
        idTecnica: 1,
        descripcion: "Camiseta",
        cantidad: 3,
        precioUnitario: 30000,
        subtotal: 90000,
        costoDiseno: 0,
        requiereDiseno: false,
        origenDiseno: "PIXEL",
      },
      {
        idProducto: 2,
        idTecnica: 1,
        descripcion: "Gorra",
        cantidad: 2,
        precioUnitario: 13000,
        subtotal: 26000,
        subtotalConDescuento: 26000,
        costoDiseno: 5000,
        requiereDiseno: true,
        origenDiseno: "CLIENTE",
        archivoDisenoInicialUrl: "https://pixel.test/disenos/gorra.png",
        esDisenoGeneral: false,
        medioRecepcionDiseno: "SISTEMA",
      },
    ],
  };

  const pedido = new PedidoService().prepararPedidoDesdeCotizacion(
    cotizacion,
    {},
    { idUsuario: 99, idCliente: 10, rol: "Admin" },
  );

  assert.equal(pedido.idCliente, 20);
  assert.equal(pedido.detalles.length, 2);
  assert.equal(pedido.detalles[0].idTecnica, 1);
  assert.equal(pedido.detalles[1].idTecnica, 1);
  assert.equal(pedido.detalles[1].idProducto, 2);
  assert.equal(pedido.detalles[1].costoDiseno, 5000);
  assert.equal(pedido.detalles[0].requiereDiseno, false);
  assert.equal(pedido.detalles[1].origenDiseno, "CLIENTE");
  assert.equal(
    pedido.detalles[1].archivoDisenoInicialUrl,
    "https://pixel.test/disenos/gorra.png",
  );
  assert.equal(pedido.total, 116000);
  assert.equal(pedido.saldoPendiente, 116000);
});

test("PedidoService admin lista pedidos con cliente real de cada pedido", async (t) => {
  t.mock.method(PedidoRepository.prototype, "listarPedidos", async () => [
    pedidoA,
    pedidoB,
  ]);

  const respuesta = await new PedidoService().listarPedidos({
    idUsuario: 99,
    rol: "Admin",
  });

  assert.equal(respuesta.data[0].cliente.idCliente, 10);
  assert.equal(respuesta.data[0].cliente.nombre, "Cliente A");
  assert.equal(respuesta.data[1].cliente.idCliente, 20);
  assert.equal(respuesta.data[1].cliente.nombre, "Cliente B");
});

test("PedidoService Cliente A solo lista pedidos de Cliente A", async (t) => {
  const listarPorClienteMock = t.mock.method(
    PedidoRepository.prototype,
    "listarPorCliente",
    async (idCliente: number) => {
      assert.equal(idCliente, 10);
      return [pedidoA];
    },
  );

  const respuesta = await new PedidoService().listarPedidos({
    idUsuario: 77,
    idCliente: 10,
    rol: "Cliente",
  });

  assert.equal(listarPorClienteMock.mock.calls.length, 1);
  assert.equal(respuesta.data.length, 1);
  assert.equal(respuesta.data[0].idCliente, 10);
  assert.equal(respuesta.data[0].cliente.idCliente, 10);
});

test("PedidoService Cliente B solo lista pedidos de Cliente B", async (t) => {
  t.mock.method(
    PedidoRepository.prototype,
    "listarPorCliente",
    async (idCliente: number) => {
      assert.equal(idCliente, 20);
      return [pedidoB];
    },
  );

  const respuesta = await new PedidoService().listarPedidos({
    idUsuario: 88,
    idCliente: 20,
    rol: "Cliente",
  });

  assert.equal(respuesta.data.length, 1);
  assert.equal(respuesta.data[0].idCliente, 20);
  assert.equal(respuesta.data[0].cliente.idCliente, 20);
});

test("PedidoService cliente sin idCliente vinculado no usa idUsuario como fallback", async (t) => {
  const listarPorClienteMock = t.mock.method(
    PedidoRepository.prototype,
    "listarPorCliente",
    async () => [pedidoA],
  );

  await assert.rejects(
    () =>
      new PedidoService().listarPedidos({
        idUsuario: 10,
        rol: "Cliente",
      }),
    /cliente vinculado/,
  );
  assert.equal(listarPorClienteMock.mock.calls.length, 0);
});

test("PedidoService Cliente A no puede ver pedido de Cliente B", async (t) => {
  t.mock.method(PedidoRepository.prototype, "buscarPorId", async () => pedidoB);

  await assert.rejects(
    () =>
      new PedidoService().buscarPorId(2, {
        idUsuario: 77,
        idCliente: 10,
        rol: "Cliente",
      }),
    /No tienes permisos/,
  );
});

test("PedidoService devuelve snapshots multiproducto iguales a los usados por email", async (t) => {
  const pedidoMultiproducto = {
    ...pedidoA,
    idPedido: 36,
    total: 3358340,
    saldoPendiente: 3358340,
    detalles: [
      {
        idDetallePedido: 1,
        idProducto: 1,
        idTecnica: 1,
        descripcion: "Producto 1",
        cantidad: 100,
        precioUnitario: 27143.4,
        subtotal: 2714340,
        producto: {
          idProducto: 1,
          nombre: "Camiseta",
          categoriaProducto: {
            idCategoriaProducto: 1,
            nombre: "Textiles",
          },
        },
        tecnica: { idTecnica: 1, nombre: "Estampado" },
      },
      {
        idDetallePedido: 2,
        idProducto: 2,
        idTecnica: 1,
        descripcion: "Producto 2",
        cantidad: 100,
        precioUnitario: 6440,
        subtotal: 644000,
        producto: {
          idProducto: 2,
          nombre: "Logo adicional",
          categoriaProducto: {
            idCategoriaProducto: 2,
            nombre: "Adicionales",
          },
        },
        tecnica: { idTecnica: 1, nombre: "Estampado" },
      },
    ],
    cotizacion: {
      idCotizacion: 300,
      subtotal: 4500000,
      descuentoTotal: 1141660,
      costosAdicionales: 0,
      total: 3358340,
      detalles: [
        {
          idProducto: 1,
          idTecnica: 1,
          descripcion: "Producto 1",
          cantidad: 100,
          precioBase: 38000,
          descuentoPorcentaje: 28.57,
          descuentoValorUnitario: 10856.6,
          precioUnitario: 27143.4,
          costoDiseno: 0,
          subtotal: 3800000,
          subtotalBruto: 3800000,
          descuentoTotal: 1085660,
          subtotalConDescuento: 2714340,
          producto: {
            idProducto: 1,
            nombre: "Camiseta",
            categoriaProducto: {
              idCategoriaProducto: 1,
              nombre: "Textiles",
            },
          },
          tecnica: { idTecnica: 1, nombre: "Estampado" },
        },
        {
          idProducto: 2,
          idTecnica: 1,
          descripcion: "Producto 2",
          cantidad: 100,
          precioBase: 7000,
          descuentoPorcentaje: 8,
          descuentoValorUnitario: 560,
          precioUnitario: 6440,
          costoDiseno: 0,
          subtotal: 700000,
          subtotalBruto: 700000,
          descuentoTotal: 56000,
          subtotalConDescuento: 644000,
          producto: {
            idProducto: 2,
            nombre: "Logo adicional",
            categoriaProducto: {
              idCategoriaProducto: 2,
              nombre: "Adicionales",
            },
          },
          tecnica: { idTecnica: 1, nombre: "Estampado" },
        },
      ],
    },
  };

  t.mock.method(
    PedidoRepository.prototype,
    "buscarPorId",
    async () => pedidoMultiproducto,
  );

  const respuesta = await new PedidoService().buscarPorId(36, {
    idUsuario: 99,
    rol: "Admin",
  });
  const [producto1, producto2] = respuesta.detalles;

  assert.equal(Number(producto1.precioBase), 38000);
  assert.equal(producto1.idCategoriaProducto, 1);
  assert.equal(producto1.categoriaProducto.nombre, "Textiles");
  assert.equal(producto1.tecnica.nombre, "Estampado");
  assert.equal(Number(producto1.descuentoPorcentaje), 28.57);
  assert.equal(Number(producto1.subtotalBruto), 3800000);
  assert.equal(Number(producto1.descuentoTotal), 1085660);
  assert.equal(Number(producto1.subtotalConDescuento), 2714340);
  assert.equal(Number(producto2.precioBase), 7000);
  assert.equal(producto2.tecnica.nombre, "Estampado");
  assert.equal(Number(producto2.descuentoPorcentaje), 8);
  assert.equal(Number(producto2.subtotalBruto), 700000);
  assert.equal(Number(producto2.descuentoTotal), 56000);
  assert.equal(Number(producto2.subtotalConDescuento), 644000);
  assert.equal(Number(respuesta.subtotalBruto), 4500000);
  assert.equal(Number(respuesta.descuentoTotal), 1141660);
  assert.equal(Number(respuesta.subtotalConDescuento), 3358340);

  const email = buildPedidoCreadoTemplate({ pedido: pedidoMultiproducto });
  const emailHtml = email.html ?? "";
  assert.match(emailHtml, /3\.800\.000/);
  assert.match(emailHtml, /1\.085\.660/);
  assert.match(emailHtml, /2\.714\.340/);
  assert.match(emailHtml, /Textiles/);
  assert.match(emailHtml, /Adicionales/);
  assert.doesNotMatch(emailHtml, /NaN|undefined|null/);
});

test("PedidoService mantiene respuesta segura para pedido antiguo sin snapshots", () => {
  const respuesta = new PedidoService().formatearPedido({
    ...pedidoA,
    detalles: [
      {
        idDetallePedido: 1,
        idProducto: null,
        idTecnica: null,
        descripcion: "Pedido antiguo",
        cantidad: 1,
        precioUnitario: 50000,
        subtotal: 50000,
      },
    ],
  });

  assert.equal(respuesta.detalles[0].precioBase, null);
  assert.equal(respuesta.detalles[0].descuentoPorcentaje, null);
  assert.equal(respuesta.detalles[0].subtotalBruto, 50000);
  assert.equal(respuesta.detalles[0].subtotalConDescuento, 50000);
  assert.equal(respuesta.detalles[0].subtotalFinal, 50000);
});

test("PedidoService expediente organiza venta, abonos, disenos y proximas acciones", async (t) => {
  const pedidoExpediente = {
    ...pedidoA,
    total: 100000,
    totalPagado: 50000,
    saldoPendiente: 50000,
    estadoPago: "PARCIAL",
    fechaEntregaEstimada: new Date("2026-08-15T00:00:00.000Z"),
    detalles: [
      {
        idDetallePedido: 11,
        idProducto: 1,
        descripcion: "Camiseta",
        cantidad: 12,
        precioUnitario: 26000,
        subtotal: 312000,
        requiereDiseno: true,
        producto: { idProducto: 1, nombre: "Camiseta" },
        tecnica: { idTecnica: 1, nombre: "DTF" },
      },
    ],
    abonos: [
      {
        idAbono: 40,
        estado: "PENDIENTE",
        monto: null,
        comprobantePath: "comprobantes/cliente-10/pedido-1/pago.png",
        nombreOriginalComprobante: "pago.png",
        fechaCreacion: new Date("2026-07-26"),
      },
    ],
    disenos: [
      {
        idDiseno: 30,
        idDetallePedido: 11,
        esDisenoGeneral: false,
        estado: "ENVIADO",
        fechaCreacion: new Date("2026-07-25"),
      },
    ],
    venta: {
      idVenta: 5,
      estado: "PARCIAL",
      totalPedido: 100000,
      totalPagado: 50000,
      saldoPendiente: 50000,
    },
  };
  t.mock.method(
    PedidoRepository.prototype,
    "buscarPorId",
    async () => pedidoExpediente,
  );

  const expediente = await new PedidoService().obtenerExpediente(1, {
    idUsuario: 99,
    rol: "Admin",
  });

  assert.equal(expediente.venta?.idVenta, 5);
  assert.equal(expediente.resumenEconomico.totalConfirmado, 50000);
  assert.equal(expediente.resumenEconomico.montoMinimoPrimerAbono, 50000);
  assert.equal(
    expediente.pedido.fechaEntregaEstimada,
    "2026-08-15",
  );
  assert.equal(expediente.abonos[0].comprobanteDisponible, true);
  assert.equal(expediente.abonos[0].comprobantePath, undefined);
  assert.ok(
    expediente.proximasAcciones.includes("COMPROBANTE_PENDIENTE_REVISION"),
  );
  assert.ok(
    expediente.proximasAcciones.includes("DISENO_PENDIENTE_APROBACION"),
  );
  assert.equal(
    expediente.detalles[0].estadoCoberturaDiseno,
    "DISENO_ENVIADO",
  );
  assert.equal(expediente.detalles[0].diseno.idDiseno, 30);
});

test("PedidoService conserva la fecha calendario sin desplazarla por zona horaria", () => {
  const service = new PedidoService();
  const conFecha = service.formatearPedido({
    ...pedidoA,
    fechaEntregaEstimada: new Date("2026-07-28T00:00:00.000Z"),
  });
  const sinFecha = service.formatearPedido({
    ...pedidoA,
    fechaEntregaEstimada: "fecha-invalida",
  });

  assert.equal(
    conFecha.fechaEntregaEstimada,
    "2026-07-28",
  );
  assert.equal(sinFecha.fechaEntregaEstimada, null);
});

test("conversion crea solo disenos entregados por cliente y conserva su archivo", () => {
  const fecha = new Date("2026-07-26T12:00:00.000Z");
  const disenos = prepararDisenosInicialesDesdeDetalles(
    [
      {
        idDetallePedido: 1,
        requiereDiseno: false,
        origenDiseno: "PIXEL",
        archivoDisenoInicialUrl: null,
        esDisenoGeneral: false,
        medioRecepcionDiseno: null,
      },
      {
        idDetallePedido: 2,
        requiereDiseno: true,
        origenDiseno: "PIXEL",
        archivoDisenoInicialUrl: null,
        esDisenoGeneral: false,
        medioRecepcionDiseno: null,
      },
      {
        idDetallePedido: 3,
        requiereDiseno: true,
        origenDiseno: "CLIENTE",
        archivoDisenoInicialUrl: "https://pixel.test/cliente.png",
        esDisenoGeneral: false,
        medioRecepcionDiseno: "SISTEMA",
      },
    ],
    20,
    fecha,
  );

  assert.equal(disenos.length, 1);
  assert.equal(disenos[0]?.idDetallePedido, 3);
  assert.equal(disenos[0]?.archivoUrl, "https://pixel.test/cliente.png");
  assert.equal(disenos[0]?.origenDiseno, "CLIENTE");
  assert.equal(disenos[0]?.estado, "ENVIADO");
});

test("conversion usa un solo diseno general sin duplicar disenos especificos", () => {
  const base = {
    requiereDiseno: true,
    origenDiseno: "CLIENTE",
    medioRecepcionDiseno: "SISTEMA",
  };
  const disenos = prepararDisenosInicialesDesdeDetalles(
    [
      {
        ...base,
        idDetallePedido: 1,
        archivoDisenoInicialUrl: "https://pixel.test/general.png",
        esDisenoGeneral: true,
      },
      {
        ...base,
        idDetallePedido: 2,
        archivoDisenoInicialUrl: "https://pixel.test/especifico.png",
        esDisenoGeneral: false,
      },
    ],
    20,
  );

  assert.equal(disenos.length, 1);
  assert.equal(disenos[0]?.idDetallePedido, null);
  assert.equal(disenos[0]?.esDisenoGeneral, true);
  assert.equal(disenos[0]?.archivoUrl, "https://pixel.test/general.png");
});

test("cobertura por detalle distingue no requiere, cliente, PIXEL y general", () => {
  const detalles = [
    {
      idDetallePedido: 1,
      requiereDiseno: false,
      origenDiseno: "PIXEL",
    },
    {
      idDetallePedido: 2,
      requiereDiseno: true,
      origenDiseno: "CLIENTE",
      archivoDisenoInicialUrl: "https://pixel.test/cliente.png",
    },
    {
      idDetallePedido: 3,
      requiereDiseno: true,
      origenDiseno: "PIXEL",
    },
  ];
  const coberturaInicial = agregarCoberturaDisenoADetalles(detalles, [
    {
      idDiseno: 8,
      idDetallePedido: 2,
      esDisenoGeneral: false,
      origenDiseno: "CLIENTE",
      estado: "ENVIADO",
    },
  ]);

  assert.equal(coberturaInicial[0]?.estadoCoberturaDiseno, "NO_REQUIERE_DISENO");
  assert.equal(coberturaInicial[0]?.cubiertoPorDiseno, true);
  assert.equal(
    coberturaInicial[1]?.estadoCoberturaDiseno,
    "DISENO_ENTREGADO_POR_CLIENTE",
  );
  assert.equal(
    coberturaInicial[2]?.estadoCoberturaDiseno,
    "PENDIENTE_CREACION_PIXEL",
  );

  const coberturaGeneral = agregarCoberturaDisenoADetalles(detalles, [
    {
      idDiseno: 9,
      idDetallePedido: null,
      esDisenoGeneral: true,
      origenDiseno: "CLIENTE",
      estado: "APROBADO",
    },
  ]);
  assert.equal(
    coberturaGeneral[1]?.estadoCoberturaDiseno,
    "CUBIERTO_POR_DISENO_GENERAL",
  );
  assert.equal(coberturaGeneral[2]?.cubiertoPorDiseno, true);
});

test("cobertura conserva diseno antiguo sin idDetallePedido en pedido de un producto", () => {
  const cobertura = agregarCoberturaDisenoADetalles(
    [
      {
        idDetallePedido: 501,
        requiereDiseno: true,
        origenDiseno: "PIXEL",
      },
    ],
    [
      {
        idDiseno: 99,
        idDetallePedido: null,
        esDisenoGeneral: false,
        estado: "APROBADO",
        origenDiseno: "DISENADOR",
      },
    ],
  );

  assert.equal(cobertura[0]?.estadoCoberturaDiseno, "DISENO_APROBADO");
  assert.equal(cobertura[0]?.cubiertoPorDiseno, true);
  assert.equal(cobertura[0]?.diseno.idDiseno, 99);
});

test("cobertura usa la version vigente y un rechazo posterior invalida la aprobacion anterior", () => {
  const cobertura = agregarCoberturaDisenoADetalles(
    [
      {
        idDetallePedido: 501,
        requiereDiseno: true,
        origenDiseno: "PIXEL",
      },
    ],
    [
      {
        idDiseno: 10,
        idDetallePedido: 501,
        esDisenoGeneral: false,
        estado: "APROBADO",
        fechaCreacion: new Date("2026-07-20T12:00:00.000Z"),
      },
      {
        idDiseno: 11,
        idDetallePedido: 501,
        esDisenoGeneral: false,
        estado: "RECHAZADO",
        fechaCreacion: new Date("2026-07-21T12:00:00.000Z"),
      },
    ],
  );

  assert.equal(cobertura[0]?.estadoCoberturaDiseno, "DISENO_RECHAZADO");
  assert.equal(cobertura[0]?.cubiertoPorDiseno, false);
  assert.equal(cobertura[0]?.diseno.idDiseno, 11);
});
