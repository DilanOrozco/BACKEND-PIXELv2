import test from "node:test";
import assert from "node:assert/strict";
import { DashboardService } from "./dashboard.service";
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
    "obtenerPedidoActivoCliente",
    async () => ({ idPedido: 5, idCliente: 10 }),
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
});
