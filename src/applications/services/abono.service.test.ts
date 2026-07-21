import test from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "../../../generated/prisma/client";
import { AbonoService } from "./abono.service";
import { NotificationService } from "./notification.service";
import { AbonoRepository } from "../../infrastructure/repositories/abono.repository";

const admin = { idUsuario: 99, rol: "Admin" };

const pedidoBase = {
  idPedido: 1,
  idCliente: 10,
  estadoPedido: "PENDIENTE",
  estadoPago: "PENDIENTE",
  total: 100000,
  totalPagado: 0,
  saldoPendiente: 100000,
  cliente: {
    idCliente: 10,
    nombre: "Cliente A",
    documento: null,
    correo: "cliente@pixel.test",
    telefono: "3000000000",
    direccion: null,
  },
};

const abonoPendiente = {
  idAbono: 5,
  idPedido: 1,
  monto: 50000,
  metodoPago: "EFECTIVO",
  referencia: null,
  comprobanteUrl: null,
  estado: "PENDIENTE",
  fechaCreacion: new Date("2026-01-01"),
  confirmadoPorId: null,
  fechaConfirmacion: null,
  rechazadoPorId: null,
  fechaRechazo: null,
  motivoRechazo: null,
  pedido: pedidoBase,
  confirmadoPor: null,
  rechazadoPor: null,
};

const abonoConfirmado = {
  ...abonoPendiente,
  estado: "CONFIRMADO",
  confirmadoPorId: 99,
  fechaConfirmacion: new Date("2026-01-01"),
};

const transaccionFake = async <T>(
  handler: (tx: Prisma.TransactionClient) => Promise<T>,
) => handler({} as Prisma.TransactionClient);

test("AbonoService registra abono sin confirmar", async (t) => {
  t.mock.method(
    AbonoRepository.prototype,
    "buscarPedidoPorId",
    async () => pedidoBase,
  );
  const crearMock = t.mock.method(
    AbonoRepository.prototype,
    "crearAbono",
    async (_data: unknown) => abonoPendiente,
  );

  const abono = await new AbonoService(transaccionFake).crearAbono(
    {
      idPedido: 1,
      monto: 50000,
      metodoPago: "EFECTIVO",
    },
    admin,
  );

  assert.equal(abono?.estado, "PENDIENTE");
  assert.equal(crearMock.mock.calls.length, 1);
  assert.equal((crearMock.mock.calls[0]?.arguments[0] as any).estado, "PENDIENTE");
  assert.equal((abono as any).totalPedido, 100000);
  assert.equal((abono as any).totalConfirmado, 0);
  assert.equal((abono as any).saldoPendiente, 100000);
  assert.equal((abono as any).montoMinimoPrimerAbono, 50000);
  assert.equal((abono as any).estadoPago, "PENDIENTE");
});

test("AbonoService registra abono confirmado y envia evento despues de DB", async (t) => {
  let dentroTransaccion = false;
  const transaccionControlada = async <T>(
    handler: (tx: Prisma.TransactionClient) => Promise<T>,
  ) => {
    dentroTransaccion = true;
    const resultado = await handler({} as Prisma.TransactionClient);
    dentroTransaccion = false;
    return resultado;
  };

  t.mock.method(
    AbonoRepository.prototype,
    "buscarPedidoPorId",
    async () => pedidoBase,
  );
  t.mock.method(
    AbonoRepository.prototype,
    "sumarAbonosConfirmados",
    async () => 0,
  );
  t.mock.method(
    AbonoRepository.prototype,
    "crearAbonoOperacion",
    async () => ({ idAbono: 5, idPedido: 1, monto: 50000, estado: "CONFIRMADO" }),
  );
  t.mock.method(
    AbonoRepository.prototype,
    "actualizarResumenPagoPedido",
    async (_idPedido: number, data: unknown) => data,
  );
  t.mock.method(
    AbonoRepository.prototype,
    "existeDisenoAprobado",
    async () => false,
  );
  t.mock.method(
    AbonoRepository.prototype,
    "buscarPorId",
    async () => abonoConfirmado,
  );
  const notificationMock = t.mock.method(
    NotificationService.prototype,
    "primerAbonoConfirmado",
    async () => {
      assert.equal(dentroTransaccion, false);
      return { event: "PRIMER_ABONO_CONFIRMADO", cliente: "enviado" };
    },
  );

  const abono = await new AbonoService(transaccionControlada).crearAbono(
    {
      idPedido: 1,
      monto: 50000,
      metodoPago: "EFECTIVO",
      confirmar: true,
    },
    admin,
  );

  assert.equal(abono?.estado, "CONFIRMADO");
  assert.equal(notificationMock.mock.calls.length, 1);
});

test("AbonoService confirmar primer abono envia evento y actualiza saldo", async (t) => {
  t.mock.method(
    AbonoRepository.prototype,
    "buscarPorIdOperacion",
    async () => ({ idAbono: 5, idPedido: 1, monto: 50000, estado: "PENDIENTE" }),
  );
  t.mock.method(
    AbonoRepository.prototype,
    "buscarPedidoPorId",
    async () => pedidoBase,
  );
  t.mock.method(
    AbonoRepository.prototype,
    "sumarAbonosConfirmados",
    async () => 0,
  );
  const actualizarPagoMock = t.mock.method(
    AbonoRepository.prototype,
    "actualizarResumenPagoPedido",
    async (_idPedido: number, data: unknown) => data,
  );
  t.mock.method(
    AbonoRepository.prototype,
    "actualizarAbonoOperacion",
    async () => ({ idAbono: 5, idPedido: 1, monto: 50000, estado: "CONFIRMADO" }),
  );
  t.mock.method(
    AbonoRepository.prototype,
    "existeDisenoAprobado",
    async () => false,
  );
  t.mock.method(
    AbonoRepository.prototype,
    "buscarPorId",
    async () => abonoConfirmado,
  );
  const notificationMock = t.mock.method(
    NotificationService.prototype,
    "primerAbonoConfirmado",
    async () => ({ event: "PRIMER_ABONO_CONFIRMADO", cliente: "enviado" }),
  );

  const abono = await new AbonoService(transaccionFake).confirmarAbono(
    5,
    admin,
  );

  const pago = actualizarPagoMock.mock.calls[0]?.arguments[1] as any;
  assert.equal(abono?.estado, "CONFIRMADO");
  assert.equal(pago.totalPagado, 50000);
  assert.equal(pago.saldoPendiente, 50000);
  assert.equal(pago.estadoPago, "PARCIAL");
  assert.equal(notificationMock.mock.calls.length, 1);
});

test("AbonoService confirmar segundo abono no reenvia evento de primer abono", async (t) => {
  t.mock.method(
    AbonoRepository.prototype,
    "buscarPorIdOperacion",
    async () => ({ idAbono: 6, idPedido: 1, monto: 50000, estado: "PENDIENTE" }),
  );
  t.mock.method(
    AbonoRepository.prototype,
    "buscarPedidoPorId",
    async () => pedidoBase,
  );
  t.mock.method(
    AbonoRepository.prototype,
    "sumarAbonosConfirmados",
    async () => 50000,
  );
  t.mock.method(
    AbonoRepository.prototype,
    "actualizarResumenPagoPedido",
    async (_idPedido: number, data: unknown) => data,
  );
  t.mock.method(
    AbonoRepository.prototype,
    "actualizarAbonoOperacion",
    async () => ({ idAbono: 6, idPedido: 1, monto: 50000, estado: "CONFIRMADO" }),
  );
  t.mock.method(
    AbonoRepository.prototype,
    "existeDisenoAprobado",
    async () => false,
  );
  t.mock.method(
    AbonoRepository.prototype,
    "buscarPorId",
    async () => ({ ...abonoConfirmado, idAbono: 6 }),
  );
  const notificationMock = t.mock.method(
    NotificationService.prototype,
    "primerAbonoConfirmado",
    async () => ({ event: "PRIMER_ABONO_CONFIRMADO", cliente: "enviado" }),
  );

  await new AbonoService(transaccionFake).confirmarAbono(6, admin);

  assert.equal(notificationMock.mock.calls.length, 0);
});

test("AbonoService no confirma dos veces el mismo abono", async (t) => {
  t.mock.method(
    AbonoRepository.prototype,
    "buscarPorIdOperacion",
    async () => ({ idAbono: 5, idPedido: 1, monto: 50000, estado: "CONFIRMADO" }),
  );
  const actualizarMock = t.mock.method(
    AbonoRepository.prototype,
    "actualizarAbonoOperacion",
    async () => abonoConfirmado,
  );

  await assert.rejects(
    () => new AbonoService(transaccionFake).confirmarAbono(5, admin),
    /El abono ya fue confirmado/,
  );
  assert.equal(actualizarMock.mock.calls.length, 0);
});

test("AbonoService responde error controlado si el pedido no existe", async (t) => {
  t.mock.method(
    AbonoRepository.prototype,
    "buscarPedidoPorId",
    async () => null,
  );

  await assert.rejects(
    () =>
      new AbonoService(transaccionFake).crearAbono(
        {
          idPedido: 999,
          monto: 50000,
          metodoPago: "EFECTIVO",
        },
        admin,
      ),
    /Pedido no encontrado/,
  );
});

test("AbonoService pago completo deja saldo cero y estado COMPLETO", async () => {
  const service = new AbonoService(transaccionFake);

  assert.equal(service.calcularEstadoPago(100000, 100000), "COMPLETO");
});
