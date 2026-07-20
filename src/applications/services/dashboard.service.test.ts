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
        estadoPedido: "PENDIENTE",
        fechaCreacion: new Date("2026-07-18"),
        total: 50000,
        saldoPendiente: 25000,
        abonos: [],
        disenos: [],
      },
      {
        idPedido: 4,
        idCliente: 10,
        estadoPedido: "EN_PROCESO",
        fechaCreacion: new Date("2026-07-17"),
        total: 70000,
        saldoPendiente: 0,
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
  assert.equal(dashboard.pedidosActivos.length, 2);
  assert.equal(dashboard.pedidosActivos[1]?.idPedido, 4);
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
