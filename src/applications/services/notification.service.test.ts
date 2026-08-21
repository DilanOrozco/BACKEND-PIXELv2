import test from "node:test";
import assert from "node:assert/strict";
import { EmailService } from "./email.service";
import { buildPropuestaCotizacionEnviadaTemplate } from "./email-templates";
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
      tecnica: {
        idTecnica: 2,
        nombre: "Sublimacion",
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
  assert.match(correoCliente.text, /Camiseta/);
  assert.match(correoCliente.text, /Cantidad: 2000/);
  assert.match(correoCliente.text, /equipo revisara/i);
  assert.doesNotMatch(correoCliente.text, /Precio base|Subtotal|Total final|51\.000\.000/);
  assert.match(correoStaff.subject, /Nueva solicitud de cotización/i);
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

test("NotificationService muestra todos los productos de una cotizacion multiple", async (t) => {
  delete process.env.STAFF_EMAIL;
  const sendMailMock = t.mock.method(
    EmailService.prototype,
    "sendMail",
    async () => ({ sent: true, skipped: false }),
  );

  await new NotificationService().cotizacionCreada({
    ...pedido,
    idCotizacion: 102,
    subtotal: 60026000,
    descuentoTotal: 9000000,
    total: 51026000,
    detalles: [
      {
        ...pedido.detalles[0],
        tecnica: { nombre: "DTF" },
      },
      {
        descripcion: "Gorra",
        cantidad: 2,
        precioBase: 13000,
        descuentoPorcentaje: 0,
        descuentoValorUnitario: 0,
        precioUnitario: 13000,
        subtotal: 26000,
        subtotalBruto: 26000,
        descuentoTotal: 0,
        subtotalConDescuento: 26000,
        producto: { nombre: "Gorra" },
        tecnica: { nombre: "Sublimacion" },
      },
    ],
  });
  const mail = sendMailMock.mock.calls[0]?.arguments[0];

  assert.ok(mail);
  assert.match(mail.text, /Camiseta/);
  assert.match(mail.text, /Gorra/);
  assert.doesNotMatch(mail.text, /Total final|51\.026\.000/);
  assertContenidoLimpio(mail.text);
  assertContenidoLimpio(mail.html ?? "");
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
  assert.match(correoCliente.text, /Camiseta/);
  assert.doesNotMatch(correoCliente.text, /Subtotal|Descuento aplicado|60\.000\.000/);
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

  assert.match(correoCliente.subject, /solicitud de cotización/i);
  assert.doesNotMatch(correoCliente.text, /Subtotal bruto|Valor descontado|Total final/);
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
  assert.match(mail.subject, /pedido ya está en marcha/i);
  assert.match(mail.text, /Numero de pedido: 20/i);
  assert.match(mail.text, /Tecnica: Sublimacion/);
  assert.doesNotMatch(mail.text, /cotizacion #/i);
  assert.match(mail.text, /Subtotal bruto:.*60\.000\.000/);
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
  assert.match(mail.subject, /actualizamos tu cotización/i);
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
  assert.match(mail.subject, /confirmamos tu pago/);
  assert.match(mail.text, /pedido #20/i);
  assert.match(mail.text, /Tecnica: Sublimacion/);
  assert.match(mail.text, /Total final:.*51\.000\.000/);
  assertContenidoLimpio(mail.text);
});

test("NotificationService primer abono muestra todos los productos y snapshots", async (t) => {
  const sendMailMock = t.mock.method(
    EmailService.prototype,
    "sendMail",
    async () => ({ sent: true, skipped: false }),
  );
  const pedidoMultiproducto = {
    ...pedido,
    total: 51644000,
    saldoPendiente: 25822000,
    cotizacion: {
      subtotal: 60700000,
      descuentoTotal: 9056000,
      costosAdicionales: 0,
      total: 51644000,
      detalles: [
        pedido.detalles[0],
        {
          descripcion: "Gorra",
          cantidad: 100,
          precioBase: 7000,
          descuentoPorcentaje: 8,
          descuentoValorUnitario: 560,
          precioUnitario: 6440,
          subtotalBruto: 700000,
          descuentoTotal: 56000,
          subtotalConDescuento: 644000,
          producto: { nombre: "Gorra" },
          tecnica: { nombre: "DTF" },
        },
      ],
    },
  };

  await new NotificationService().primerAbonoConfirmado({
    idAbono: 2,
    monto: 25822000,
    pedido: pedidoMultiproducto,
  });
  const mail = sendMailMock.mock.calls[0]?.arguments[0];

  assert.ok(mail);
  assert.match(mail.text, /Camiseta/);
  assert.match(mail.text, /Gorra/);
  assert.match(mail.text, /Descuento aplicado: 15%/);
  assert.match(mail.text, /Descuento aplicado: 8%/);
  assert.match(mail.text, /Subtotal bruto:.*700\.000/);
  assert.match(mail.text, /Saldo pendiente:.*25\.822\.000/);
  assert.equal(contar(mail.text, /Subtotal bruto:/g), 2);
  assertContenidoLimpio(mail.text);
  assertContenidoLimpio(mail.html ?? "");
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
  assert.match(mail.subject, /pedido está listo/);
  assert.match(mail.text, /Subtotal bruto:.*60\.000\.000/);
  assert.match(mail.text, /Total final:.*51\.000\.000/);
  assertContenidoLimpio(mail.text);
});

test("NotificationService envia eventos de produccion y entrega", async (t) => {
  const sendMailMock = t.mock.method(
    EmailService.prototype,
    "sendMail",
    async () => ({ sent: true, skipped: false }),
  );

  const enProduccion = await new NotificationService().pedidoEnProduccion({
    ...pedido,
    estadoPedido: "EN_PROCESO",
  });
  const entregado = await new NotificationService().pedidoEntregado({
    ...pedido,
    estadoPedido: "ENTREGADO",
  });
  const correoProduccion = sendMailMock.mock.calls[0]?.arguments[0];
  const correoEntrega = sendMailMock.mock.calls[1]?.arguments[0];

  assert.equal(enProduccion.event, "PEDIDO_EN_PRODUCCION");
  assert.equal(entregado.event, "PEDIDO_ENTREGADO");
  assert.ok(correoProduccion);
  assert.ok(correoEntrega);
  assert.match(correoProduccion.subject, /diseño fue aprobado.*producción/i);
  assert.match(correoProduccion.text, /Numero de pedido: 20/);
  assert.match(correoEntrega.subject, /pedido entregado/i);
  assertContenidoLimpio(correoProduccion.text);
  assertContenidoLimpio(correoEntrega.text);
});

test("NotificationService envia evento de diseno enviado para revision y pedido anulado", async (t) => {
  const sendMailMock = t.mock.method(
    EmailService.prototype,
    "sendMail",
    async () => ({ sent: true, skipped: false }),
  );
  const diseno = {
    idDiseno: 8,
    descripcion: "Propuesta camiseta negra",
    pedido,
  };

  const revision = await new NotificationService().disenoEnviadoParaRevision(diseno);
  const anulacion = await new NotificationService().pedidoAnulado(
    pedido,
    "El cliente solicito cancelar.",
  );
  const correoRevision = sendMailMock.mock.calls[0]?.arguments[0];
  const correoAnulacion = sendMailMock.mock.calls[1]?.arguments[0];

  if (!correoRevision || !correoAnulacion) {
    throw new Error("Se esperaban los correos de revision y anulacion.");
  }

  assert.equal(revision.event, "DISENO_ENVIADO_PARA_REVISION");
  assert.equal(anulacion.event, "PEDIDO_ANULADO");
  assert.match(correoRevision.subject, /diseño está listo para revisión/i);
  assert.match(correoRevision.text, /pedido #20/i);
  assert.match(correoAnulacion.subject, /actualización sobre tu pedido/i);
  assert.match(correoAnulacion.text, /cliente solicito cancelar/i);
  assertContenidoLimpio(correoRevision.text);
  assertContenidoLimpio(correoAnulacion.text);
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
  assert.match(mail.subject, /pedido está por terminar/i);
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
  assert.match(mail.text, /Subtotal bruto:.*50\.000/);
  assert.match(mail.text, /Descuento aplicado: Sin descuento \/ 0%/);
  assert.match(mail.text, /Tecnica: No especificada/);
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

test("correo de propuesta oficial muestra tecnicas y medidas sin costos internos", () => {
  const mail = buildPropuestaCotizacionEnviadaTemplate({
    cliente,
    version: {
      numeroVersion: 2,
      precioFinal: 52000,
      descuentoManual: 1000,
      costosAdicionales: 3000,
      ajusteManual: 5000,
      motivoAjusteManual: "Margen y riesgo interno.",
      validaHasta: new Date(Date.now() + 86400000),
      desgloseVisible: {
        items: [
          {
            nombre: "Camiseta",
            cantidad: 2,
            precioUnitario: 25000,
            subtotal: 50000,
            estampados: [
              {
                tecnica: { idTecnica: 1, nombre: "DTF" },
                ubicacion: "FRENTE",
                anchoCm: 10,
                altoCm: 12,
              },
            ],
          },
        ],
        disenos: [
          { descripcion: "Creacion de diseno frontal", valor: 2000 },
        ],
        conceptosAdicionales: [
          { concepto: "Transporte", valor: 1000 },
        ],
        descuentoManual: 1000,
        ajusteComercial: 5000,
      },
    },
  });

  assert.match(mail.text!, /DTF \(FRENTE, 10 x 12 cm\)/);
  assert.match(mail.html!, /Estampados y servicios/);
  assert.match(mail.html!, /DTF/);
  assert.match(mail.text!, /Creacion de diseno frontal/);
  assert.match(mail.text!, /Transporte/);
  assert.match(mail.text!, /Ajuste comercial: \$\s*5\.000/);
  assert.doesNotMatch(mail.text!, /precio sugerido|tarifa aplicada|margen/i);
  assert.doesNotMatch(mail.text!, /Margen y riesgo interno/);
  assertContenidoLimpio(mail.text!);
});
