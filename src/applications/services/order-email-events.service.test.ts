import test from "node:test";
import assert from "node:assert/strict";
import { CotizacionService } from "./cotizacion.service";
import { PedidoService } from "./pedido.service";
import { NotificationService } from "./notification.service";
import { CotizacionRepository } from "../../infrastructure/repositories/cotizacion.repository";
import { PedidoRepository } from "../../infrastructure/repositories/pedido.repository";

const cliente = {
  idCliente: 1,
  nombre: "Ana Cliente",
  correo: "ana@pixel.test",
};

const cotizacion = {
  idCotizacion: 10,
  idCliente: 1,
  estado: "PENDIENTE",
  total: 50000,
  subtotal: 50000,
  costosAdicionales: 0,
  cliente,
  detalles: [
    {
      idDetalleCotizacion: 1,
      idProducto: 1,
      idTecnica: null,
      descripcion: "Camiseta",
      cantidad: 2,
      precioUnitario: 25000,
      costoDiseno: 0,
      subtotal: 50000,
      observaciones: null,
    },
  ],
};

const pedido = {
  idPedido: 20,
  idCotizacion: 10,
  idCliente: 1,
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
  cliente,
  detalles: [
    {
      descripcion: "Camiseta",
      cantidad: 2,
      precioUnitario: 25000,
      subtotal: 50000,
    },
  ],
};

test("CotizacionService dispara PEDIDO_CREADO_DESDE_COTIZACION al aprobar", async (t) => {
  t.mock.method(CotizacionRepository.prototype, "buscarPorId", async () => cotizacion);
  t.mock.method(
    CotizacionRepository.prototype,
    "aprobarYCrearPedido",
    async () => ({ cotizacion: { ...cotizacion, estado: "APROBADA" }, pedido }),
  );
  const notificationMock = t.mock.method(
    NotificationService.prototype,
    "pedidoCreadoDesdeCotizacion",
    async () => ({ event: "PEDIDO_CREADO_DESDE_COTIZACION", cliente: "enviado" }),
  );

  const resultado = await new CotizacionService().aprobarCotizacion(10, {
    idUsuario: 99,
    rol: "Admin",
  });

  assert.equal(resultado.pedido.idPedido, 20);
  assert.equal(notificationMock.mock.calls.length, 1);
  assert.equal(notificationMock.mock.calls[0]?.arguments[0].cliente.correo, "ana@pixel.test");
});

test("PedidoService dispara PEDIDO_FINALIZADO y evita duplicar si ya no esta en proceso", async (t) => {
  t.mock.method(PedidoRepository.prototype, "buscarPorId", async () => ({
    ...pedido,
    estadoPedido: "EN_PROCESO",
  }));
  t.mock.method(PedidoRepository.prototype, "actualizarPedido", async () => ({
    ...pedido,
    estadoPedido: "FINALIZADO",
    fechaFinalizado: new Date("2026-01-02"),
  }));
  const notificationMock = t.mock.method(
    NotificationService.prototype,
    "pedidoFinalizado",
    async () => ({ event: "PEDIDO_FINALIZADO", cliente: "enviado" }),
  );

  const service = new PedidoService();
  const finalizado = await service.finalizarPedido(
    20,
    { observaciones: "Listo" },
    { idUsuario: 99, rol: "Admin" },
  );

  assert.equal(finalizado.estadoPedido, "FINALIZADO");
  assert.equal(notificationMock.mock.calls.length, 1);

  t.mock.restoreAll();
  t.mock.method(PedidoRepository.prototype, "buscarPorId", async () => ({
    ...pedido,
    estadoPedido: "FINALIZADO",
  }));
  const notificationDuplicadoMock = t.mock.method(
    NotificationService.prototype,
    "pedidoFinalizado",
    async () => ({ event: "PEDIDO_FINALIZADO", cliente: "enviado" }),
  );

  await assert.rejects(
    () =>
      service.finalizarPedido(
        20,
        { observaciones: "Listo otra vez" },
        { idUsuario: 99, rol: "Admin" },
      ),
    /Solo se pueden finalizar pedidos en proceso/,
  );
  assert.equal(notificationDuplicadoMock.mock.calls.length, 0);
});
