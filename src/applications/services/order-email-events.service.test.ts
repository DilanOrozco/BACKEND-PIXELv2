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

test("CotizacionService dispara COTIZACION_MODIFICADA al recotizar una cotizacion con precios", async (t) => {
  const cotizacionConPrecios = {
    ...cotizacion,
    subtotal: 3724000,
    descuentoTotal: 798053,
    total: 2925947,
    detalles: [
      {
        ...cotizacion.detalles[0],
        cantidad: 98,
        precioBase: 38000,
        descuentoPorcentaje: 21.43,
        descuentoValorUnitario: 8143,
        precioUnitario: 29857,
        costoDiseno: 0,
        subtotal: 3724000,
        subtotalBruto: 3724000,
        descuentoTotal: 798053,
        subtotalConDescuento: 2925947,
      },
    ],
  };
  t.mock.method(CotizacionRepository.prototype, "buscarPorId", async () => cotizacionConPrecios);
  const cotizarMock = t.mock.method(
    CotizacionRepository.prototype,
    "cotizarCotizacion",
    async (_id: number, data: any, detalles: any[]) => ({
      ...cotizacionConPrecios,
      ...data,
      total: 62000,
      detalles,
    }),
  );
  const notificationMock = t.mock.method(
    NotificationService.prototype,
    "cotizacionModificada",
    async () => ({ event: "COTIZACION_MODIFICADA", cliente: "enviado" }),
  );

  await new CotizacionService().cotizarCotizacion(10, {
    motivoCambio: "Se agrego costo de diseno.",
    costosAdicionales: 2000,
    observaciones: "Ajuste",
    detalles: [
      {
        idDetalleCotizacion: 1,
        precioUnitario: 25000,
        costoDiseno: 10000,
      },
    ],
  });

  assert.equal(notificationMock.mock.calls.length, 1);
  const [, dataCotizacion, detallesCotizados] =
    cotizarMock.mock.calls[0]?.arguments ?? [];
  assert.ok(detallesCotizados);
  assert.equal(dataCotizacion.subtotal, 3724000);
  assert.equal(dataCotizacion.descuentoTotal, 798053);
  assert.equal(dataCotizacion.total, 2937947);
  assert.equal(detallesCotizados[0].subtotalBruto, 3724000);
  assert.equal(detallesCotizados[0].descuentoTotal, 798053);
  assert.equal(detallesCotizados[0].subtotalConDescuento, 2925947);
  assert.equal(detallesCotizados[0].costoDiseno, 10000);
  const opciones = notificationMock.mock.calls[0]?.arguments[1];
  assert.ok(opciones);
  assert.equal(
    opciones.motivoCambio,
    "Se agrego costo de diseno.",
  );
  assert.equal(opciones.totalAnterior, 2925947);
});

test("PedidoService dispara PEDIDO_FINALIZADO y evita duplicar si ya no esta en proceso", async (t) => {
  t.mock.method(PedidoRepository.prototype, "buscarPorId", async () => ({
    ...pedido,
    estadoPedido: "EN_PROCESO",
    estadoPago: "COMPLETO",
    totalPagado: 50000,
    saldoPendiente: 0,
  }));
  t.mock.method(PedidoRepository.prototype, "actualizarPedido", async () => ({
    ...pedido,
    estadoPedido: "FINALIZADO",
    estadoPago: "COMPLETO",
    totalPagado: 50000,
    saldoPendiente: 0,
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

test("PedidoService marca pedido en proceso como pendiente de saldo final y notifica", async (t) => {
  t.mock.method(PedidoRepository.prototype, "buscarPorId", async () => ({
    ...pedido,
    estadoPedido: "EN_PROCESO",
    estadoPago: "PARCIAL",
    totalPagado: 25000,
    saldoPendiente: 25000,
  }));
  const actualizarMock = t.mock.method(
    PedidoRepository.prototype,
    "actualizarPedido",
    async (_idPedido: number, data: any) => ({
      ...pedido,
      ...data,
      estadoPago: "PARCIAL",
      totalPagado: 25000,
      saldoPendiente: 25000,
    }),
  );
  const notificationMock = t.mock.method(
    NotificationService.prototype,
    "pedidoPendienteSaldoFinal",
    async () => ({ event: "PEDIDO_PENDIENTE_SALDO_FINAL", cliente: "enviado" }),
  );

  const resultado = await new PedidoService().marcarPendienteSaldoFinal(
    20,
    { observaciones: "Produccion lista" },
    { idUsuario: 99, rol: "Admin" },
  );

  assert.equal(resultado.estadoPedido, "PENDIENTE_SALDO_FINAL");
  assert.equal(actualizarMock.mock.calls[0]?.arguments[1].estadoPedido, "PENDIENTE_SALDO_FINAL");
  assert.equal(notificationMock.mock.calls.length, 1);
});

test("PedidoService no finaliza pedidos con saldo pendiente ni envia correo de finalizacion", async (t) => {
  t.mock.method(PedidoRepository.prototype, "buscarPorId", async () => ({
    ...pedido,
    estadoPedido: "PENDIENTE_SALDO_FINAL",
    estadoPago: "PARCIAL",
    totalPagado: 25000,
    saldoPendiente: 25000,
  }));
  const actualizarMock = t.mock.method(
    PedidoRepository.prototype,
    "actualizarPedido",
    async () => ({ ...pedido, estadoPedido: "FINALIZADO" }),
  );
  const notificationMock = t.mock.method(
    NotificationService.prototype,
    "pedidoFinalizado",
    async () => ({ event: "PEDIDO_FINALIZADO", cliente: "enviado" }),
  );

  await assert.rejects(
    () =>
      new PedidoService().finalizarPedido(
        20,
        { observaciones: "Listo" },
        { idUsuario: 99, rol: "Admin" },
      ),
    /saldo pendiente/,
  );

  assert.equal(actualizarMock.mock.calls.length, 0);
  assert.equal(notificationMock.mock.calls.length, 0);
});

test("PedidoService confirma entrega de pedido finalizado sin crear una venta nueva", async (t) => {
  t.mock.method(PedidoRepository.prototype, "buscarPorId", async () => ({
    ...pedido,
    estadoPedido: "FINALIZADO",
    estadoPago: "COMPLETO",
    totalPagado: 50000,
    saldoPendiente: 0,
    fechaFinalizado: new Date("2026-01-02"),
  }));
  const actualizarMock = t.mock.method(
    PedidoRepository.prototype,
    "actualizarPedido",
    async (_idPedido: number, data: any) => ({
      ...pedido,
      ...data,
      estadoPago: "COMPLETO",
      totalPagado: 50000,
      saldoPendiente: 0,
    }),
  );
  const notificationMock = t.mock.method(
    NotificationService.prototype,
    "pedidoEntregado",
    async () => ({ event: "PEDIDO_ENTREGADO", cliente: "enviado" }),
  );

  const resultado = await new PedidoService().confirmarEntrega(
    20,
    { observaciones: "Cliente reclamo en tienda" },
    { idUsuario: 99, rol: "Admin" },
  );

  assert.equal(resultado.estadoPedido, "ENTREGADO");
  assert.equal(actualizarMock.mock.calls.length, 1);
  assert.equal(actualizarMock.mock.calls[0]?.arguments[1].estadoPedido, "ENTREGADO");
  assert.equal(notificationMock.mock.calls.length, 1);
});

test("PedidoService bloquea entrega con saldo pendiente, estado invalido o entrega duplicada", async (t) => {
  const actualizarMock = t.mock.method(
    PedidoRepository.prototype,
    "actualizarPedido",
    async () => ({ ...pedido, estadoPedido: "ENTREGADO" }),
  );
  const notificationMock = t.mock.method(
    NotificationService.prototype,
    "pedidoEntregado",
    async () => ({ event: "PEDIDO_ENTREGADO", cliente: "enviado" }),
  );

  t.mock.method(PedidoRepository.prototype, "buscarPorId", async () => ({
    ...pedido,
    estadoPedido: "FINALIZADO",
    estadoPago: "PARCIAL",
    totalPagado: 25000,
    saldoPendiente: 25000,
  }));
  await assert.rejects(
    () => new PedidoService().confirmarEntrega(20, {}, { idUsuario: 99, rol: "Admin" }),
    /saldo pendiente/,
  );

  t.mock.restoreAll();
  t.mock.method(PedidoRepository.prototype, "buscarPorId", async () => ({
    ...pedido,
    estadoPedido: "EN_PROCESO",
    estadoPago: "COMPLETO",
    totalPagado: 50000,
    saldoPendiente: 0,
  }));
  await assert.rejects(
    () => new PedidoService().confirmarEntrega(20, {}, { idUsuario: 99, rol: "Admin" }),
    /FINALIZADO/,
  );

  t.mock.restoreAll();
  const actualizarDuplicadoMock = t.mock.method(
    PedidoRepository.prototype,
    "actualizarPedido",
    async () => ({ ...pedido, estadoPedido: "ENTREGADO" }),
  );
  const notificationDuplicadoMock = t.mock.method(
    NotificationService.prototype,
    "pedidoEntregado",
    async () => ({ event: "PEDIDO_ENTREGADO", cliente: "enviado" }),
  );
  t.mock.method(PedidoRepository.prototype, "buscarPorId", async () => ({
    ...pedido,
    estadoPedido: "ENTREGADO",
    estadoPago: "COMPLETO",
    totalPagado: 50000,
    saldoPendiente: 0,
  }));
  await assert.rejects(
    () => new PedidoService().confirmarEntrega(20, {}, { idUsuario: 99, rol: "Admin" }),
    /ya fue entregado/,
  );

  assert.equal(actualizarMock.mock.calls.length, 0);
  assert.equal(notificationMock.mock.calls.length, 0);
  assert.equal(actualizarDuplicadoMock.mock.calls.length, 0);
  assert.equal(notificationDuplicadoMock.mock.calls.length, 0);
});
