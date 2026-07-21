import test from "node:test";
import assert from "node:assert/strict";
import { PedidoService } from "./pedido.service";
import { PedidoRepository } from "../../infrastructure/repositories/pedido.repository";

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
    total: 90000,
    detalles: [
      {
        idProducto: 1,
        idTecnica: 1,
        descripcion: "Camiseta",
        cantidad: 3,
        precioUnitario: 30000,
        subtotal: 90000,
      },
    ],
  };

  const pedido = new PedidoService().prepararPedidoDesdeCotizacion(
    cotizacion,
    {},
    { idUsuario: 99, idCliente: 10, rol: "Admin" },
  );

  assert.equal(pedido.idCliente, 20);
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
