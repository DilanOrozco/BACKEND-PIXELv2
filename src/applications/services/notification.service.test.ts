import test from "node:test";
import assert from "node:assert/strict";
import { EmailService } from "./email.service";
import { NotificationService } from "./notification.service";

const cliente = {
  idCliente: 1,
  nombre: "Ana Cliente",
  correo: "ana@pixel.test",
  telefono: "3001234567",
};

const pedido = {
  idPedido: 20,
  idCotizacion: 10,
  estadoPedido: "PENDIENTE",
  total: 50000,
  cliente,
  detalles: [
    {
      descripcion: "Camiseta",
      cantidad: 2,
      precioUnitario: 25000,
      subtotal: 50000,
      producto: {
        nombre: "Camiseta",
        categoriaProducto: { nombre: "Textiles" },
      },
    },
  ],
};

test("NotificationService envia evento PEDIDO_CREADO_DESDE_COTIZACION", async (t) => {
  const sendMailMock = t.mock.method(
    EmailService.prototype,
    "sendMail",
    async () => ({ sent: true, skipped: false }),
  );

  const resultado = await new NotificationService().pedidoCreadoDesdeCotizacion(pedido);
  const mail = sendMailMock.mock.calls[0]?.arguments[0];

  assert.ok(mail);
  assert.deepEqual(resultado, {
    event: "PEDIDO_CREADO_DESDE_COTIZACION",
    cliente: "enviado",
  });
  assert.equal(mail.to, "ana@pixel.test");
  assert.match(mail.subject, /cotizacion fue aprobada/i);
  assert.match(mail.text, /pedido #20/i);
});

test("NotificationService envia evento PRIMER_ABONO_CONFIRMADO", async (t) => {
  const sendMailMock = t.mock.method(
    EmailService.prototype,
    "sendMail",
    async () => ({ sent: true, skipped: false }),
  );
  const abono = { idAbono: 1, monto: 25000, pedido };

  const resultado = await new NotificationService().primerAbonoConfirmado(abono);
  const mail = sendMailMock.mock.calls[0]?.arguments[0];

  assert.ok(mail);
  assert.equal(resultado.event, "PRIMER_ABONO_CONFIRMADO");
  assert.equal(resultado.cliente, "enviado");
  assert.match(mail.subject, /Abono confirmado/);
  assert.match(mail.text, /pedido #20/i);
});

test("NotificationService envia evento PEDIDO_FINALIZADO", async (t) => {
  const sendMailMock = t.mock.method(
    EmailService.prototype,
    "sendMail",
    async () => ({ sent: true, skipped: false }),
  );

  const resultado = await new NotificationService().pedidoFinalizado({
    ...pedido,
    estadoPedido: "FINALIZADO",
  });
  const mail = sendMailMock.mock.calls[0]?.arguments[0];

  assert.ok(mail);
  assert.equal(resultado.event, "PEDIDO_FINALIZADO");
  assert.equal(resultado.cliente, "enviado");
  assert.match(mail.subject, /listo para reclamar/);
});

test("NotificationService omite sin correo y no rompe si SMTP falla", async (t) => {
  t.mock.method(console, "warn", () => undefined);
  t.mock.method(console, "error", () => undefined);
  const sendMailMock = t.mock.method(
    EmailService.prototype,
    "sendMail",
    async () => {
      throw new Error("SMTP down");
    },
  );

  const sinCorreo = await new NotificationService().pedidoFinalizado({
    ...pedido,
    cliente: { ...cliente, correo: null },
  });
  const conFallo = await new NotificationService().pedidoFinalizado(pedido);

  assert.equal(sinCorreo.cliente, "omitido");
  assert.equal(sendMailMock.mock.calls.length, 1);
  assert.equal(conFallo.cliente, "error");
});
