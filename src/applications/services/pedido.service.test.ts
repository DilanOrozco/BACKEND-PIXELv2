import test from "node:test";
import assert from "node:assert/strict";
import { PedidoService } from "./pedido.service";
import { PedidoRepository } from "../../infrastructure/repositories/pedido.repository";
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
      },
      {
        idProducto: 2,
        idTecnica: 1,
        descripcion: "Gorra",
        cantidad: 2,
        precioUnitario: 13000,
        subtotal: 26000,
        subtotalConDescuento: 26000,
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
        producto: { idProducto: 1, nombre: "Camiseta" },
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
        producto: { idProducto: 2, nombre: "Logo adicional" },
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
