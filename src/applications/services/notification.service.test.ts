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

const contar = (contenido: string, patron: RegExp) =>
  [...contenido.matchAll(patron)].length;

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
  assert.equal(contar(correoCliente.text, /Subtotal bruto:/g), 1);
  assert.equal(contar(correoCliente.text, /Valor descontado:/g), 1);
  assert.equal(contar(correoCliente.text, /Subtotal con descuento:/g), 1);
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
  assert.match(correoCliente.text, /Subtotal bruto:.*60\.000\.000/);
  assert.match(correoCliente.text, /Descuento aplicado: Sin descuento \/ 0%/);
  assert.match(correoCliente.text, /Total final:.*60\.000\.000/);
  assert.equal(contar(correoCliente.text, /Subtotal bruto:/g), 1);
  assertContenidoLimpio(correoCliente.text);

  if (staffAnterior !== undefined) {
    process.env.STAFF_EMAIL = staffAnterior;
  }
});

test("NotificationService envia cotizacion presencial valorizada con acceso seguro", async (t) => {
  const sendMailMock = t.mock.method(
    EmailService.prototype,
    "sendMail",
    async () => ({ sent: true, skipped: false }),
  );

  const resultado = await new NotificationService().cotizacionPresencialCreada({
    ...pedido,
    idCotizacion: 101,
    cliente,
    observaciones: "Entrega urgente",
    accesoCliente: {
      usuarioCreado: true,
      linkCrearPassword: "https://pixel.test/crear-password-cliente/token-seguro",
    },
  });
  const correoCliente = sendMailMock.mock.calls[0]?.arguments[0];

  assert.deepEqual(resultado, {
    event: "COTIZACION_PRESENCIAL_CREADA",
    cliente: "enviado",
  });
  if (!correoCliente) {
    assert.fail("Debe enviar el correo de cotizacion presencial.");
  }

  assert.match(correoCliente.subject, /cotizacion presencial/i);
  assert.match(correoCliente.text, /Subtotal antes de descuento:.*60\.000\.000/);
  assert.match(correoCliente.text, /Valor descontado:.*9\.000\.000/);
  assert.match(correoCliente.text, /Total final:.*51\.000\.000/);
  assert.match(correoCliente.text, /Crea tu contrasena aqui:/i);
  assert.doesNotMatch(correoCliente.text, /contrasena temporal|password temporal/i);
  assertContenidoLimpio(correoCliente.text);
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
  assert.match(mail.text, /Numero de pedido: 20/i);
  assert.doesNotMatch(mail.text, /cotizacion #/i);
  assert.match(mail.text, /Subtotal antes de descuento:.*60\.000\.000/);
  assert.match(mail.text, /Valor descontado:.*9\.000\.000/);
  assert.match(mail.text, /Total final:.*51\.000\.000/);
  assertContenidoLimpio(mail.text);
});

test("NotificationService envia evento COTIZACION_MODIFICADA con motivo", async (t) => {
  const sendMailMock = t.mock.method(
    EmailService.prototype,
    "sendMail",
    async () => ({ sent: true, skipped: false }),
  );

  const resultado = await new NotificationService().cotizacionModificada(
    {
      ...pedido,
      cliente,
    },
    {
      motivoCambio: "Se agrego costo de diseno.",
      totalAnterior: 50000000,
    },
  );
  const mail = sendMailMock.mock.calls[0]?.arguments[0];

  assert.ok(mail);
  assert.deepEqual(resultado, {
    event: "COTIZACION_MODIFICADA",
    cliente: "enviado",
  });
  assert.match(mail.subject, /modificada/i);
  assert.match(mail.text, /Tu cotizacion fue modificada/);
  assert.match(mail.text, /Motivo del cambio: Se agrego costo de diseno/);
  assert.match(mail.text, /Total anterior:.*50\.000\.000/);
  assert.match(mail.text, /Total final:.*51\.000\.000/);
  assert.doesNotMatch(mail.text, /cotizacion #/i);
  assertContenidoLimpio(mail.text);
});

test("NotificationService cotizacion modificada conserva snapshots al cambiar solo costo de diseno", async (t) => {
  const sendMailMock = t.mock.method(
    EmailService.prototype,
    "sendMail",
    async () => ({ sent: true, skipped: false }),
  );

  await new NotificationService().cotizacionModificada(
    {
      idCotizacion: 77,
      cliente,
      subtotal: 3724000,
      descuentoTotal: 798053,
      costosAdicionales: 0,
      total: 2945947,
      observaciones: "Se agrego costo de diseno",
      detalles: [
        {
          descripcion: "Camiseta",
          cantidad: 98,
          precioBase: 38000,
          descuentoPorcentaje: 21.43,
          descuentoValorUnitario: 8143,
          precioUnitario: 29857,
          subtotal: 3724000,
          subtotalBruto: 3724000,
          descuentoTotal: 798053,
          subtotalConDescuento: 2925947,
          costoDiseno: 20000,
          producto: {
            nombre: "Camiseta",
            categoriaProducto: { nombre: "Textiles" },
          },
        },
      ],
    },
    { totalAnterior: 2925947 },
  );
  const mail = sendMailMock.mock.calls[0]?.arguments[0];

  assert.ok(mail);
  assert.match(mail.text, /Camiseta \(Textiles\)/);
  assert.match(mail.text, /Descuento aplicado: 21,43%/);
  assert.match(mail.text, /Subtotal bruto:.*3\.724\.000/);
  assert.match(mail.text, /Valor descontado:.*798\.053/);
  assert.match(mail.text, /Subtotal con descuento:.*2\.925\.947/);
  assert.match(mail.text, /Costo de diseno:.*20\.000/);
  assert.match(mail.text, /Costos adicionales:.*0/);
  assert.match(mail.text, /Total final:.*2\.945\.947/);
  assert.equal(contar(mail.text, /Subtotal bruto:/g), 1);
  assert.equal(contar(mail.text, /Descuento aplicado:/g), 1);
  assert.equal(contar(mail.text, /Valor descontado:/g), 1);
  assert.equal(contar(mail.text, /Subtotal con descuento:/g), 1);
  assert.equal(contar(mail.text, /Costo de diseno:/g), 1);
  assertContenidoLimpio(mail.text);
});

test("NotificationService cotizacion modificada con costos adicionales conserva descuento", async (t) => {
  const sendMailMock = t.mock.method(
    EmailService.prototype,
    "sendMail",
    async () => ({ sent: true, skipped: false }),
  );

  await new NotificationService().cotizacionModificada({
    idCotizacion: 78,
    cliente,
    subtotal: 3724000,
    descuentoTotal: 798053,
    costosAdicionales: 50000,
    total: 2975947,
    detalles: [
      {
        descripcion: "Camiseta",
        cantidad: 98,
        precioBase: 38000,
        descuentoPorcentaje: 21.43,
        precioUnitario: 29857,
        subtotalBruto: 3724000,
        descuentoTotal: 798053,
        subtotalConDescuento: 2925947,
        costoDiseno: 0,
      },
    ],
  });
  const mail = sendMailMock.mock.calls[0]?.arguments[0];

  assert.ok(mail);
  assert.match(mail.text, /Descuento aplicado: 21,43%/);
  assert.match(mail.text, /Costos adicionales:.*50\.000/);
  assert.match(mail.text, /Total final:.*2\.975\.947/);
  assertContenidoLimpio(mail.text);
});

test("NotificationService cotizacion modificada sin motivo usa texto generico", async (t) => {
  const sendMailMock = t.mock.method(
    EmailService.prototype,
    "sendMail",
    async () => ({ sent: true, skipped: false }),
  );

  await new NotificationService().cotizacionModificada({
    ...pedido,
    cliente,
  });
  const mail = sendMailMock.mock.calls[0]?.arguments[0];

  assert.ok(mail);
  assert.match(mail.text, /Motivo del cambio: Se realizaron ajustes en la cotizacion/);
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

test("NotificationService envia evento PEDIDO_PENDIENTE_SALDO_FINAL", async (t) => {
  const sendMailMock = t.mock.method(
    EmailService.prototype,
    "sendMail",
    async () => ({ sent: true, skipped: false }),
  );

  const resultado = await new NotificationService().pedidoPendienteSaldoFinal({
    ...pedido,
    estadoPedido: "PENDIENTE_SALDO_FINAL",
    totalPagado: 25000000,
    saldoPendiente: 26000000,
  });
  const mail = sendMailMock.mock.calls[0]?.arguments[0];

  assert.ok(mail);
  assert.equal(resultado.event, "PEDIDO_PENDIENTE_SALDO_FINAL");
  assert.equal(resultado.cliente, "enviado");
  assert.match(mail.subject, /termino produccion/i);
  assert.match(mail.text, /Saldo pendiente:.*26\.000\.000/);
  assert.doesNotMatch(mail.text, /listo para reclamar/i);
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
