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
  subtotal: 60000000,
  subtotalBruto: 60000000,
  descuentoTotal: 9000000,
  costosAdicionales: 0,
  total: 51000000,
  cliente,
  detalles: [
    {
      descripcion: "Camiseta",
      cantidad: 2000,
      precioBase: 30000,
      descuentoPorcentaje: 15,
      descuentoValorUnitario: 4500,
      precioUnitario: 25500,
      subtotal: 60000000,
      subtotalBruto: 60000000,
      descuentoTotal: 9000000,
      subtotalConDescuento: 51000000,
      producto: {
        nombre: "Camiseta",
        categoriaProducto: { nombre: "Textiles" },
      },
    },
  ],
};

const assertContenidoLimpio = (contenido: string) => {
  assert.doesNotMatch(contenido, /NaN/);
  assert.doesNotMatch(contenido, /undefined/);
  assert.doesNotMatch(contenido, /null/);
};

test("NotificationService email de cotizacion publica muestra desglose con descuento y staff", async (t) => {
  const staffAnterior = process.env.STAFF_EMAIL;
  process.env.STAFF_EMAIL = "staff@pixel.test";
  const sendMailMock = t.mock.method(
    EmailService.prototype,
    "sendMail",
    async () => ({ sent: true, skipped: false }),
  );

  const resultado = await new NotificationService().cotizacionCreada({
    ...pedido,
    idCotizacion: 99,
    cliente,
    observaciones: "Entrega urgente",
  });
  const correoCliente = sendMailMock.mock.calls[0]?.arguments[0];
  const correoStaff = sendMailMock.mock.calls[1]?.arguments[0];

  assert.deepEqual(resultado, {
    event: "COTIZACION_CREADA",
    cliente: "enviado",
    staff: "enviado",
  });
  assert.ok(correoCliente);
  assert.ok(correoStaff);
  assert.match(correoCliente.text, /Precio base unitario:.*30\.000/);
  assert.match(correoCliente.text, /Descuento aplicado: 15%/);
  assert.match(correoCliente.text, /Precio unitario con descuento:.*25\.500/);
  assert.match(correoCliente.text, /Subtotal bruto:.*60\.000\.000/);
  assert.match(correoCliente.text, /Valor descontado:.*9\.000\.000/);
  assert.match(correoCliente.text, /Subtotal con descuento:.*51\.000\.000/);
  assert.match(correoCliente.text, /Total final:.*51\.000\.000/);
  assert.match(correoStaff.subject, /Nueva cotizacion publica/i);
  assert.match(correoStaff.text, /Valor descontado:.*9\.000\.000/);
  assertContenidoLimpio(correoCliente.text);
  assertContenidoLimpio(correoCliente.html ?? "");
  assertContenidoLimpio(correoStaff.text);

  if (staffAnterior === undefined) {
    delete process.env.STAFF_EMAIL;
  } else {
    process.env.STAFF_EMAIL = staffAnterior;
  }
});

test("NotificationService email de cotizacion publica sin descuento muestra total claro", async (t) => {
  const staffAnterior = process.env.STAFF_EMAIL;
  delete process.env.STAFF_EMAIL;
  const sendMailMock = t.mock.method(
    EmailService.prototype,
    "sendMail",
    async () => ({ sent: true, skipped: false }),
  );

  const cotizacionSinDescuento = {
    idCotizacion: 100,
    cliente,
    subtotal: 60000000,
    subtotalBruto: 60000000,
    descuentoTotal: 0,
    costosAdicionales: 0,
    total: 60000000,
    observaciones: null,
    detalles: [
      {
        descripcion: "Camiseta",
        cantidad: 2000,
        precioBase: 30000,
        descuentoPorcentaje: 0,
        descuentoValorUnitario: 0,
        precioUnitario: 30000,
        subtotal: 60000000,
        subtotalBruto: 60000000,
        descuentoTotal: 0,
        subtotalConDescuento: 60000000,
      },
    ],
  };

  await new NotificationService().cotizacionCreada(cotizacionSinDescuento);
  const correoCliente = sendMailMock.mock.calls[0]?.arguments[0];

  assert.ok(correoCliente);
  assert.match(correoCliente.text, /Subtotal:.*60\.000\.000/);
  assert.match(correoCliente.text, /Descuento aplicado: Sin descuento \/ 0%/);
  assert.match(correoCliente.text, /Total final:.*60\.000\.000/);
  assertContenidoLimpio(correoCliente.text);

  if (staffAnterior !== undefined) {
    process.env.STAFF_EMAIL = staffAnterior;
  }
});

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
  assert.match(mail.text, /Subtotal antes de descuento:.*60\.000\.000/);
  assert.match(mail.text, /Valor descontado:.*9\.000\.000/);
  assert.match(mail.text, /Total final:.*51\.000\.000/);
  assertContenidoLimpio(mail.text);
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
  assert.match(mail.text, /Total del pedido:.*51\.000\.000/);
  assertContenidoLimpio(mail.text);
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
  assert.match(mail.text, /Subtotal antes de descuento:.*60\.000\.000/);
  assert.match(mail.text, /Total final:.*51\.000\.000/);
  assertContenidoLimpio(mail.text);
});

test("NotificationService soporta cotizaciones antiguas sin campos nuevos", async (t) => {
  const sendMailMock = t.mock.method(
    EmailService.prototype,
    "sendMail",
    async () => ({ sent: true, skipped: false }),
  );

  await new NotificationService().pedidoCreadoDesdeCotizacion({
    ...pedido,
    subtotal: 50000,
    subtotalBruto: undefined,
    descuentoTotal: undefined,
    total: 50000,
    detalles: [
      {
        descripcion: "Camiseta antigua",
        cantidad: 2,
        precioUnitario: 25000,
        subtotal: 50000,
      },
    ],
  });
  const mail = sendMailMock.mock.calls[0]?.arguments[0];

  assert.ok(mail);
  assert.match(mail.text, /Subtotal:.*50\.000/);
  assert.match(mail.text, /Descuento aplicado: Sin descuento \/ 0%/);
  assert.match(mail.text, /Total final:.*50\.000/);
  assertContenidoLimpio(mail.text);
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
