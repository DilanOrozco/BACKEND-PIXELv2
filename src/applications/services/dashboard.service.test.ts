import test from "node:test";
import assert from "node:assert/strict";
import {
  DashboardForbiddenError,
  DashboardNotFoundError,
  DashboardService,
} from "./dashboard.service";
import { ClienteAccessService } from "./cliente-access.service";
import { DashboardRepository } from "../../infrastructure/repositories/dashboard.repository";

const cliente = {
  idCliente: 10,
  nombre: "Ana Cliente",
  correo: "ana@pixel.test",
  telefono: "3001234567",
  estado: true,
};

test("DashboardService cliente usa Cliente vinculado al Usuario autenticado", async (t) => {
  t.mock.method(
    ClienteAccessService.prototype,
    "obtenerClienteDeUsuario",
    async (idUsuario: number) => {
      assert.equal(idUsuario, 77);
      return cliente;
    },
  );
  const contarPedidosMock = t.mock.method(
    DashboardRepository.prototype,
    "contarPedidosCliente",
    async () => 2,
  );
  t.mock.method(
    DashboardRepository.prototype,
    "contarPedidosClientePorEstado",
    async () => [
      { estadoPedido: "PENDIENTE", _count: { _all: 1 } },
      { estadoPedido: "PENDIENTE_SALDO_FINAL", _count: { _all: 1 } },
      { estadoPedido: "FINALIZADO", _count: { _all: 1 } },
    ],
  );
  t.mock.method(
    DashboardRepository.prototype,
    "contarCotizacionesPendientesCliente",
    async () => 1,
  );
  t.mock.method(
    DashboardRepository.prototype,
    "sumarTotalGastadoCliente",
    async () => 50000,
  );
  t.mock.method(
    DashboardRepository.prototype,
    "sumarSaldoPendienteCliente",
    async () => 10000,
  );
  t.mock.method(
    DashboardRepository.prototype,
    "obtenerPedidosActivosCliente",
    async () => [
      {
        idPedido: 5,
        idCliente: 10,
        cliente,
        estadoPedido: "PENDIENTE",
        fechaCreacion: new Date("2026-07-18"),
        total: 50000,
        saldoPendiente: 25000,
        abonos: [],
        detalles: [
          {
            idDetallePedido: 501,
            requiereDiseno: false,
            origenDiseno: "PIXEL",
          },
          {
            idDetallePedido: 502,
            requiereDiseno: true,
            origenDiseno: "PIXEL",
          },
          {
            idDetallePedido: 503,
            requiereDiseno: true,
            origenDiseno: "PIXEL",
          },
        ],
        disenos: [
          {
            idDiseno: 90,
            idDetallePedido: 502,
            esDisenoGeneral: false,
            estado: "APROBADO",
            fechaCreacion: new Date("2026-07-18T12:00:00.000Z"),
          },
        ],
      },
      {
        idPedido: 4,
        idCliente: 10,
        cliente,
        estadoPedido: "PENDIENTE_SALDO_FINAL",
        fechaCreacion: new Date("2026-07-17"),
        total: 70000,
        saldoPendiente: 20000,
        abonos: [],
        disenos: [],
      },
    ],
  );
  t.mock.method(
    DashboardRepository.prototype,
    "obtenerHistorialPedidosCliente",
    async () => [{ idPedido: 4 }],
  );
  t.mock.method(
    DashboardRepository.prototype,
    "obtenerCotizacionesPendientesCliente",
    async () => [{ idCotizacion: 3 }],
  );

  const dashboard = await new DashboardService().obtenerDashboardCliente(
    { idUsuario: 77, rol: "Cliente" },
    { limite: "5" },
  );

  assert.equal(contarPedidosMock.mock.calls[0]?.arguments[0], 10);
  assert.deepEqual(dashboard.cliente, {
    idCliente: 10,
    nombre: "Ana Cliente",
    correo: "ana@pixel.test",
    telefono: "3001234567",
  });
  assert.equal(dashboard.kpis.totalPedidos, 2);
  assert.equal(dashboard.kpis.pedidosPendientes, 1);
  assert.equal(dashboard.kpis.pedidosFinalizados, 1);
  assert.equal(dashboard.pedidoActivo?.idPedido, 5);
  assert.equal(dashboard.pedidoActivo?.cliente.idCliente, 10);
  assert.equal(dashboard.pedidosActivos.length, 2);
  assert.equal(dashboard.pedidosActivos[1]?.idPedido, 4);
  assert.equal(dashboard.pedidosActivos[1]?.estadoPedido, "PENDIENTE_SALDO_FINAL");
  assert.equal(dashboard.pedidoActivo?.totalDisenosRequeridos, 2);
  assert.equal(dashboard.pedidoActivo?.totalDisenosAprobados, 1);
  assert.equal(dashboard.pedidoActivo?.totalDisenosPendientes, 1);
  assert.equal(
    dashboard.pedidoActivo?.detalles[0]?.estadoCoberturaDiseno,
    "NO_REQUIERE_DISENO",
  );
  assert.ok(
    dashboard.pedidosActivos.every((pedido: any) => pedido.cliente.idCliente === 10),
  );
});

test("DashboardService cliente A y cliente B no mezclan ownership de pedidos", async (t) => {
  const clienteA = {
    idCliente: 10,
    nombre: "Cliente A",
    correo: "a@pixel.test",
    telefono: "3000000001",
    estado: true,
  };
  const clienteB = {
    idCliente: 20,
    nombre: "Cliente B",
    correo: "b@pixel.test",
    telefono: "3000000002",
    estado: true,
  };
  t.mock.method(
    ClienteAccessService.prototype,
    "obtenerClienteDeUsuario",
    async (idUsuario: number) => (idUsuario === 77 ? clienteA : clienteB),
  );
  t.mock.method(DashboardRepository.prototype, "contarPedidosCliente", async () => 1);
  t.mock.method(
    DashboardRepository.prototype,
    "contarPedidosClientePorEstado",
    async () => [{ estadoPedido: "PENDIENTE", _count: { _all: 1 } }],
  );
  t.mock.method(
    DashboardRepository.prototype,
    "contarCotizacionesPendientesCliente",
    async () => 0,
  );
  t.mock.method(DashboardRepository.prototype, "sumarTotalGastadoCliente", async () => 0);
  t.mock.method(DashboardRepository.prototype, "sumarSaldoPendienteCliente", async () => 0);
  const pedidosActivosMock = t.mock.method(
    DashboardRepository.prototype,
    "obtenerPedidosActivosCliente",
    async (idCliente: number) => [
      {
        idPedido: idCliente === 10 ? 1 : 2,
        idCliente,
        cliente: idCliente === 10 ? clienteA : clienteB,
        estadoPedido: "EN_PROCESO",
        estadoPago: "COMPLETO",
        total: 10000,
        totalPagado: 10000,
        saldoPendiente: 0,
        abonos: [],
        detalles: [],
        disenos: [],
      },
    ],
  );
  t.mock.method(
    DashboardRepository.prototype,
    "obtenerHistorialPedidosCliente",
    async () => [],
  );
  t.mock.method(
    DashboardRepository.prototype,
    "obtenerCotizacionesPendientesCliente",
    async () => [],
  );

  const dashboardA = await new DashboardService().obtenerDashboardCliente(
    { idUsuario: 77, rol: "Cliente" },
    {},
  );
  const dashboardB = await new DashboardService().obtenerDashboardCliente(
    { idUsuario: 88, rol: "Cliente" },
    {},
  );

  assert.equal(pedidosActivosMock.mock.calls[0]?.arguments[0], 10);
  assert.equal(pedidosActivosMock.mock.calls[1]?.arguments[0], 20);
  const pedidoA = dashboardA.pedidosActivos[0];
  const pedidoB = dashboardB.pedidosActivos[0];
  assert.ok(pedidoA);
  assert.ok(pedidoB);
  assert.equal(pedidoA.cliente.idCliente, 10);
  assert.equal(pedidoA.cliente.nombre, "Cliente A");
  assert.equal(pedidoB.cliente.idCliente, 20);
  assert.equal(pedidoB.cliente.nombre, "Cliente B");
  assert.equal(pedidoA.puedeSolicitarSaldoFinal, false);
  assert.equal(pedidoA.puedeFinalizar, true);
  assert.equal(pedidoA.estadoPasoSaldoFinal, "NO_APLICA");
});

test("DashboardService cliente rechaza usuarios no Cliente", async () => {
  await assert.rejects(
    () =>
      new DashboardService().obtenerDashboardCliente(
        { idUsuario: 1, rol: "Admin" },
        {},
      ),
    DashboardForbiddenError,
  );
});

test("DashboardService cliente responde claro si no hay Cliente vinculado", async (t) => {
  t.mock.method(
    ClienteAccessService.prototype,
    "obtenerClienteDeUsuario",
    async () => {
      throw new Error("El usuario no tiene un cliente vinculado.");
    },
  );

  await assert.rejects(
    () =>
      new DashboardService().obtenerDashboardCliente(
        { idUsuario: 77, rol: "Cliente" },
        {},
      ),
    DashboardNotFoundError,
  );
});
